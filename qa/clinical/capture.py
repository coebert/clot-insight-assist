import asyncio,json
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright,expect
D=Path("/tmp/browser/clinical-qa")
D.mkdir(parents=True,exist_ok=True)
Image.new('RGB',(900,600),'gray').save(D/'synthetic.png')
NORMAL={'CK_R':6,'CKH_R':6,'CRT_MA':60,'CFF_MA':22,'CK_LY30':1,'notes':'Synthetic only'}
REPORT=[]
MOCK='''() => {
 window.stopped=0; window.acquired=0;
 navigator.mediaDevices.getUserMedia=async()=>{window.acquired++;if(window.mediaMode==='denied')throw Error('Synthetic permission denied');if(window.mediaMode==='late')await new Promise(r=>window.resolveMedia=r);return {getTracks:()=>[{stop:()=>window.stopped++}]};};
 Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{get(){return this._src},set(v){this._src=v},configurable:true});
 Object.defineProperty(HTMLVideoElement.prototype,'videoWidth',{get:()=>900,configurable:true});Object.defineProperty(HTMLVideoElement.prototype,'videoHeight',{get:()=>600,configurable:true});
 HTMLMediaElement.prototype.play=async()=>{};
 const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(source instanceof HTMLVideoElement){this.fillRect(0,0,900,600);return;}return original.call(this,source,...args);};
 const timeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===2500?20:ms===45000?200:ms,...args);
}'''
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True)
  for width,height,label in [(1280,1800,'desktop'),(390,844,'mobile')]:
   c=await b.new_context(viewport={'width':width,'height':height});page=await c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   mode='success';calls=[];pending=[];frames=[]
   async def intercept(route):
    nonlocal mode
    calls.append(route.request.url)
    if mode=='pending':
     pending.append(route);return
    if mode=='failure':await route.fulfill(status=200,content_type='application/json',body=json.dumps({'error':{'message':'Synthetic upstream unavailable'},'result':None}));return
    if mode=='invalid':values={**NORMAL,'CK_R':'bad'}
    elif mode=='empty':values={k:None for k in NORMAL if k!='notes'}
    elif mode=='coherent':values=frames.pop(0) if frames else NORMAL
    else:values=NORMAL
    await route.fulfill(status=200,content_type='application/json',body=json.dumps({'result':values}))
   await page.route('**/*',lambda r:intercept(r) if r.request.headers.get('x-tsr-serverfn')=='true' else r.continue_())
   async def open_capture():
    await page.goto('http://localhost:8080/capture',wait_until='networkidle');await page.evaluate(MOCK);await page.get_by_role('checkbox',name='I consent').check()
   async def shoot(name):await page.get_by_role('alert').scroll_into_view_if_needed();await page.screenshot(path=str(D/f'{label}-capture-{name}.png'))
   await open_capture();await page.evaluate("window.mediaMode='denied'");await page.get_by_role('button',name='Start auto-scan').click();await expect(page.get_by_role('alert')).to_contain_text('permission denied');await shoot('denied');REPORT.append(f'{label}: permission denial visible; manual available')
   await page.get_by_role('button',name='Try auto-scan again').click();await expect(page.get_by_role('alert')).to_be_visible()
   await page.evaluate("window.mediaMode='late'");await page.get_by_role('button',name='Try auto-scan again').click();await expect(page.get_by_role('button',name='Stop',exact=True)).to_be_visible();await page.get_by_role('button',name='Stop',exact=True).click();await page.evaluate('window.resolveMedia()');await page.wait_for_timeout(50);assert await page.evaluate('window.stopped')==1;REPORT.append(f'{label}: late getUserMedia after stop closes tracks')
   await page.get_by_role('button',name='Start auto-scan').click();await page.get_by_role('button',name='Enter manually').click();await page.evaluate('window.resolveMedia()');await page.wait_for_timeout(50);assert await page.evaluate('window.stopped')==2;await expect(page.get_by_role('heading',name='Confirm values')).to_be_visible();REPORT.append(f'{label}: late getUserMedia after unmount closes tracks')
   await open_capture();mode='pending';calls.clear();await page.set_input_files('input[type=file]',str(D/'synthetic.png'))
   for _ in range(30):
    if pending:break
    await page.wait_for_timeout(10)
   assert pending;await page.get_by_role('button',name='Enter manually').click();await pending.pop().fulfill(status=200,content_type='application/json',body=json.dumps({'result':NORMAL}));await page.wait_for_timeout(650);await expect(page.get_by_role('spinbutton',name='CK.R',exact=True)).to_have_value('');REPORT.append(f'{label}: photo cancellation by manual cannot save/navigate stale values')
   await open_capture();mode='pending';await page.set_input_files('input[type=file]',str(D/'synthetic.png'))
   for _ in range(30):
    if pending:break
    await page.wait_for_timeout(10)
   await page.get_by_role('button',name='Stop',exact=True).click();mode='success';await page.set_input_files('input[type=file]',str(D/'synthetic.png'));await page.wait_for_timeout(50)
   if pending:await pending.pop().fulfill(status=200,content_type='application/json',body=json.dumps({'result':{**NORMAL,'CK_R':18}}))
   await expect(page.get_by_role('heading',name='Confirm values')).to_be_visible();await expect(page.get_by_role('spinbutton',name='CK.R',exact=True)).to_have_value('6');await expect(page.get_by_role('checkbox',name='Adult patient')).not_to_be_checked();REPORT.append(f'{label}: restarted photo discards stale completion and starts clean context')
   await open_capture();mode='failure';calls.clear();await page.get_by_role('button',name='Start auto-scan').click();await expect(page.get_by_role('alert')).to_be_visible();assert len(calls)==1;await page.wait_for_timeout(100);assert len(calls)==1;REPORT.append(f'{label}: persistent upstream failure stops after first call; visible retry/manual')
   await page.get_by_role('button',name='Try auto-scan again').click();await expect(page.get_by_role('alert')).to_be_visible();assert len(calls)==2
   mode='empty';calls.clear();await page.get_by_role('button',name='Try auto-scan again').click();await expect(page.get_by_role('alert')).to_contain_text('8 frames',timeout=5000);assert len(calls)==8;await shoot('retry-cap');REPORT.append(f'{label}: eight incoherent/empty frames capped with visible error')
   mode='coherent';calls.clear();frames=[{**NORMAL,'CFF_MA':None},{**NORMAL,'CK_R':None},NORMAL,NORMAL];await page.get_by_role('button',name='Try auto-scan again').click();await expect(page.get_by_role('heading',name='Confirm values')).to_be_visible();assert len(calls)==4;await expect(page.get_by_role('spinbutton',name='CFF.MA',exact=True)).to_have_value('22');REPORT.append(f'{label}: partial different screens do not merge; two coherent full frames confirm')
   await open_capture();mode='success';calls.clear();await page.set_input_files('input[type=file]',{'name':'bad.txt','mimeType':'text/plain','buffer':b'bad'});await expect(page.get_by_role('alert')).to_contain_text('JPEG');assert len(calls)==0;REPORT.append(f'{label}: invalid photo rejected before cloud call')
   mode='invalid';await page.set_input_files('input[type=file]',str(D/'synthetic.png'));await expect(page.get_by_role('alert')).to_contain_text('Invalid extracted');REPORT.append(f'{label}: malformed OCR result rejected at capture boundary')
   mode='pending';await page.set_input_files('input[type=file]',str(D/'synthetic.png'));await expect(page.get_by_role('alert')).to_contain_text('timed out',timeout=5000);await shoot('timeout');REPORT.append(f'{label}: stalled photo response times out with manual/retry')
   assert not errors,errors;REPORT.append(f'{label}: zero uncaught browser errors in mocked capture');
   for r in pending:
    try:await r.abort()
    except Exception:pass
   pending.clear();await page.unroute_all(behavior='wait');await c.close()
  await b.close()
 D.joinpath('capture-results.json').write_text(json.dumps(REPORT,indent=2));print('\n'.join(REPORT))
asyncio.run(main())
