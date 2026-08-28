import {
  checkElement,
  clickElement,
  fillElement,
  focusElement,
  pressElement,
  scrollElement,
  selectElement,
} from "./actions";
import { ElementNotFoundError, StaleElementReferenceError } from "./errors";
import { AgentObservation, buildObservation, normalizeRef } from "./observation";
import type {
  AgentAction,
  BrowserWindow,
  CreateAgentPageOptions,
  Observation,
  ObserveOptions,
  RoleLocatorOptions,
  TextMatch,
} from "./types";

interface RefState {
  snapshotGeneration: number;
  documentGeneration: number;
  refs: Map<string, Element>;
}

function ownerDocument(root: Document | Element | ShadowRoot): Document {
  return root.ownerDocument ?? (root as Document);
}

export class AgentPage {
  readonly window: BrowserWindow;
  readonly root: Document | Element | ShadowRoot;

  #documentGeneration = 0;
  #snapshotGeneration = 0;
  #refState: RefState | undefined;
  #observation: AgentObservation | undefined;
  #observer: MutationObserver;

  constructor(window: BrowserWindow, options: CreateAgentPageOptions = {}) {
    this.window = window;
    this.root = options.root ?? window.document;

    const document = ownerDocument(this.root);
    if (document.defaultView !== window) {
      throw new TypeError("The root must belong to the supplied window.");
    }

    this.#observer = new window.MutationObserver(() => {
      this.#documentGeneration++;
    });
    this.#observer.observe(this.root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  }

  observe(options: ObserveOptions = {}): Observation {
    this.#syncMutations();
    const generation = ++this.#snapshotGeneration;
    const built = buildObservation(generation, this.root, options);
    this.#observation = built.observation;
    this.#refState = {
      snapshotGeneration: generation,
      documentGeneration: this.#documentGeneration,
      refs: built.refs,
    };
    return built.observation;
  }

  snapshot(options: ObserveOptions = {}): Observation {
    return this.observe(options);
  }

  getByRole(role: string, options: RoleLocatorOptions = {}): string {
    return this.#freshObservation().findByRole(role, options).ref;
  }

  getByLabel(label: TextMatch): string {
    return this.#freshObservation().findByLabel(label).ref;
  }

  getByText(text: TextMatch): string {
    return this.#freshObservation().findByText(text).ref;
  }

  click(ref: string): void {
    clickElement(this.#resolve(ref));
  }

  fill(ref: string, value: string): void {
    fillElement(this.#resolve(ref), value);
  }

  select(ref: string, value: string | readonly string[]): void {
    selectElement(this.#resolve(ref), value);
  }

  check(ref: string): void {
    checkElement(this.#resolve(ref), true);
  }

  uncheck(ref: string): void {
    checkElement(this.#resolve(ref), false);
  }

  focus(ref: string): void {
    focusElement(this.#resolve(ref));
  }

  scroll(ref: string, block?: ScrollLogicalPosition, inline?: ScrollLogicalPosition): void {
    scrollElement(this.#resolve(ref), block, inline);
  }

  press(ref: string, key: string): void {
    pressElement(this.#resolve(ref), key);
  }

  act(action: AgentAction): void {
    switch (action.type) {
      case "click":
        this.click(action.ref);
        return;
      case "fill":
        this.fill(action.ref, action.value);
        return;
      case "select":
        this.select(action.ref, action.value);
        return;
      case "check":
        this.check(action.ref);
        return;
      case "uncheck":
        this.uncheck(action.ref);
        return;
      case "focus":
        this.focus(action.ref);
        return;
      case "scroll":
        this.scroll(action.ref, action.block, action.inline);
        return;
      case "press":
        this.press(action.ref, action.key);
    }
  }

  destroy(): void {
    this.#observer.disconnect();
    this.#refState = undefined;
    this.#observation = undefined;
  }

  #syncMutations(): void {
    if (this.#observer.takeRecords().length > 0) this.#documentGeneration++;
  }

  #freshObservation(): AgentObservation {
    this.#syncMutations();
    if (!this.#observation || !this.#refState) return this.observe() as AgentObservation;
    if (this.#refState.documentGeneration !== this.#documentGeneration) return this.observe() as AgentObservation;
    return this.#observation;
  }

  #resolve(ref: string): Element {
    this.#syncMutations();
    const normalized = normalizeRef(ref);
    const state = this.#refState;
    if (!state) throw new ElementNotFoundError("Observe the page before using a ref.");

    if (state.documentGeneration !== this.#documentGeneration) {
      throw new StaleElementReferenceError(normalized, state.snapshotGeneration, this.#snapshotGeneration + 1);
    }

    const element = state.refs.get(normalized);
    if (!element) throw new ElementNotFoundError(`Unknown ref ${ref}.`);
    if (!element.isConnected) {
      this.#documentGeneration++;
      throw new StaleElementReferenceError(normalized, state.snapshotGeneration, this.#snapshotGeneration + 1);
    }
    return element;
  }
}

export function createAgentPage(window: BrowserWindow, options: CreateAgentPageOptions = {}): AgentPage {
  return new AgentPage(window, options);
}
