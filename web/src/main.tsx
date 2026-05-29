import { StrictMode, useState, useCallback, useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HomeMapCanvas, type EditMode, type Selection, type GhostLevel } from './HomeMapCanvas'
import type { HomeLevel, AssetMarker, Room, Zone, WallSegment, MarkerCategory, ZoneType, HomeMapState, Point, MapConfig, GridUnit } from './types'
import {
  PALETTE, LEVEL_TYPE_LABELS, MARKER_CATEGORY_LABELS, MARKER_CATEGORY_COLOURS,
  ZONE_TYPE_LABELS, ZONE_TYPE_COLOURS, GRID_UNIT_LABELS,
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
  async updateLevel(id: string, name: string, type: string, wallsJson: string, mapConfigJson = ''): Promise<HomeLevel> {
    const r = await fetch(`/api/v1/levels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, walls_json: wallsJson, map_config_json: mapConfigJson }),
    })
    return r.json()
  },
  async reorderLevel(id: string, orderIndex: number) {
    const r = await fetch(`/api/v1/levels/${id}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_index: orderIndex }),
    })
    if (!r.ok) throw new Error(`reorder failed: ${r.status}`)
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
  async createZone(levelId: string, name: string, type: string, pointsJson: string): Promise<Zone> {
    const r = await fetch(`/api/v1/levels/${levelId}/zones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, points_json: pointsJson }),
    })
    return r.json()
  },
  async updateZone(levelId: string, id: string, name: string, type: string, pointsJson: string): Promise<Zone> {
    const r = await fetch(`/api/v1/levels/${levelId}/zones/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, points_json: pointsJson }),
    })
    return r.json()
  },
  async deleteZone(levelId: string, id: string) {
    await fetch(`/api/v1/levels/${levelId}/zones/${id}`, { method: 'DELETE' })
  },
}

// ─── Dialog ────────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string; disabled?: boolean }

interface DialogField {
  label: string
  key: string
  type?: 'text' | 'select'
  value: string
  options?: SelectOption[]
}

