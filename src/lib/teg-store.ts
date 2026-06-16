// Client-side session-only store. Nothing is persisted to a database.
import type { TegValues } from "./teg-algorithm";

const KEY = "teg-values-v1";

export const EMPTY_VALUES: TegValues = {
  CK_R: null,
  CKH_R: null,
  CRT_MA: null,
  CFF_MA: null,
  CK_LY30: null,
};

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
