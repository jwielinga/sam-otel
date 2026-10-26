import type { LogAttributes, Severity } from './types'

export const logPresets: {
  label: string
  severity: Severity
  body: string
  attributes: LogAttributes
}[] = [
  {
    label: 'Send debug',
    severity: 'debug',
    body: 'Rendered TodoList with 3 items',
    attributes: {
      'demo.action': 'todo.render',
      'component.name': 'TodoList',
      'todo.count': 3,
    },
  },
  {
    label: 'Send info',
    severity: 'info',
    body: 'Todo added: Buy milk',
    attributes: {
      'demo.action': 'todo.add',
      'todo.title': 'Buy milk',
      'todo.count': 4,
    },
  },
  {
    label: 'Send warning',
    severity: 'warn',
    body: 'Saving todos is taking longer than expected',
    attributes: {
      'demo.action': 'todo.save',
      duration_ms: 1830,
    },
  },
  {
    label: 'Send error',
    severity: 'error',
    body: 'Failed to save todo',
    attributes: {
      'demo.action': 'todo.save',
      'todo.id': 'todo-42',
      'error.code': 'NETWORK_ERROR',
    },
  },
  {
    label: 'Send fatal',
    severity: 'fatal',
    body: 'TodoList crashed: Cannot read properties of undefined',
    attributes: {
      'demo.action': 'todo.render',
      'component.name': 'TodoList',
    },
  },
]

export const todoTitles = [
  'Buy milk',
  'Walk the dog',
  'Write tests',
  'Review pull request',
  'Fix flaky build',
  'Update docs',
  'Book flights',
  'Call mom',
  'Water plants',
  'Pay rent',
]
