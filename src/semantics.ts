import {
  computeAccessibleDescription,
  computeAccessibleName,
  getRole,
} from "dom-accessibility-api";
import type { ElementState } from "./types";

const FALLBACK_ROLES: Readonly<Record<string, string>> = {
  article: "article",
  aside: "complementary",
  body: "document",
  caption: "caption",
  dd: "definition",
  details: "group",
  dialog: "dialog",
  dl: "list",
  dt: "term",
  footer: "contentinfo",
  form: "form",
  header: "banner",
  li: "listitem",
  main: "main",
  nav: "navigation",
  ol: "list",
  p: "paragraph",
  section: "region",
  summary: "button",
  table: "table",
  tbody: "rowgroup",
  td: "cell",
  tfoot: "rowgroup",
  th: "columnheader",
  thead: "rowgroup",
  tr: "row",
  ul: "list",
};

const INTERACTIVE_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "gridcell",
  "link",
  "listbox",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem",
]);

const TEXT_FALLBACK_ROLES = new Set([
  "article",
  "caption",
  "cell",
  "columnheader",
  "definition",
  "heading",
  "listitem",
  "paragraph",
  "rowheader",
  "term",
]);

const SKIPPED_TAGS = new Set([
  "base",
  "link",
  "meta",
  "noscript",
  "script",
  "style",
  "template",
  "title",
]);

function shadowHost(element: Element): Element | null {
  const root = element.getRootNode();
  return root.nodeType === 11 && "host" in root ? (root as ShadowRoot).host : null;
}

function parentAcrossShadow(element: Element): Element | null {
  return element.parentElement ?? shadowHost(element);
}

export function isHidden(element: Element): boolean {
  let current: Element | null = element;

  while (current) {
    if (
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true"
    ) {
      return true;
    }

    const view = current.ownerDocument.defaultView;
    if (view) {
      const style = view.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
        return true;
      }
    }

    current = parentAcrossShadow(current);
  }

  return false;
}

export function roleOf(element: Element): string | null {
  const explicitOrImplicit = getRole(element);
  if (explicitOrImplicit && explicitOrImplicit !== "generic" && explicitOrImplicit !== "presentation") {
    return explicitOrImplicit;
  }

  if (element.localName === "input" && (element as HTMLInputElement).type === "password") return "textbox";
  if (/^h[1-6]$/u.test(element.localName)) return "heading";
  return FALLBACK_ROLES[element.localName] ?? null;
}

export function isInteractive(element: Element, role: string | null): boolean {
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  if (element.hasAttribute("contenteditable")) return true;
  if (element.hasAttribute("tabindex") && element.getAttribute("tabindex") !== "-1") return true;

  return (
    ["button", "input", "select", "textarea"].includes(element.localName) ||
    (element.localName === "a" && element.hasAttribute("href"))
  );
}

function cleanText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function clipped(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function nameOf(element: Element, role: string, maxLength: number): string {
  let name = "";
  try {
    name = cleanText(computeAccessibleName(element));
  } catch {
    // Invalid or incomplete markup should not make the whole observation fail.
  }

  if (!name && TEXT_FALLBACK_ROLES.has(role)) {
    name = cleanText(element.textContent ?? "");
  }

  return clipped(name, maxLength);
}

export function descriptionOf(element: Element, maxLength: number): string | undefined {
  try {
    const description = clipped(cleanText(computeAccessibleDescription(element)), maxLength);
    return description || undefined;
  } catch {
    return undefined;
  }
}

function ariaBoolean(element: Element, name: string): boolean | undefined {
  const value = element.getAttribute(name);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function ariaTriState(element: Element, name: string): boolean | "mixed" | undefined {
  const value = element.getAttribute(name);
  if (value === "mixed") return "mixed";
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function stateOf(element: Element, role: string): ElementState {
  const state: ElementState = {};

  const disabled =
    "disabled" in element && typeof element.disabled === "boolean"
      ? element.disabled
      : ariaBoolean(element, "aria-disabled");
  if (disabled !== undefined) state.disabled = disabled;

  const required =
    "required" in element && typeof element.required === "boolean"
      ? element.required
      : ariaBoolean(element, "aria-required");
  if (required !== undefined) state.required = required;

  const readOnly =
    "readOnly" in element && typeof element.readOnly === "boolean"
      ? element.readOnly
      : ariaBoolean(element, "aria-readonly");
  if (readOnly !== undefined) state.readonly = readOnly;

  if (element.localName === "input" && ["checkbox", "radio"].includes((element as HTMLInputElement).type)) {
    const input = element as HTMLInputElement;
    state.checked = input.indeterminate ? "mixed" : input.checked;
  } else {
    const checked = ariaTriState(element, "aria-checked");
    if (checked !== undefined) state.checked = checked;
  }

  if (element.localName === "option") state.selected = (element as HTMLOptionElement).selected;
  else {
    const selected = ariaBoolean(element, "aria-selected");
    if (selected !== undefined) state.selected = selected;
  }

  const expanded = ariaBoolean(element, "aria-expanded");
  if (expanded !== undefined) state.expanded = expanded;

  const pressed = ariaTriState(element, "aria-pressed");
  if (pressed !== undefined) state.pressed = pressed;

  if (role === "heading") {
    const explicitLevel = Number(element.getAttribute("aria-level"));
    const nativeLevel = /^h([1-6])$/u.exec(element.localName)?.[1];
    const level = explicitLevel > 0 ? explicitLevel : Number(nativeLevel);
    if (level > 0) state.level = level;
  }

  if (element.localName === "select") {
    const select = element as HTMLSelectElement;
    state.value = select.multiple
      ? Array.from(select.selectedOptions, (option) => option.value).join(", ")
      : select.value;
  } else if (
    (element.localName === "input" &&
      !["password", "file", "checkbox", "radio"].includes((element as HTMLInputElement).type)) ||
    element.localName === "textarea"
  ) {
    state.value = (element as HTMLInputElement | HTMLTextAreaElement).value;
  }

  return state;
}

export interface WalkedElement {
  element: Element;
  depth: number;
}

export function* walkElements(root: Document | Element | ShadowRoot): Generator<WalkedElement> {
  const start =
    root.nodeType === 9 || (root.nodeType === 11 && "host" in root)
      ? Array.from((root as Document | ShadowRoot).children)
      : [root as Element];

  function* visit(element: Element, depth: number): Generator<WalkedElement> {
    if (SKIPPED_TAGS.has(element.localName)) return;
    yield { element, depth };

    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) yield* visit(child, depth + 1);
    }

    for (const child of element.children) yield* visit(child, depth + 1);
  }

  for (const element of start) yield* visit(element, 0);
}
