import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import demo from '../data/jakarta_demo.json'
import type { Scenario, SimResult, OptimizeResult, CostEstimate } from '../lib/api'

type ScenarioState = {
  scenario: Scenario
  setScenario: (s: Scenario) => void
  project: any
  setProject: (p: any) => void
  lastSim?: SimResult | null
  setLastSim: (r: SimResult | null) => void
  lastOpt?: OptimizeResult | null
  setLastOpt: (r: OptimizeResult | null) => void
  lastCost?: CostEstimate | null
  setLastCost: (c: CostEstimate | null) => void
  saved: ScenarioSnapshot[]
  saveScenario: (name: string, includeResults?: boolean) => ScenarioSnapshot
  loadScenario: (id: string) => void
  deleteScenario: (id: string) => void
}

const Ctx = createContext<ScenarioState | null>(null)

export type ScenarioSnapshot = {
  id: string
  name: string
  created_at: number
  scenario: Scenario
  sim?: SimResult | null
  cost?: CostEstimate | null
}

const initialScenario = demo as unknown as Scenario
const storageKey = 'neo:saved_scenarios'
const projectKey = 'neo:project'

function newProjectDefaults() {
  return { id: cryptoRandomId(), name: 'Jakarta 13.8ha Superblock', site_area_m2: 138000, units: 'm2', lat: -6.2, lng: 106.8, basemap: true, created_at: Date.now(), updated_at: Date.now() }
}

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario)
  const [project, setProject] = useState<any>(() => {
    try { const raw = localStorage.getItem(projectKey); if (raw) return JSON.parse(raw); } catch {}
    return newProjectDefaults()
  })
  const [lastSim, setLastSim] = useState<SimResult | null>(null)
  const [lastOpt, setLastOpt] = useState<OptimizeResult | null>(null)
  const [lastCost, setLastCost] = useState<CostEstimate | null>(null)
  const [saved, setSaved] = useState<ScenarioSnapshot[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setSaved(JSON.parse(raw))
    } catch {}
  }, [])

  function persist(list: ScenarioSnapshot[]) {
    setSaved(list)
    try { localStorage.setItem(storageKey, JSON.stringify(list)) } catch {}
  }

  useEffect(() => {
    const next = { ...project, id: project?.id ?? cryptoRandomId(), updated_at: Date.now(), created_at: project?.created_at ?? Date.now() }
    setProjectInternal(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setProjectInternal(p: any) {
    try { localStorage.setItem(projectKey, JSON.stringify(p)) } catch {}
  }

  useEffect(() => { setProjectInternal(project) }, [project])

  function saveScenario(name: string, includeResults = true): ScenarioSnapshot {
    const snap: ScenarioSnapshot = {
      id: Math.random().toString(36).slice(2, 10),
      name,
      created_at: Date.now(),
      scenario,
      sim: includeResults ? lastSim : null,
      cost: includeResults ? lastCost : null,
    }
    persist([snap, ...saved])
    return snap
  }

  function loadScenario(id: string) {
    const snap = saved.find(s => s.id === id)
    if (!snap) return
    setScenario(snap.scenario)
    setLastSim(snap.sim ?? null)
    setLastOpt(null)
    setLastCost(snap.cost ?? null)
  }

  function deleteScenario(id: string) {
    persist(saved.filter(s => s.id !== id))
  }

  const value = useMemo(() => ({ scenario, setScenario, project, setProject, lastSim, setLastSim, lastOpt, setLastOpt, lastCost, setLastCost, saved, saveScenario, loadScenario, deleteScenario }), [scenario, project, lastSim, lastOpt, lastCost, saved])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function cryptoRandomId() {
  try {
    // @ts-ignore
    const bytes = (crypto?.getRandomValues?.(new Uint8Array(8))) || []
    return Array.from(bytes as any).map((b: number)=>b.toString(16).padStart(2,'0')).join('')
  } catch { return Math.random().toString(36).slice(2,10) }
}

export function useScenario() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useScenario must be used within ScenarioProvider')
  return v
}
