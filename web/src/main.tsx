import { StrictMode, useState, useCallback, useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HomeMapCanvas, type EditMode, type Selection } from './HomeMapCanvas'
import type { HomeLevel, AssetMarker, Room, WallSegment, MarkerCategory, HomeMapState } from './types'
import {
  PALETTE, LEVEL_TYPE_LABELS, MARKER_CATEGORY_LABELS, MARKER_CATEGORY_COLOURS,
  parseWalls, newId,
} from './types'

// ─── API helpers ────────────────────────────────────────────────────────────

const api = {
  async createLevel(name: string, type: string): Promise<HomeLevel> {
    const r = await fetch('/api/v1/levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, created_by: 'user' }),
    })
    return r.json()
  },
  async updateLevel(id: string, name: string, type: string, wallsJson: string): Promise<HomeLevel> {
    const r = await fetch(`/api/v1/levels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, walls_json: wallsJson }),
    })
    return r.json()
  },
  async deleteLevel(id: string) {
    await fetch(`/api/v1/levels/${id}`, { method: 'DELETE' })
  },
  async createMarker(levelId: string, label: string, category: string, x: number, y: number, notes: string): Promise<AssetMarker> {
    const r = await fetch(`/api/v1/levels/${levelId}/markers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, category, x_coordinate: x, y_coordinate: y, notes }),
    })
    return r.json()
  },
  async updateMarker(levelId: string, id: string, label: string, category: string, x: number, y: number, notes: string): Promise<AssetMarker> {
    const r = await fetch(`/api/v1/levels/${levelId}/markers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, category, x_coordinate: x, y_coordinate: y, notes }),
    })
    return r.json()
  },
  async deleteMarker(levelId: string, id: string) {
    await fetch(`/api/v1/levels/${levelId}/markers/${id}`, { method: 'DELETE' })
  },
  async createRoom(levelId: string, name: string, x: number, y: number): Promise<Room> {
    const r = await fetch(`/api/v1/levels/${levelId}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, x_coordinate: x, y_coordinate: y }),
    })
    return r.json()
  },
  async updateRoom(levelId: string, id: string, name: string, x: number, y: number): Promise<Room> {
    const r = await fetch(`/api/v1/levels/${levelId}/rooms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, x_coordinate: x, y_coordinate: y }),
    })
    return r.json()
  },
  async deleteRoom(levelId: string, id: string) {
    await fetch(`/api/v1/levels/${levelId}/rooms/${id}`, { method: 'DELETE' })
  },
}

// ─── Inline dialog ────────────────────────────────────────────────────────────

interface DialogProps {
  title: string
  fields: { label: string; key: string; type?: string; value: string }[]
  onConfirm: (values: Record<string, string>) => void
  onCancel: () => void
}

function Dialog({ title, fields, onConfirm, onCancel }: DialogProps) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, f.value]))
  )
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: '1.5rem',
        minWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        fontFamily: 'sans-serif',
      }}>
        <h3 style={{ color: PALETTE.sage, marginBottom: '1rem', fontFamily: 'Georgia, serif' }}>{title}</h3>
        {fields.map(f => (
          <div key={f.key} style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>{f.label}</label>
            <input
              type={f.type ?? 'text'}
              value={vals[f.key]}
              autoFocus={f === fields[0]}
              onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && onConfirm(vals)}
              style={{
                width: '100%', padding: '0.4rem 0.6rem', border: `1px solid ${PALETTE.border}`,
                borderRadius: 4, fontSize: 14, outline: 'none',
              }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button onClick={onCancel} style={btnStyle('ghost')}>Cancel</button>
          <button onClick={() => onConfirm(vals)} style={btnStyle('primary')}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

function btnStyle(variant: 'primary' | 'ghost' | 'danger' | 'tool' | 'tool-active'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '0.35rem 0.8rem', borderRadius: 4, cursor: 'pointer',
    fontSize: 12, fontFamily: 'sans-serif', border: 'none', transition: 'background 0.1s',
  }
  if (variant === 'primary') return { ...base, background: PALETTE.sage, color: '#fff' }
  if (variant === 'ghost') return { ...base, background: 'transparent', color: PALETTE.text, border: `1px solid ${PALETTE.border}` }
  if (variant === 'danger') return { ...base, background: '#fee2e2', color: '#dc2626' }
  if (variant === 'tool') return { ...base, background: PALETTE.bg, color: PALETTE.text, border: `1px solid ${PALETTE.border}` }
  if (variant === 'tool-active') return { ...base, background: PALETTE.sage, color: '#fff', border: `1px solid ${PALETTE.sage}` }
  return base
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type LevelState = { walls: WallSegment[]; markers: AssetMarker[]; rooms: Room[] }

function App({ initialState }: { initialState: HomeMapState }) {
  const [levels, setLevels] = useState<HomeLevel[]>(initialState.levels)
  const [activeLevelId, setActiveLevelId] = useState<string | null>(initialState.levels[0]?.id ?? null)

  // Per-level data indexed by level id
  const [allMarkers, setAllMarkers] = useState<AssetMarker[]>(initialState.markers ?? [])
  const [allRooms, setAllRooms] = useState<Room[]>(initialState.rooms ?? [])
  const [allWalls, setAllWalls] = useState<Record<string, WallSegment[]>>(() => {
    const m: Record<string, WallSegment[]> = {}
    for (const lvl of initialState.levels) m[lvl.id] = parseWalls(lvl.walls_json)
    return m
  })

  const activeLevel = levels.find(l => l.id === activeLevelId) ?? null
  const walls = activeLevelId ? (allWalls[activeLevelId] ?? []) : []
  const markers = allMarkers.filter(m => m.level_id === activeLevelId)
  const rooms = allRooms.filter(r => r.level_id === activeLevelId)

  // Undo/redo
  const [history, setHistory] = useState<LevelState[]>([])
  const [future, setFuture] = useState<LevelState[]>([])

  function snapshot(): LevelState { return { walls: [...walls], markers: [...markers], rooms: [...rooms] } }

  function pushHistory() {
    setHistory(h => [...h.slice(-29), snapshot()])
    setFuture([])
  }

  // Edit state
  const [mode, setMode] = useState<EditMode>('select')
  const [selectedCategory, setSelectedCategory] = useState<MarkerCategory>('OUTLET')
  const [selection, setSelection] = useState<Selection>({ kind: 'none' })

  // Dialogs
  const [markerDialog, setMarkerDialog] = useState<{ x: number; y: number } | null>(null)
  const [roomDialog, setRoomDialog] = useState<{ x: number; y: number } | null>(null)
  const [addLevelDialog, setAddLevelDialog] = useState(false)
  const [renameLevelDialog, setRenameLevelDialog] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function scheduleAutoSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveActiveLevel, 1500)
  }

  async function saveActiveLevel() {
    if (!activeLevel || !activeLevelId) return
    setSaving(true)
    setSaveError(null)
    try {
      const wallsJson = JSON.stringify(allWalls[activeLevelId] ?? [])
      await api.updateLevel(activeLevelId, activeLevel.name, activeLevel.type, wallsJson)
    } catch (_err) {
      setSaveError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Wall mutations
  const handleWallsChange = useCallback((newWalls: WallSegment[]) => {
    if (!activeLevelId) return
    pushHistory()
    setAllWalls(prev => ({ ...prev, [activeLevelId]: newWalls }))
    scheduleAutoSave()
  }, [activeLevelId])

  // Marker mutations
  const handleMarkerPlace = useCallback((x: number, y: number) => {
    setMarkerDialog({ x, y })
    setMode('select')
  }, [])

  const handleMarkerMove = useCallback((id: string, x: number, y: number) => {
    setAllMarkers(prev => prev.map(m => m.id !== id ? m : { ...m, x_coordinate: x, y_coordinate: y }))
  }, [])

  const handleMarkerDelete = useCallback((id: string) => {
    if (!activeLevelId) return
    const marker = allMarkers.find(m => m.id === id)
    if (!marker) return
    pushHistory()
    setAllMarkers(prev => prev.filter(m => m.id !== id))
    api.deleteMarker(activeLevelId, id).catch(() => setSaveError('Delete failed'))
  }, [activeLevelId, allMarkers])

  const handleMarkerSaveMove = useCallback(async (id: string, x: number, y: number) => {
    if (!activeLevelId) return
    const marker = allMarkers.find(m => m.id === id)
    if (!marker) return
    try {
      await api.updateMarker(activeLevelId, id, marker.label, String(marker.category), x, y, marker.notes)
    } catch { setSaveError('Save failed') }
  }, [activeLevelId, allMarkers])

  // Room mutations
  const handleRoomPlace = useCallback((x: number, y: number) => {
    setRoomDialog({ x, y })
    setMode('select')
  }, [])

  const handleRoomMove = useCallback((id: string, x: number, y: number) => {
    setAllRooms(prev => prev.map(r => r.id !== id ? r : { ...r, x_coordinate: x, y_coordinate: y }))
  }, [])

  const handleRoomDelete = useCallback((id: string) => {
    if (!activeLevelId) return
    pushHistory()
    setAllRooms(prev => prev.filter(r => r.id !== id))
    api.deleteRoom(activeLevelId, id).catch(() => setSaveError('Delete failed'))
  }, [activeLevelId])

  // Save marker moves on mouse-up (debounce handled by the drag end)
  useEffect(() => {
    const up = (_e: MouseEvent) => {
      if (!activeLevelId) return
      const sel = selection
      if (sel.kind === 'marker' && sel.markerId) {
        const m = allMarkers.find(x => x.id === sel.markerId)
        if (m) handleMarkerSaveMove(m.id, m.x_coordinate, m.y_coordinate)
      }
      if (sel.kind === 'room' && sel.roomId) {
        const room = allRooms.find(r => r.id === sel.roomId)
        if (room) {
          api.updateRoom(activeLevelId, room.id, room.name, room.x_coordinate, room.y_coordinate).catch(() => setSaveError('Save failed'))
        }
      }
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [activeLevelId, selection, allMarkers, allRooms, handleMarkerSaveMove])

  // Undo/redo
  function undo() {
    if (history.length === 0 || !activeLevelId) return
    const prev = history[history.length - 1]
    setFuture(f => [snapshot(), ...f])
    setHistory(h => h.slice(0, -1))
    setAllWalls(w => ({ ...w, [activeLevelId]: prev.walls }))
    setAllMarkers(ms => [...ms.filter(m => m.level_id !== activeLevelId), ...prev.markers])
    setAllRooms(rs => [...rs.filter(r => r.level_id !== activeLevelId), ...prev.rooms])
    scheduleAutoSave()
  }

  function redo() {
    if (future.length === 0 || !activeLevelId) return
    const next = future[0]
    setHistory(h => [...h, snapshot()])
    setFuture(f => f.slice(1))
    setAllWalls(w => ({ ...w, [activeLevelId]: next.walls }))
    setAllMarkers(ms => [...ms.filter(m => m.level_id !== activeLevelId), ...next.markers])
    setAllRooms(rs => [...rs.filter(r => r.level_id !== activeLevelId), ...next.rooms])
    scheduleAutoSave()
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); undo() }
        if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); redo() }
        if (e.key === 's') { e.preventDefault(); saveActiveLevel() }
      }
      if (e.key === 's') setMode('select')
      if (e.key === 'd') setMode('draw')
      if (e.key === 'r') setMode('room')
      if (e.key === 'm') setMode('marker')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line

  // Selection-based property edits
  const selectedMarker = selection.kind === 'marker' ? allMarkers.find(m => m.id === selection.markerId) ?? null : null
  const selectedRoom = selection.kind === 'room' ? allRooms.find(r => r.id === selection.roomId) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: PALETTE.bg }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 1rem',
        height: 44, background: '#fff', borderBottom: `1px solid ${PALETTE.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#999', marginRight: 4 }}>MODE</span>
        {([['select', 'Select (S)'], ['draw', 'Draw Walls (D)'], ['room', 'Room Label (R)'], ['marker', 'Place Marker (M)']] as [EditMode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} title={label} style={btnStyle(mode === m ? 'tool-active' : 'tool')}>
            {label.split(' (')[0]}
          </button>
        ))}

        {mode === 'marker' && (
          <>
            <div style={{ width: 1, height: 24, background: PALETTE.border, margin: '0 4px' }} />
            <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#999' }}>TYPE</span>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value as MarkerCategory)}
              style={{ fontSize: 12, padding: '0.2rem 0.4rem', border: `1px solid ${PALETTE.border}`, borderRadius: 4, fontFamily: 'sans-serif' }}
            >
              {(Object.keys(MARKER_CATEGORY_LABELS) as MarkerCategory[]).map(c => (
                <option key={c} value={c}>{MARKER_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </>
        )}

        <div style={{ flex: 1 }} />

        <button onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)" style={btnStyle('ghost')}>↩ Undo</button>
        <button onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Y)" style={btnStyle('ghost')}>↪ Redo</button>
        <div style={{ width: 1, height: 24, background: PALETTE.border, margin: '0 4px' }} />
        <button onClick={saveActiveLevel} disabled={saving || !activeLevel} style={btnStyle('primary')}>
          {saving ? 'Saving…' : '💾 Save'}
        </button>
        {saveError && <span style={{ color: '#dc2626', fontSize: 12, fontFamily: 'sans-serif' }}>{saveError}</span>}
      </div>

      {/* Body: levels panel + canvas + properties panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Levels Panel */}
        <aside style={{
          width: 200, background: '#fff', borderRight: `1px solid ${PALETTE.border}`,
          display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
        }}>
          <div style={{ padding: '0.75rem 0.75rem 0.5rem', borderBottom: `1px solid ${PALETTE.border}` }}>
            <span style={{ fontSize: 11, fontFamily: 'sans-serif', color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Levels</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {levels.map(lvl => (
              <div
                key={lvl.id}
                onClick={() => { setActiveLevelId(lvl.id); setSelection({ kind: 'none' }) }}
                style={{
                  padding: '0.5rem 0.6rem', marginBottom: 3, borderRadius: 5, cursor: 'pointer',
                  background: lvl.id === activeLevelId ? PALETTE.sage : 'transparent',
                  color: lvl.id === activeLevelId ? '#fff' : PALETTE.text,
                  fontFamily: 'sans-serif', fontSize: 13,
                  border: `1px solid ${lvl.id === activeLevelId ? PALETTE.sage : PALETTE.border}`,
                }}
              >
                <div style={{ fontWeight: 500 }}>{lvl.name}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{LEVEL_TYPE_LABELS[lvl.type] ?? lvl.type}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0.5rem', borderTop: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => setAddLevelDialog(true)} style={{ ...btnStyle('primary'), width: '100%', textAlign: 'center' }}>+ Add Level</button>
            {activeLevel && (
              <>
                <button onClick={() => setRenameLevelDialog(true)} style={{ ...btnStyle('ghost'), width: '100%', textAlign: 'center' }}>Rename</button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${activeLevel.name}"? All walls, markers, and rooms will be lost.`)) return
                    await api.deleteLevel(activeLevelId!)
                    const remaining = levels.filter(l => l.id !== activeLevelId)
                    setLevels(remaining)
                    setAllWalls(w => { const n = { ...w }; delete n[activeLevelId!]; return n })
                    setAllMarkers(ms => ms.filter(m => m.level_id !== activeLevelId))
                    setAllRooms(rs => rs.filter(r => r.level_id !== activeLevelId))
                    setActiveLevelId(remaining[0]?.id ?? null)
                  }}
                  style={{ ...btnStyle('danger'), width: '100%', textAlign: 'center' }}
                >Delete Level</button>
              </>
            )}
          </div>
        </aside>

        {/* Canvas */}
        <div style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: `repeating-linear-gradient(0deg,transparent,transparent 39px,${PALETTE.border} 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,${PALETTE.border} 40px),${PALETTE.bg}`,
        }}>
          {activeLevel ? (
            <HomeMapCanvas
              walls={walls}
              markers={markers}
              rooms={rooms}
              mode={mode}
              selectedCategory={selectedCategory}
              onWallsChange={handleWallsChange}
              onMarkerPlace={handleMarkerPlace}
              onMarkerMove={handleMarkerMove}
              onMarkerDelete={handleMarkerDelete}
              onRoomPlace={handleRoomPlace}
              onRoomMove={handleRoomMove}
              onRoomDelete={handleRoomDelete}
              selection={selection}
              onSelectionChange={setSelection}
            />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', fontFamily: 'sans-serif', color: '#999', fontSize: 14,
            }}>
              Add a level to get started
            </div>
          )}
          {/* Mode hint */}
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 20,
            padding: '0.25rem 0.9rem', fontSize: 11, fontFamily: 'sans-serif',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {mode === 'select' && 'Click to select · Drag to move · Delete to remove'}
            {mode === 'draw' && 'Click to place vertices · Double-click to finish · Esc to cancel'}
            {mode === 'room' && 'Click to place a room label'}
            {mode === 'marker' && `Click to place ${MARKER_CATEGORY_LABELS[selectedCategory]} marker`}
          </div>
        </div>

        {/* Properties Panel */}
        <aside style={{
          width: 220, background: '#fff', borderLeft: `1px solid ${PALETTE.border}`,
          display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
        }}>
          <div style={{ padding: '0.75rem 0.75rem 0.5rem', borderBottom: `1px solid ${PALETTE.border}` }}>
            <span style={{ fontSize: 11, fontFamily: 'sans-serif', color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Properties</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            {selection.kind === 'none' && (
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#aaa' }}>Select an element on the canvas to view and edit its properties.</p>
            )}
            {selection.kind === 'wall' && (
              <WallProps
                wallId={selection.wallId!}
                walls={walls}
                onDelete={() => {
                  handleWallsChange(walls.filter(w => w.id !== selection.wallId))
                  setSelection({ kind: 'none' })
                }}
              />
            )}
            {selection.kind === 'vertex' && (
              <VertexProps
                wallId={selection.wallId!}
                pointIndex={selection.pointIndex!}
                walls={walls}
                onWallsChange={handleWallsChange}
              />
            )}
            {selectedMarker && activeLevelId && (
              <MarkerProps
                marker={selectedMarker}
                onUpdate={async (label, category, notes) => {
                  const updated = await api.updateMarker(activeLevelId, selectedMarker.id, label, category, selectedMarker.x_coordinate, selectedMarker.y_coordinate, notes)
                  setAllMarkers(ms => ms.map(m => m.id === updated.id ? updated : m))
                }}
                onDelete={() => handleMarkerDelete(selectedMarker.id)}
              />
            )}
            {selectedRoom && activeLevelId && (
              <RoomProps
                room={selectedRoom}
                onUpdate={async (name) => {
                  const updated = await api.updateRoom(activeLevelId, selectedRoom.id, name, selectedRoom.x_coordinate, selectedRoom.y_coordinate)
                  setAllRooms(rs => rs.map(r => r.id === updated.id ? updated : r))
                }}
                onDelete={() => handleRoomDelete(selectedRoom.id)}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Dialogs */}
      {addLevelDialog && (
        <Dialog
          title="Add Level"
          fields={[
            { label: 'Name', key: 'name', value: '' },
            { label: 'Type', key: 'type', value: 'GROUND' },
          ]}
          onConfirm={async vals => {
            setAddLevelDialog(false)
            const lvl = await api.createLevel(vals.name || 'New Level', vals.type || 'GROUND')
            setLevels(prev => [...prev, lvl])
            setAllWalls(w => ({ ...w, [lvl.id]: [] }))
            setActiveLevelId(lvl.id)
          }}
          onCancel={() => setAddLevelDialog(false)}
        />
      )}
      {renameLevelDialog && activeLevel && (
        <Dialog
          title="Rename Level"
          fields={[
            { label: 'Name', key: 'name', value: activeLevel.name },
            { label: 'Type', key: 'type', value: activeLevel.type },
          ]}
          onConfirm={async vals => {
            setRenameLevelDialog(false)
            const updated = await api.updateLevel(activeLevelId!, vals.name, vals.type, JSON.stringify(allWalls[activeLevelId!] ?? []))
            setLevels(prev => prev.map(l => l.id === updated.id ? updated : l))
          }}
          onCancel={() => setRenameLevelDialog(false)}
        />
      )}
      {markerDialog && activeLevelId && (
        <Dialog
          title="Add Marker"
          fields={[
            { label: 'Label', key: 'label', value: MARKER_CATEGORY_LABELS[selectedCategory] },
            { label: 'Notes', key: 'notes', value: '' },
          ]}
          onConfirm={async vals => {
            const d = markerDialog
            setMarkerDialog(null)
            const m = await api.createMarker(activeLevelId, vals.label || 'Marker', selectedCategory, d.x, d.y, vals.notes)
            setAllMarkers(prev => [...prev, m])
          }}
          onCancel={() => setMarkerDialog(null)}
        />
      )}
      {roomDialog && activeLevelId && (
        <Dialog
          title="Add Room Label"
          fields={[{ label: 'Room Name', key: 'name', value: '' }]}
          onConfirm={async vals => {
            const d = roomDialog
            setRoomDialog(null)
            const r = await api.createRoom(activeLevelId, vals.name || 'Room', d.x, d.y)
            setAllRooms(prev => [...prev, r])
          }}
          onCancel={() => setRoomDialog(null)}
        />
      )}
    </div>
  )
}

// ─── Property sub-panels ──────────────────────────────────────────────────────

function WallProps({ wallId, walls, onDelete }: { wallId: string; walls: WallSegment[]; onDelete: () => void }) {
  const wall = walls.find(w => w.id === wallId)
  if (!wall) return null
  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 12 }}>
      <PropRow label="Segment" value={`${wall.points.length} vertices`} />
      <PropRow label="Closed" value={wall.closed ? 'Yes' : 'No'} />
      <button onClick={onDelete} style={{ ...btnStyle('danger'), marginTop: 12, width: '100%' }}>Delete Wall</button>
    </div>
  )
}

function VertexProps({ wallId, pointIndex, walls, onWallsChange }: {
  wallId: string; pointIndex: number; walls: WallSegment[]; onWallsChange: (w: WallSegment[]) => void
}) {
  const wall = walls.find(w => w.id === wallId)
  const pt = wall?.points[pointIndex]
  if (!pt) return null
  const set = (axis: 'x' | 'y', val: string) => {
    const v = parseFloat(val)
    if (isNaN(v)) return
    onWallsChange(walls.map(w => w.id !== wallId ? w : {
      ...w, points: w.points.map((p, i) => i !== pointIndex ? p : { ...p, [axis]: Math.min(100, Math.max(0, v)) })
    }))
  }
  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 12 }}>
      <PropLabel>X Position (%)</PropLabel>
      <input type="number" min={0} max={100} step={0.1} defaultValue={pt.x.toFixed(1)}
        onBlur={e => set('x', e.target.value)} style={inputStyle} />
      <PropLabel>Y Position (%)</PropLabel>
      <input type="number" min={0} max={100} step={0.1} defaultValue={pt.y.toFixed(1)}
        onBlur={e => set('y', e.target.value)} style={inputStyle} />
      <p style={{ color: '#aaa', fontSize: 11, marginTop: 8 }}>Delete key removes this vertex</p>
    </div>
  )
}

