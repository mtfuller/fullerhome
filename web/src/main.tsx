import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SpatialCanvas } from './SpatialCanvas'
import type { SpatialState } from './types'

function App({ initialState }: { initialState: SpatialState }) {
  const [activeLevelId, setActiveLevelId] = useState<string | null>(
    initialState.levels[0]?.id ?? null
  )

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Level selector sidebar — synced with the server-rendered buttons */}
      <div style={{ display: 'none' }}>
        {initialState.levels.map((l) => (
          <button key={l.id} onClick={() => setActiveLevelId(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <SpatialCanvas state={initialState} activeLevelId={activeLevelId} />
      </div>
    </div>
  )
}

// Mount when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('interactive-canvas-root')
  if (!root) return

  // Hydrate state from the data attribute written by the server
  let initialState: SpatialState = { levels: [], markers: [] }
  const raw = root.dataset.state
  if (raw) {
    try {
      initialState = JSON.parse(raw)
    } catch (e) {
      console.error('FullerHome: failed to parse canvas state', e)
    }
  }

  // Wire sidebar buttons rendered server-side into React state
  document.querySelectorAll<HTMLButtonElement>('.level-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const levelId = btn.dataset.levelId ?? null
      reactApp?.setLevel(levelId)
      document.querySelectorAll('.level-btn').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
    })
  })

  // Expose a handle so sidebar click handler above can update level
  const reactApp = { setLevel: (_: string | null) => {} }

  function AppWrapper() {
    const [activeLevelId, setActiveLevelId] = useState<string | null>(
      initialState.levels[0]?.id ?? null
    )
    reactApp.setLevel = setActiveLevelId
    return <SpatialCanvas state={initialState} activeLevelId={activeLevelId} />
  }

  createRoot(root).render(
    <StrictMode>
      <AppWrapper />
    </StrictMode>
  )
})

void App // exported for testing
