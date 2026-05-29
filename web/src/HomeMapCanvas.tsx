import { useEffect, useRef, useCallback } from 'react'
import type { WallSegment, AssetMarker, Room, Zone, Point, MarkerCategory, ZoneType, MapConfig } from './types'
import { PALETTE, MARKER_CATEGORY_COLOURS, MARKER_CATEGORY_ABBREV, ZONE_TYPE_COLOURS, ZONE_TYPE_LABELS, newId } from './types'

export type EditMode = 'select' | 'draw' | 'room' | 'marker' | 'zone'

export interface Selection {
  kind: 'none' | 'vertex' | 'wall' | 'marker' | 'room' | 'zone'
  wallId?: string
  pointIndex?: number
  markerId?: string
  roomId?: string
  zoneId?: string
}

export interface GhostLevel {
  walls: WallSegment[]
  markers: AssetMarker[]
  rooms: Room[]
  zones: Zone[]
}

interface Props {
  walls: WallSegment[]
  markers: AssetMarker[]
  rooms: Room[]
  zones: Zone[]
  ghostLevels: GhostLevel[]
  mode: EditMode
  selectedCategory: MarkerCategory
  selectedZoneType: ZoneType
  mapConfig: MapConfig | null
  onWallsChange: (walls: WallSegment[]) => void
  onMarkerPlace: (x: number, y: number) => void
  onMarkerMove: (id: string, x: number, y: number) => void
  onMarkerDelete: (id: string) => void
  onRoomPlace: (x: number, y: number) => void
  onRoomMove: (id: string, x: number, y: number) => void
  onRoomDelete: (id: string) => void
  onZoneCreate: (points: Point[], type: ZoneType, name: string) => void
  onZoneDelete: (id: string) => void
  selection: Selection
  onSelectionChange: (s: Selection) => void
}

const VERTEX_R = 6
const MARKER_HALF = 9
const SNAP_PX = 14
const LINE_HIT = 6
const FONT_VERTEX = '12px sans-serif'
const FONT_LABEL = '11px sans-serif'
const FONT_ROOM = '500 12px system-ui, -apple-system, sans-serif'
const GRID_PX = 40

const MIN_SCALE = 0.15
const MAX_SCALE = 10

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

function parseZonePoints(json: string): Point[] {
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr)) return []
    return arr.filter((v): v is Point => typeof v === 'object' && v !== null && 'x' in v && 'y' in v)
  } catch { return [] }
}

