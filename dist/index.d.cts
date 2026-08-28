type TextMatch = string | RegExp;
type BrowserWindow = Window & typeof globalThis;
interface ObserveOptions {
    /** Include only elements an agent can directly interact with. */
    interactiveOnly?: boolean;
    /** Include elements hidden by HTML, ARIA, or CSS. */
    includeHidden?: boolean;
    /** Limit the observation to an element or an open shadow root. */
    root?: Document | Element | ShadowRoot;
    /** Maximum accessible-name length before truncation. */
    maxNameLength?: number;
}
interface ElementState {
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
interface ObservedElement extends ElementState {
    readonly ref: string;
    readonly role: string;
    readonly name: string;
    readonly description?: string;
    readonly tag: string;
    readonly interactive: boolean;
    readonly depth: number;
}
interface RoleLocatorOptions {
    name?: TextMatch;
}
interface Observation {
    readonly generation: number;
    readonly text: string;
    readonly elements: readonly ObservedElement[];
    get(ref: string): ObservedElement;
    findByRole(role: string, options?: RoleLocatorOptions): ObservedElement;
    findByLabel(label: TextMatch): ObservedElement;
    findByText(text: TextMatch): ObservedElement;
}
type AgentAction = {
    type: "click";
    ref: string;
} | {
    type: "fill";
    ref: string;
    value: string;
} | {
    type: "select";
    ref: string;
    value: string | readonly string[];
} | {
    type: "check";
    ref: string;
} | {
    type: "uncheck";
    ref: string;
} | {
    type: "focus";
    ref: string;
} | {
    type: "scroll";
    ref: string;
    block?: ScrollLogicalPosition;
    inline?: ScrollLogicalPosition;
} | {
    type: "press";
    ref: string;
    key: string;
};
interface CreateAgentPageOptions {
    root?: Document | Element | ShadowRoot;
}

declare class AgentPage {
    #private;
    readonly window: BrowserWindow;
    readonly root: Document | Element | ShadowRoot;
    constructor(window: BrowserWindow, options?: CreateAgentPageOptions);
    observe(options?: ObserveOptions): Observation;
    snapshot(options?: ObserveOptions): Observation;
    getByRole(role: string, options?: RoleLocatorOptions): string;
    getByLabel(label: TextMatch): string;
    getByText(text: TextMatch): string;
    click(ref: string): void;
    fill(ref: string, value: string): void;
    select(ref: string, value: string | readonly string[]): void;
    check(ref: string): void;
    uncheck(ref: string): void;
    focus(ref: string): void;
    scroll(ref: string, block?: ScrollLogicalPosition, inline?: ScrollLogicalPosition): void;
    press(ref: string, key: string): void;
    act(action: AgentAction): void;
    destroy(): void;
}
declare function createAgentPage(window: BrowserWindow, options?: CreateAgentPageOptions): AgentPage;

declare class AgentObservation implements Observation {
    readonly generation: number;
    readonly text: string;
    readonly elements: readonly ObservedElement[];
    constructor(generation: number, elements: ObservedElement[]);
    get(ref: string): ObservedElement;
    findByRole(role: string, options?: RoleLocatorOptions): ObservedElement;
    findByLabel(label: TextMatch): ObservedElement;
    findByText(text: TextMatch): ObservedElement;
}

declare class AgentDomError extends Error {
    readonly name: string;
}
declare class StaleElementReferenceError extends AgentDomError {
    readonly name: string;
    constructor(ref: string, snapshotGeneration: number, currentGeneration: number);
}
declare class ElementNotFoundError extends AgentDomError {
    readonly name: string;
    constructor(message: string);
}
declare class ActionError extends AgentDomError {
    readonly name: string;
}

export { ActionError, type AgentAction, AgentDomError, AgentObservation, AgentPage, type BrowserWindow, type CreateAgentPageOptions, ElementNotFoundError, type ElementState, type Observation, type ObserveOptions, type ObservedElement, type RoleLocatorOptions, StaleElementReferenceError, type TextMatch, createAgentPage };
