import { useEffect, useRef, useState, useCallback } from 'react'
import type { SpatialState, AssetMarker, WallSegment, Point } from './types'
import { PALETTE, CATEGORY_COLOURS } from './types'

interface Props {
  state: SpatialState
  activeLevelId: string | null
}

const MARKER_RADIUS = 10
const FONT = '12px sans-serif'

export function SpatialCanvas({ state, activeLevelId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredMarker, setHoveredMarker] = useState<AssetMarker | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  const activeMarkers = state.markers.filter(
    (m) => m.level_id === activeLevelId
  )

  const activeLevel = state.levels.find((l) => l.id === activeLevelId)
  const walls: WallSegment[] = activeLevel
    ? safeParseWalls(activeLevel.walls_json)
    : []

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas

    ctx.clearRect(0, 0, width, height)

    // Draw walls
    ctx.strokeStyle = PALETTE.sage
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    walls.forEach((wall) => {
      if (wall.points.length < 2) return
      ctx.beginPath()
      wall.points.forEach((pt, i) => {
        const px = (pt.x / 100) * width
        const py = (pt.y / 100) * height
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      if (wall.closed) ctx.closePath()
      ctx.stroke()
    })

    // Draw markers
    activeMarkers.forEach((marker) => {
      const px = (marker.x_coordinate / 100) * width
      const py = (marker.y_coordinate / 100) * height
      const isHovered = hoveredMarker?.id === marker.id
      const colour = CATEGORY_COLOURS[marker.category] ?? PALETTE.terracotta

      ctx.beginPath()
      ctx.arc(px, py, isHovered ? MARKER_RADIUS + 3 : MARKER_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = colour
      ctx.globalAlpha = isHovered ? 1 : 0.85
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      ctx.fillStyle = PALETTE.text
      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.fillText(marker.label, px, py + MARKER_RADIUS + 14)
    })
  }, [walls, activeMarkers, hoveredMarker])

  // Resize observer keeps canvas pixel-sharp
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      draw()
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  useEffect(() => {
    draw()
  }, [draw])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const w = canvas.width
    const h = canvas.height

    const hit = activeMarkers.find((m) => {
      const px = (m.x_coordinate / 100) * w
      const py = (m.y_coordinate / 100) * h
      return Math.hypot(mx - px, my - py) <= MARKER_RADIUS + 4
    })

    setHoveredMarker(hit ?? null)
    setTooltip(hit ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : null)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: hoveredMarker ? 'pointer' : 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredMarker(null); setTooltip(null) }}
      />
      {hoveredMarker && tooltip && (
        <Tooltip marker={hoveredMarker} x={tooltip.x} y={tooltip.y} />
      )}
    </div>
  )
}

function Tooltip({ marker, x, y }: { marker: AssetMarker; x: number; y: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x + 14,
        top: y - 8,
        background: '#fff',
        border: `1px solid ${PALETTE.border}`,
        borderRadius: 6,
        padding: '0.4rem 0.75rem',
        pointerEvents: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontFamily: 'sans-serif',
        fontSize: 12,
        color: PALETTE.text,
        minWidth: 140,
        zIndex: 10,
      }}
    >
      <strong style={{ color: PALETTE.sage }}>{marker.label}</strong>
      <div style={{ color: '#888', marginTop: 2 }}>{marker.category}</div>
      {marker.notes && <div style={{ marginTop: 4 }}>{marker.notes}</div>}
    </div>
  )
}

function safeParseWalls(json: string): WallSegment[] {
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isWallSegment)
  } catch {
    return []
  }
}

function isWallSegment(v: unknown): v is WallSegment {
  return (
    typeof v === 'object' &&
    v !== null &&
    'points' in v &&
    Array.isArray((v as WallSegment).points)
  )
}

function isPoint(v: unknown): v is Point {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Point).x === 'number' &&
    typeof (v as Point).y === 'number'
  )
}

void isPoint // used by strict type checking consumers
