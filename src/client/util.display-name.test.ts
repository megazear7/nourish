import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayName } from "./util.auth.js";

const email = "alex@example.com";

describe("displayName", () => {
  it("uses Auth0 name when it is not the email", () => {
    assert.equal(
      displayName({ name: "Alex Lockhart", email }),
      "Alex Lockhart",
    );
  });

  it("ignores a name that is only the email", () => {
    assert.equal(displayName({ name: "Alex@example.com", email }), "");
  });

  it("joins given and family names when name is the email", () => {
    assert.equal(
      displayName({
        name: email,
        given_name: "Alex",
        family_name: "Lockhart",
        email,
      }),
      "Alex Lockhart",
    );
  });

  it("uses a nickname that is not the email local part", () => {
    assert.equal(
      displayName({ name: email, nickname: "Lockhart", email }),
      "Lockhart",
    );
  });

  it("ignores Auth0's automatic nickname", () => {
    assert.equal(displayName({ name: email, nickname: "alex", email }), "");
  });
});
