// Client-side session-only store. Nothing is persisted to a database.
import { EMPTY_VALUES, type Population, type TegValues } from "./teg-algorithm";

// Re-export so existing `import { EMPTY_VALUES } from "@/lib/teg-store"`
// call sites keep working while the canonical definition lives with the schema.
export { EMPTY_VALUES };

const KEY = "teg-values-v1";
const POP_KEY = "teg-population-v1";

export function hasSavedValues(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) !== null;
}


export function saveValues(v: TegValues) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(v));
}

export function loadValues(): TegValues {
  if (typeof window === "undefined") return EMPTY_VALUES;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_VALUES;
    return { ...EMPTY_VALUES, ...JSON.parse(raw) };
  } catch {
    return EMPTY_VALUES;
  }
}

export function clearValues() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(POP_KEY);
}

export function savePopulation(p: Population) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(POP_KEY, p);
}

export function loadPopulation(): Population {
  if (typeof window === "undefined") return "standard";
  return sessionStorage.getItem(POP_KEY) === "pregnant" ? "pregnant" : "standard";
}

const DISCLAIMER_KEY = "teg-disclaimer-ack-v1";
export function hasAckDisclaimer() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(DISCLAIMER_KEY) === "1";
}
export function ackDisclaimer() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DISCLAIMER_KEY, "1");
}
