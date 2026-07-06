import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PLAUSIBLE, type TegValues } from "./teg-algorithm";

const REQUEST_TIMEOUT_MS = 30_000;
const AI_MODEL = "google/gemini-3-flash-preview";
const AI_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";



const InputSchema = z.object({
  imageDataUrl: z
    .string()
    .startsWith("data:image/")
    .max(15_000_000, "Image too large (max ~15MB)"),
});

const numOrNull = z.union([z.number(), z.null()]);

const ResultSchema = z.object({
  CK_R: numOrNull,
  CKH_R: numOrNull,
  CRT_MA: numOrNull,
  CFF_MA: numOrNull,
  CK_LY30: numOrNull,
  notes: z.string().optional(),
});

export type ExtractResult = z.infer<typeof ResultSchema>;

export const extractTegValues = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ExtractResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a vision system that reads numeric values from a photograph of a Haemonetics TEG 6s thromboelastograph display.
Locate the results panel (typically labelled with CK, CKH, CRT, CFF channels) and return the following parameters as numbers:
- CK_R   (Citrated Kaolin R time, in minutes)
- CKH_R  (Citrated Kaolin + Heparinase R time, in minutes)
- CRT_MA (Citrated RapidTEG Maximum Amplitude, in mm)
- CFF_MA (Citrated Functional Fibrinogen MA, in mm)
- CK_LY30 (Lysis at 30 min from the CK channel, percent)

Return null for any value you cannot read with high confidence. Do NOT guess. Do NOT interpret the values clinically. Only extract numbers.
Respond ONLY with a JSON object matching this exact shape:
{"CK_R": number|null, "CKH_R": number|null, "CRT_MA": number|null, "CFF_MA": number|null, "CK_LY30": number|null, "notes": string}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(AI_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the TEG 6s parameters from this image. Return JSON only.",
                },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("AI request timed out. Please try again or enter values manually.");
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }


    if (res.status === 429) {
      throw new Error("Rate limit exceeded — please try again in a moment.");
    }
    if (res.status === 402) {
      throw new Error(
        "AI credits exhausted for this workspace. Add credits in Settings → Workspace → Usage.",
      );
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway error (${res.status}): ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Model returned non-JSON output. Please enter values manually.");
    }
    const result = ResultSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("Model returned an unexpected shape. Please enter values manually.");
    }
    // Defensive scrub: any value the model returned that is outside the
    // physiologically plausible range is almost certainly an OCR mistake.
    // Null it out so the clinician must enter it manually rather than
    // accidentally confirm a misread number.
    const scrubbed = { ...result.data };
    (Object.keys(PLAUSIBLE) as (keyof TegValues)[]).forEach((k) => {
      const val = scrubbed[k];
      if (val === null || val === undefined) return;
      const [lo, hi] = PLAUSIBLE[k];
      if (!Number.isFinite(val) || val < lo || val > hi) {
        scrubbed[k] = null;
      }
    });
    return scrubbed;
  });

