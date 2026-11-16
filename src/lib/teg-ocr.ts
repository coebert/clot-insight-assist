import { z } from "zod";
import { EMPTY_VALUES, KEYS, validateValue, type TegValues } from "./teg-algorithm";
const Reading = z
  .object({
    channel: z.string(),
    parameter: z.string(),
    raw: z.string().nullable(),
    complete: z.boolean(),
  })
  .strict();
export const OcrSchema = z
  .object({
    device: z.literal("TEG6s"),
    cartridge: z.literal("Global Hemostasis CK CKH CRT CFF"),
    readings: z.array(Reading).max(5),
  })
  .strict();
export type ExtractResult = TegValues & { notes: string };
export function parseOcr(input: unknown): ExtractResult {
  const parsed = OcrSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "Unsupported or unreadable device/cartridge. Use original TEG 6s Global Hemostasis CK/CKH/CRT/CFF results or enter manually.",
    );
  const values = { ...EMPTY_VALUES };
  const seen = new Set<string>();
  let rejected = false;
  for (const r of parsed.data.readings) {
    const key = `${r.channel}_${r.parameter}`;
    if (!KEYS.includes(key as keyof TegValues) || seen.has(key))
      throw new Error(
        "Unsupported or duplicate channel/parameter; A5/A10 are not MA. Re-check display.",
      );
    seen.add(key);
    const k = key as keyof TegValues;
    if (
      !r.complete ||
      r.raw === null ||
      !/^\d+(?:\.\d+)?$/.test(r.raw) ||
      validateValue(k, Number(r.raw))
    ) {
      rejected = true;
      continue;
    }
    values[k] = Number(r.raw);
  }
  return {
    ...values,
    notes: rejected
      ? "Uncertain, incomplete, inequality or implausible readings omitted; verify on display."
      : "Verify every value, channel and completed reading against the display.",
  };
}
