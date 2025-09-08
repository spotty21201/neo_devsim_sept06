export type RegSet = {
  site_area_m2: number
  kdb: number
  klb: number
  max_floors?: number
  max_height_m?: number
}

export type Typology = {
  podium_levels: number
  podium_footprint_m2: number
  tower_floors: number
  tower_plate_m2: number
  efficiency: number
}

export type Lot = {
  id: string
  area_m2: number
  use: 'resi'|'office'|'hotel'|'retail'|'convention'|'infra'|'mixed'
  typology: Typology
}

export type Tract = {
  id: string
  area_m2: number
  type: 'road'|'park'|'water'|'infra'
  buildable?: boolean
  row_m?: number
  length_m?: number
  area_override?: boolean
}

export type Scenario = {
  id: string
  reg: RegSet
  lots: Lot[]
  tracts?: Tract[]
}

export type SimResult = {
  total_gfa: number
  far_util: number
  kdb_util: number
  height_ok: boolean
  compliance: {
    far_ok: boolean
    kdb_ok: boolean
    height_ok: boolean
    buffers: { far: number; kdb: number }
  }
}

export type OptimizeResult = {
  best_floors: number
  best_plate_m2: number
  best_total_gfa: number
  feasible: { floors: number; plate: number; gfa: number; ok: boolean }[]
}

export type CostLibraryItem = {
  component: string
  basis: 'gfa'|'area'|'lump'
  rate: number
  unit: string
}

export type CostEstimate = {
  rows: { component: string; qty: number; unit_cost: number; total_cost: number }[]
  totals: { direct: number; contingency: number; soft: number; grand_total: number; usd: number }
}

const API_URL = (import.meta as any).env?.VITE_API_URL as string | undefined

export async function postJSON<T>(path: string, body: any): Promise<T> {
  const url = API_URL ? `${API_URL}${path}` : `/api${path}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e: any) {
    throw new Error(`Network error: ${e?.message || e}`)
  }
  if (!res.ok) {
    let detail = ''
    try { detail = await res.text() } catch {}
    throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? ` – ${detail}` : ''}`)
  }
  return res.json() as Promise<T>
}

export const SimAPI = {
  simulate: (scenario: Scenario) => postJSON<SimResult>('/simulate', scenario),
  optimize: (payload: { scenario: Scenario; floors_range?: number[]; plate_range_m2?: number[] }) =>
    postJSON<OptimizeResult>('/optimize', payload),
  estimateCost: (payload: { scenario: Scenario; library: CostLibraryItem[]; fx_rate?: number; contingency_pct?: number; soft_cost_pct?: number }) =>
    postJSON<CostEstimate>('/cost/estimate', payload),
}
