---
sidebar_position: 6
title: Page unload
---

# Page unload

When a user closes a tab or navigates away, a normal request can be cancelled before it finishes. Sam uses two mechanisms to give queued logs a chance to arrive.

## Automatic flush on page hide

In a browser, Sam registers listeners when you create the logger:

- `pagehide`, when the page is being unloaded or put in the back/forward cache.
- `visibilitychange`, when the page becomes hidden (tab switch, minimize, app switch on mobile).

When either fires, Sam sends everything queued **immediately**:

- Requests start synchronously inside the event handler.
- It does not wait for an earlier request that is still in flight.
- It does not compress, retry, or apply timeouts; there is no time for that.
- A large batch is split into several requests so each one fits the keepalive size limit (below).

Outside a browser, for example in Node.js, no listeners are registered. `shutdown()` removes them.

## Fetch keepalive

Sam sets the Fetch `keepalive` flag on requests so the browser can finish them after the page is gone. It is on by default:

```ts
const logger = createSamLogger({
  endpoint: 'https://collector.example.com/v1/logs',
  serviceName: 'storefront',
  keepalive: false, // opt out
})
```

Sam only sets the flag when the browser supports it. Otherwise it sends plain requests, which the browser may cancel during unload.

### Browser limits

- **Support.** Browsers without Fetch `keepalive` (for example Firefox before 133, and very old Chrome and Safari) ignore the flag. Sam detects this and sends normal requests, so unload delivery is not guaranteed there.
- **Size.** Browsers cap in-flight keepalive request bodies at 64 KiB. Sam stays below it: it omits the flag for a larger normal batch, and it splits unload batches. A single record that alone exceeds the limit is sent without `keepalive`.
- **Preflight.** Keepalive requests with custom headers such as `Authorization` trigger a CORS preflight. The collector must answer it, and the browser may not finish the preflight if the page is already closing. Avoid custom headers if unload delivery matters.

:::info About `Connection: keep-alive`

Scripts cannot set the `Connection` header, and HTTP/2 and HTTP/3 do not allow it. Browsers already reuse connections, so Fetch `keepalive` is the only browser-level control.

:::

## Tips

- Keep records small. Smaller records mean fewer split requests at unload.
- If you need a log to survive, `await` it before navigating, or call `await logger.flush()` first.
- In single-page apps, hidden-tab flushes happen automatically; you do not need to flush on route changes.
