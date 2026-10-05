import { vi } from 'vitest'

// Stubs whether the browser's Request exposes fetch `keepalive`; undo with vi.unstubAllGlobals().
export function stubFetchKeepalive(supported: boolean): void {
  vi.stubGlobal(
    'Request',
    supported
      ? class {
          get keepalive() {
            return false
          }
        }
      : class {},
  )
}
