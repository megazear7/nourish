import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeReturnPath } from "./util.auth.js";

describe("safeReturnPath", () => {
  it("keeps an in-app path", () => {
    assert.equal(
      safeReturnPath("/competitions/11111111-1111-4111-8111-111111111111"),
      "/competitions/11111111-1111-4111-8111-111111111111",
    );
  });

  it("rejects anything that is not a same-origin path", () => {
    assert.equal(safeReturnPath("https://evil.example/competitions"), null);
    assert.equal(safeReturnPath("//evil.example"), null);
    assert.equal(safeReturnPath("/\\evil"), null);
    assert.equal(safeReturnPath("/competitions id"), null);
    assert.equal(safeReturnPath(null), null);
  });
});
