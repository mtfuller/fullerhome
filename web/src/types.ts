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

export interface HomeLevel {
  id: string
  name: string
  type: LevelType
  order_index: number
  walls_json: string
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
