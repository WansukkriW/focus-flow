import type { FocusFlowApi } from '../shared/types'

declare global {
  interface Window {
    api: FocusFlowApi
  }
}
