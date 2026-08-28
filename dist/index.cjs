"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ActionError: () => ActionError,
  AgentDomError: () => AgentDomError,
  AgentObservation: () => AgentObservation,
  AgentPage: () => AgentPage,
  ElementNotFoundError: () => ElementNotFoundError,
  StaleElementReferenceError: () => StaleElementReferenceError,
  createAgentPage: () => createAgentPage
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var AgentDomError = class extends Error {
  name = "AgentDomError";
};
var StaleElementReferenceError = class extends AgentDomError {
  name = "StaleElementReferenceError";
  constructor(ref, snapshotGeneration, currentGeneration) {
    super(
      `${ref} belongs to snapshot generation ${snapshotGeneration}; the current document generation is ${currentGeneration}. Observe the page again.`
    );
  }
};
var ElementNotFoundError = class extends AgentDomError {
  name = "ElementNotFoundError";
  constructor(message) {
    super(message);
  }
};
var ActionError = class extends AgentDomError {
  name = "ActionError";
};

// src/actions.ts
function viewOf(element) {
  const view = element.ownerDocument.defaultView;
  if (!view) throw new ActionError("The element is not attached to a browser window.");
  return view;
}
function assertEnabled(element) {
  const disabled = element.getAttribute("aria-disabled") === "true" || "disabled" in element && typeof element.disabled === "boolean" && element.disabled;
  if (disabled) throw new ActionError("Cannot act on a disabled element.");
}
function dispatch(element, type) {
  const view = viewOf(element);
  element.dispatchEvent(new view.Event(type, { bubbles: true, composed: true }));
}
function setNativeValue(element, value) {
  const view = viewOf(element);
  const prototype = element instanceof view.HTMLInputElement ? view.HTMLInputElement.prototype : view.HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}
function setNativeChecked(element, checked) {
  const view = viewOf(element);
  const setter = Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "checked")?.set;
  if (setter) setter.call(element, checked);
  else element.checked = checked;
}
function clickElement(element) {
  assertEnabled(element);
  if (!(element instanceof viewOf(element).HTMLElement)) {
    throw new ActionError("Click requires an HTML element.");
  }
  element.scrollIntoView?.({ block: "center", inline: "center" });
  element.focus({ preventScroll: true });
  element.click();
}
function fillElement(element, value) {
  assertEnabled(element);
  const view = viewOf(element);
  if (element instanceof view.HTMLInputElement) {
    if (["checkbox", "radio", "file", "button", "submit", "reset"].includes(element.type)) {
      throw new ActionError(`Cannot fill an input of type ${element.type}.`);
    }
    if (element.readOnly) throw new ActionError("Cannot fill a read-only input.");
    setNativeValue(element, value);
  } else if (element instanceof view.HTMLTextAreaElement) {
    if (element.readOnly) throw new ActionError("Cannot fill a read-only textarea.");
    setNativeValue(element, value);
  } else if (element instanceof view.HTMLElement && element.isContentEditable) {
    element.textContent = value;
  } else {
    throw new ActionError("Fill requires an input, textarea, or contenteditable element.");
  }
  dispatch(element, "input");
  dispatch(element, "change");
}
function selectElement(element, value) {
  assertEnabled(element);
  const view = viewOf(element);
  if (!(element instanceof view.HTMLSelectElement)) throw new ActionError("Select requires a select element.");
  const values = new Set(Array.isArray(value) ? value : [value]);
  if (values.size > 1 && !element.multiple) throw new ActionError("Cannot select multiple values in a single select.");
  const available = new Set(Array.from(element.options, (option) => option.value));
  if (Array.from(values).some((item) => !available.has(item))) {
    throw new ActionError("One or more select values do not exist.");
  }
  for (const option of element.options) {
    option.selected = values.has(option.value);
  }
  dispatch(element, "input");
  dispatch(element, "change");
}
function checkElement(element, checked) {
  assertEnabled(element);
  const view = viewOf(element);
  if (!(element instanceof view.HTMLInputElement) || !["checkbox", "radio"].includes(element.type)) {
    throw new ActionError("Check requires a checkbox or radio input.");
  }
  if (!checked && element.type === "radio") throw new ActionError("Radio inputs cannot be unchecked directly.");
  if (element.checked === checked) return;
  setNativeChecked(element, checked);
  dispatch(element, "input");
  dispatch(element, "change");
}
function focusElement(element) {
  if (!(element instanceof viewOf(element).HTMLElement)) throw new ActionError("Focus requires an HTML element.");
  element.focus();
}
function scrollElement(element, block = "center", inline = "nearest") {
  element.scrollIntoView?.({ behavior: "auto", block, inline });
}
function pressElement(element, key) {
  assertEnabled(element);
  const view = viewOf(element);
  if (!(element instanceof view.HTMLElement)) throw new ActionError("Press requires an HTML element.");
  element.focus({ preventScroll: true });
  const init = { key, bubbles: true, cancelable: true, composed: true };
  const proceed = element.dispatchEvent(new view.KeyboardEvent("keydown", init));
  if (proceed && key.length === 1) element.dispatchEvent(new view.KeyboardEvent("keypress", init));
  element.dispatchEvent(new view.KeyboardEvent("keyup", init));
}

