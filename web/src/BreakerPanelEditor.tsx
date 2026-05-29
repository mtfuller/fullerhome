import React, { useState, useEffect, useCallback } from 'react'
import {
  BreakerPanel, Circuit, CircuitConnection, AssetMarker,
  BreakerType, BREAKER_TYPE_LABELS, MARKER_CATEGORY_LABELS,
  MARKER_CATEGORY_COLOURS, PALETTE,
} from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  initialPanels: BreakerPanel[]
  initialMarkers: AssetMarker[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AMPERAGE_OPTIONS = [15, 20, 30, 40, 50, 60, 100, 150, 200]

function slotLabel(slot: number): string {
  // Left column = odd slots, right column = even slots (standard US panel layout)
  return String(slot)
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return undefined as T
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'API error')
  return json as T
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Badge({ category }: { category: string }) {
  const colour = MARKER_CATEGORY_COLOURS[category as keyof typeof MARKER_CATEGORY_COLOURS] ?? '#888'
  return (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 3,
      background: colour, color: '#fff', fontSize: 11, fontFamily: 'sans-serif',
      fontWeight: 600, lineHeight: '16px',
    }}>
      {MARKER_CATEGORY_LABELS[category as keyof typeof MARKER_CATEGORY_LABELS] ?? category}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BreakerPanelEditor({ initialPanels, initialMarkers }: Props) {
  const [panels, setPanels] = useState<BreakerPanel[]>(initialPanels)
  const [markers] = useState<AssetMarker[]>(initialMarkers)
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(
    initialPanels.length > 0 ? initialPanels[0].id : null
  )
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [selectedCircuitId, setSelectedCircuitId] = useState<string | null>(null)
  const [connections, setConnections] = useState<CircuitConnection[]>([])

  // Panel form state
  const [showNewPanel, setShowNewPanel] = useState(false)
  const [newPanelMarkerId, setNewPanelMarkerId] = useState('')
  const [newPanelSlots, setNewPanelSlots] = useState(20)

  // Circuit edit state (right panel)
  const [editLabel, setEditLabel] = useState('')
  const [editAmperage, setEditAmperage] = useState(15)
  const [editBreakerType, setEditBreakerType] = useState<BreakerType>('SINGLE')
  const [editNotes, setEditNotes] = useState('')
  const [editSlot, setEditSlot] = useState(1)
  const [editDirty, setEditDirty] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // Connection picker
  const [showAddConn, setShowAddConn] = useState(false)
  const [connMarkerId, setConnMarkerId] = useState('')

  // Panel editor
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [editPanelSlots, setEditPanelSlots] = useState(20)
  const [editPanelNotes, setEditPanelNotes] = useState('')

  const selectedPanel = panels.find(p => p.id === selectedPanelId) ?? null
  const selectedCircuit = circuits.find(c => c.id === selectedCircuitId) ?? null

  // BREAKER markers that don't yet have a panel
  const breakerMarkers = markers.filter(m =>
    m.category === 'BREAKER' && !panels.some(p => p.marker_id === m.id)
  )

  // Load circuits when panel changes
  useEffect(() => {
    if (!selectedPanelId) { setCircuits([]); setSelectedCircuitId(null); return }
    apiFetch<Circuit[]>('GET', `/breaker-panels/${selectedPanelId}/circuits`)
      .then(setCircuits)
      .catch(console.error)
    setSelectedCircuitId(null)
  }, [selectedPanelId])

  // Load connections when circuit changes
  useEffect(() => {
    if (!selectedCircuitId) { setConnections([]); return }
    apiFetch<CircuitConnection[]>('GET', `/circuits/${selectedCircuitId}/connections`)
      .then(setConnections)
      .catch(console.error)
  }, [selectedCircuitId])

  // Populate edit form when circuit selected
  useEffect(() => {
    if (selectedCircuit) {
      setEditLabel(selectedCircuit.label)
      setEditAmperage(selectedCircuit.amperage)
      setEditBreakerType(selectedCircuit.breaker_type)
      setEditNotes(selectedCircuit.notes)
      setEditSlot(selectedCircuit.slot_number)
      setEditDirty(false)
    }
  }, [selectedCircuit])

  // ---------- Panel actions ----------

  const handleCreatePanel = useCallback(async () => {
    if (!newPanelMarkerId) return
    try {
      const panel = await apiFetch<BreakerPanel>('POST', '/breaker-panels', {
        marker_id: newPanelMarkerId,
        total_slots: newPanelSlots,
        notes: '',
      })
      setPanels(prev => [...prev, panel])
      setSelectedPanelId(panel.id)
      setShowNewPanel(false)
      setNewPanelMarkerId('')
      setNewPanelSlots(20)
    } catch (e) {
      alert(`Failed to create panel: ${(e as Error).message}`)
    }
  }, [newPanelMarkerId, newPanelSlots])

  const handleDeletePanel = useCallback(async () => {
    if (!selectedPanelId || !confirm('Delete this panel and all its circuits?')) return
    await apiFetch('DELETE', `/breaker-panels/${selectedPanelId}`)
    setPanels(prev => prev.filter(p => p.id !== selectedPanelId))
    setSelectedPanelId(panels.find(p => p.id !== selectedPanelId)?.id ?? null)
  }, [selectedPanelId, panels])

  const handleUpdatePanel = useCallback(async () => {
    if (!selectedPanelId) return
    const updated = await apiFetch<BreakerPanel>('PUT', `/breaker-panels/${selectedPanelId}`, {
      total_slots: editPanelSlots,
      notes: editPanelNotes,
    })
    setPanels(prev => prev.map(p => p.id === updated.id ? updated : p))
    setShowEditPanel(false)
  }, [selectedPanelId, editPanelSlots, editPanelNotes])

  // ---------- Circuit actions ----------

  const handleSlotClick = useCallback(async (slot: number) => {
    const existing = circuits.find(c => {
      if (c.slot_number === slot) return true
      if (c.breaker_type === 'DOUBLE' && c.slot_number === slot - 1) return true
      return false
    })
    if (existing) {
      setSelectedCircuitId(existing.id)
      return
    }
    // Create new circuit on this slot
    if (!selectedPanelId) return
    try {
      const circuit = await apiFetch<Circuit>('POST', `/breaker-panels/${selectedPanelId}/circuits`, {
        slot_number: slot,
        label: `Circuit ${slot}`,
        amperage: 15,
        breaker_type: 'SINGLE' as BreakerType,
        notes: '',
      })
      setCircuits(prev => [...prev, circuit].sort((a, b) => a.slot_number - b.slot_number))
      setSelectedCircuitId(circuit.id)
    } catch (e) {
      alert(`Failed to add circuit: ${(e as Error).message}`)
    }
  }, [circuits, selectedPanelId])

  const handleSaveCircuit = useCallback(async () => {
    if (!selectedCircuitId) return
    setEditSaving(true)
    try {
      const updated = await apiFetch<Circuit>('PUT', `/circuits/${selectedCircuitId}`, {
        slot_number: editSlot,
        label: editLabel,
        amperage: editAmperage,
        breaker_type: editBreakerType,
        notes: editNotes,
      })
      setCircuits(prev => prev.map(c => c.id === updated.id ? updated : c)
        .sort((a, b) => a.slot_number - b.slot_number))
      setEditDirty(false)
    } catch (e) {
      alert(`Failed to save: ${(e as Error).message}`)
    } finally {
      setEditSaving(false)
    }
  }, [selectedCircuitId, editSlot, editLabel, editAmperage, editBreakerType, editNotes])

  const handleDeleteCircuit = useCallback(async () => {
    if (!selectedCircuitId || !confirm('Delete this circuit?')) return
    await apiFetch('DELETE', `/circuits/${selectedCircuitId}`)
    setCircuits(prev => prev.filter(c => c.id !== selectedCircuitId))
    setSelectedCircuitId(null)
  }, [selectedCircuitId])

  // ---------- Connection actions ----------

  const handleAddConnection = useCallback(async () => {
    if (!selectedCircuitId || !connMarkerId) return
    try {
      const conn = await apiFetch<CircuitConnection>('POST', `/circuits/${selectedCircuitId}/connections`, {
        marker_id: connMarkerId,
        notes: '',
      })
      setConnections(prev => [...prev, conn])
      setConnMarkerId('')
      setShowAddConn(false)
    } catch (e) {
      alert(`Failed to add connection: ${(e as Error).message}`)
    }
  }, [selectedCircuitId, connMarkerId])

  const handleDeleteConnection = useCallback(async (connId: string) => {
    await apiFetch('DELETE', `/circuit-connections/${connId}`)
    setConnections(prev => prev.filter(c => c.id !== connId))
  }, [])

  // ---------- Render helpers ----------

  const totalSlots = selectedPanel?.total_slots ?? 20
  // Build a slot → circuit map (DOUBLE circuits occupy two consecutive slots)
  const slotMap = new Map<number, Circuit>()
  const doubleSecondary = new Set<number>()
  for (const c of circuits) {
    slotMap.set(c.slot_number, c)
    if (c.breaker_type === 'DOUBLE') doubleSecondary.add(c.slot_number + 1)
  }

  // ---------- Layout ----------

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'sans-serif' }}>

      {/* ── Left panel: panel list ── */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: `1px solid ${PALETTE.border}`,
        background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${PALETTE.border}`, background: PALETTE.sageLight }}>
          <span style={{ fontFamily: 'Georgia,serif', fontSize: 13, color: PALETTE.sage, fontWeight: 600 }}>
            Breaker Panels
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {panels.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPanelId(p.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 12px', border: 'none', cursor: 'pointer',
                background: selectedPanelId === p.id ? PALETTE.sageLight : 'transparent',
                borderLeft: selectedPanelId === p.id ? `3px solid ${PALETTE.sage}` : '3px solid transparent',
                fontSize: 13, color: PALETTE.text,
              }}
            >
              <div style={{ fontFamily: 'Georgia,serif', fontWeight: 600, marginBottom: 2 }}>{p.marker_label}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{p.total_slots} slots</div>
            </button>
          ))}

          {panels.length === 0 && (
            <div style={{ padding: 16, fontSize: 12, color: '#aaa', textAlign: 'center' }}>
              No panels yet.<br />Add a Breaker marker on the Home Map, then initialize it here.
            </div>
          )}
        </div>

        <div style={{ padding: 10, borderTop: `1px solid ${PALETTE.border}` }}>
          <button
            onClick={() => { setShowNewPanel(true); setNewPanelMarkerId(breakerMarkers[0]?.id ?? '') }}
            disabled={breakerMarkers.length === 0}
            style={{
              width: '100%', padding: '6px 0', background: PALETTE.sage, color: '#fff',
              border: 'none', borderRadius: 4, cursor: breakerMarkers.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12, opacity: breakerMarkers.length === 0 ? 0.5 : 1,
            }}
          >
            + Add Panel
          </button>
          {breakerMarkers.length === 0 && panels.length === 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#aaa', textAlign: 'center' }}>
              Place a Breaker marker on the Home Map first.
            </div>
          )}
        </div>
      </div>

      {/* ── Center: breaker box visual ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: PALETTE.bg }}>
        {!selectedPanel ? (
          <div style={{ textAlign: 'center', color: '#aaa', marginTop: 60, fontSize: 14 }}>
            Select or create a breaker panel to get started.
          </div>
        ) : (
          <>
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Georgia,serif', color: PALETTE.sage, fontSize: 18, margin: 0 }}>
                {selectedPanel.marker_label}
              </h2>
              <span style={{ fontSize: 12, color: '#888', fontFamily: 'sans-serif' }}>
                {selectedPanel.total_slots} slots · {circuits.length} circuits mapped
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setEditPanelSlots(selectedPanel.total_slots); setEditPanelNotes(selectedPanel.notes); setShowEditPanel(true) }}
                  style={btnStyle('outline')}
                >
                  Edit Panel
                </button>
                <button onClick={handleDeletePanel} style={btnStyle('danger')}>Delete</button>
              </div>
            </div>

            {selectedPanel.notes && (
              <p style={{ fontSize: 12, color: '#666', marginBottom: 12, fontStyle: 'italic' }}>
                {selectedPanel.notes}
              </p>
            )}

            {/* Breaker box grid */}
            <div style={{
              background: '#2a2a2a', borderRadius: 8, padding: '16px 12px',
              maxWidth: 480, margin: '0 auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              {/* Main label */}
              <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, marginBottom: 12, letterSpacing: 2 }}>
                MAIN PANEL
              </div>
              {/* Main breaker (top) */}
              <div style={{
                background: '#1a1a1a', borderRadius: 4, padding: '8px 12px', marginBottom: 12,
                textAlign: 'center', color: '#fff', fontSize: 12, letterSpacing: 1,
                border: '1px solid #444',
              }}>
                MAIN BREAKER
              </div>

              {/* Two-column slot grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 8px 1fr', gap: '3px 0' }}>
                {Array.from({ length: totalSlots }, (_, i) => i + 1).map(slot => {
                  if (doubleSecondary.has(slot)) return null // rendered by primary slot
                  const circuit = slotMap.get(slot)
                  const isDouble = circuit?.breaker_type === 'DOUBLE'
                  const isTandem = circuit?.breaker_type === 'TANDEM'
                  const isSelected = circuit?.id === selectedCircuitId
                  const isEmpty = !circuit

                  const col = slot % 2 === 1 ? 1 : 3 // odd = left col, even = right col
                  const row = Math.ceil(slot / 2)

                  const slotEl = (
                    <div
                      key={slot}
                      onClick={() => handleSlotClick(slot)}
                      style={{
                        gridColumn: col,
                        gridRow: isDouble ? `${row} / span 2` : row,
                        background: isEmpty ? '#333' : (isSelected ? PALETTE.terracotta : PALETTE.sage),
                        border: `1px solid ${isSelected ? '#e88' : '#555'}`,
                        borderRadius: 3,
                        padding: isTandem ? '2px 6px' : '4px 6px',
                        cursor: 'pointer',
                        minHeight: isDouble ? 48 : 22,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        transition: 'background 0.1s',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: '#aaa', lineHeight: 1 }}>{slotLabel(slot)}</span>
                        {circuit && (
                          <span style={{ fontSize: 9, color: '#ddd', lineHeight: 1 }}>{circuit.amperage}A</span>
                        )}
                      </div>
                      {circuit && (
                        <div style={{
                          fontSize: 10, color: '#fff', marginTop: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {circuit.label || `Circuit ${slot}`}
                        </div>
                      )}
                      {isTandem && circuit && (
                        <div style={{ fontSize: 9, color: '#ccc', marginTop: 1 }}>Tandem</div>
                      )}
                      {isEmpty && (
                        <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>+</div>
                      )}
                    </div>
                  )

                  if (col === 1) {
                    // Pair with the divider column and right-column slot
                    const rightSlot = slot + 1
                    const rightCircuit = slotMap.get(rightSlot)
                    const rightIsDouble = rightCircuit?.breaker_type === 'DOUBLE'
                    const rightSelected = rightCircuit?.id === selectedCircuitId
                    const rightEmpty = !rightCircuit && !doubleSecondary.has(rightSlot)

                    return (
                      <React.Fragment key={slot}>
                        {slotEl}
                        {/* Center divider */}
                        <div style={{ gridColumn: 2, gridRow: row, background: '#1a1a1a' }} />
                        {/* Right slot (if within bounds) */}
                        {rightSlot <= totalSlots && !doubleSecondary.has(rightSlot) && (
                          <div
                            onClick={() => handleSlotClick(rightSlot)}
                            style={{
                              gridColumn: 3,
                              gridRow: rightIsDouble ? `${row} / span 2` : row,
                              background: rightEmpty ? '#333' : (rightSelected ? PALETTE.terracotta : PALETTE.sage),
                              border: `1px solid ${rightSelected ? '#e88' : '#555'}`,
                              borderRadius: 3,
                              padding: rightCircuit?.breaker_type === 'TANDEM' ? '2px 6px' : '4px 6px',
                              cursor: 'pointer',
                              minHeight: rightIsDouble ? 48 : 22,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              transition: 'background 0.1s',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 9, color: '#aaa', lineHeight: 1 }}>{slotLabel(rightSlot)}</span>
                              {rightCircuit && (
                                <span style={{ fontSize: 9, color: '#ddd', lineHeight: 1 }}>{rightCircuit.amperage}A</span>
                              )}
                            </div>
                            {rightCircuit && (
                              <div style={{
                                fontSize: 10, color: '#fff', marginTop: 1,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {rightCircuit.label || `Circuit ${rightSlot}`}
                              </div>
                            )}
                            {rightEmpty && (
                              <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>+</div>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    )
                  }
                  return null // right slots rendered in left-slot fragment
                })}
              </div>
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 10 }}>
              Click any slot to select or add a circuit.
            </p>
          </>
        )}
      </div>

      {/* ── Right panel: circuit details ── */}
      <div style={{
        width: 280, flexShrink: 0, borderLeft: `1px solid ${PALETTE.border}`,
        background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${PALETTE.border}`, background: PALETTE.sageLight }}>
          <span style={{ fontFamily: 'Georgia,serif', fontSize: 13, color: PALETTE.sage, fontWeight: 600 }}>
            {selectedCircuit ? `Slot ${selectedCircuit.slot_number}` : 'Circuit Details'}
          </span>
        </div>

        {!selectedCircuit ? (
          <div style={{ padding: 16, fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 20 }}>
            Select a circuit on the panel to edit it.
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {/* Edit form */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Label</label>
              <input
                value={editLabel}
                onChange={e => { setEditLabel(e.target.value); setEditDirty(true) }}
                style={inputStyle}
              />

              <label style={labelStyle}>Slot #</label>
              <input
                type="number"
                min={1}
                max={selectedPanel?.total_slots ?? 99}
                value={editSlot}
                onChange={e => { setEditSlot(Number(e.target.value)); setEditDirty(true) }}
                style={inputStyle}
              />

              <label style={labelStyle}>Type</label>
              <select
                value={editBreakerType}
                onChange={e => { setEditBreakerType(e.target.value as BreakerType); setEditDirty(true) }}
                style={inputStyle}
              >
                {(Object.keys(BREAKER_TYPE_LABELS) as BreakerType[]).map(bt => (
                  <option key={bt} value={bt}>{BREAKER_TYPE_LABELS[bt]}</option>
                ))}
              </select>

              <label style={labelStyle}>Amperage</label>
              <select
                value={editAmperage}
                onChange={e => { setEditAmperage(Number(e.target.value)); setEditDirty(true) }}
                style={inputStyle}
              >
                {AMPERAGE_OPTIONS.map(a => (
                  <option key={a} value={a}>{a}A</option>
                ))}
              </select>

              <label style={labelStyle}>Notes</label>
              <textarea
                value={editNotes}
                onChange={e => { setEditNotes(e.target.value); setEditDirty(true) }}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={handleSaveCircuit}
                  disabled={!editDirty || editSaving}
                  style={{
                    ...btnStyle('primary'),
                    opacity: (!editDirty || editSaving) ? 0.5 : 1,
                    cursor: (!editDirty || editSaving) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={handleDeleteCircuit} style={btnStyle('danger')}>Delete</button>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: `1px solid ${PALETTE.border}`, margin: '12px 0' }} />

            {/* Connections */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: PALETTE.sage, fontFamily: 'Georgia,serif' }}>
                  Connected Outlets / Switches
                </span>
                <button onClick={() => setShowAddConn(true)} style={{ ...btnStyle('outline'), fontSize: 11, padding: '2px 8px' }}>
                  + Add
                </button>
              </div>

              {connections.length === 0 && (
                <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '8px 0' }}>
                  No connections yet.
                </div>
              )}

              {connections.map(conn => (
                <div key={conn.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0',
                  borderBottom: `1px solid ${PALETTE.border}`,
                }}>
                  <Badge category={conn.marker_category} />
                  <span style={{ flex: 1, fontSize: 12 }}>{conn.marker_label}</span>
                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c00', fontSize: 14, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Add connection picker */}
              {showAddConn && (
                <div style={{ marginTop: 8, padding: 8, background: PALETTE.bg, borderRadius: 4, border: `1px solid ${PALETTE.border}` }}>
                  <select
                    value={connMarkerId}
                    onChange={e => setConnMarkerId(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 6 }}
                  >
                    <option value="">— pick a marker —</option>
                    {markers
                      .filter(m => m.category !== 'BREAKER' && !connections.some(c => c.marker_id === m.id))
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          [{MARKER_CATEGORY_LABELS[m.category]}] {m.label}
                        </option>
                      ))
                    }
                  </select>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleAddConnection} disabled={!connMarkerId} style={{ ...btnStyle('primary'), opacity: !connMarkerId ? 0.5 : 1 }}>
                      Add
                    </button>
                    <button onClick={() => { setShowAddConn(false); setConnMarkerId('') }} style={btnStyle('outline')}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: new panel ── */}
      {showNewPanel && (
        <Modal title="Initialize Breaker Panel" onClose={() => setShowNewPanel(false)}>
          <label style={labelStyle}>Breaker Marker</label>
          <select value={newPanelMarkerId} onChange={e => setNewPanelMarkerId(e.target.value)} style={inputStyle}>
            {breakerMarkers.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>

          <label style={labelStyle}>Total Slots</label>
          <input
            type="number" min={2} max={200} step={2}
            value={newPanelSlots}
            onChange={e => setNewPanelSlots(Number(e.target.value))}
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
            Typical residential panels: 20, 24, 30, 40 slots.
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreatePanel} style={btnStyle('primary')}>Create</button>
            <button onClick={() => setShowNewPanel(false)} style={btnStyle('outline')}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── Modal: edit panel ── */}
      {showEditPanel && (
        <Modal title="Edit Panel" onClose={() => setShowEditPanel(false)}>
          <label style={labelStyle}>Total Slots</label>
          <input
            type="number" min={2} max={200} step={2}
            value={editPanelSlots}
            onChange={e => setEditPanelSlots(Number(e.target.value))}
            style={inputStyle}
          />

          <label style={labelStyle}>Notes</label>
          <textarea
            value={editPanelNotes}
            onChange={e => setEditPanelNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleUpdatePanel} style={btnStyle('primary')}>Save</button>
            <button onClick={() => setShowEditPanel(false)} style={btnStyle('outline')}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal helper
// ---------------------------------------------------------------------------

function Modal({ title, children }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, maxWidth: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ fontFamily: 'Georgia,serif', color: PALETTE.sage, marginBottom: 16, fontSize: 16 }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: '#666', marginBottom: 3, marginTop: 8,
  fontFamily: 'sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 8px', border: `1px solid ${PALETTE.border}`,
  borderRadius: 4, fontSize: 13, fontFamily: 'sans-serif',
  background: '#fafafa', marginBottom: 0, color: PALETTE.text,
}

function btnStyle(variant: 'primary' | 'outline' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '5px 12px', borderRadius: 4, fontSize: 12,
    fontFamily: 'sans-serif', cursor: 'pointer', border: 'none',
  }
  if (variant === 'primary') return { ...base, background: PALETTE.sage, color: '#fff' }
  if (variant === 'danger') return { ...base, background: '#dc2626', color: '#fff' }
  return { ...base, background: 'transparent', color: PALETTE.sage, border: `1px solid ${PALETTE.sage}` }
}
