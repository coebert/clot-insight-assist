// Client-side session-only store for the current TEG case.
// Nothing is persisted to a database — sessionStorage is intentional so the
// data disappears when the tab closes.
//
// Components read/write through `useTegSession()`, which subscribes to a
// tiny in-module event bus so every mounted screen stays in sync. The
// primitive `save*`/`load*` helpers remain for one-off callers (server-fn
// results, route guards) that don't need to subscribe.

import { useSyncExternalStore } from "react";
import { EMPTY_VALUES, type Population, type TegValues } from "./teg-algorithm";

// Re-export so existing `import { EMPTY_VALUES } from "@/lib/teg-store"`
// call sites keep working while the canonical definition lives with the schema.
export { EMPTY_VALUES };

const VALUES_KEY = "teg-values-v1";
const POP_KEY = "teg-population-v1";
const DISCLAIMER_KEY = "teg-disclaimer-ack-v1";

// ---------------------------------------------------------------------------
// Tiny pub/sub so mounted `useTegSession` consumers see updates from siblings
// without a full context provider. sessionStorage doesn't fire `storage`
// events for the same tab, hence the manual bus.
// ---------------------------------------------------------------------------
type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------------------------------------------------------------------------
// Primitive read/write helpers — safe on the server (return sensible empties).
// ---------------------------------------------------------------------------
export function hasSavedValues(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(VALUES_KEY) !== null;
}

export function saveValues(v: TegValues) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(VALUES_KEY, JSON.stringify(v));
  emit();
}

export function loadValues(): TegValues {
  if (typeof window === "undefined") return EMPTY_VALUES;
  try {
    const raw = sessionStorage.getItem(VALUES_KEY);
    if (!raw) return EMPTY_VALUES;
    return { ...EMPTY_VALUES, ...JSON.parse(raw) };
  } catch {
    return EMPTY_VALUES;
  }
}

export function clearValues() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(VALUES_KEY);
  sessionStorage.removeItem(POP_KEY);
  emit();
}

export function savePopulation(p: Population) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(POP_KEY, p);
  emit();
}

export function loadPopulation(): Population {
  if (typeof window === "undefined") return "standard";
  return sessionStorage.getItem(POP_KEY) === "pregnant" ? "pregnant" : "standard";
}

export function hasAckDisclaimer() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(DISCLAIMER_KEY) === "1";
}
export function ackDisclaimer() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DISCLAIMER_KEY, "1");
  emit();
}

// ---------------------------------------------------------------------------
// Reactive hook. Cached snapshots keep `useSyncExternalStore` happy — the
// contract requires reference equality across renders when nothing changed.
// ---------------------------------------------------------------------------
type Snapshot = {
  values: TegValues;
  population: Population;
  hasValues: boolean;
};

let cached: Snapshot | null = null;
function getSnapshot(): Snapshot {
  const values = loadValues();
  const population = loadPopulation();
  const hasValues = hasSavedValues();
  if (
    cached &&
    cached.population === population &&
    cached.hasValues === hasValues &&
    shallowEqValues(cached.values, values)
  ) {
    return cached;
  }
  cached = { values, population, hasValues };
  return cached;
}

function shallowEqValues(a: TegValues, b: TegValues): boolean {
  return (
    a.CK_R === b.CK_R &&
    a.CKH_R === b.CKH_R &&
    a.CRT_MA === b.CRT_MA &&
    a.CFF_MA === b.CFF_MA &&
    a.CK_LY30 === b.CK_LY30
  );
}

const EMPTY_SNAPSHOT: Snapshot = {
  values: EMPTY_VALUES,
  population: "standard",
  hasValues: false,
};
function getServerSnapshot(): Snapshot {
  return EMPTY_SNAPSHOT;
}

/**
 * Reactive read of the current TEG session. Any `saveValues`,
 * `savePopulation`, or `clearValues` call re-renders every consumer.
 */
export function useTegSession(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