// src/semantics.ts
var import_dom_accessibility_api = require("dom-accessibility-api");
var FALLBACK_ROLES = {
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
  ul: "list"
};
var INTERACTIVE_ROLES = /* @__PURE__ */ new Set([
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
  "treeitem"
]);
var TEXT_FALLBACK_ROLES = /* @__PURE__ */ new Set([
  "article",
  "caption",
  "cell",
  "columnheader",
  "definition",
  "heading",
  "listitem",
  "paragraph",
  "rowheader",
  "term"
]);
var SKIPPED_TAGS = /* @__PURE__ */ new Set([
  "base",
  "link",
  "meta",
  "noscript",
  "script",
  "style",
  "template",
  "title"
]);
function shadowHost(element) {
  const root = element.getRootNode();
  return root.nodeType === 11 && "host" in root ? root.host : null;
}
function parentAcrossShadow(element) {
  return element.parentElement ?? shadowHost(element);
}
function isHidden(element) {
  let current = element;
  while (current) {
    if (current.hasAttribute("hidden") || current.hasAttribute("inert") || current.getAttribute("aria-hidden") === "true") {
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
function roleOf(element) {
  const explicitOrImplicit = (0, import_dom_accessibility_api.getRole)(element);
  if (explicitOrImplicit && explicitOrImplicit !== "generic" && explicitOrImplicit !== "presentation") {
    return explicitOrImplicit;
  }
  if (element.localName === "input" && element.type === "password") return "textbox";
  if (/^h[1-6]$/u.test(element.localName)) return "heading";
  return FALLBACK_ROLES[element.localName] ?? null;
}
function isInteractive(element, role) {
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  if (element.hasAttribute("contenteditable")) return true;
  if (element.hasAttribute("tabindex") && element.getAttribute("tabindex") !== "-1") return true;
  return ["button", "input", "select", "textarea"].includes(element.localName) || element.localName === "a" && element.hasAttribute("href");
}
function cleanText(value) {
  return value.replace(/\s+/gu, " ").trim();
}
function clipped(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}\u2026`;
}
function nameOf(element, role, maxLength) {
  let name = "";
  try {
    name = cleanText((0, import_dom_accessibility_api.computeAccessibleName)(element));
  } catch {
  }
  if (!name && TEXT_FALLBACK_ROLES.has(role)) {
    name = cleanText(element.textContent ?? "");
  }
  return clipped(name, maxLength);
}
function descriptionOf(element, maxLength) {
  try {
    const description = clipped(cleanText((0, import_dom_accessibility_api.computeAccessibleDescription)(element)), maxLength);
    return description || void 0;
  } catch {
    return void 0;
  }
}
function ariaBoolean(element, name) {
  const value = element.getAttribute(name);
  if (value === "true") return true;
  if (value === "false") return false;
  return void 0;
}
function ariaTriState(element, name) {
  const value = element.getAttribute(name);
  if (value === "mixed") return "mixed";
  if (value === "true") return true;
  if (value === "false") return false;
  return void 0;
}
function stateOf(element, role) {
  const state = {};
  const disabled = "disabled" in element && typeof element.disabled === "boolean" ? element.disabled : ariaBoolean(element, "aria-disabled");
  if (disabled !== void 0) state.disabled = disabled;
  const required = "required" in element && typeof element.required === "boolean" ? element.required : ariaBoolean(element, "aria-required");
  if (required !== void 0) state.required = required;
  const readOnly = "readOnly" in element && typeof element.readOnly === "boolean" ? element.readOnly : ariaBoolean(element, "aria-readonly");
  if (readOnly !== void 0) state.readonly = readOnly;
  if (element.localName === "input" && ["checkbox", "radio"].includes(element.type)) {
    const input = element;
    state.checked = input.indeterminate ? "mixed" : input.checked;
  } else {
    const checked = ariaTriState(element, "aria-checked");
    if (checked !== void 0) state.checked = checked;
  }
  if (element.localName === "option") state.selected = element.selected;
  else {
    const selected = ariaBoolean(element, "aria-selected");
    if (selected !== void 0) state.selected = selected;
  }
  const expanded = ariaBoolean(element, "aria-expanded");
  if (expanded !== void 0) state.expanded = expanded;
  const pressed = ariaTriState(element, "aria-pressed");
  if (pressed !== void 0) state.pressed = pressed;
  if (role === "heading") {
    const explicitLevel = Number(element.getAttribute("aria-level"));
    const nativeLevel = /^h([1-6])$/u.exec(element.localName)?.[1];
    const level = explicitLevel > 0 ? explicitLevel : Number(nativeLevel);
    if (level > 0) state.level = level;
  }
  if (element.localName === "select") {
    const select = element;
    state.value = select.multiple ? Array.from(select.selectedOptions, (option) => option.value).join(", ") : select.value;
  } else if (element.localName === "input" && !["password", "file", "checkbox", "radio"].includes(element.type) || element.localName === "textarea") {
    state.value = element.value;
  }
  return state;
}
function* walkElements(root) {
  const start = root.nodeType === 9 || root.nodeType === 11 && "host" in root ? Array.from(root.children) : [root];
  function* visit(element, depth) {
    if (SKIPPED_TAGS.has(element.localName)) return;
    yield { element, depth };
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) yield* visit(child, depth + 1);
    }
    for (const child of element.children) yield* visit(child, depth + 1);
  }
  for (const element of start) yield* visit(element, 0);
}

// src/observation.ts
function matches(value, matcher) {
  if (matcher instanceof RegExp) {
    matcher.lastIndex = 0;
    return matcher.test(value);
  }
  return value.toLocaleLowerCase().includes(matcher.toLocaleLowerCase());
}
function exactlyOne(elements, description) {
  if (elements.length === 0) throw new ElementNotFoundError(`No element matches ${description}.`);
  if (elements.length > 1) {
    throw new ElementNotFoundError(`${elements.length} elements match ${description}; use a ref from the observation.`);
  }
  return elements[0];
}
function quote(value) {
  return JSON.stringify(value);
}
function formatElement(element) {
  const fields = [element.role];
  if (element.name) fields.push(quote(element.name));
  fields.push(`[ref=${element.ref}]`);
  if (element.level !== void 0) fields.push(`[level=${element.level}]`);
  if (element.disabled) fields.push("[disabled]");
  if (element.readonly) fields.push("[readonly]");
  if (element.required) fields.push("[required]");
  if (element.checked !== void 0) fields.push(`[checked=${element.checked}]`);
  if (element.selected !== void 0) fields.push(`[selected=${element.selected}]`);
  if (element.expanded !== void 0) fields.push(`[expanded=${element.expanded}]`);
  if (element.pressed !== void 0) fields.push(`[pressed=${element.pressed}]`);
  if (element.value) fields.push(`[value=${quote(element.value)}]`);
  return fields.join(" ");
}
var AgentObservation = class {
  generation;
  text;
  elements;
  constructor(generation, elements) {
    this.generation = generation;
    this.elements = Object.freeze(elements.map((element) => Object.freeze(element)));
    this.text = this.elements.map(formatElement).join("\n");
    Object.freeze(this);
  }
  get(ref) {
    return exactlyOne(this.elements.filter((element) => element.ref === normalizeRef(ref)), `ref ${ref}`);
  }
  findByRole(role, options = {}) {
    const candidates = this.elements.filter(
      (element) => element.role === role && (options.name === void 0 || matches(element.name, options.name))
    );
    const named = options.name === void 0 ? role : `${role} named ${String(options.name)}`;
    return exactlyOne(candidates, `role ${named}`);
  }
  findByLabel(label) {
    return exactlyOne(
      this.elements.filter((element) => element.interactive && matches(element.name, label)),
      `label ${String(label)}`
    );
  }
  findByText(text) {
    return exactlyOne(this.elements.filter((element) => matches(element.name, text)), `text ${String(text)}`);
  }
};
function normalizeRef(ref) {
  return ref.startsWith("@") ? ref.slice(1) : ref;
}
function buildObservation(generation, defaultRoot, options = {}) {
  const refs = /* @__PURE__ */ new Map();
  const records = [];
  const root = options.root ?? defaultRoot;
  const maxNameLength = options.maxNameLength ?? 160;
  let refNumber = 0;
  for (const { element, depth } of walkElements(root)) {
    if (!options.includeHidden && isHidden(element)) continue;
    const role = roleOf(element);
    if (!role) continue;
    const interactive = isInteractive(element, role);
    if (options.interactiveOnly && !interactive) continue;
    const name = nameOf(element, role, maxNameLength);
    const ref = `e${++refNumber}`;
    refs.set(ref, element);
    const description = descriptionOf(element, maxNameLength);
    const record = {
      ref,
      role,
      name,
      tag: element.localName,
      interactive,
      depth,
      ...stateOf(element, role),
      ...description ? { description } : {}
    };
    records.push(record);
  }
  return { observation: new AgentObservation(generation, records), refs };
}

// src/page.ts
function ownerDocument(root) {
  return root.ownerDocument ?? root;
}
var AgentPage = class {
  window;
  root;
  #documentGeneration = 0;
  #snapshotGeneration = 0;
  #refState;
  #observation;
  #observer;
  constructor(window, options = {}) {
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
      characterData: true
    });
  }
  observe(options = {}) {
    this.#syncMutations();
    const generation = ++this.#snapshotGeneration;
    const built = buildObservation(generation, this.root, options);
    this.#observation = built.observation;
    this.#refState = {
      snapshotGeneration: generation,
      documentGeneration: this.#documentGeneration,
      refs: built.refs
    };
    return built.observation;
  }
  snapshot(options = {}) {
    return this.observe(options);
  }
  getByRole(role, options = {}) {
    return this.#freshObservation().findByRole(role, options).ref;
  }
  getByLabel(label) {
    return this.#freshObservation().findByLabel(label).ref;
  }
  getByText(text) {
    return this.#freshObservation().findByText(text).ref;
  }
  click(ref) {
    clickElement(this.#resolve(ref));
  }
  fill(ref, value) {
    fillElement(this.#resolve(ref), value);
  }
  select(ref, value) {
    selectElement(this.#resolve(ref), value);
  }
  check(ref) {
    checkElement(this.#resolve(ref), true);
  }
  uncheck(ref) {
    checkElement(this.#resolve(ref), false);
  }
  focus(ref) {
    focusElement(this.#resolve(ref));
  }
  scroll(ref, block, inline) {
    scrollElement(this.#resolve(ref), block, inline);
  }
  press(ref, key) {
    pressElement(this.#resolve(ref), key);
  }
  act(action) {
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
  destroy() {
    this.#observer.disconnect();
    this.#refState = void 0;
    this.#observation = void 0;
  }
  #syncMutations() {
    if (this.#observer.takeRecords().length > 0) this.#documentGeneration++;
  }
  #freshObservation() {
    this.#syncMutations();
    if (!this.#observation || !this.#refState) return this.observe();
    if (this.#refState.documentGeneration !== this.#documentGeneration) return this.observe();
    return this.#observation;
  }
  #resolve(ref) {
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
};
function createAgentPage(window, options = {}) {
  return new AgentPage(window, options);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ActionError,
  AgentDomError,
  AgentObservation,
  AgentPage,
  ElementNotFoundError,
  StaleElementReferenceError,
  createAgentPage
});
