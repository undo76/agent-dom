import { ElementNotFoundError } from "./errors";
import { descriptionOf, isHidden, isInteractive, nameOf, roleOf, stateOf, walkElements } from "./semantics";
import type {
  Observation,
  ObservedElement,
  ObserveOptions,
  RoleLocatorOptions,
  TextMatch,
} from "./types";

export interface ObservationBuild {
  observation: AgentObservation;
  refs: Map<string, Element>;
}

function matches(value: string, matcher: TextMatch): boolean {
  if (matcher instanceof RegExp) {
    matcher.lastIndex = 0;
    return matcher.test(value);
  }
  return value.toLocaleLowerCase().includes(matcher.toLocaleLowerCase());
}

function exactlyOne(elements: readonly ObservedElement[], description: string): ObservedElement {
  if (elements.length === 0) throw new ElementNotFoundError(`No element matches ${description}.`);
  if (elements.length > 1) {
    throw new ElementNotFoundError(`${elements.length} elements match ${description}; use a ref from the observation.`);
  }
  return elements[0]!;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function formatElement(element: ObservedElement): string {
  const fields = [element.role];
  if (element.name) fields.push(quote(element.name));
  fields.push(`[ref=${element.ref}]`);

  if (element.level !== undefined) fields.push(`[level=${element.level}]`);
  if (element.disabled) fields.push("[disabled]");
  if (element.readonly) fields.push("[readonly]");
  if (element.required) fields.push("[required]");
  if (element.checked !== undefined) fields.push(`[checked=${element.checked}]`);
  if (element.selected !== undefined) fields.push(`[selected=${element.selected}]`);
  if (element.expanded !== undefined) fields.push(`[expanded=${element.expanded}]`);
  if (element.pressed !== undefined) fields.push(`[pressed=${element.pressed}]`);
  if (element.value) fields.push(`[value=${quote(element.value)}]`);

  return fields.join(" ");
}

export class AgentObservation implements Observation {
  readonly generation: number;
  readonly text: string;
  readonly elements: readonly ObservedElement[];

  constructor(generation: number, elements: ObservedElement[]) {
    this.generation = generation;
    this.elements = Object.freeze(elements.map((element) => Object.freeze(element)));
    this.text = this.elements.map(formatElement).join("\n");
    Object.freeze(this);
  }

  get(ref: string): ObservedElement {
    return exactlyOne(this.elements.filter((element) => element.ref === normalizeRef(ref)), `ref ${ref}`);
  }

  findByRole(role: string, options: RoleLocatorOptions = {}): ObservedElement {
    const candidates = this.elements.filter(
      (element) => element.role === role && (options.name === undefined || matches(element.name, options.name)),
    );
    const named = options.name === undefined ? role : `${role} named ${String(options.name)}`;
    return exactlyOne(candidates, `role ${named}`);
  }

  findByLabel(label: TextMatch): ObservedElement {
    return exactlyOne(
      this.elements.filter((element) => element.interactive && matches(element.name, label)),
      `label ${String(label)}`,
    );
  }

  findByText(text: TextMatch): ObservedElement {
    return exactlyOne(this.elements.filter((element) => matches(element.name, text)), `text ${String(text)}`);
  }
}

export function normalizeRef(ref: string): string {
  return ref.startsWith("@") ? ref.slice(1) : ref;
}

export function buildObservation(
  generation: number,
  defaultRoot: Document | Element | ShadowRoot,
  options: ObserveOptions = {},
): ObservationBuild {
  const refs = new Map<string, Element>();
  const records: ObservedElement[] = [];
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
    const record: ObservedElement = {
      ref,
      role,
      name,
      tag: element.localName,
      interactive,
      depth,
      ...stateOf(element, role),
      ...(description ? { description } : {}),
    };
    records.push(record);
  }

  return { observation: new AgentObservation(generation, records), refs };
}
