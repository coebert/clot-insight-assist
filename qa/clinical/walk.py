import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright,expect
DIR=Path("/tmp/browser/clinical-qa")
DIR.mkdir(parents=True,exist_ok=True)
REPORT=[]
NORMAL=[6,6,60,22,1]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width,height,label in [(1280,1800,'desktop'),(390,844,'mobile')]:
   context=await browser.new_context(viewport={'width':width,'height':height})
   page=await context.new_page(); errors=[]
   page.on('pageerror',lambda e: errors.append(str(e)))
   page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
   page.on('dialog',lambda d: d.accept())
   async def shot(name):
    await page.screenshot(path=str(DIR/f'{label}-{name}.png'))
    assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'horizontal overflow'
   async def manual():
    await page.goto('http://localhost:8080/',wait_until='networkidle'); await page.get_by_role('button',name='I understand').click(); await page.get_by_role('button',name='Enter manually',exact=True).click(); await expect(page.get_by_role('heading',name='Confirm values')).to_be_visible()
   async def fill(vals):
    for field,val in zip(['CK.R','CKH.R','CRT.MA','CFF.MA','CK.LY30'],vals): await page.get_by_role('spinbutton',name=field,exact=True).fill('' if val is None else str(val))
   async def gates():
    await page.get_by_role('checkbox',name='Adult patient').check(); await page.get_by_role('checkbox',name='Original TEG').check()
   async def verify():
    await page.get_by_role('checkbox',name='I verified').check(); await page.get_by_role('button',name='View interpretation',exact=True).click(); await expect(page.get_by_role('heading',name='Interpretation',exact=True)).to_be_visible()
   await page.goto('http://localhost:8080/results'); await expect(page).to_have_url('http://localhost:8080/capture'); REPORT.append(f'{label}: empty results deep link blocked')
   await manual(); await expect(page.get_by_role('checkbox',name='I verified')).to_be_disabled(); await gates(); await expect(page.get_by_role('checkbox',name='I verified')).to_be_disabled(); REPORT.append(f'{label}: empty input blocked')
   await fill(NORMAL); await page.get_by_role('checkbox',name='Adult patient').uncheck(); await expect(page.get_by_role('checkbox',name='I verified')).to_be_disabled(); await page.get_by_role('checkbox',name='Adult patient').check(); await page.get_by_role('checkbox',name='Original TEG').uncheck(); await expect(page.get_by_role('checkbox',name='I verified')).to_be_disabled(); await page.get_by_role('checkbox',name='Original TEG').check(); REPORT.append(f'{label}: adult/cartridge gates')
   await page.goto('http://localhost:8080/results'); await expect(page).to_have_url('http://localhost:8080/review'); REPORT.append(f'{label}: unverified direct results blocked')
   await verify(); await expect(page.get_by_text('No configured threshold crossed;',exact=False)).to_be_visible(); await shot('normal'); await page.reload(); await expect(page.get_by_role('heading',name='Interpretation',exact=True)).to_be_visible(); REPORT.append(f'{label}: normal, verified reload')
   await page.get_by_role('link',name='Edit values').click()
   for field,val in zip(['CK.R','CKH.R','CRT.MA','CFF.MA','CK.LY30'],[7,7,61,23,1.1]):
    await page.get_by_role('checkbox',name='I verified').check(); await page.get_by_role('spinbutton',name=field,exact=True).fill(str(val)); await expect(page.get_by_role('checkbox',name='I verified')).not_to_be_checked(); await expect(page.get_by_role('button',name='View interpretation',exact=True)).to_be_disabled()
   for name in ['Adult patient','Original TEG','Patient is pregnant']:
    await page.get_by_role('checkbox',name='I verified').check(); await page.get_by_role('checkbox',name=name).click(); await expect(page.get_by_role('checkbox',name='I verified')).not_to_be_checked(); await page.get_by_role('checkbox',name=name).click()
   for name in ['Active significant bleeding','Trauma']:
    await page.get_by_role('checkbox',name='I verified').check(); await page.get_by_role('radio',name=name,exact=True).check(); await expect(page.get_by_role('checkbox',name='I verified')).not_to_be_checked()
   await page.get_by_role('checkbox',name='I verified').check(); await page.get_by_role('radio',name='yes',exact=True).check(); await expect(page.get_by_role('checkbox',name='I verified')).not_to_be_checked(); REPORT.append(f'{label}: every value and all six context edits revoke verification')
   await fill([16,12,40,8,10]); await verify(); await expect(page.get_by_text('both MA low:',exact=False)).to_be_visible(); await expect(page.get_by_text('For confirmed bleeding trauma',exact=False)).to_be_visible(); await shot('mixed-trauma'); REPORT.append(f'{label}: mixed deficits, trauma within 3h, normal/abnormal TXA independence')
   await page.get_by_role('link',name='Edit values').click(); await page.get_by_role('radio',name='no',exact=True).check(); await verify(); await expect(page.get_by_text('Timing is outside this window',exact=False)).to_be_visible(); REPORT.append(f'{label}: late trauma no automatic TXA')
   await page.get_by_role('link',name='Edit values').click(); await page.get_by_role('radio',name='Other / not established',exact=True).check(); await page.get_by_role('checkbox',name='Patient is pregnant').check(); await verify(); await expect(page.get_by_text('For confirmed',exact=False)).to_have_count(0); await expect(page.get_by_text('no validated local obstetric algorithm configured',exact=False).first).to_be_visible(); await shot('pregnancy'); REPORT.append(f'{label}: pregnancy alone no PPH guidance or products')
   await page.get_by_role('link',name='Edit values').click(); await page.get_by_role('radio',name='Confirmed postpartum',exact=False).check(); await page.get_by_role('radio',name='yes',exact=True).check(); await fill([6,6,60,22,0]); await verify(); await expect(page.get_by_text('For confirmed postpartum haemorrhage',exact=False)).to_be_visible(); await shot('pph'); REPORT.append(f'{label}: confirmed PPH within3h despite LY30 zero, no doses')
   for bleeding in ['Not bleeding','Unknown']:
    await page.get_by_role('link',name='Edit values').click(); await fill([14,12,40,22,10]); await page.get_by_role('radio',name=bleeding,exact=True).check(); await verify(); await expect(page.get_by_text('Consider plasma',exact=False)).to_have_count(0); await expect(page.get_by_text('Consider platelets',exact=False)).to_have_count(0); REPORT.append(f'{label}: {bleeding} abnormal findings only')
   await page.get_by_role('link',name='Edit values').click(); await fill([14,None,40,None,None]); await verify(); await expect(page.get_by_text('heparin comparison and plasma branch unavailable',exact=False)).to_be_visible(); await shot('partial'); REPORT.append(f'{label}: partial unavailable assessments')
   await page.get_by_role('link',name='Edit values').click(); await fill([61,6,60,22,1]); await expect(page.get_by_role('checkbox',name='I verified')).to_be_disabled(); await shot('invalid'); REPORT.append(f'{label}: out-of-range blocks')
   await fill(NORMAL); await page.reload(); await expect(page.get_by_role('spinbutton',name='CK.R',exact=True)).to_have_value('6'); await page.get_by_role('link',name='Back to capture').click(); await page.get_by_role('button',name='Enter manually').click(); await expect(page.get_by_role('spinbutton',name='CK.R',exact=True)).to_have_value('6'); REPORT.append(f'{label}: back/manual preserves intentional edits')
   await page.get_by_role('button',name='Discard and start over').click(); await page.get_by_role('button',name='Enter manually').click(); await expect(page.get_by_role('spinbutton',name='CK.R',exact=True)).to_have_value(''); await expect(page.get_by_role('checkbox',name='Patient is pregnant')).not_to_be_checked(); await expect(page.get_by_role('checkbox',name='Adult patient')).not_to_be_checked(); REPORT.append(f'{label}: reset/new case clears values and all context')
   await fill([14,6,60,22,0]); await gates(); await page.get_by_role('radio',name='Active significant bleeding').check(); await verify(); await expect(page.get_by_text('Suspected heparin effect',exact=True)).to_be_visible(); await expect(page.get_by_text('Consider plasma',exact=False)).to_have_count(0)
   await page.evaluate('window.printCalls=0;window.print=()=>window.printCalls++'); await page.get_by_role('button',name='Print / Save as PDF').click(); await page.wait_for_timeout(100); assert await page.evaluate('window.printCalls')>=1; await page.emulate_media(media='print'); await shot('print'); await page.pdf(path=str(DIR/f'{label}-print.pdf')); await page.emulate_media(media='screen'); REPORT.append(f'{label}: heparin correction, print handler and PDF')
   await page.goto('http://localhost:8080/algorithm'); await expect(page.locator('.mermaid-host svg')).to_have_count(3,timeout=30000); await page.get_by_placeholder('Search by keyword').fill('combined deficits'); await expect(page.get_by_text('1 rule and 1 source match.')).to_be_visible(); await expect(page.get_by_role('heading',name='Reduced clot strength')).to_be_visible(); await shot('reference-search'); await page.get_by_role('button',name='Clear search').click(); await page.get_by_placeholder('Search by keyword').fill('nonexistent-query'); await expect(page.get_by_text('No rules match your search.')).to_be_visible(); await page.get_by_role('button',name='Clear search').click(); await shot('diagrams'); await page.goto('http://localhost:8080/rules'); await expect(page.get_by_text('15 – 32 mm',exact=True)).to_be_visible(); await shot('rules'); REPORT.append(f'{label}: 3 diagrams, label-only search count, clear/no match, interval rules')
   assert not errors, errors
   REPORT.append(f'{label}: zero console/page errors'); await context.close()
  await browser.close()
 DIR.joinpath('results.json').write_text(json.dumps(REPORT,indent=2)); print('\n'.join(REPORT))
asyncio.run(main())
