import { useSyncExternalStore } from "react";
import {
  EMPTY_CONTEXT,
  EMPTY_VALUES,
  KEYS,
  validateAll,
  validContext,
  type ClinicalContext,
  type Population,
  type TegValues,
} from "./teg-algorithm";
export { EMPTY_VALUES };
const KEY = "clot-clarity-case-v2";
type Case = {
  values: TegValues;
  context: ClinicalContext;
  verified: string | null;
  hasValues: boolean;
  storageWarning: boolean;
};
const emptyCase = (): Case => ({
  values: { ...EMPTY_VALUES },
  context: { ...EMPTY_CONTEXT },
  verified: null,
  hasValues: false,
  storageWarning: false,
});
export function fingerprint(values: TegValues, context: ClinicalContext) {
  return JSON.stringify([
    KEYS.map((k) => values[k]),
    context.adultConfirmed,
    context.cartridgeConfirmed,
    context.population,
    context.bleeding,
    context.indication,
    context.withinThreeHours,
  ]);
}
export function createSessionStore(
  storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | null,
) {
  let current = emptyCase();
  let loaded = false;
  const listeners = new Set<() => void>();
  function read() {
    if (loaded) return current;
    loaded = true;
    try {
      const raw = storage()?.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (
          p &&
          typeof p === "object" &&
          Object.keys(p).every((k) =>
            ["values", "context", "verified", "hasValues", "storageWarning"].includes(k),
          ) &&
          validateAll(p.values).every((i) => i.severity !== "error") &&
          validContext(p.context) &&
          typeof p.hasValues === "boolean"
        ) {
          const token = fingerprint(p.values, p.context);
          current = {
            values: { ...p.values },
            context: { ...p.context },
            hasValues: p.hasValues,
            verified: p.verified === token ? token : null,
            storageWarning: false,
          };
        } else storage()?.removeItem(KEY);
      }
    } catch {
      current = { ...emptyCase(), storageWarning: true };
      try {
        storage()?.removeItem(KEY);
      } catch {
        /* Retry on every subsequent write/clear. */
      }
    }
    // Failure to clean obsolete keys must not disable persistence of this case.
    for (const old of ["teg-values-v1", "teg-population-v1"]) {
      try {
        storage()?.removeItem(old);
      } catch {
        /* Never imported. */
      }
    }
    return current;
  }
  function write(next: Case, clear = false) {
    loaded = true;
    current = { ...next, storageWarning: false };
    try {
      if (clear) storage()?.removeItem(KEY);
      else storage()?.setItem(KEY, JSON.stringify(current));
    } catch {
      current = { ...current, storageWarning: true };
      try {
        storage()?.removeItem(KEY);
      } catch {
        /* Browser refuses all storage: deletion cannot be guaranteed. */
      }
    }
    listeners.forEach((l) => l());
  }
  return {
    read,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    begin(values: TegValues) {
      write({ ...emptyCase(), values: { ...values }, hasValues: true });
    },
    saveValues(values: TegValues) {
      write({ ...read(), values: { ...values }, hasValues: true, verified: null });
    },
    saveContext(context: ClinicalContext) {
      write({ ...read(), context: { ...context }, verified: null });
    },
    verify() {
      const c = read();
      if (
        !c.hasValues ||
        validateAll(c.values).some((i) => i.severity === "error") ||
        KEYS.every((k) => c.values[k] === null) ||
        !validContext(c.context) ||
        !c.context.adultConfirmed ||
        !c.context.cartridgeConfirmed
      )
        return false;
      write({ ...c, verified: fingerprint(c.values, c.context) });
      return true;
    },
    revoke() {
      write({ ...read(), verified: null });
    },
    isVerified() {
      const c = read();
      return (
        c.verified !== null &&
        c.verified === fingerprint(c.values, c.context) &&
        c.hasValues &&
        validContext(c.context) &&
        !validateAll(c.values).some((i) => i.severity === "error") &&
        c.context.adultConfirmed &&
        c.context.cartridgeConfirmed &&
        KEYS.some((k) => c.values[k] !== null)
      );
    },
    clear() {
      write(emptyCase(), true);
    },
  };
}
// No mutable case store exists on the server. Future server callers cannot share patient context.
let browserSession: ReturnType<typeof createSessionStore> | undefined;
function session() {
  if (typeof window === "undefined") return undefined;
  browserSession ??= createSessionStore(() => window.sessionStorage);
  return browserSession;
}
export const beginCase = (v: TegValues) => session()?.begin(v);
export const saveValues = (v: TegValues) => session()?.saveValues(v);
export const loadValues = () => session()?.read().values ?? { ...EMPTY_VALUES };
export const hasSavedValues = () => session()?.read().hasValues ?? false;
export const clearValues = () => session()?.clear();
export const saveContext = (c: ClinicalContext) => session()?.saveContext(c);
export const savePopulation = (p: Population) => {
  const s = session();
  if (s) s.saveContext({ ...s.read().context, population: p });
};
export const loadPopulation = () => session()?.read().context.population ?? "standard";
export const verifyCase = () => session()?.verify() ?? false;
export const revokeVerification = () => session()?.revoke();
export const isCaseVerified = () => session()?.isVerified() ?? false;
const SERVER = Object.freeze({
  ...emptyCase(),
  values: Object.freeze({ ...EMPTY_VALUES }),
  context: Object.freeze({ ...EMPTY_CONTEXT }),
});
const subscribe = (listener: () => void) => session()?.subscribe(listener) ?? (() => {});
const snapshot = () => session()?.read() ?? SERVER;
export function useTegSession() {
  const state = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  return { ...state, population: state.context.population };
}
