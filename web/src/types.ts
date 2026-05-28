export type LevelType = 'YARD' | 'BASEMENT' | 'MAIN' | 'UPPER'

export type AssetCategory = 'UTILITY' | 'STORAGE' | 'PEST' | 'WORKSHOP'

export interface SpatialLevel {
  id: string
  name: string
  type: LevelType
  order_index: number
  walls_json: string  // JSON-encoded polyline array
  created_by: string
  updated_at: string
}

export interface AssetMarker {
  id: string
  level_id: string
  label: string
  category: AssetCategory
  x_coordinate: number  // percentage offset 0.0–100.0
  y_coordinate: number  // percentage offset 0.0–100.0
  notes: string
  updated_at: string
}

export interface SpatialState {
  levels: SpatialLevel[]
  markers: AssetMarker[]
}

export interface Point {
  x: number
  y: number
}

export interface WallSegment {
  points: Point[]
  closed: boolean
}

// Colour palette constants matching the design system
export const PALETTE = {
  bg: '#fcfbfa',
  sage: '#3c6255',
  terracotta: '#a66c56',
  text: '#2c2c2c',
  border: '#ddd8d2',
  white: '#ffffff',
} as const

export const CATEGORY_COLOURS: Record<AssetCategory, string> = {
  UTILITY: '#a66c56',   // terracotta circle
  STORAGE: '#8b6344',   // soft brown
  PEST: '#6b7280',      // slate grey
  WORKSHOP: '#3c6255',  // sage green
}
