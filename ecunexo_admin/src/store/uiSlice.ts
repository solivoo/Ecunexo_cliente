import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type UiState = {
  pendingHttp: number
  httpMessage: string | null
}

const initialState: UiState = {
  pendingHttp: 0,
  httpMessage: null,
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    beginRequest(state) {
      state.pendingHttp += 1
    },
    endRequest(state) {
      state.pendingHttp = Math.max(0, state.pendingHttp - 1)
    },
    setHttpMessage(state, action: PayloadAction<string | null>) {
      state.httpMessage = action.payload
    },
    clearHttpMessage(state) {
      state.httpMessage = null
    },
  },
})

export const { beginRequest, endRequest, setHttpMessage, clearHttpMessage } = uiSlice.actions

export function selectPendingHttp(state: { ui: UiState }): number {
  return state.ui.pendingHttp
}

export function selectHttpMessage(state: { ui: UiState }): string | null {
  return state.ui.httpMessage
}
