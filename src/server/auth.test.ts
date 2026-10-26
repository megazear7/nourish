import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JWTPayload } from "jose";
import { emailFromClaims } from "./auth.js";

function claims(sub: string, email?: string): JWTPayload {
  return email === undefined ? { sub } : { sub, email };
}

describe("emailFromClaims", () => {
  it("uses the access token email when it has one", () => {
    assert.equal(
      emailFromClaims(claims("auth0|a", "a@example.com"), null),
      "a@example.com",
    );
  });

  it("uses the ID token email when the access token has none and the subject matches", () => {
    assert.equal(
      emailFromClaims(claims("auth0|a"), claims("auth0|a", "a@example.com")),
      "a@example.com",
    );
  });

  it("ignores an ID token for a different subject", () => {
    assert.equal(
      emailFromClaims(claims("auth0|a"), claims("auth0|b", "b@example.com")),
      null,
    );
  });

  it("ignores a blank email", () => {
    assert.equal(
      emailFromClaims(claims("auth0|a", "  "), claims("auth0|a", " ")),
      null,
    );
  });
});
