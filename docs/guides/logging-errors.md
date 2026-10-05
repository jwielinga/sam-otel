---
sidebar_position: 3
title: Logging errors
---

# Logging errors

## Error as the body

Pass an `Error` as the body and Sam builds a useful record for you:

```ts
try {
  await checkout()
} catch (error) {
  if (error instanceof Error) {
    await logger.error(error, { orderId: 'order-42' })
  }
}
```

The record gets:

| Field                  | Value                                                        |
| ---------------------- | ------------------------------------------------------------ |
| body                   | `error.message` (the error type if the message is empty)     |
| `exception.type`       | The error name, or the class name for subclasses (see below) |
| `exception.message`    | `error.message`                                              |
| `exception.stacktrace` | `error.stack`, when the engine provides one                  |
| your own attributes    | Added after the `exception.*` attributes                     |

These follow the OpenTelemetry [exception semantic conventions](https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/), so backends can group and display errors.

If you pass an attribute with the same name as an `exception.*` attribute, yours wins.

### Error types

`exception.type` is `error.name` when it was changed from the default `'Error'` (for example `'TypeError'` or `'AbortError'`). For a subclass that keeps the default name, Sam uses the class name:

```ts
class PaymentDeclinedError extends Error {}

await logger.error(new PaymentDeclinedError('Card declined'))
// exception.type = 'PaymentDeclinedError'
```

:::tip Minified class names

Production bundles often rename classes. Set `this.name` in your custom errors if you need stable names in your backend.

:::

## Error as an attribute

An `Error` inside the attributes becomes a map with `type`, `message`, and `stacktrace`:

```ts
await logger.warn('Retrying after failure', {
  attempt: 2,
  cause: new RangeError('Value out of range'),
})
```

Use this for related errors, such as a `cause`. Errors nested inside arrays or maps are converted the same way.

## Length limits

The stack trace is an attribute, so `limits.attributeValueLengthLimit` truncates it. The body message is not truncated. See [Attribute limits](./attribute-limits.md).

## Automatic error capture

Sam does not install global error handlers. [Recipes](./recipes.md#capture-uncaught-errors) shows how to send uncaught errors and unhandled rejections with a few lines.
