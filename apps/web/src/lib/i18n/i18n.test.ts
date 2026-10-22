import { describe, expect, it } from "vitest";
import { messagesEn } from "./messages-en.ts";
import { messagesEs } from "./messages-es.ts";

/** Every leaf path with its kind, e.g. "errors.table-full: string". */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => shape(child, path === "" ? key : `${path}.${key}`));
  }
  return [`${path}: ${typeof value}`];
}

function isMessageFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

/** Calls message functions with sample arguments so their output is checked too (non-strings fail). */
function leaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (isMessageFunction(value)) {
    const out = value("Ana", 3);
    return [typeof out === "string" ? out : ""];
  }
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(leaves);
  return [];
}

describe("translations", () => {
  it("English has exactly the same keys and kinds as Spanish", () => {
    expect(shape(messagesEn)).toEqual(shape(messagesEs));
  });

  it("no message is empty, in either language", () => {
    for (const text of [...leaves(messagesEs), ...leaves(messagesEn)]) expect(text.trim()).not.toBe("");
  });

  it("the two languages differ (English is actually translated)", () => {
    expect(messagesEn.rotateTitle).not.toBe(messagesEs.rotateTitle);
    expect(messagesEn.errors["table-full"]).not.toBe(messagesEs.errors["table-full"]);
  });
});
