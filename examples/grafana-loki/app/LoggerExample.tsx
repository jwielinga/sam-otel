import { ChevronDown } from 'lucide-react'

const example = `import { createSamLogger, OTelSeverityNumber } from 'sam-otel'

const logger = createSamLogger({
  endpoint: 'http://localhost:4318/v1/logs',
  serviceName: 'sam-demo',
})

// Every call returns a promise: it resolves once the batch is exported
// and rejects if the export fails, so await it or add .catch().
await logger.debug('Rendered TodoList with 3 items', {
  'component.name': 'TodoList',
})

await logger.info('Todo added: Buy milk', {
  'todo.title': 'Buy milk',
})

await logger.warn('Saving todos is taking longer than expected', {
  duration_ms: 1830,
})

await logger.error('Failed to save todo', {
  'todo.id': 'todo-42',
  'error.code': 'NETWORK_ERROR',
})

// Pass an Error as the body to get exception.type, exception.message and the stack.
try {
  JSON.parse(savedTodos)
} catch (error) {
  await logger.error(error as Error, { 'demo.action': 'todo.load' })
}

// Sam has no logger.fatal(). Send the OTel FATAL severity with logRecord().
await logger.logRecord({
  severityNumber: OTelSeverityNumber.FATAL,
  severityText: 'FATAL',
  body: 'TodoList crashed: Cannot read properties of undefined',
  attributes: { 'component.name': 'TodoList' },
})`

export function LoggerExample() {
  return (
    <details className="usage group">
      <summary>
        <span className="usage-title">How to use the logger</span>
        <span className="usage-hint">message + optional attributes</span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <pre>
        <code>{example}</code>
      </pre>
    </details>
  )
}
