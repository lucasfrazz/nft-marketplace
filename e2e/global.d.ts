import type { KurioMockControl } from '../src/mocks/browser'

declare global {
  interface Window {
    __kurioMock?: KurioMockControl
  }
}
