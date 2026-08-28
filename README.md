# agent-dom

`@agent-dom/core` is a browser-native semantic DOM API for AI agents. It runs inside the page, derives roles and accessible names from DOM and ARIA, produces a compact observation, and maps short-lived refs back to real elements for actions.

It does not require Playwright, Puppeteer, CDP, or a remote browser.

## Install

```sh
npm install @agent-dom/core
```

## Observe and act

```ts
import { createAgentPage } from "@agent-dom/core";

const page = createAgentPage(window);
const observation = page.observe();

console.log(observation.text);
// heading "Checkout" [ref=e1] [level=1]
// textbox "Email" [ref=e2]
// checkbox "Save card" [ref=e3] [checked=false]
// button "Pay €32.00" [ref=e4]

page.fill("e2", "foo@example.com");

// Observe again if the page changed before using another ref.
const next = page.observe();
page.click(next.findByRole("button", { name: "Pay" }).ref);
```

The `@` prefix is optional, so `e4` and `@e4` both work.

## Agent-shaped API

`act` accepts a discriminated union that can be exposed directly as an LLM tool:

```ts
const observation = page.observe({ interactiveOnly: true });

page.act({
  type: "fill",
  ref: observation.findByLabel("Email").ref,
  value: "foo@example.com",
});
```

Supported actions are `click`, `fill`, `select`, `check`, `uncheck`, `focus`, `scroll`, and `press`.

## Structured observations

Every observation includes an immutable `elements` array:

```ts
const observation = page.observe();

observation.elements;
// [
//   {
//     ref: "e1",
//     role: "textbox",
//     name: "Email",
//     tag: "input",
//     interactive: true,
//     depth: 3,
//     required: true,
//     value: ""
//   }
// ]
```

Password and file-input values are never included in observations.

## Locators

Locators use the same accessible semantics as observations:

```ts
const observation = page.observe();

observation.findByRole("button", { name: /continue/i });
observation.findByLabel("Email address");
observation.findByText("Order summary");

page.getByRole("button", { name: "Continue" }); // returns a ref
page.getByLabel("Email");                       // returns a ref
page.getByText("Order summary");               // returns a ref
```

A locator throws if it finds zero or multiple elements. This keeps agent actions deterministic.

## Ref lifetime

Refs belong to one observation. A `MutationObserver` tracks changes to the document, including attribute and text changes. If the DOM changes, an action using an older ref throws `StaleElementReferenceError` and the agent must observe again.

```ts
const first = page.observe();
const button = first.findByRole("button").ref;

document.body.append(document.createElement("div"));

page.click(button); // throws StaleElementReferenceError
```

## Browser boundaries

The library traverses the current document and open shadow roots. Normal page JavaScript cannot inspect closed shadow roots or cross-origin iframe documents. A browser extension can inject one `AgentPage` into each permitted frame and merge the results in a coordinator.

This library derives a useful semantic view from DOM and ARIA. It is not the browser's privileged accessibility tree, so unusual widgets can differ from Chromium's CDP accessibility output.

## Cleanup

Disconnect the internal mutation observer when the page object is no longer needed:

```ts
page.destroy();
```
