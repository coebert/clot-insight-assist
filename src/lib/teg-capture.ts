import { EMPTY_VALUES, KEYS, validateAll, type TegValues } from "./teg-algorithm";
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export function validatePhoto(file: { type: string; size: number }) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES)
    throw new Error("Photo must be non-empty and no larger than 10 MB.");
}
export function coherentFrame(previous: TegValues | null, current: TegValues): TegValues | null {
  if (
    validateAll(current).some((i) => i.severity === "error") ||
    KEYS.filter((k) => current[k] !== null).length < 3 ||
    !previous
  )
    return null;
  // Same complete set of visible parameters, exact readings, consecutive frames.
  // No tolerance or rolling accumulation across different screens/patients.
  return KEYS.every((k) => previous[k] === current[k]) ? { ...current } : null;
}
export class CaptureRun {
  private generation = 0;
  private controller = new AbortController();
  get signal() {
    return this.controller.signal;
  }
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cancelPending = new Set<() => void>();
  stop() {
    this.controller.abort();
    this.generation++;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.cancelPending.forEach((cancel) => cancel());
    this.cancelPending.clear();
  }
  start() {
    this.stop();
    this.controller = new AbortController();
    return this.generation;
  }
  alive(token: number) {
    return token === this.generation;
  }
  async camera(token: number, acquire: () => Promise<MediaStream>) {
    let expired = false;
    const pending = acquire().then((stream) => {
      if (expired || !this.alive(token)) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      return stream;
    });
    let stream: MediaStream | null;
    try {
      stream = await this.wait(token, () => pending);
    } catch (error) {
      expired = true;
      if (!this.alive(token)) return null;
      throw error;
    }
    if (!stream) return null;
    if (!this.alive(token)) {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }
    return stream;
  }
  later(token: number, fn: () => void, ms: number) {
    this.timer = setTimeout(() => {
      if (this.alive(token)) fn();
    }, ms);
  }
  async wait<T>(token: number, operation: () => Promise<T>, ms = 45_000): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: () => void = () => {};
    try {
      if (!this.alive(token)) throw new Error("Capture cancelled.");
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          cancel = () => reject(new Error("Capture cancelled."));
          this.cancelPending.add(cancel);
          timer = setTimeout(() => {
            this.controller.abort();
            reject(new Error("Reading timed out. Retry or enter manually."));
          }, ms);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      this.cancelPending.delete(cancel);
    }
  }
}
export function extractValues(result: TegValues): TegValues {
  const values = Object.fromEntries(KEYS.map((k) => [k, result?.[k]]));
  if (validateAll(values).some((i) => i.severity === "error"))
    throw new Error("Invalid extracted readings. Re-check display or enter manually.");
  return values as TegValues;
}
export const blankFrame = () => ({ ...EMPTY_VALUES });
