export type TextMatch = string | RegExp;

export type BrowserWindow = Window & typeof globalThis;

export interface ObserveOptions {
  /** Include only elements an agent can directly interact with. */
  interactiveOnly?: boolean;
  /** Include elements hidden by HTML, ARIA, or CSS. */
  includeHidden?: boolean;
  /** Limit the observation to an element or an open shadow root. */
  root?: Document | Element | ShadowRoot;
  /** Maximum accessible-name length before truncation. */
  maxNameLength?: number;
}

export interface ElementState {
  disabled?: boolean;
  checked?: boolean | "mixed";
  selected?: boolean;
  expanded?: boolean;
  pressed?: boolean | "mixed";
  required?: boolean;
  readonly?: boolean;
  value?: string;
  level?: number;
}

export interface ObservedElement extends ElementState {
  readonly ref: string;
  readonly role: string;
  readonly name: string;
  readonly description?: string;
  readonly tag: string;
  readonly interactive: boolean;
  readonly depth: number;
}

export interface RoleLocatorOptions {
  name?: TextMatch;
}

export interface Observation {
  readonly generation: number;
  readonly text: string;
  readonly elements: readonly ObservedElement[];
  get(ref: string): ObservedElement;
  findByRole(role: string, options?: RoleLocatorOptions): ObservedElement;
  findByLabel(label: TextMatch): ObservedElement;
  findByText(text: TextMatch): ObservedElement;
}

export type AgentAction =
  | { type: "click"; ref: string }
  | { type: "fill"; ref: string; value: string }
  | { type: "select"; ref: string; value: string | readonly string[] }
  | { type: "check"; ref: string }
  | { type: "uncheck"; ref: string }
  | { type: "focus"; ref: string }
  | { type: "scroll"; ref: string; block?: ScrollLogicalPosition; inline?: ScrollLogicalPosition }
  | { type: "press"; ref: string; key: string };

export interface CreateAgentPageOptions {
  root?: Document | Element | ShadowRoot;
  /**
   * When a ref stops being usable.
   *
   * - `"connected"` (default): a ref stays valid until *its own* element is removed.
   *   Real pages never stop mutating — streaming chat, spinners, clocks, toasts,
   *   virtualised lists, framework re-renders. A policy that reacted to all of it
   *   would mean no action ever lands on a live page.
   * - `"generation"`: any mutation anywhere under the root invalidates every ref from
   *   the previous observation. Opt in for stepwise harnesses that must be current.
   */
  stale?: StalePolicy;
}

export type StalePolicy = "generation" | "connected";
