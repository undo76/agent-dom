# agent-dom

[![npm version](https://img.shields.io/npm/v/%40undo76%2Fagent-dom.svg)](https://www.npmjs.com/package/@undo76/agent-dom)
[![Publish to npm](https://github.com/undo76/agent-dom/actions/workflows/publish.yml/badge.svg)](https://github.com/undo76/agent-dom/actions/workflows/publish.yml)

`agent-dom` is a browser-native semantic DOM API for AI agents. It runs inside the page, derives roles and accessible names from DOM and ARIA, produces a compact observation, and maps short-lived refs back to real elements for actions.

It does not require Playwright, Puppeteer, CDP, or a remote browser.

## Install

```sh
npm install @undo76/agent-dom
```

## Observe and act

```ts
import { createAgentPage } from "@undo76/agent-dom";

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

A ref identifies one element in the last observation. By default (`stale: "connected"`) it stays valid until that **own** element leaves the document, so unrelated page churn — streamed chat, spinners, clocks, framework re-renders — does not stop you acting.

```ts
const obs = page.observe({ interactiveOnly: true });
const link = obs.findByRole("link", { name: "Home" }).ref;

chat.append(document.createTextNode("thinking…")); // sibling subtree mutates
page.click(link);                                   // works

sidebar.querySelector("a")?.remove();
page.click(link);                                 // StaleElementReferenceError
```

Opt into strict snapshot semantics with `stale: "generation"`, where any mutation under the root invalidates every older ref:

```ts
const strict = createAgentPage(window, { stale: "generation" });
const ref = strict.observe().findByRole("button").ref;

document.body.append(document.createElement("div"));

strict.click(ref); // throws StaleElementReferenceError
```

The trade is freshness, not safety: under `"connected"` a ref can resolve to an element whose text changed since you observed it. Re-observe when the label is the contract (totals, quantities, confirm dialogs); `disabled` and removed elements are still caught.

## Browser boundaries

The library traverses the current document and open shadow roots. Normal page JavaScript cannot inspect closed shadow roots or cross-origin iframe documents. A browser extension can inject one `AgentPage` into each permitted frame and merge the results in a coordinator.

This library derives a useful semantic view from DOM and ARIA. It is not the browser's privileged accessibility tree, so unusual widgets can differ from Chromium's CDP accessibility output.

## Cleanup

Disconnect the internal mutation observer when the page object is no longer needed:

```ts
page.destroy();
```