function MarkerProps({ marker, onUpdate, onDelete }: {
  marker: AssetMarker
  onUpdate: (label: string, category: string, notes: string) => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(marker.label)
  const [category, setCategory] = useState<MarkerCategory>(marker.category)
  const [notes, setNotes] = useState(marker.notes)

  useEffect(() => { setLabel(marker.label); setCategory(marker.category); setNotes(marker.notes) }, [marker.id])

  const colour = MARKER_CATEGORY_COLOURS[category]

  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 16, height: 16, background: colour, borderRadius: 3 }} />
        <span style={{ fontWeight: 600, color: PALETTE.text }}>{marker.label}</span>
      </div>
      <PropLabel>Label</PropLabel>
      <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} />
      <PropLabel>Category</PropLabel>
      <select value={category} onChange={e => setCategory(e.target.value as MarkerCategory)} style={inputStyle}>
        {(Object.keys(MARKER_CATEGORY_LABELS) as MarkerCategory[]).map(c => (
          <option key={c} value={c}>{MARKER_CATEGORY_LABELS[c]}</option>
        ))}
      </select>
      <PropLabel>Notes</PropLabel>
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
      <PropRow label="Position" value={`${marker.x_coordinate.toFixed(1)}%, ${marker.y_coordinate.toFixed(1)}%`} />
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={() => onUpdate(label, category, notes)} style={btnStyle('primary')}>Save</button>
        <button onClick={onDelete} style={btnStyle('danger')}>Delete</button>
      </div>
    </div>
  )
}

