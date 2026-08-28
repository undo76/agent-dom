import { ActionError } from "./errors";
import type { BrowserWindow } from "./types";

function viewOf(element: Element): BrowserWindow {
  const view = element.ownerDocument.defaultView;
  if (!view) throw new ActionError("The element is not attached to a browser window.");
  return view as BrowserWindow;
}

function assertEnabled(element: Element): void {
  const disabled =
    element.getAttribute("aria-disabled") === "true" ||
    ("disabled" in element && typeof element.disabled === "boolean" && element.disabled);
  if (disabled) throw new ActionError("Cannot act on a disabled element.");
}

function dispatch(element: Element, type: string): void {
  const view = viewOf(element);
  element.dispatchEvent(new view.Event(type, { bubbles: true, composed: true }));
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const view = viewOf(element);
  const prototype =
    element instanceof view.HTMLInputElement ? view.HTMLInputElement.prototype : view.HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

function setNativeChecked(element: HTMLInputElement, checked: boolean): void {
  const view = viewOf(element);
  const setter = Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "checked")?.set;
  if (setter) setter.call(element, checked);
  else element.checked = checked;
}

export function clickElement(element: Element): void {
  assertEnabled(element);
  if (!(element instanceof viewOf(element).HTMLElement)) {
    throw new ActionError("Click requires an HTML element.");
  }
  element.scrollIntoView?.({ block: "center", inline: "center" });
  element.focus({ preventScroll: true });
  element.click();
}

export function fillElement(element: Element, value: string): void {
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

export function selectElement(element: Element, value: string | readonly string[]): void {
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

export function checkElement(element: Element, checked: boolean): void {
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

export function focusElement(element: Element): void {
  if (!(element instanceof viewOf(element).HTMLElement)) throw new ActionError("Focus requires an HTML element.");
  element.focus();
}

export function scrollElement(
  element: Element,
  block: ScrollLogicalPosition = "center",
  inline: ScrollLogicalPosition = "nearest",
): void {
  element.scrollIntoView?.({ behavior: "auto", block, inline });
}

export function pressElement(element: Element, key: string): void {
  assertEnabled(element);
  const view = viewOf(element);
  if (!(element instanceof view.HTMLElement)) throw new ActionError("Press requires an HTML element.");
  element.focus({ preventScroll: true });

  const init: KeyboardEventInit = { key, bubbles: true, cancelable: true, composed: true };
  const proceed = element.dispatchEvent(new view.KeyboardEvent("keydown", init));
  if (proceed && key.length === 1) element.dispatchEvent(new view.KeyboardEvent("keypress", init));
  element.dispatchEvent(new view.KeyboardEvent("keyup", init));
}
