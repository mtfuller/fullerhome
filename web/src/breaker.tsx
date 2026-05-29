import React from 'react'
import { createRoot } from 'react-dom/client'
import BreakerPanelEditor from './BreakerPanelEditor'
import { ElectricalState } from './types'

const rootEl = document.getElementById('electrical-root')
if (rootEl) {
  const raw = rootEl.dataset.state ?? '{}'
  const state: ElectricalState = JSON.parse(raw)
  createRoot(rootEl).render(
    <React.StrictMode>
      <BreakerPanelEditor
        initialPanels={state.panels ?? []}
        initialMarkers={state.markers ?? []}
      />
    </React.StrictMode>
  )
}