function RoomProps({ room, onUpdate, onDelete }: {
  room: Room; onUpdate: (name: string) => void; onDelete: () => void
}) {
  const [name, setName] = useState(room.name)
  useEffect(() => { setName(room.name) }, [room.id])
  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 12 }}>
      <PropLabel>Room Name</PropLabel>
      <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      <PropRow label="Position" value={`${room.x_coordinate.toFixed(1)}%, ${room.y_coordinate.toFixed(1)}%`} />
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={() => onUpdate(name)} style={btnStyle('primary')}>Save</button>
        <button onClick={onDelete} style={btnStyle('danger')}>Delete</button>
      </div>
    </div>
  )
}

function PropLabel({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 3, marginTop: 8 }}>{children}</label>
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, fontFamily: 'sans-serif' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: PALETTE.text }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.3rem 0.5rem', fontSize: 12, fontFamily: 'sans-serif',
  border: `1px solid ${PALETTE.border}`, borderRadius: 4, outline: 'none',
  background: PALETTE.bg, color: PALETTE.text,
}

// ─── Mount ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('home-map-root')
  if (!root) return

  let initialState: HomeMapState = { levels: [], markers: [], rooms: [] }
  const raw = root.dataset.state
  if (raw) {
    try { initialState = JSON.parse(raw) } catch (e) { console.error('FullerHome: failed to parse state', e) }
  }

  // Ensure arrays are always present
  initialState.markers ??= []
  initialState.rooms ??= []

  createRoot(root).render(
    <StrictMode>
      <App initialState={initialState} />
    </StrictMode>
  )
})

// Keep old canvas root name working for backward compat
void newId