interface DialogProps {
  title: string
  fields: DialogField[]
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
        minWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        fontFamily: 'sans-serif',
      }}>
        <h3 style={{ color: PALETTE.sage, marginBottom: '1rem', fontFamily: 'Georgia, serif' }}>{title}</h3>
        {fields.map(f => (
          <div key={f.key} style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>{f.label}</label>
            {f.type === 'select' ? (
              <select
                value={vals[f.key]}
                onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '0.4rem 0.6rem', border: `1px solid ${PALETTE.border}`, borderRadius: 4, fontSize: 14, outline: 'none', fontFamily: 'sans-serif' }}
              >
                {f.options?.map(opt => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={vals[f.key]}
                autoFocus={f === fields[0]}
                onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && onConfirm(vals)}
                style={{
                  width: '100%', padding: '0.4rem 0.6rem', border: `1px solid ${PALETTE.border}`,
                  borderRadius: 4, fontSize: 14, outline: 'none',
                }}
              />
            )}
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

// ─── Level type options (enforces single ground floor) ────────────────────────

const ALL_LEVEL_TYPES = Object.keys(LEVEL_TYPE_LABELS) as (keyof typeof LEVEL_TYPE_LABELS)[]

function levelTypeOptions(existingLevels: HomeLevel[], excludeLevelId?: string): SelectOption[] {
  const hasGround = existingLevels.some(l => l.type === 'GROUND' && l.id !== excludeLevelId)
  return ALL_LEVEL_TYPES.map(t => ({
    value: t,
    label: LEVEL_TYPE_LABELS[t],
    disabled: t === 'GROUND' && hasGround,
  }))
}

// ─── Main App ─────────────────────────────────────────────────────────────────

type LevelState = { walls: WallSegment[]; markers: AssetMarker[]; rooms: Room[]; zones: Zone[] }

function App({ initialState }: { initialState: HomeMapState }) {
  const [levels, setLevels] = useState<HomeLevel[]>(initialState.levels)
  const [activeLevelId, setActiveLevelId] = useState<string | null>(initialState.levels[0]?.id ?? null)

  const [allMarkers, setAllMarkers] = useState<AssetMarker[]>(initialState.markers ?? [])
  const [allRooms, setAllRooms] = useState<Room[]>(initialState.rooms ?? [])
  const [allZones, setAllZones] = useState<Zone[]>(initialState.zones ?? [])
  const [allWalls, setAllWalls] = useState<Record<string, WallSegment[]>>(() => {
    const m: Record<string, WallSegment[]> = {}
    for (const lvl of initialState.levels) m[lvl.id] = parseWalls(lvl.walls_json)
    return m
  })

  const activeLevel = levels.find(l => l.id === activeLevelId) ?? null
  const walls = activeLevelId ? (allWalls[activeLevelId] ?? []) : []
  const markers = allMarkers.filter(m => m.level_id === activeLevelId)
  const rooms = allRooms.filter(r => r.level_id === activeLevelId)
  const zones = allZones.filter(z => z.level_id === activeLevelId)

  // Ghost levels: all other levels' data
  const ghostLevels: GhostLevel[] = levels
    .filter(l => l.id !== activeLevelId)
    .map(l => ({
      walls: allWalls[l.id] ?? [],
      markers: allMarkers.filter(m => m.level_id === l.id),
      rooms: allRooms.filter(r => r.level_id === l.id),
      zones: allZones.filter(z => z.level_id === l.id),
    }))

  // Undo/redo
  const [history, setHistory] = useState<LevelState[]>([])
  const [future, setFuture] = useState<LevelState[]>([])

  function snapshot(): LevelState { return { walls: [...walls], markers: [...markers], rooms: [...rooms], zones: [...zones] } }

  function pushHistory() {
    setHistory(h => [...h.slice(-29), snapshot()])
    setFuture([])
  }

  // Edit state
  const [mode, setMode] = useState<EditMode>('select')
  const [selectedCategory, setSelectedCategory] = useState<MarkerCategory>('OUTLET')
  const [selectedZoneType, setSelectedZoneType] = useState<ZoneType>('GRASS')
  const [selection, setSelection] = useState<Selection>({ kind: 'none' })

  // Dialogs
  const [markerDialog, setMarkerDialog] = useState<{ x: number; y: number } | null>(null)
  const [roomDialog, setRoomDialog] = useState<{ x: number; y: number } | null>(null)
  const [zoneDialog, setZoneDialog] = useState<{ points: Point[]; type: ZoneType } | null>(null)
  const [addLevelDialog, setAddLevelDialog] = useState(false)
  const [renameLevelDialog, setRenameLevelDialog] = useState(false)

  // Map background state (satellite tiles per level)
  const [mapConfigs, setMapConfigs] = useState<Record<string, MapConfig | null>>(() => {
    const m: Record<string, MapConfig | null> = {}
    for (const lvl of initialState.levels) {
      try { m[lvl.id] = lvl.map_config_json ? JSON.parse(lvl.map_config_json) : null } catch { m[lvl.id] = null }
    }
    return m
  })
  const [showMapPanel, setShowMapPanel] = useState(false)
  const [mapAddress, setMapAddress] = useState('')
  const [mapZoom, setMapZoom] = useState(18)
  const [mapOpacity, setMapOpacity] = useState(0.6)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)

  // Keep panel fields in sync with the active level's config
  useEffect(() => {
    if (!activeLevelId) return
    const cfg = mapConfigs[activeLevelId]
    if (cfg) { setMapZoom(cfg.zoom); setMapOpacity(cfg.opacity) }
  }, [activeLevelId]) // eslint-disable-line

  // Grid unit
  const [gridUnit, setGridUnit] = useState<GridUnit>('none')

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
      const cfg = mapConfigs[activeLevelId]
      const mapConfigJson = cfg ? JSON.stringify(cfg) : ''
      await api.updateLevel(activeLevelId, activeLevel.name, activeLevel.type, wallsJson, mapConfigJson)
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

  // Map background
  async function handleGeocode() {
    if (!mapAddress.trim() || !activeLevelId) return
    setGeocoding(true)
    setGeocodeError(null)
    try {
      const r = await fetch(`/api/v1/geocode?q=${encodeURIComponent(mapAddress.trim())}`)
      if (!r.ok) { setGeocodeError('Address not found'); return }
      const { lat, lon } = await r.json()
      const cfg: MapConfig = { lat, lon, zoom: mapZoom, opacity: mapOpacity }
      setMapConfigs(prev => ({ ...prev, [activeLevelId]: cfg }))
      scheduleAutoSave()
    } catch { setGeocodeError('Geocoding failed') } finally { setGeocoding(false) }
  }

  function handleClearMapBg() {
    if (!activeLevelId) return
    setMapConfigs(prev => ({ ...prev, [activeLevelId]: null }))
    scheduleAutoSave()
  }

  function handleMapConfigChange(partial: Partial<MapConfig>) {
    if (!activeLevelId) return
    setMapConfigs(prev => {
      const existing = prev[activeLevelId] ?? { lat: 0, lon: 0, zoom: mapZoom, opacity: mapOpacity }
      return { ...prev, [activeLevelId]: { ...existing, ...partial } }
    })
    scheduleAutoSave()
  }

  // Zone mutations
  const handleZoneCreate = useCallback((points: Point[], type: ZoneType, name: string) => {
    if (!activeLevelId) return
    if (name === '') {
      // Show dialog to name the zone
      setZoneDialog({ points, type })
      setMode('select')
      return
    }
    const pointsJson = JSON.stringify(points)
    api.createZone(activeLevelId, name, type, pointsJson)
      .then(z => setAllZones(prev => [...prev, z]))
      .catch(() => setSaveError('Save failed'))
  }, [activeLevelId])

  const handleZoneDelete = useCallback((id: string) => {
    if (!activeLevelId) return
    const zone = allZones.find(z => z.id === id)
    if (!zone) return
    setAllZones(prev => prev.filter(z => z.id !== id))
    api.deleteZone(activeLevelId, id).catch(() => setSaveError('Delete failed'))
  }, [activeLevelId, allZones])

  // Level reordering
  async function handleMoveLevel(id: string, dir: 'up' | 'down') {
    const sorted = [...levels].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex(l => l.id === id)
    if (idx === -1) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[swapIdx]
    // Use positional indexes so the two slots always get distinct values,
    // even when they currently share an order_index.
    const aNew = swapIdx
    const bNew = idx
    try {
      await api.reorderLevel(a.id, aNew)
      await api.reorderLevel(b.id, bNew)
    } catch {
      setSaveError('Reorder failed')
      return
    }
    setLevels(prev => prev.map(l =>
      l.id === a.id ? { ...l, order_index: aNew } :
      l.id === b.id ? { ...l, order_index: bNew } : l
    ))
  }

  // Save marker/room moves on mouse-up
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
    setAllZones(zs => [...zs.filter(z => z.level_id !== activeLevelId), ...prev.zones])
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
    setAllZones(zs => [...zs.filter(z => z.level_id !== activeLevelId), ...next.zones])
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
      if (e.key === 'z' && !e.ctrlKey && !e.metaKey) setMode('zone')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line

  const selectedMarker = selection.kind === 'marker' ? allMarkers.find(m => m.id === selection.markerId) ?? null : null
  const selectedRoom = selection.kind === 'room' ? allRooms.find(r => r.id === selection.roomId) ?? null : null
  const selectedZone = selection.kind === 'zone' ? allZones.find(z => z.id === selection.zoneId) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: PALETTE.bg }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 1rem',
        height: 44, background: '#fff', borderBottom: `1px solid ${PALETTE.border}`,
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#999', marginRight: 4 }}>MODE</span>
        {([
          ['select', 'Select (S)'],
          ['draw', 'Draw Walls (D)'],
          ['zone', 'Draw Zone (Z)'],
          ['room', 'Room Label (R)'],
          ['marker', 'Place Marker (M)'],
        ] as [EditMode, string][]).map(([m, label]) => (
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

        {mode === 'zone' && (
          <>
            <div style={{ width: 1, height: 24, background: PALETTE.border, margin: '0 4px' }} />
            <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#999' }}>ZONE</span>
            <select
              value={selectedZoneType}
              onChange={e => setSelectedZoneType(e.target.value as ZoneType)}
              style={{ fontSize: 12, padding: '0.2rem 0.4rem', border: `1px solid ${PALETTE.border}`, borderRadius: 4, fontFamily: 'sans-serif' }}
            >
              {(Object.keys(ZONE_TYPE_LABELS) as ZoneType[]).map(z => (
                <option key={z} value={z} style={{ color: ZONE_TYPE_COLOURS[z] }}>{ZONE_TYPE_LABELS[z]}</option>
              ))}
            </select>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: ZONE_TYPE_COLOURS[selectedZoneType] }} />
          </>
        )}

        <div style={{ flex: 1 }} />

        <span style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#bbb' }}>Scroll=zoom · Space+drag=pan · 0=reset</span>
        <div style={{ width: 1, height: 24, background: PALETTE.border, margin: '0 4px' }} />
        <button onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)" style={btnStyle('ghost')}>↩ Undo</button>
        <button onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Y)" style={btnStyle('ghost')}>↪ Redo</button>
        <div style={{ width: 1, height: 24, background: PALETTE.border, margin: '0 4px' }} />
        <button
          onClick={() => setShowMapPanel(p => !p)}
          title="Satellite background"
          style={btnStyle(showMapPanel ? 'tool-active' : 'tool')}
        >Map Bg</button>
        <div style={{ width: 1, height: 24, background: PALETTE.border, margin: '0 4px' }} />
        <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#999' }}>SCALE</span>
        <select
          value={gridUnit}
          onChange={e => setGridUnit(e.target.value as GridUnit)}
          style={{ fontSize: 12, padding: '0.2rem 0.4rem', border: `1px solid ${PALETTE.border}`, borderRadius: 4, fontFamily: 'sans-serif' }}
        >
          {(Object.keys(GRID_UNIT_LABELS) as GridUnit[]).map(u => (
            <option key={u} value={u}>{GRID_UNIT_LABELS[u]}</option>
          ))}
        </select>
        <div style={{ width: 1, height: 24, background: PALETTE.border, margin: '0 4px' }} />
        <button onClick={saveActiveLevel} disabled={saving || !activeLevel} style={btnStyle('primary')}>
          {saving ? 'Saving…' : '💾 Save'}
        </button>
        {saveError && <span style={{ color: '#dc2626', fontSize: 12, fontFamily: 'sans-serif' }}>{saveError}</span>}
      </div>

      {/* Body */}
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
            {[...levels].sort((a, b) => a.order_index - b.order_index).map((lvl, idx, sorted) => (
              <div key={lvl.id} style={{ display: 'flex', alignItems: 'stretch', marginBottom: 3, gap: 3 }}>
                <div
                  onClick={() => { setActiveLevelId(lvl.id); setSelection({ kind: 'none' }) }}
                  style={{
                    flex: 1, padding: '0.5rem 0.6rem', borderRadius: 5, cursor: 'pointer',
                    background: lvl.id === activeLevelId ? PALETTE.sage : 'transparent',
                    color: lvl.id === activeLevelId ? '#fff' : PALETTE.text,
                    fontFamily: 'sans-serif', fontSize: 13,
                    border: `1px solid ${lvl.id === activeLevelId ? PALETTE.sage : PALETTE.border}`,
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{lvl.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{LEVEL_TYPE_LABELS[lvl.type] ?? lvl.type}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button
                    onClick={e => { e.stopPropagation(); handleMoveLevel(lvl.id, 'up') }}
                    disabled={idx === 0}
                    title="Move up"
                    style={{
                      flex: 1, padding: '0 5px', fontSize: 10, cursor: idx === 0 ? 'default' : 'pointer',
                      border: `1px solid ${PALETTE.border}`, borderRadius: 3, background: PALETTE.bg,
                      color: PALETTE.text, opacity: idx === 0 ? 0.3 : 1, fontFamily: 'sans-serif',
                    }}
                  >↑</button>
                  <button
                    onClick={e => { e.stopPropagation(); handleMoveLevel(lvl.id, 'down') }}
                    disabled={idx === sorted.length - 1}
                    title="Move down"
                    style={{
                      flex: 1, padding: '0 5px', fontSize: 10, cursor: idx === sorted.length - 1 ? 'default' : 'pointer',
                      border: `1px solid ${PALETTE.border}`, borderRadius: 3, background: PALETTE.bg,
                      color: PALETTE.text, opacity: idx === sorted.length - 1 ? 0.3 : 1, fontFamily: 'sans-serif',
                    }}
                  >↓</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0.5rem', borderTop: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => setAddLevelDialog(true)} style={{ ...btnStyle('primary'), width: '100%', textAlign: 'center' }}>+ Add Level</button>
            {activeLevel && (
              <>
                <button onClick={() => setRenameLevelDialog(true)} style={{ ...btnStyle('ghost'), width: '100%', textAlign: 'center' }}>Edit Level</button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${activeLevel.name}"? All walls, markers, rooms, and zones will be lost.`)) return
                    await api.deleteLevel(activeLevelId!)
                    const remaining = levels.filter(l => l.id !== activeLevelId)
                    setLevels(remaining)
                    setAllWalls(w => { const n = { ...w }; delete n[activeLevelId!]; return n })
                    setAllMarkers(ms => ms.filter(m => m.level_id !== activeLevelId))
                    setAllRooms(rs => rs.filter(r => r.level_id !== activeLevelId))
                    setAllZones(zs => zs.filter(z => z.level_id !== activeLevelId))
                    setActiveLevelId(remaining[0]?.id ?? null)
                  }}
                  style={{ ...btnStyle('danger'), width: '100%', textAlign: 'center' }}
                >Delete Level</button>
              </>
            )}
          </div>
        </aside>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: PALETTE.bg }}>
          {activeLevel ? (
            <HomeMapCanvas
              walls={walls}
              markers={markers}
              rooms={rooms}
              zones={zones}
              ghostLevels={ghostLevels}
              mode={mode}
              selectedCategory={selectedCategory}
              selectedZoneType={selectedZoneType}
              mapConfig={activeLevelId ? (mapConfigs[activeLevelId] ?? null) : null}
              gridUnit={gridUnit}
              onWallsChange={handleWallsChange}
              onMarkerPlace={handleMarkerPlace}
              onMarkerMove={handleMarkerMove}
              onMarkerDelete={handleMarkerDelete}
              onRoomPlace={handleRoomPlace}
              onRoomMove={handleRoomMove}
              onRoomDelete={handleRoomDelete}
              onZoneCreate={handleZoneCreate}
              onZoneDelete={handleZoneDelete}
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
            {mode === 'zone' && `Click to place zone vertices · Double-click to finish (≥3 pts) · Esc to cancel`}
            {mode === 'room' && 'Click to place a room label'}
            {mode === 'marker' && `Click to place ${MARKER_CATEGORY_LABELS[selectedCategory]} marker`}
          </div>

          {/* Satellite map background panel */}
          {showMapPanel && activeLevelId && (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: '#fff', border: `1px solid ${PALETTE.border}`, borderRadius: 8,
              padding: '1rem', width: 260, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
              fontFamily: 'sans-serif', fontSize: 12, zIndex: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600, color: PALETTE.sage, fontSize: 13 }}>Satellite Background</span>
                <button onClick={() => setShowMapPanel(false)} style={{ ...btnStyle('ghost'), padding: '0.1rem 0.4rem', fontSize: 14, lineHeight: 1 }}>×</button>
              </div>

              <label style={{ display: 'block', color: '#888', marginBottom: 3 }}>Address or place name</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: '0.6rem' }}>
                <input
                  type="text"
                  placeholder="e.g. 123 Main St, Springfield"
                  value={mapAddress}
                  onChange={e => setMapAddress(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                  style={{ flex: 1, padding: '0.3rem 0.5rem', border: `1px solid ${PALETTE.border}`, borderRadius: 4, fontSize: 12, outline: 'none' }}
                />
                <button onClick={handleGeocode} disabled={geocoding || !mapAddress.trim()} style={btnStyle('primary')}>
                  {geocoding ? '…' : 'Find'}
                </button>
              </div>
              {geocodeError && <p style={{ color: '#dc2626', margin: '0 0 0.5rem', fontSize: 11 }}>{geocodeError}</p>}

              <label style={{ display: 'block', color: '#888', marginBottom: 3 }}>
                Zoom level ({mapZoom})
                <span style={{ float: 'right', color: '#bbb' }}>14 – 21</span>
              </label>
              <input
                type="range" min={14} max={21} value={mapZoom}
                onChange={e => {
                  const z = Number(e.target.value)
                  setMapZoom(z)
                  handleMapConfigChange({ zoom: z })
                }}
                style={{ width: '100%', marginBottom: '0.6rem' }}
              />

              <label style={{ display: 'block', color: '#888', marginBottom: 3 }}>
                Opacity ({Math.round(mapOpacity * 100)}%)
              </label>
              <input
                type="range" min={10} max={100} value={Math.round(mapOpacity * 100)}
                onChange={e => {
                  const op = Number(e.target.value) / 100
                  setMapOpacity(op)
                  handleMapConfigChange({ opacity: op })
                }}
                style={{ width: '100%', marginBottom: '0.75rem' }}
              />

              {mapConfigs[activeLevelId] && (
                <button onClick={handleClearMapBg} style={{ ...btnStyle('danger'), width: '100%', textAlign: 'center' }}>
                  Clear Background
                </button>
              )}
              <p style={{ color: '#bbb', fontSize: 10, margin: '0.5rem 0 0', lineHeight: 1.4 }}>
                Imagery © Esri. Changes save with the level.
              </p>
            </div>
          )}
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
            {selectedZone && activeLevelId && (
              <ZoneProps
                zone={selectedZone}
                onUpdate={async (name, type) => {
                  const updated = await api.updateZone(activeLevelId, selectedZone.id, name, type, selectedZone.points_json)
                  setAllZones(zs => zs.map(z => z.id === updated.id ? updated : z))
                }}
                onDelete={() => { handleZoneDelete(selectedZone.id); setSelection({ kind: 'none' }) }}
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
            {
              label: 'Type', key: 'type', type: 'select', value: 'GROUND',
              options: levelTypeOptions(levels),
            },
          ]}
          onConfirm={async vals => {
            setAddLevelDialog(false)
            const lvl = await api.createLevel(vals.name || 'New Level', vals.type || 'GROUND')
            setLevels(prev => [...prev, lvl])
            setAllWalls(w => ({ ...w, [lvl.id]: [] }))
            setMapConfigs(m => ({ ...m, [lvl.id]: null }))
            setActiveLevelId(lvl.id)
          }}
          onCancel={() => setAddLevelDialog(false)}
        />
      )}
      {renameLevelDialog && activeLevel && (
        <Dialog
          title="Edit Level"
          fields={[
            { label: 'Name', key: 'name', value: activeLevel.name },
            {
              label: 'Type', key: 'type', type: 'select', value: activeLevel.type,
              options: levelTypeOptions(levels, activeLevelId!),
            },
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
      {zoneDialog && activeLevelId && (
        <Dialog
          title="Name This Zone"
          fields={[
            { label: 'Zone Name (optional)', key: 'name', value: ZONE_TYPE_LABELS[zoneDialog.type] },
          ]}
          onConfirm={async vals => {
            const d = zoneDialog
            setZoneDialog(null)
            const pointsJson = JSON.stringify(d.points)
            const z = await api.createZone(activeLevelId, vals.name || ZONE_TYPE_LABELS[d.type], d.type, pointsJson)
            setAllZones(prev => [...prev, z])
          }}
          onCancel={() => setZoneDialog(null)}
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

function ZoneProps({ zone, onUpdate, onDelete }: {
  zone: Zone
  onUpdate: (name: string, type: string) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(zone.name)
  const [type, setType] = useState<ZoneType>(zone.type)
  useEffect(() => { setName(zone.name); setType(zone.type) }, [zone.id])
  const colour = ZONE_TYPE_COLOURS[type]
  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 16, height: 16, background: colour, borderRadius: 3 }} />
        <span style={{ fontWeight: 600, color: PALETTE.text }}>{ZONE_TYPE_LABELS[zone.type]}</span>
      </div>
      <PropLabel>Name</PropLabel>
      <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      <PropLabel>Zone Type</PropLabel>
      <select value={type} onChange={e => setType(e.target.value as ZoneType)} style={inputStyle}>
        {(Object.keys(ZONE_TYPE_LABELS) as ZoneType[]).map(z => (
          <option key={z} value={z}>{ZONE_TYPE_LABELS[z]}</option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={() => onUpdate(name, type)} style={btnStyle('primary')}>Save</button>
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

  let initialState: HomeMapState = { levels: [], markers: [], rooms: [], zones: [] }
  const raw = root.dataset.state
  if (raw) {
    try { initialState = JSON.parse(raw) } catch (e) { console.error('FullerHome: failed to parse state', e) }
  }

  initialState.markers ??= []
  initialState.rooms ??= []
  initialState.zones ??= []

  createRoot(root).render(
    <StrictMode>
      <App initialState={initialState} />
    </StrictMode>
  )
})

void newId
