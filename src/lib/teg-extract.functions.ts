import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
export type { ExtractResult } from "./teg-ocr";
const InputSchema = z
  .object({
    imageDataUrl: z
      .string()
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
      .max(4_000_000),
    cloudConsent: z.literal(true),
  })
  .strict();
export const extractTegValues = createServerFn({ method: "POST" })
  .validator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Photo reading is not configured. Enter manually.");
    const { requestOcr } = await import("./teg-extract.server");
    return requestOcr(data.imageDataUrl, key, fetch, 30_000, getRequest().signal);
  });