function drawZones(ctx: CanvasRenderingContext2D, zones: Zone[], W: number, H: number, selZoneId?: string) {
  zones.forEach(zone => {
    const pts = parseZonePoints(zone.points_json)
    if (pts.length < 3) return
    const colour = ZONE_TYPE_COLOURS[zone.type] ?? '#888'
    const isSel = zone.id === selZoneId
    ctx.beginPath()
    pts.forEach((pt, i) => {
      const px = toPx(pt.x, W), py = toPx(pt.y, H)
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fillStyle = colour + (isSel ? '55' : '30')
    ctx.fill()
    ctx.strokeStyle = isSel ? PALETTE.terracotta : colour + 'cc'
    ctx.lineWidth = isSel ? 2 : 1.5
    ctx.stroke()
    // Centroid label
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    ctx.fillStyle = isSel ? PALETTE.terracotta : colour
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(zone.name || ZONE_TYPE_LABELS[zone.type], toPx(cx, W), toPx(cy, H) + 4)
  })
}

function drawWalls(ctx: CanvasRenderingContext2D, walls: WallSegment[], W: number, H: number, sel: Selection) {
  walls.forEach(wall => {
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
}

export function HomeMapCanvas({
  walls, markers, rooms, zones, ghostLevels, mode, selectedCategory, selectedZoneType, mapConfig,
  onWallsChange, onMarkerPlace, onMarkerMove, onMarkerDelete,
  onRoomPlace, onRoomMove, onRoomDelete,
  onZoneCreate, onZoneDelete,
  selection, onSelectionChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Stable refs to avoid stale closures
  const wallsRef = useRef(walls)
  const markersRef = useRef(markers)
  const roomsRef = useRef(rooms)
  const zonesRef = useRef(zones)
  const ghostRef = useRef(ghostLevels)
  const modeRef = useRef(mode)
  const selRef = useRef(selection)
  const catRef = useRef(selectedCategory)
  const zoneTypeRef = useRef(selectedZoneType)
  const mapConfigRef = useRef(mapConfig)
  wallsRef.current = walls
  markersRef.current = markers
  roomsRef.current = rooms
  zonesRef.current = zones
  ghostRef.current = ghostLevels
  modeRef.current = mode
  selRef.current = selection
  catRef.current = selectedCategory
  zoneTypeRef.current = selectedZoneType
  mapConfigRef.current = mapConfig

  // Tile image cache for satellite background
  const tileCache = useRef(new Map<string, HTMLImageElement | 'loading' | 'error'>())

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

  // Pan/zoom viewport (screen-space offset and scale)
  const viewport = useRef({ x: 0, y: 0, scale: 1 })

  // Panning state (middle-click or space+drag)
  const panning = useRef({ active: false, startX: 0, startY: 0, vpX: 0, vpY: 0 })
  const spaceHeld = useRef(false)

  // --- Coordinate helpers that account for viewport ---

  function screenToCanvas(screenX: number, screenY: number, W: number, H: number) {
    const vp = viewport.current
    const px = (screenX - vp.x) / vp.scale
    const py = (screenY - vp.y) / vp.scale
    return { px, py, pctX: toPct(px, W), pctY: toPct(py, H) }
  }

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const W = c.width, H = c.height
    return { ...screenToCanvas(e.clientX - r.left, e.clientY - r.top, W, H), W, H }
  }

  // --- Canvas drawing ---

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const vp = viewport.current
    ctx.save()
    ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.x, vp.y)

    const ws = wallsRef.current
    const ms = markersRef.current
    const rs = roomsRef.current
    const zs = zonesRef.current
    const ghosts = ghostRef.current
    const sel = selRef.current
    const dr = drawing.current

    // Visible bounds in content space (for grid culling)
    const visLeft = -vp.x / vp.scale
    const visTop = -vp.y / vp.scale
    const visRight = (W - vp.x) / vp.scale
    const visBottom = (H - vp.y) / vp.scale

    // Grid — drawn in content space so it pans and zooms with the world
    {
      const g0x = Math.floor(visLeft / GRID_PX) * GRID_PX
      const g0y = Math.floor(visTop / GRID_PX) * GRID_PX
      ctx.strokeStyle = 'rgba(180,170,160,0.22)'
      ctx.lineWidth = 0.5
      for (let gx = g0x; gx <= visRight; gx += GRID_PX) {
        ctx.beginPath(); ctx.moveTo(gx, visTop); ctx.lineTo(gx, visBottom); ctx.stroke()
      }
      for (let gy = g0y; gy <= visBottom; gy += GRID_PX) {
        ctx.beginPath(); ctx.moveTo(visLeft, gy); ctx.lineTo(visRight, gy); ctx.stroke()
      }
    }

    // Satellite tile background
    const cfg = mapConfigRef.current
    if (cfg) {
      const z = cfg.zoom
      const worldSize = 256 * Math.pow(2, z)
      const cwx = (cfg.lon + 180) / 360 * worldSize
      const cwy = (1 - Math.log(Math.tan(cfg.lat * Math.PI / 180) + 1 / Math.cos(cfg.lat * Math.PI / 180)) / Math.PI) / 2 * worldSize
      const txMin = Math.floor((cwx - W / 2) / 256)
      const txMax = Math.floor((cwx + W / 2) / 256)
      const tyMin = Math.floor((cwy - H / 2) / 256)
      const tyMax = Math.floor((cwy + H / 2) / 256)
      const maxTile = Math.pow(2, z) - 1
      ctx.globalAlpha = cfg.opacity
      for (let ty = tyMin; ty <= tyMax; ty++) {
        for (let tx = txMin; tx <= txMax; tx++) {
          if (tx < 0 || tx > maxTile || ty < 0 || ty > maxTile) continue
          const tileCanvasX = W / 2 + tx * 256 - cwx
          const tileCanvasY = H / 2 + ty * 256 - cwy
          const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`
          const cached = tileCache.current.get(tileUrl)
          if (!cached) {
            tileCache.current.set(tileUrl, 'loading')
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => { tileCache.current.set(tileUrl, img); draw() }
            img.onerror = () => tileCache.current.set(tileUrl, 'error')
            img.src = tileUrl
          } else if (cached !== 'loading' && cached !== 'error') {
            ctx.drawImage(cached, tileCanvasX, tileCanvasY, 256, 256)
          }
        }
      }
      ctx.globalAlpha = 1
    }

    // Ghost levels (other floors at low opacity)
    ctx.globalAlpha = 0.18
    ghosts.forEach(ghost => {
      drawZones(ctx, ghost.zones, W, H)
      drawWalls(ctx, ghost.walls, W, H, { kind: 'none' })
      ghost.markers.forEach(marker => {
        const mx = toPx(marker.x_coordinate, W), my = toPx(marker.y_coordinate, H)
        const colour = MARKER_CATEGORY_COLOURS[marker.category] ?? PALETTE.terracotta
        roundRect(ctx, mx - MARKER_HALF, my - MARKER_HALF, MARKER_HALF * 2, MARKER_HALF * 2, 3)
        ctx.fillStyle = colour
        ctx.fill()
      })
    })
    ctx.globalAlpha = 1

    // Active level: zones first (beneath walls)
    drawZones(ctx, zs, W, H, sel.kind === 'zone' ? sel.zoneId : undefined)

    // Active level: walls
    drawWalls(ctx, ws, W, H, sel)

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

    // Room labels — clean pill badge, sans-serif, no shadow
    rs.forEach(room => {
      const rx = toPx(room.x_coordinate, W), ry = toPx(room.y_coordinate, H)
      const isSel = sel.kind === 'room' && sel.roomId === room.id
      ctx.font = FONT_ROOM
      const tw = ctx.measureText(room.name).width + 18
      const th = 22
      const r = th / 2  // pill radius
      roundRect(ctx, rx - tw / 2, ry - th / 2, tw, th, r)
      ctx.fillStyle = isSel ? PALETTE.sageLight : '#fff'
      ctx.fill()
      if (isSel) {
        ctx.strokeStyle = PALETTE.sage
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      ctx.fillStyle = PALETTE.sage
      ctx.textAlign = 'center'
      ctx.fillText(room.name, rx, ry + 4)
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

    // Drawing preview (walls and zones share the same drawing state)
    if (modeRef.current === 'draw' || modeRef.current === 'zone') {
      const isZoneMode = modeRef.current === 'zone'
      const zoneColour = ZONE_TYPE_COLOURS[zoneTypeRef.current] ?? '#888'

      if (dr.active && dr.points.length > 0) {
        const tip = dr.snap ?? dr.cursor

        if (isZoneMode && dr.points.length >= 2) {
          // Filled polygon preview for zone mode
          ctx.beginPath()
          dr.points.forEach((pt, i) => {
            const px = toPx(pt.x, W), py = toPx(pt.y, H)
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          })
          if (tip) ctx.lineTo(toPx(tip.x, W), toPx(tip.y, H))
          ctx.closePath()
          ctx.fillStyle = zoneColour + '30'
          ctx.fill()
        }

        ctx.strokeStyle = isZoneMode ? zoneColour : PALETTE.terracotta
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.setLineDash([6, 4])
        ctx.beginPath()
        dr.points.forEach((pt, i) => {
          const px = toPx(pt.x, W), py = toPx(pt.y, H)
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        })
        if (tip) ctx.lineTo(toPx(tip.x, W), toPx(tip.y, H))
        if (isZoneMode) ctx.closePath()
        ctx.stroke()
        ctx.setLineDash([])

        // Placed vertices
        dr.points.forEach(pt => {
          ctx.beginPath()
          ctx.arc(toPx(pt.x, W), toPx(pt.y, H), 4, 0, Math.PI * 2)
          ctx.fillStyle = isZoneMode ? zoneColour : PALETTE.terracotta
          ctx.fill()
        })
      }

      // Snap ring
      if (dr.snap) {
        ctx.beginPath()
        ctx.arc(toPx(dr.snap.x, W), toPx(dr.snap.y, H), SNAP_PX * 0.65, 0, Math.PI * 2)
        ctx.strokeStyle = isZoneMode ? (ZONE_TYPE_COLOURS[zoneTypeRef.current] ?? '#888') : PALETTE.terracotta
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Cursor dot when not yet drawing
      if (!dr.active && dr.cursor) {
        ctx.beginPath()
        ctx.arc(toPx(dr.cursor.x, W), toPx(dr.cursor.y, H), 4, 0, Math.PI * 2)
        ctx.fillStyle = isZoneMode ? (ZONE_TYPE_COLOURS[zoneTypeRef.current] ?? '#888') : PALETTE.terracotta
        ctx.globalAlpha = 0.45
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    ctx.restore()

    // Zoom indicator (drawn in screen space, outside transform)
    const scale = vp.scale
    if (Math.abs(scale - 1) > 0.02) {
      const label = `${Math.round(scale * 100)}%`
      ctx.font = '11px sans-serif'
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.textAlign = 'right'
      ctx.fillText(label, W - 10, H - 10)
    }

    void FONT_VERTEX
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

  useEffect(() => { draw() }, [draw, walls, markers, rooms, zones, ghostLevels, selection, mode, selectedZoneType, mapConfig])

  // --- Hit testing ---

  function findSnap(pctX: number, pctY: number, W: number, H: number, skipWall?: string, skipIdx?: number): Point | null {
    const r2 = SNAP_PX * SNAP_PX
    for (const wall of wallsRef.current) {
      for (let i = 0; i < wall.points.length; i++) {
        if (wall.id === skipWall && i === skipIdx) continue
        const vx = toPx(wall.points[i].x, W), vy = toPx(wall.points[i].y, H)
        const cx = toPx(pctX, W), cy = toPx(pctY, H)
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
      const tw = ctx.measureText(room.name).width + 18
      if (Math.abs(px - rx) <= tw / 2 && Math.abs(py - ry) <= 11) return room.id
    }
    return null
  }

  function hitZone(px: number, py: number, W: number, H: number): string | null {
    // Point-in-polygon test (ray casting)
    for (const zone of zonesRef.current) {
      const pts = parseZonePoints(zone.points_json)
      if (pts.length < 3) continue
      let inside = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = toPx(pts[i].x, W), yi = toPx(pts[i].y, H)
        const xj = toPx(pts[j].x, W), yj = toPx(pts[j].y, H)
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
          inside = !inside
      }
      if (inside) return zone.id
    }
    return null
  }

  // --- Zoom/pan handlers ---

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const mouseX = e.clientX - r.left
    const mouseY = e.clientY - r.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const vp = viewport.current
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * factor))
    viewport.current = {
      scale: newScale,
      x: mouseX - (mouseX - vp.x) * (newScale / vp.scale),
      y: mouseY - (mouseY - vp.y) * (newScale / vp.scale),
    }
    draw()
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // --- Event handlers ---

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan in progress
    if (panning.current.active) {
      viewport.current = {
        ...viewport.current,
        x: panning.current.vpX + (e.clientX - panning.current.startX),
        y: panning.current.vpY + (e.clientY - panning.current.startY),
      }
      draw()
      return
    }

    const { px, py, pctX, pctY, W, H } = canvasCoords(e)
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

    void px; void py
    if (modeRef.current === 'draw' || modeRef.current === 'zone') {
      const snap = drawing.current.active ? findSnap(pctX, pctY, W, H) : null
      drawing.current.cursor = { x: pctX, y: pctY }
      drawing.current.snap = snap
      draw()
    }
  }, [onWallsChange, onMarkerMove, onRoomMove, draw])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle-click or space+left-click → pan
    if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault()
      panning.current = { active: true, startX: e.clientX, startY: e.clientY, vpX: viewport.current.x, vpY: viewport.current.y }
      return
    }

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
    const zid = hitZone(px, py, W, H)
    if (zid) { onSelectionChange({ kind: 'zone', zoneId: zid }); return }
    onSelectionChange({ kind: 'none' })
  }, [onSelectionChange])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (panning.current.active) {
      panning.current.active = false
      e.preventDefault()
      return
    }
    drag.current = { active: false, kind: null, wallId: null, pointIdx: null, itemId: null }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (panning.current.active) return
    const { pctX, pctY, W, H } = canvasCoords(e)

    if (modeRef.current === 'draw') {
      const snap = findSnap(pctX, pctY, W, H)
      const pt = snap ?? { x: pctX, y: pctY }
      drawing.current.active = true
      drawing.current.points = [...drawing.current.points, pt]
      draw()
    } else if (modeRef.current === 'zone') {
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
    if (panning.current.active) return
    const mode = modeRef.current
    if (mode !== 'draw' && mode !== 'zone') return

    const pts = drawing.current.points
    // Double-click fires two clicks then dblclick; remove duplicate last point
    const finalPts = pts.length >= 2 ? pts.slice(0, -1) : pts

    if (mode === 'draw') {
      if (finalPts.length >= 2) {
        const seg: WallSegment = { id: newId(), points: finalPts, closed: false }
        onWallsChange([...wallsRef.current, seg])
      }
    } else if (mode === 'zone') {
      if (finalPts.length >= 3) {
        onZoneCreate(finalPts, zoneTypeRef.current, '')
      }
    }
    drawing.current = { active: false, points: [], cursor: null, snap: null }
    draw()
  }, [onWallsChange, onZoneCreate, draw])

  const handleMouseLeave = useCallback(() => {
    panning.current.active = false
    drawing.current.cursor = null
    draw()
  }, [draw])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceHeld.current = true; e.preventDefault() }

      if ((e.key === 'Escape') && (modeRef.current === 'draw' || modeRef.current === 'zone')) {
        drawing.current = { active: false, points: [], cursor: null, snap: null }
        draw()
        return
      }

      // Reset viewport
      if (e.key === '0' && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement).tagName !== 'INPUT') {
        viewport.current = { x: 0, y: 0, scale: 1 }
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
        } else if (sel.kind === 'zone' && sel.zoneId) {
          onZoneDelete(sel.zoneId)
          onSelectionChange({ kind: 'none' })
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceHeld.current = false; panning.current.active = false }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onWallsChange, onMarkerDelete, onRoomDelete, onZoneDelete, onSelectionChange, draw])

  const isPanMode = mode === 'select' && spaceHeld.current
  const cursor = isPanMode
    ? (panning.current.active ? 'grabbing' : 'grab')
    : mode === 'draw' || mode === 'zone' ? 'crosshair'
    : mode === 'marker' || mode === 'room' ? 'copy'
    : 'default'

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
        onMouseLeave={handleMouseLeave}
        onContextMenu={e => e.preventDefault()}
      />
    </div>
  )
}
