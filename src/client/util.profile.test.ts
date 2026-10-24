import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { localDisplayName, setLocalDisplayName } from "./util.profile.js";

const memory = new Map<string, string>();

function installStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, String(value));
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
}

describe("local display name", () => {
  beforeEach(() => {
    memory.clear();
    installStorage();
  });

  it("is missing until one is saved", () => {
    assert.equal(localDisplayName("auth0|a"), undefined);
  });

  it("stores a name for that user only", () => {
    assert.equal(setLocalDisplayName("auth0|a", " Alex ", ""), "Alex");
    assert.equal(localDisplayName("auth0|a"), "Alex");
    assert.equal(localDisplayName("auth0|b"), undefined);
  });

  it("clears a blank name and a name that matches Auth0", () => {
    setLocalDisplayName("auth0|a", "Alex", "");
    assert.equal(setLocalDisplayName("auth0|a", "   ", ""), "");
    assert.equal(localDisplayName("auth0|a"), undefined);
    assert.equal(localStorage.getItem("nourish-display-name"), null);
    setLocalDisplayName("auth0|a", "Alex", "Alex");
    assert.equal(localDisplayName("auth0|a"), undefined);
  });

  it("ignores a corrupt document", () => {
    localStorage.setItem("nourish-display-name", "{");
    assert.equal(localDisplayName("auth0|a"), undefined);
    assert.equal(setLocalDisplayName("auth0|a", "Alex", ""), "Alex");
  });
});
