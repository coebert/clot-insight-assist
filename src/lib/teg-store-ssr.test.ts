import { expect, it } from "vitest";
import {
  beginCase,
  clearValues,
  loadValues,
  loadPopulation,
  saveContext,
  savePopulation,
  saveValues,
  verifyCase,
  hasSavedValues,
  isCaseVerified,
} from "./teg-store";
import { EMPTY_VALUES, EMPTY_CONTEXT } from "./teg-algorithm";
it("server mutations cannot affect another request or poison browser session", () => {
  beginCase({ ...EMPTY_VALUES, CK_R: 14 });
  saveValues({ ...EMPTY_VALUES, CK_R: 22 });
  savePopulation("pregnant");
  saveContext({ ...EMPTY_CONTEXT, population: "pregnant" });
  expect(loadValues()).toEqual(EMPTY_VALUES);
  expect(loadPopulation()).toBe("standard");
  expect(hasSavedValues()).toBe(false);
  expect(verifyCase()).toBe(false);
  expect(isCaseVerified()).toBe(false);
  clearValues();
  expect(loadValues()).toEqual(EMPTY_VALUES);
});
