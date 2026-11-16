import { useSyncExternalStore } from "react";
import { EMPTY_CONTEXT, EMPTY_VALUES, KEYS, validateAll, validContext, type ClinicalContext, type Population, type TegValues } from "./teg-algorithm";
export { EMPTY_VALUES };
const KEY = "clot-clarity-case-v2";
type Case = { values: TegValues; context: ClinicalContext; verified: string | null; hasValues: boolean };
const emptyCase = (): Case => ({ values: { ...EMPTY_VALUES }, context: { ...EMPTY_CONTEXT }, verified: null, hasValues: false });
export function fingerprint(values: TegValues, context: ClinicalContext) { return JSON.stringify([KEYS.map(k => values[k]), context.adultConfirmed, context.cartridgeConfirmed, context.population, context.bleeding, context.indication, context.withinThreeHours]); }
export function createSessionStore(storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | null) {
  let current = emptyCase();
  let loaded = false;
  let storageFailed = false;
  const listeners = new Set<() => void>();
  function read() {
    if (loaded) return current;
    loaded = true;
    try {
      const raw = storage()?.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length === 4 && validateAll(parsed.values).every(i => i.severity !== "error") && validContext(parsed.context) && typeof parsed.hasValues === "boolean") {
          const token = fingerprint(parsed.values, parsed.context);
          current = { values: { ...parsed.values }, context: { ...parsed.context }, hasValues: parsed.hasValues, verified: parsed.verified === token ? token : null };
        } else storage()?.removeItem(KEY);
      }
      // Deliberately never migrate old unverified values or patient context.
      for (const old of ["teg-values-v1", "teg-population-v1"]) storage()?.removeItem(old);
    } catch { storageFailed = true; }
    return current;
  }
  function write(next: Case) {
    loaded = true;
    current = next;
    if (!storageFailed) {
      try { storage()?.setItem(KEY, JSON.stringify(current)); }
      catch {
        storageFailed = true;
        // Remove any previously saved case; failed writes must not resurrect it.
        try { storage()?.removeItem(KEY); } catch { /* blocked storage: in-memory only */ }
      }
    }
    listeners.forEach(l => l());
  }
  return {
    read,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    saveValues(values: TegValues) { const c = read(); write({ ...c, values: { ...values }, hasValues: true, verified: null }); },
    saveContext(context: ClinicalContext) { const c = read(); write({ ...c, context: { ...context }, verified: null }); },
    verify() {
      const c = read();
      if (!c.hasValues || validateAll(c.values).some(i => i.severity === "error") || KEYS.every(k => c.values[k] === null) || !validContext(c.context) || !c.context.adultConfirmed || !c.context.cartridgeConfirmed) return false;
      write({ ...c, verified: fingerprint(c.values, c.context) }); return true;
    },
    revoke() { write({ ...read(), verified: null }); },
    isVerified() { const c = read(); return c.verified !== null && c.verified === fingerprint(c.values, c.context) && c.hasValues && !validateAll(c.values).some(i => i.severity === "error") && c.context.adultConfirmed && c.context.cartridgeConfirmed && KEYS.some(k => c.values[k] !== null); },
    clear() { write(emptyCase()); },
  };
}
const session = createSessionStore(() => typeof window === "undefined" ? null : window.sessionStorage);
export const saveValues = (v: TegValues) => session.saveValues(v);
export const loadValues = () => typeof window === "undefined" ? EMPTY_VALUES : session.read().values;
export const hasSavedValues = () => typeof window !== "undefined" && session.read().hasValues;
export const clearValues = () => session.clear();
export const saveContext = (c: ClinicalContext) => session.saveContext(c);
export const savePopulation = (p: Population) => session.saveContext({ ...session.read().context, population: p });
export const loadPopulation = () => session.read().context.population;
export const verifyCase = () => session.verify();
export const revokeVerification = () => session.revoke();
export const isCaseVerified = () => typeof window !== "undefined" && session.isVerified();
let acknowledged = false;
export const ackDisclaimer = () => { acknowledged = true; };
export const hasAckDisclaimer = () => acknowledged;
const SERVER = emptyCase();
export function useTegSession() {
  const snapshot = useSyncExternalStore(session.subscribe, session.read, () => SERVER);
  return { ...snapshot, population: snapshot.context.population };
}
