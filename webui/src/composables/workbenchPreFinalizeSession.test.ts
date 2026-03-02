import { describe, it, expect } from "vitest";
import { createPreFinalizeSessionManager } from "@/composables/workbenchPreFinalizeSession";

describe("workbenchPreFinalizeSession", () => {
  it("creates session ids in increasing order", () => {
    const manager = createPreFinalizeSessionManager();

    const first = manager.createSession();
    const second = manager.createSession();

    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it("invalidates and settles sessions independently", () => {
    const manager = createPreFinalizeSessionManager();
    const sessionA = manager.createSession();
    const sessionB = manager.createSession();

    manager.invalidateSession(sessionA);
    expect(manager.isSessionValid(sessionA)).toBe(false);
    expect(manager.isSessionValid(sessionB)).toBe(true);

    manager.settleSession(sessionA);
    expect(manager.isSessionValid(sessionA)).toBe(true);
  });

  it("treats undefined session id as valid and no-op", () => {
    const manager = createPreFinalizeSessionManager();

    manager.invalidateSession(undefined);
    manager.settleSession(undefined);

    expect(manager.isSessionValid(undefined)).toBe(true);
  });
});
