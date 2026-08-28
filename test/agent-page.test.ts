import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionError,
  createAgentPage,
  StaleElementReferenceError,
  type AgentPage,
} from "../src";

let page: AgentPage | undefined;

afterEach(() => {
  page?.destroy();
  page = undefined;
  document.body.replaceChildren();
});

describe("observations", () => {
  it("builds a compact semantic observation with state", () => {
    document.body.innerHTML = `
      <main>
        <h1>Checkout</h1>
        <label for="email">Email address</label>
        <input id="email" value="alice@example.com" required>
        <label><input type="checkbox" checked> Save card</label>
        <button aria-label="Pay now"><svg></svg></button>
      </main>
    `;
    page = createAgentPage(window);

    const observation = page.observe();

    expect(observation.text).toContain('heading "Checkout"');
    expect(observation.text).toContain('textbox "Email address"');
    expect(observation.text).toContain("[required]");
    expect(observation.text).toContain("[checked=true]");
    expect(observation.text).toContain('button "Pay now"');
    expect(Object.isFrozen(observation.elements)).toBe(true);
  });

  it("can return interactive elements only", () => {
    document.body.innerHTML = `<h1>Title</h1><p>Copy</p><button>Continue</button>`;
    page = createAgentPage(window);

    const observation = page.observe({ interactiveOnly: true });

    expect(observation.elements).toHaveLength(1);
    expect(observation.elements[0]).toMatchObject({ role: "button", name: "Continue" });
  });

  it("skips hidden elements and never exposes password values", () => {
    document.body.innerHTML = `
      <button hidden>Hidden</button>
      <input aria-label="Password" type="password" value="secret">
    `;
    page = createAgentPage(window);

    const observation = page.observe();

    expect(observation.text).not.toContain("Hidden");
    expect(observation.text).not.toContain("secret");
    expect(observation.findByRole("textbox", { name: "Password" }).value).toBeUndefined();
  });

  it("traverses open shadow roots", () => {
    const host = document.createElement("div");
    host.attachShadow({ mode: "open" }).innerHTML = `<button>Inside shadow</button>`;
    document.body.append(host);
    page = createAgentPage(window);

    expect(page.observe().text).toContain('button "Inside shadow"');
  });
});

describe("locators and actions", () => {
  it("fills fields and clicks controls through refs", () => {
    document.body.innerHTML = `
      <label for="email">Email</label><input id="email">
      <button>Submit</button>
    `;
    const input = document.querySelector<HTMLInputElement>("input")!;
    const button = document.querySelector<HTMLButtonElement>("button")!;
    const onInput = vi.fn();
    const onClick = vi.fn();
    input.addEventListener("input", onInput);
    button.addEventListener("click", onClick);
    page = createAgentPage(window);
    page.observe();

    page.fill(page.getByLabel("Email"), "me@example.com");
    page.click(page.getByRole("button", { name: "Submit" }));

    expect(input.value).toBe("me@example.com");
    expect(onInput).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("supports select, check, and the generic act API", () => {
    document.body.innerHTML = `
      <label><input type="checkbox"> Remember me</label>
      <label for="country">Country</label>
      <select id="country"><option value="be">Belgium</option><option value="fr">France</option></select>
    `;
    page = createAgentPage(window);
    const observation = page.observe();
    const checkbox = observation.findByRole("checkbox").ref;
    const select = observation.findByRole("combobox", { name: "Country" }).ref;

    page.act({ type: "check", ref: checkbox });
    page.act({ type: "select", ref: select, value: "fr" });

    expect(document.querySelector<HTMLInputElement>("input")!.checked).toBe(true);
    expect(document.querySelector<HTMLSelectElement>("select")!.value).toBe("fr");
  });

  it("rejects stale refs after a DOM mutation", () => {
    document.body.innerHTML = `<button>Old action</button>`;
    page = createAgentPage(window);
    const ref = page.observe().findByRole("button").ref;
    document.body.append(document.createElement("p"));

    expect(() => page!.click(ref)).toThrow(StaleElementReferenceError);
  });

  it("reports invalid actions clearly", () => {
    document.body.innerHTML = `<input type="checkbox" aria-label="Choice">`;
    page = createAgentPage(window);
    const ref = page.observe().findByRole("checkbox").ref;

    expect(() => page!.fill(ref, "nope")).toThrow(ActionError);
  });
});
