export class AgentDomError extends Error {
  override readonly name: string = "AgentDomError";
}

export class StaleElementReferenceError extends AgentDomError {
  override readonly name: string = "StaleElementReferenceError";

  constructor(ref: string, snapshotGeneration: number, currentGeneration: number) {
    super(
      `${ref} belongs to snapshot generation ${snapshotGeneration}; ` +
        `the current document generation is ${currentGeneration}. Observe the page again.`,
    );
  }
}

export class ElementNotFoundError extends AgentDomError {
  override readonly name: string = "ElementNotFoundError";

  constructor(message: string) {
    super(message);
  }
}

export class ActionError extends AgentDomError {
  override readonly name: string = "ActionError";
}
