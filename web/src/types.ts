export type LevelType =
  | 'BASEMENT' | 'GROUND' | 'FLOOR_1' | 'FLOOR_2' | 'FLOOR_3'
  | 'ATTIC' | 'GARAGE' | 'YARD'

export const LEVEL_TYPE_LABELS: Record<LevelType, string> = {
  BASEMENT: 'Basement',
  GROUND: 'Ground Floor',
  FLOOR_1: 'Floor 1',
  FLOOR_2: 'Floor 2',
  FLOOR_3: 'Floor 3',
  ATTIC: 'Attic',
  GARAGE: 'Garage',
  YARD: 'Yard',
}

// Fixed display order: bottom of the list = ground level, top = attic
export const LEVEL_TYPE_ORDER: Record<LevelType, number> = {
  ATTIC: 0,
  FLOOR_3: 1,
  FLOOR_2: 2,
  FLOOR_1: 3,
  GROUND: 4,
  GARAGE: 5,
  YARD: 6,
  BASEMENT: 7,
}

export type MarkerCategory =
  | 'OUTLET' | 'SWITCH' | 'APPLIANCE' | 'FURNITURE' | 'SENSOR'
  | 'HVAC' | 'PLUMBING' | 'LIGHTING' | 'DOOR' | 'WINDOW'
  | 'UTILITY' | 'STORAGE' | 'BREAKER'

export const MARKER_CATEGORY_LABELS: Record<MarkerCategory, string> = {
  OUTLET: 'Outlet', SWITCH: 'Switch', APPLIANCE: 'Appliance',
  FURNITURE: 'Furniture', SENSOR: 'Sensor', HVAC: 'HVAC',
  PLUMBING: 'Plumbing', LIGHTING: 'Lighting', DOOR: 'Door',
  WINDOW: 'Window', UTILITY: 'Utility', STORAGE: 'Storage', BREAKER: 'Breaker',
}

export const MARKER_CATEGORY_ABBREV: Record<MarkerCategory, string> = {
  OUTLET: 'OT', SWITCH: 'SW', APPLIANCE: 'AP', FURNITURE: 'FN',
  SENSOR: 'SE', HVAC: 'HV', PLUMBING: 'PL', LIGHTING: 'LT',
  DOOR: 'DR', WINDOW: 'WN', UTILITY: 'UT', STORAGE: 'ST', BREAKER: 'BR',
}

export const MARKER_CATEGORY_COLOURS: Record<MarkerCategory, string> = {
  OUTLET: '#e07b39', SWITCH: '#5b7fa6', APPLIANCE: '#6b7280',
  FURNITURE: '#8b7355', SENSOR: '#3c6255', HVAC: '#4a90a4',
  PLUMBING: '#2563eb', LIGHTING: '#d97706', DOOR: '#7c3aed',
  WINDOW: '#059669', UTILITY: '#a66c56', STORAGE: '#8b6344', BREAKER: '#dc2626',
}

export interface MapConfig {
  lat: number
  lon: number
  zoom: number     // Web Mercator zoom (14–21)
  opacity: number  // 0–1
}

export interface HomeLevel {
  id: string
  name: string
  type: LevelType
  order_index: number
  walls_json: string
  map_config_json: string  // JSON-encoded MapConfig or empty string
  created_by: string
  updated_at: string
}

export interface Room {
  id: string
  level_id: string
  name: string
  x_coordinate: number
  y_coordinate: number
  updated_at: string
}

export interface AssetMarker {
  id: string
  level_id: string
  label: string
  category: MarkerCategory
  x_coordinate: number
  y_coordinate: number
  notes: string
  updated_at: string
}

export type ZoneType =
  | 'GRASS' | 'DRIVEWAY' | 'FLOWER_BED' | 'PATIO' | 'DECK'
  | 'GARDEN' | 'POOL' | 'SIDEWALK' | 'PARKING'

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  GRASS: 'Grass', DRIVEWAY: 'Driveway', FLOWER_BED: 'Flower Bed',
  PATIO: 'Patio', DECK: 'Deck', GARDEN: 'Garden',
  POOL: 'Pool', SIDEWALK: 'Sidewalk', PARKING: 'Parking',
}

