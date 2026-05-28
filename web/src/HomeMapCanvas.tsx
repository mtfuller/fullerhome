import { useEffect, useRef, useCallback } from 'react'
import type { WallSegment, AssetMarker, Room, Point, MarkerCategory } from './types'
import { PALETTE, MARKER_CATEGORY_COLOURS, MARKER_CATEGORY_ABBREV, newId } from './types'

export type EditMode = 'select' | 'draw' | 'room' | 'marker'

export interface Selection {
  kind: 'none' | 'vertex' | 'wall' | 'marker' | 'room'
  wallId?: string
  pointIndex?: number
  markerId?: string
  roomId?: string
}

interface Props {
  walls: WallSegment[]
  markers: AssetMarker[]
  rooms: Room[]
  mode: EditMode
  selectedCategory: MarkerCategory
  onWallsChange: (walls: WallSegment[]) => void
  onMarkerPlace: (x: number, y: number) => void
  onMarkerMove: (id: string, x: number, y: number) => void
  onMarkerDelete: (id: string) => void
  onRoomPlace: (x: number, y: number) => void
  onRoomMove: (id: string, x: number, y: number) => void
  onRoomDelete: (id: string) => void
  selection: Selection
  onSelectionChange: (s: Selection) => void
}

const VERTEX_R = 6
const MARKER_HALF = 9
const SNAP_PX = 14
const LINE_HIT = 6
const FONT_VERTEX = '12px sans-serif'
const FONT_LABEL = '11px sans-serif'
const FONT_ROOM = 'italic 13px Georgia, serif'

function toPx(pct: number, dim: number) { return (pct / 100) * dim }
function toPct(px: number, dim: number) { return (px / dim) * 100 }

function ptLineDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function HomeMapCanvas({
  walls, markers, rooms, mode, selectedCategory,
  onWallsChange, onMarkerPlace, onMarkerMove, onMarkerDelete,
  onRoomPlace, onRoomMove, onRoomDelete,
  selection, onSelectionChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Stable refs to avoid stale closures in event handlers
  const wallsRef = useRef(walls)
  const markersRef = useRef(markers)
  const roomsRef = useRef(rooms)
  const modeRef = useRef(mode)
  const selRef = useRef(selection)
  const catRef = useRef(selectedCategory)
  wallsRef.current = walls
  markersRef.current = markers
  roomsRef.current = rooms
  modeRef.current = mode
  selRef.current = selection
  catRef.current = selectedCategory

  // Mutable drawing state (no re-renders during mouse move)
  const drawing = useRef({ active: false, points: [] as Point[], cursor: null as Point | null, snap: null as Point | null })

  // Mutable drag state
  const drag = useRef({
    active: false,
    kind: null as 'vertex' | 'marker' | 'room' | null,
    wallId: null as string | null,
    pointIdx: null as number | null,
    itemId: null as string | null,
  })

  // --- Canvas drawing ---

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const ws = wallsRef.current
    const ms = markersRef.current
    const rs = roomsRef.current
    const sel = selRef.current
    const dr = drawing.current

    // Walls
    ws.forEach(wall => {
      if (wall.points.length < 2) return
      const isSel = sel.kind === 'wall' && sel.wallId === wall.id
      ctx.beginPath()
      wall.points.forEach((pt, i) => {
        const px = toPx(pt.x, W), py = toPx(pt.y, H)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      })
      if (wall.closed) ctx.closePath()
      ctx.strokeStyle = isSel ? PALETTE.terracotta : PALETTE.sage
      ctx.lineWidth = isSel ? 3 : 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    })

    // Vertex handles in select mode
    if (modeRef.current === 'select') {
      ws.forEach(wall => {
        wall.points.forEach((pt, i) => {
          const px = toPx(pt.x, W), py = toPx(pt.y, H)
          const isSelV = sel.kind === 'vertex' && sel.wallId === wall.id && sel.pointIndex === i
          ctx.beginPath()
          ctx.arc(px, py, VERTEX_R, 0, Math.PI * 2)
          ctx.fillStyle = isSelV ? PALETTE.terracotta : PALETTE.white
          ctx.strokeStyle = isSelV ? PALETTE.terracotta : PALETTE.sage
          ctx.lineWidth = 1.5
          ctx.fill()
          ctx.stroke()
        })
      })
    }

    // Room labels
    rs.forEach(room => {
      const rx = toPx(room.x_coordinate, W), ry = toPx(room.y_coordinate, H)
      const isSel = sel.kind === 'room' && sel.roomId === room.id
      ctx.font = FONT_ROOM
      const tw = ctx.measureText(room.name).width + 14
      const th = 22
      roundRect(ctx, rx - tw / 2, ry - th / 2, tw, th, 4)
      ctx.fillStyle = isSel ? PALETTE.sageLight : 'rgba(255,255,255,0.88)'
      ctx.fill()
      ctx.strokeStyle = isSel ? PALETTE.sage : PALETTE.border
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = PALETTE.sage
      ctx.textAlign = 'center'
      ctx.fillText(room.name, rx, ry + 5)
    })

    // Markers
    ms.forEach(marker => {
      const mx = toPx(marker.x_coordinate, W), my = toPx(marker.y_coordinate, H)
      const isSel = sel.kind === 'marker' && sel.markerId === marker.id
      const colour = MARKER_CATEGORY_COLOURS[marker.category] ?? PALETTE.terracotta
      const abbrev = MARKER_CATEGORY_ABBREV[marker.category] ?? '?'

      if (isSel) {
        ctx.strokeStyle = PALETTE.terracotta
        ctx.lineWidth = 2
        roundRect(ctx, mx - MARKER_HALF - 4, my - MARKER_HALF - 4, (MARKER_HALF + 4) * 2, (MARKER_HALF + 4) * 2, 3)
        ctx.stroke()
      }

      roundRect(ctx, mx - MARKER_HALF, my - MARKER_HALF, MARKER_HALF * 2, MARKER_HALF * 2, 3)
      ctx.fillStyle = colour
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 8px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(abbrev, mx, my + 3)

      ctx.fillStyle = PALETTE.text
      ctx.font = FONT_LABEL
      ctx.fillText(marker.label, mx, my + MARKER_HALF + 13)
    })

    // Drawing preview
    if (modeRef.current === 'draw') {
      if (dr.active && dr.points.length > 0) {
        ctx.strokeStyle = PALETTE.terracotta
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        dr.points.forEach((pt, i) => {
          const px = toPx(pt.x, W), py = toPx(pt.y, H)
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        })
        const tip = dr.snap ?? dr.cursor
        if (tip) ctx.lineTo(toPx(tip.x, W), toPx(tip.y, H))
        ctx.stroke()
        ctx.setLineDash([])

        // Placed vertices
        dr.points.forEach(pt => {
          ctx.beginPath()
          ctx.arc(toPx(pt.x, W), toPx(pt.y, H), 4, 0, Math.PI * 2)
          ctx.fillStyle = PALETTE.terracotta
          ctx.fill()
        })
      }

      // Snap ring
      if (dr.snap) {
        ctx.beginPath()
        ctx.arc(toPx(dr.snap.x, W), toPx(dr.snap.y, H), SNAP_PX * 0.65, 0, Math.PI * 2)
        ctx.strokeStyle = PALETTE.terracotta
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Cursor dot when not yet drawing
      if (!dr.active && dr.cursor) {
        ctx.beginPath()
        ctx.arc(toPx(dr.cursor.x, W), toPx(dr.cursor.y, H), 4, 0, Math.PI * 2)
        ctx.fillStyle = PALETTE.terracotta
        ctx.globalAlpha = 0.45
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    void FONT_VERTEX // keep import used
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const obs = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      draw()
    })
    obs.observe(canvas)
    return () => obs.disconnect()
  }, [draw])

  useEffect(() => { draw() }, [draw, walls, markers, rooms, selection, mode])

  // --- Hit testing ---

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top, W: c.width, H: c.height }
  }

  function findSnap(pcx: number, pcy: number, W: number, H: number, skipWall?: string, skipIdx?: number): Point | null {
    const r2 = SNAP_PX * SNAP_PX
    for (const wall of wallsRef.current) {
      for (let i = 0; i < wall.points.length; i++) {
        if (wall.id === skipWall && i === skipIdx) continue
        const vx = toPx(wall.points[i].x, W), vy = toPx(wall.points[i].y, H)
        const cx = toPx(pcx, W), cy = toPx(pcy, H)
        if ((cx - vx) ** 2 + (cy - vy) ** 2 < r2) return wall.points[i]
      }
    }
    return null
  }

  function hitVertex(px: number, py: number, W: number, H: number) {
    for (const wall of wallsRef.current) {
      for (let i = 0; i < wall.points.length; i++) {
        const vx = toPx(wall.points[i].x, W), vy = toPx(wall.points[i].y, H)
        if (Math.hypot(px - vx, py - vy) <= VERTEX_R + 4)
          return { wallId: wall.id, pointIndex: i }
      }
    }
    return null
  }

  function hitWall(px: number, py: number, W: number, H: number): string | null {
    for (const wall of wallsRef.current) {
      for (let i = 0; i + 1 < wall.points.length; i++) {
        const ax = toPx(wall.points[i].x, W), ay = toPx(wall.points[i].y, H)
        const bx = toPx(wall.points[i + 1].x, W), by = toPx(wall.points[i + 1].y, H)
        if (ptLineDist(px, py, ax, ay, bx, by) <= LINE_HIT) return wall.id
      }
      if (wall.closed && wall.points.length >= 2) {
        const last = wall.points[wall.points.length - 1], first = wall.points[0]
        if (ptLineDist(px, py, toPx(last.x, W), toPx(last.y, H), toPx(first.x, W), toPx(first.y, H)) <= LINE_HIT)
          return wall.id
      }
    }
    return null
  }

  function hitMarker(px: number, py: number, W: number, H: number): string | null {
    const h = MARKER_HALF + 4
    for (const m of markersRef.current) {
      if (Math.abs(px - toPx(m.x_coordinate, W)) <= h && Math.abs(py - toPx(m.y_coordinate, H)) <= h)
        return m.id
    }
    return null
  }

  function hitRoom(px: number, py: number, W: number, H: number): string | null {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return null
    for (const room of roomsRef.current) {
      const rx = toPx(room.x_coordinate, W), ry = toPx(room.y_coordinate, H)
      ctx.font = FONT_ROOM
      const tw = ctx.measureText(room.name).width + 14
      if (Math.abs(px - rx) <= tw / 2 && Math.abs(py - ry) <= 11) return room.id
    }
    return null
  }

  // --- Event handlers ---

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { px, py, W, H } = canvasCoords(e)
    const pctX = toPct(px, W), pctY = toPct(py, H)
    const dg = drag.current

    if (dg.active) {
      if (dg.kind === 'vertex' && dg.wallId && dg.pointIdx !== null) {
        const snap = findSnap(pctX, pctY, W, H, dg.wallId, dg.pointIdx)
        const target = snap ?? { x: pctX, y: pctY }
        onWallsChange(wallsRef.current.map(w =>
          w.id !== dg.wallId ? w : { ...w, points: w.points.map((p, i) => i === dg.pointIdx ? target : p) }
        ))
      } else if (dg.kind === 'marker' && dg.itemId) {
        onMarkerMove(dg.itemId, pctX, pctY)
      } else if (dg.kind === 'room' && dg.itemId) {
        onRoomMove(dg.itemId, pctX, pctY)
      }
      draw()
      return
    }

    if (modeRef.current === 'draw') {
      const snap = drawing.current.active ? findSnap(pctX, pctY, W, H) : null
      drawing.current.cursor = { x: pctX, y: pctY }
      drawing.current.snap = snap
      draw()
    }
  }, [onWallsChange, onMarkerMove, onRoomMove, draw])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (modeRef.current !== 'select') return
    const { px, py, W, H } = canvasCoords(e)

    const v = hitVertex(px, py, W, H)
    if (v) {
      onSelectionChange({ kind: 'vertex', ...v })
      drag.current = { active: true, kind: 'vertex', wallId: v.wallId, pointIdx: v.pointIndex, itemId: null }
      return
    }
    const mid = hitMarker(px, py, W, H)
    if (mid) {
      onSelectionChange({ kind: 'marker', markerId: mid })
      drag.current = { active: true, kind: 'marker', wallId: null, pointIdx: null, itemId: mid }
      return
    }
    const rid = hitRoom(px, py, W, H)
    if (rid) {
      onSelectionChange({ kind: 'room', roomId: rid })
      drag.current = { active: true, kind: 'room', wallId: null, pointIdx: null, itemId: rid }
      return
    }
    const wid = hitWall(px, py, W, H)
    if (wid) { onSelectionChange({ kind: 'wall', wallId: wid }); return }
    onSelectionChange({ kind: 'none' })
  }, [onSelectionChange])

  const handleMouseUp = useCallback(() => {
    drag.current = { active: false, kind: null, wallId: null, pointIdx: null, itemId: null }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { px, py, W, H } = canvasCoords(e)
    const pctX = toPct(px, W), pctY = toPct(py, H)

    if (modeRef.current === 'draw') {
      const snap = findSnap(pctX, pctY, W, H)
      const pt = snap ?? { x: pctX, y: pctY }
      drawing.current.active = true
      drawing.current.points = [...drawing.current.points, pt]
      draw()
    } else if (modeRef.current === 'marker') {
      onMarkerPlace(pctX, pctY)
    } else if (modeRef.current === 'room') {
      onRoomPlace(pctX, pctY)
    }
  }, [onMarkerPlace, onRoomPlace, draw])

  const handleDoubleClick = useCallback(() => {
    if (modeRef.current !== 'draw') return
    const pts = drawing.current.points
    // Double-click fires two clicks then dblclick; remove duplicate last point
    const finalPts = pts.length >= 2 ? pts.slice(0, -1) : pts
    if (finalPts.length >= 2) {
      const seg: WallSegment = { id: newId(), points: finalPts, closed: false }
      onWallsChange([...wallsRef.current, seg])
    }
    drawing.current = { active: false, points: [], cursor: null, snap: null }
    draw()
  }, [onWallsChange, draw])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modeRef.current === 'draw') {
        drawing.current = { active: false, points: [], cursor: null, snap: null }
        draw()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (e.target as HTMLElement).tagName !== 'INPUT') {
        const sel = selRef.current
        if (sel.kind === 'vertex' && sel.wallId) {
          const wall = wallsRef.current.find(w => w.id === sel.wallId)
          if (!wall) return
          if (wall.points.length > 2) {
            onWallsChange(wallsRef.current.map(w =>
              w.id !== sel.wallId ? w : { ...w, points: w.points.filter((_, i) => i !== sel.pointIndex) }
            ))
          } else {
            onWallsChange(wallsRef.current.filter(w => w.id !== sel.wallId))
          }
          onSelectionChange({ kind: 'none' })
        } else if (sel.kind === 'wall' && sel.wallId) {
          onWallsChange(wallsRef.current.filter(w => w.id !== sel.wallId))
          onSelectionChange({ kind: 'none' })
        } else if (sel.kind === 'marker' && sel.markerId) {
          onMarkerDelete(sel.markerId)
          onSelectionChange({ kind: 'none' })
        } else if (sel.kind === 'room' && sel.roomId) {
          onRoomDelete(sel.roomId)
          onSelectionChange({ kind: 'none' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onWallsChange, onMarkerDelete, onRoomDelete, onSelectionChange, draw])

  const cursor = mode === 'draw' ? 'crosshair' : mode === 'marker' || mode === 'room' ? 'copy' : 'default'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseLeave={() => { drawing.current.cursor = null; draw() }}
      />
    </div>
  )
}
