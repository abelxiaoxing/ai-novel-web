export function createPreFinalizeSessionManager() {
  let sessionCounter = 0;
  const invalidSessions = new Set<number>();

  const createSession = () => {
    sessionCounter += 1;
    return sessionCounter;
  };

  const invalidateSession = (sessionId?: number) => {
    if (typeof sessionId !== "number") {
      return;
    }
    invalidSessions.add(sessionId);
  };

  const settleSession = (sessionId?: number) => {
    if (typeof sessionId !== "number") {
      return;
    }
    invalidSessions.delete(sessionId);
  };

  const isSessionValid = (sessionId?: number) => {
    if (typeof sessionId !== "number") {
      return true;
    }
    return !invalidSessions.has(sessionId);
  };

  return {
    createSession,
    invalidateSession,
    settleSession,
    isSessionValid,
  };
}