export const ZONE_TYPE_COLOURS: Record<ZoneType, string> = {
  GRASS: '#6b9e5e', DRIVEWAY: '#9e9e8e', FLOWER_BED: '#c4709a',
  PATIO: '#c8b89a', DECK: '#a07848', GARDEN: '#3e6b3e',
  POOL: '#5ba8c8', SIDEWALK: '#b0b0a0', PARKING: '#6c6c6c',
}

export interface Zone {
  id: string
  level_id: string
  name: string
  type: ZoneType
  points_json: string
  updated_at: string
}

export interface HomeMapState {
  levels: HomeLevel[]
  markers: AssetMarker[]
  rooms: Room[]
  zones: Zone[]
}

export interface Point {
  x: number  // percentage 0–100
  y: number
}

export interface WallSegment {
  id: string
  points: Point[]
  closed: boolean
}

export type GridUnit = 'none' | '1ft' | '2ft' | '5ft' | '10ft' | '1m' | '2m' | '5m'

export const GRID_UNIT_LABELS: Record<GridUnit, string> = {
  none: 'None',
  '1ft': '1 ft / square',
  '2ft': '2 ft / square',
  '5ft': '5 ft / square',
  '10ft': '10 ft / square',
  '1m': '1 m / square',
  '2m': '2 m / square',
  '5m': '5 m / square',
}

export const GRID_UNIT_MAP: Partial<Record<GridUnit, { value: number; suffix: string }>> = {
  '1ft': { value: 1, suffix: 'ft' },
  '2ft': { value: 2, suffix: 'ft' },
  '5ft': { value: 5, suffix: 'ft' },
  '10ft': { value: 10, suffix: 'ft' },
  '1m': { value: 1, suffix: 'm' },
  '2m': { value: 2, suffix: 'm' },
  '5m': { value: 5, suffix: 'm' },
}

export const PALETTE = {
  bg: '#fcfbfa',
  sage: '#3c6255',
  terracotta: '#a66c56',
  text: '#2c2c2c',
  border: '#ddd8d2',
  white: '#ffffff',
  sageLight: '#e8f0ed',
} as const

export function newId(): string {
  return crypto.randomUUID()
}

export type BreakerType = 'SINGLE' | 'DOUBLE' | 'GFCI' | 'AFCI' | 'TANDEM'

export const BREAKER_TYPE_LABELS: Record<BreakerType, string> = {
  SINGLE: 'Single (120V)',
  DOUBLE: 'Double (240V)',
  GFCI: 'GFCI (120V)',
  AFCI: 'AFCI (120V)',
  TANDEM: 'Tandem (2×120V)',
}

export interface BreakerPanel {
  id: string
  marker_id: string
  total_slots: number
  notes: string
  updated_at: string
  marker_label: string
  level_id: string
}

export interface Circuit {
  id: string
  panel_id: string
  slot_number: number
  label: string
  amperage: number
  breaker_type: BreakerType
  notes: string
  updated_at: string
}

export interface CircuitConnection {
  id: string
  circuit_id: string
  marker_id: string
  notes: string
  updated_at: string
  marker_label: string
  marker_category: MarkerCategory
  level_id: string
}

export interface ElectricalState {
  panels: BreakerPanel[]
  markers: AssetMarker[]
}

export type EventType = 'INSPECTED' | 'REPLACED' | 'SERVICED' | 'REPAIRED' | 'CLEANED' | 'NOTE'

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  INSPECTED: 'Inspected',
  REPLACED: 'Replaced',
  SERVICED: 'Serviced',
  REPAIRED: 'Repaired',
  CLEANED: 'Cleaned',
  NOTE: 'Note',
}

export const EVENT_TYPE_COLOURS: Record<EventType, string> = {
  INSPECTED: '#3c6255',
  REPLACED:  '#dc2626',
  SERVICED:  '#2563eb',
  REPAIRED:  '#d97706',
  CLEANED:   '#059669',
  NOTE:      '#6b7280',
}

export interface MarkerEvent {
  id: number
  marker_id: string
  event_type: EventType
  note: string
  created_at: string
}

export function parseWalls(json: string): WallSegment[] {
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is WallSegment =>
      typeof v === 'object' && v !== null && 'points' in v && Array.isArray(v.points)
    )
  } catch {
    return []
  }
}
