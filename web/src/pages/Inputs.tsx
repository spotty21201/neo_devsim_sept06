import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScenario } from '../state/ScenarioContext'
import { Card } from '../components/Card'
import type { Lot, Scenario, Tract } from '../lib/api'
import { SimAPI } from '../lib/api'
import { StatusChip } from '../components/StatusChip'
import { formatNumber } from '../lib/format'

export default function Inputs() {
  const { scenario, setScenario, setLastSim, setLastOpt, setLastCost, project } = useScenario() as any
  const [draft, setDraft] = useState<Scenario>(structuredClone(scenario))
  const nav = useNavigate()
  // Prefill from Project Setup on first render
  const didSync = (globalThis as any).__neo_inputs_synced || false
  if (!didSync && project) {
    const reg = { ...draft.reg }
    let changed = false
    const fields: Array<keyof typeof reg> = ['site_area_m2','kdb','klb','max_floors','max_height_m','floor_to_floor_m','efficiency_override'] as any
    for (const f of fields) {
      if (project[f] != null && reg[f] !== project[f]) { (reg as any)[f] = project[f]; changed = true }
    }
    if (changed) setDraft(d => ({ ...d, reg }))
    ;(globalThis as any).__neo_inputs_synced = true
  }

  function updateReg<K extends keyof Scenario['reg']>(key: K, value: any) {
    setDraft({ ...draft, reg: { ...draft.reg, [key]: value } })
  }

  function updateLot(idx: number, patch: Partial<Lot>) {
    const lots = draft.lots.slice()
    lots[idx] = { ...lots[idx], ...patch }
    setDraft({ ...draft, lots })
  }

  function updateTypo(idx: number, patch: Partial<Lot['typology']>) {
    const lots = draft.lots.slice()
    lots[idx] = { ...lots[idx], typology: { ...lots[idx].typology, ...patch } }
    setDraft({ ...draft, lots })
  }

  function nextLotId(): string {
    const prefix = 'LOT-'
    const nums = draft.lots.map(l => parseInt((l.id||'').replace(prefix, ''), 10)).filter(n=>!Number.isNaN(n))
    const next = (nums.length? Math.max(...nums)+1 : 1)
    return prefix + String(next).padStart(3,'0')
  }

  function addLot() {
    const lot: Lot = {
      id: nextLotId(),
      area_m2: 8000,
      use: 'resi',
      typology: { podium_levels: 5, podium_footprint_m2: 5000, tower_floors: 40, tower_plate_m2: 2000, efficiency: 0.8 },
    }
    setDraft({ ...draft, lots: [...draft.lots, lot] })
  }

  // Tracts builder
  function updateTract(idx: number, patch: Partial<Tract>) {
    const tracts = draft.tracts ? draft.tracts.slice() : []
    tracts[idx] = { ...tracts[idx], ...patch } as Tract
    setDraft({ ...draft, tracts })
  }
  function addTract(type: Tract['type']) {
    const tracts = draft.tracts ? draft.tracts.slice() : []
    const id = `${type}-${tracts.length+1}`
    tracts.push({ id, type, area_m2: 1000, buildable: false })
    setDraft({ ...draft, tracts })
  }
  function removeTract(idx: number) {
    const tracts = (draft.tracts||[]).slice()
    tracts.splice(idx,1)
    setDraft({ ...draft, tracts })
  }
  function moveTract(idx: number, dir: -1|1) {
    const tracts = (draft.tracts||[]).slice()
    const j = idx + dir
    if (j<0 || j>=tracts.length) return
    const tmp = tracts[idx]
    tracts[idx] = tracts[j]
    tracts[j] = tmp
    setDraft({ ...draft, tracts })
  }

  function removeLot(idx: number) {
    const lots = draft.lots.slice()
    lots.splice(idx, 1)
    setDraft({ ...draft, lots })
  }

  async function saveAndSimulate() {
    setScenario(draft)
    const sim = await SimAPI.simulate(draft)
    setLastSim(sim)
    setLastOpt(null)
    setLastCost(null)
    nav('/simulate')
  }

  function reloadDemo() {
    const scn = (demo as unknown) as Scenario
    setDraft(structuredClone(scn))
    setScenario(structuredClone(scn))
  }

  function reloadFromProject() {
    const p = project || {}
    const reg = { ...draft.reg }
    const fields: Array<keyof typeof reg> = ['site_area_m2','kdb','klb','max_floors','max_height_m','floor_to_floor_m','efficiency_override'] as any
    for (const f of fields) {
      if (p[f] != null) { (reg as any)[f] = p[f] }
    }
    setDraft(d => ({ ...d, reg }))
  }

  const kdbPct = Math.round(draft.reg.kdb * 100)
  const kdbValid = draft.reg.kdb >= 0 && draft.reg.kdb <= 1
  const effInvalid = draft.lots.some(l => l.typology.efficiency <= 0 || l.typology.efficiency > 1)

  const totals = useMemo(() => computeTotals(draft), [draft])
  const tractArea = (draft.tracts||[]).reduce((a,t)=>a+((t.type==='road' && !t.area_override && t.row_m!=null && t.length_m!=null) ? (t.row_m*t.length_m) : (t.area_m2||0)),0)
  const tractPct = draft.reg.site_area_m2 ? Math.round((tractArea/draft.reg.site_area_m2)*100) : 0
  const floorsExceeded = useMemo(() => (
    typeof draft.reg.max_floors === 'number' && draft.lots.some(l => l.typology.tower_floors > (draft.reg.max_floors || 0))
  ), [draft])
  const footprintViolations = draft.lots.some(l => l.typology.podium_footprint_m2 > l.area_m2)

  const issues: string[] = []
  if (!kdbValid) issues.push('KDB must be 0–100%')
  if (effInvalid) issues.push('Efficiency must be within 0–1')
  if (floorsExceeded) issues.push('Some towers exceed Max Floors')
  if (footprintViolations) issues.push('Podium footprint exceeds lot area')
  if (totals.kdbUtil > 1) issues.push('KDB exceeds site coverage cap')
  if (totals.farUtil > 1) issues.push('FAR exceeds cap')

  return (
    <div className="space-y-6">
      <Card title="1) Site & Regulations" action={<div className="flex items-center gap-2"><button onClick={reloadFromProject} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Reload From Project Setup</button><button onClick={reloadDemo} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Reload Example Data</button></div>}>
        <div className="mb-2 text-xs text-gray-500">Example Values loaded from “Jakarta 13.8ha Superblock”. You can edit any field below.</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Site Area (m²)">
            <input type="number" value={draft.reg.site_area_m2} onChange={e=>updateReg('site_area_m2', Number(e.target.value))} className="input" />
            <InheritBadge value={draft.reg.site_area_m2} base={project?.site_area_m2} />
          </Field>
          <Field label="KDB (site coverage %)">
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={100} value={kdbPct} onChange={e=>updateReg('kdb', Number(e.target.value)/100)} className="w-full" />
              <span className="w-12 text-right">{kdbPct}%</span>
            </div>
            <InheritBadge value={draft.reg.kdb} base={project?.kdb} percent />
          </Field>
          <Field label="KLB / FAR">
            <input type="number" step="0.1" value={draft.reg.klb} onChange={e=>updateReg('klb', Number(e.target.value))} className="input" />
            <InheritBadge value={draft.reg.klb} base={project?.klb} />
          </Field>
          <Field label="Max Floors">
            <input type="number" value={draft.reg.max_floors ?? ''} onChange={e=>updateReg('max_floors', e.target.value===''? undefined : Number(e.target.value))} className="input" />
            <InheritBadge value={draft.reg.max_floors} base={project?.max_floors} />
          </Field>
          <Field label="Max Height (m)">
            <input type="number" value={draft.reg.max_height_m ?? ''} onChange={e=>updateReg('max_height_m', e.target.value===''? undefined : Number(e.target.value))} className="input" />
            <InheritBadge value={draft.reg.max_height_m} base={project?.max_height_m} />
          </Field>
          <Field label="Floor-to-Floor (m)">
            <input type="number" step={0.1} value={draft.reg.floor_to_floor_m ?? ''} onChange={e=>updateReg('floor_to_floor_m', e.target.value===''? undefined : Number(e.target.value))} className="input" />
            <InheritBadge value={draft.reg.floor_to_floor_m} base={project?.floor_to_floor_m} />
          </Field>
          <Field label="Efficiency (0-1)">
            <input type="number" step={0.01} value={draft.reg.efficiency_override ?? ''} onChange={e=>updateReg('efficiency_override', e.target.value===''? undefined : Number(e.target.value))} className="input" />
            <InheritBadge value={draft.reg.efficiency_override} base={project?.efficiency_override} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <StatusChip status={utilStatus(totals.farUtil)} label={`FAR util ${Math.round(totals.farUtil*100)}% (${formatNumber(Math.round(totals.farCap - totals.totalGfa))} m² buffer)`} />
          <StatusChip status={utilStatus(totals.kdbUtil)} label={`KDB util ${Math.round(totals.kdbUtil*100)}% (${formatNumber(Math.round(totals.kdbCap - totals.totalFootprint))} m² buffer)`} />
          {floorsExceeded && <StatusChip status="bad" label="Floors exceed max" />}
          {footprintViolations && <StatusChip status="bad" label="Footprint > Lot area" />}
        </div>
        <div className="mt-3 space-y-2">
          <UtilBar label="FAR" util={totals.farUtil} />
          <UtilBar label="KDB" util={totals.kdbUtil} />
        </div>
        {!kdbValid && <div className="text-xs text-red-600 mt-2">KDB must be between 0% and 100%.</div>}
      </Card>

      <Card title="2) Tracts (Non‑Sellable, Non‑Buildable Land)">
        <div className="mb-3 text-xs text-gray-600">Tracts represent non‑sellable remainder land excluded from sellable area/GFA. Roads can be calculated via RoW × Length; parks/water/infra are entered as areas. Totals show m², ha, and % of site.</div>
        <div className="space-y-2">
          {(draft.tracts||[]).map((t,i)=> {
            const computedArea = (t.type==='road' && !t.area_override && t.row_m!=null && t.length_m!=null) ? (t.row_m * t.length_m) : t.area_m2
            const pct = draft.reg.site_area_m2? Math.round((computedArea/draft.reg.site_area_m2)*100) : 0
            const ha = computedArea/10000
            return (
            <div key={t.id} className="grid grid-cols-2 md:grid-cols-8 gap-3 items-end">
              <div>
                <div className="text-gray-600 text-xs mb-1">#</div>
                <div className="text-sm">{i+1}</div>
              </div>
              <Field label="ID"><input className="input" value={t.id} onChange={e=>updateTract(i,{ id: e.target.value })} /></Field>
              <Field label="Type">
                <select className="input" value={t.type} onChange={e=>updateTract(i,{ type: e.target.value as Tract['type'] })}>
                  <option value="road">road</option>
                  <option value="park">park</option>
                  <option value="water">water</option>
                  <option value="infra">infra</option>
                </select>
              </Field>
              {t.type==='road' && (
                <>
                  <Field label="RoW (m)"><input className="input" type="number" value={t.row_m ?? ''} onChange={e=>updateTract(i,{ row_m: e.target.value===''? undefined : Number(e.target.value) })} /></Field>
                  <Field label="Length (m)"><input className="input" type="number" value={t.length_m ?? ''} onChange={e=>updateTract(i,{ length_m: e.target.value===''? undefined : Number(e.target.value) })} /></Field>
                  <Field label="Override Area">
                    <label className="inline-flex items-center gap-2 text-gray-700"><input type="checkbox" checked={!!t.area_override} onChange={e=>updateTract(i,{ area_override: e.target.checked })} /> Enable</label>
                  </Field>
                </>
              )}
              <Field label="Area (m²)"><input className="input" type="number" disabled={t.type==='road' && !t.area_override} value={t.type==='road' && !t.area_override ? Math.round(computedArea) : (t.area_m2||0)} onChange={e=>updateTract(i,{ area_m2: Number(e.target.value) })} /></Field>
              <div className="text-xs text-gray-500">{pct}% • {formatNumber(Math.round(computedArea))} m² • {ha.toFixed(4)} ha</div>
              <div className="flex items-center gap-2 justify-end">
                <button onClick={()=>moveTract(i,-1)} disabled={i===0} className="px-2 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">↑</button>
                <button onClick={()=>moveTract(i,1)} disabled={i===(draft.tracts||[]).length-1} className="px-2 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">↓</button>
                <button onClick={()=>removeTract(i)} className="px-3 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">Remove</button>
              </div>
            </div>
          )})}
            <div className="flex items-center gap-2">
              <button onClick={()=>addTract('road')} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Add Road</button>
              <button onClick={()=>addTract('park')} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Add Park/Water</button>
              <button onClick={()=>addTract('infra')} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Add Infra</button>
              <div className="ml-auto text-xs text-gray-600">Tracts total: {formatNumber(Math.round(tractArea))} m² • {(tractArea/10000).toFixed(4)} ha • {tractPct}%</div>
            </div>
        </div>
      </Card>

      <Card title="3) Lots & Typologies" action={<button onClick={reloadDemo} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Reload Example Data</button>}>
        <div className="space-y-3">
          {draft.lots.map((l, i) => (
            <div key={l.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm flex items-center gap-2">
                  {l.id}
                  <PerLotTooltip idx={i} totals={totals} />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-xs text-gray-500">Use:</label>
                  <select className="input" value={l.use} onChange={e=>updateLot(i,{ use: e.target.value as Lot['use'] })}>
                    <option value="resi">resi</option>
                    <option value="office">office</option>
                    <option value="hotel">hotel</option>
                    <option value="retail">retail</option>
                    <option value="convention">convention</option>
                    <option value="infra">infra</option>
                    <option value="mixed">mixed</option>
                  </select>
                  <button onClick={()=>removeLot(i)} className="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              </div>
              {/* Per-lot chips */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {(() => {
                  const s = totals.perLot[i]
                  const kdbPct = Math.round((s.kdbShare||0) * 100)
                  const farPct = Math.round((s.farShare||0) * 100)
                  const gfaTot = Math.round((s.gfaShareOfTotal||0) * 100)
                  const fpTot = Math.round((s.footprintShareOfTotal||0) * 100)
                  const podGfa = l.typology.podium_levels * l.typology.podium_footprint_m2 * l.typology.efficiency
                  const towGfa = l.typology.tower_floors * l.typology.tower_plate_m2 * l.typology.efficiency
                  const totGfa = podGfa + towGfa
                  return (
                    <>
                      <StatusChip status={s.kdbShare <= 1 ? 'ok' : 'bad'} label={`KDB share ${kdbPct}%`} />
                      <StatusChip status={s.farShare <= 1 ? 'ok' : 'bad'} label={`FAR share ${farPct}%`} />
                      <span className="text-gray-500">Footprint {formatNumber(Math.round(s.footprint))} m² ({fpTot}% total) • Podium GFA {formatNumber(Math.round(podGfa))} m² • Tower GFA {formatNumber(Math.round(towGfa))} m² • Total GFA {formatNumber(Math.round(totGfa))} m² ({gfaTot}% total)</span>
                    </>
                  )
                })()}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3 text-sm">
                <Field label="Lot Area (m²)"><input type="number" value={l.area_m2} onChange={e=>updateLot(i,{ area_m2:Number(e.target.value) })} className="input" /></Field>
                <Field label="Podium Levels"><input type="number" value={l.typology.podium_levels} onChange={e=>updateTypo(i,{ podium_levels:Number(e.target.value) })} className="input" /></Field>
                <Field label="Podium Footprint (m²)">
                  <input type="number" value={l.typology.podium_footprint_m2} onChange={e=>updateTypo(i,{ podium_footprint_m2:Number(e.target.value) })} className={`input ${l.typology.podium_footprint_m2 > l.area_m2 ? 'input-error' : ''}`} />
                  {l.typology.podium_footprint_m2 > l.area_m2 && <div className="text-xs text-red-600 mt-1">Footprint exceeds lot area (max {formatNumber(Math.round(l.area_m2))} m²)</div>}
                </Field>
                <Field label="Tower Floors">
                  <input type="number" value={l.typology.tower_floors} onChange={e=>updateTypo(i,{ tower_floors:Number(e.target.value) })} className={`input ${(draft.reg.max_floors!=null && l.typology.tower_floors > (draft.reg.max_floors||0)) ? 'input-error' : ''}`} />
                  {(draft.reg.max_floors!=null && l.typology.tower_floors > (draft.reg.max_floors||0)) && <div className="text-xs text-red-600 mt-1">Exceeds max floors ({draft.reg.max_floors})</div>}
                </Field>
                <Field label="Tower Plate (m²)"><input type="number" value={l.typology.tower_plate_m2} onChange={e=>updateTypo(i,{ tower_plate_m2:Number(e.target.value) })} className="input" /></Field>
                <Field label={`Efficiency (0-1)${effLabel(l.use)}`}>
                  <input type="number" step="0.01" value={l.typology.efficiency} onChange={e=>updateTypo(i,{ efficiency:Number(e.target.value) })} className={`input ${(l.typology.efficiency<=0 || l.typology.efficiency>1) ? 'input-error' : ''}`} />
                  <EffHint use={l.use} value={l.typology.efficiency} />
                </Field>
              </div>
            </div>
          ))}

          <button onClick={addLot} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Add Lot</button>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <button onClick={()=>setScenario(draft)} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Save</button>
        <button onClick={saveAndSimulate} disabled={issues.length>0} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">Simulate</button>
        <span className="text-xs text-gray-500">Changes are kept in memory for this session.</span>
      </div>
      {issues.length>0 && (
        <ul className="text-xs text-red-600 list-disc ml-5">
          {issues.map((i,idx)=>(<li key={idx}>{i}</li>))}
        </ul>
      )}

      {/* Preview table */}
      <Card title="Preview – Table 3: Target vs Achieved (Compliance)">
        <table className="w-full text-sm">
          <thead className="text-gray-500">
            <tr className="[&>th]:text-left [&>th]:py-2"><th>Row</th><th>Target</th><th>Achieved</th><th>Status</th><th>Buffer</th></tr>
          </thead>
          <tbody className="[&>tr>td]:py-2 border-t border-gray-100">
            <tr>
              <td>Total Land Area</td>
              <td colSpan={2}>{formatNumber(Math.round(draft.reg.site_area_m2))} m²</td>
              <td colSpan={2}></td>
            </tr>
            <tr>
              <td>Max Footprint vs ΣFootprints</td>
              <td>{formatNumber(Math.round(draft.reg.kdb * draft.reg.site_area_m2))} m²</td>
              <td>{formatNumber(Math.round(totals.totalFootprint))} m²</td>
              <td>{utilStatus(totals.kdbUtil)==='ok'? 'Compliant' : utilStatus(totals.kdbUtil)==='warn' ? 'Near cap' : 'Exceeds'}</td>
              <td>{formatNumber(Math.round(draft.reg.kdb * draft.reg.site_area_m2 - totals.totalFootprint))} m²</td>
            </tr>
            <tr>
              <td>Max GFA vs ΣGFA</td>
              <td>{formatNumber(Math.round(draft.reg.klb * draft.reg.site_area_m2))} m²</td>
              <td>{formatNumber(Math.round(totals.totalGfa))} m²</td>
              <td>{utilStatus(totals.farUtil)==='ok'? 'Compliant' : utilStatus(totals.farUtil)==='warn' ? 'Near cap' : 'Exceeds'}</td>
              <td>{formatNumber(Math.round(draft.reg.klb * draft.reg.site_area_m2 - totals.totalGfa))} m²</td>
            </tr>
            <tr>
              <td>Max Height vs Actual</td>
              <td>{draft.reg.max_floors ?? '—'} floors</td>
              <td>{Math.max(...draft.lots.map(l=>l.typology.tower_floors))} floors</td>
              <td>{floorsExceeded? 'Exceeds' : 'OK'}</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Parking</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Open Space</td>
              <td>—</td>
              <td>{formatNumber(Math.round((draft.tracts||[]).filter(t=>t.type==='park'||t.type==='water').reduce((a,t)=>a+t.area_m2,0)))} m²</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-gray-600 text-xs mb-1">{label}</div>
      {children}
    </label>
  )
}

// Tailwind helpers
declare module 'react' { interface HTMLAttributes<T> { } }

// Helpers
function computeTotals(scn: Scenario) {
  const lotStats = scn.lots.map(l => {
    const gfa = (l.typology.podium_levels * l.typology.podium_footprint_m2 * l.typology.efficiency) + (l.typology.tower_floors * l.typology.tower_plate_m2 * l.typology.efficiency)
    const footprint = Math.min(l.area_m2, l.typology.podium_footprint_m2)
    return { gfa, footprint }
  })
  const totalGfa = lotStats.reduce((a,b)=>a+b.gfa,0)
  const totalFootprint = lotStats.reduce((a,b)=>a+b.footprint,0)
  const farCap = scn.reg.klb * scn.reg.site_area_m2
  const kdbCap = scn.reg.kdb * scn.reg.site_area_m2
  const farUtil = farCap ? totalGfa / farCap : 0
  const kdbUtil = kdbCap ? totalFootprint / kdbCap : 0
  const perLot = lotStats.map(s => ({
    gfa: s.gfa,
    footprint: s.footprint,
    farShare: farCap ? s.gfa / farCap : 0,
    kdbShare: kdbCap ? s.footprint / kdbCap : 0,
    gfaShareOfTotal: totalGfa ? s.gfa / totalGfa : 0,
    footprintShareOfTotal: totalFootprint ? s.footprint / totalFootprint : 0,
  }))
  return { totalGfa, totalFootprint, farCap, kdbCap, farUtil, kdbUtil, perLot }
}

function utilStatus(util: number): 'ok'|'warn'|'bad' {
  if (util <= 0.9) return 'ok'
  if (util <= 1) return 'warn'
  return 'bad'
}

const effRanges: Record<Lot['use'], [number, number]> = {
  resi: [0.78, 0.85],
  office: [0.75, 0.82],
  hotel: [0.65, 0.75],
  convention: [0.55, 0.70],
  mixed: [0.72, 0.82],
}

function effLabel(use: Lot['use']) { const [a,b] = effRanges[use]; return ` (rec. ${a}–${b})` }

function EffHint({ use, value }: { use: Lot['use']; value: number }) {
  const [min, max] = effRanges[use]
  const ok = value >= min && value <= max
  return (
    <div className={`mt-1 text-xs ${ok? 'text-gray-400' : 'text-red-600'}`}>
      {ok ? 'Within recommended range' : `Outside recommended range (${min}–${max})`}
    </div>
  )
}

function UtilBar({ label, util }: { label: string; util: number }) {
  const pct = Math.max(0, Math.min(1.2, util))
  const color = util<=0.9 ? 'bg-emerald-500' : util<=1 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between text-gray-600 mb-1"><span>{label}</span><span>{Math.round(util*100)}%</span></div>
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(pct*100,100)}%` }} />
      </div>
    </div>
  )
}

function PerLotTooltip({ idx, totals }: { idx: number; totals: ReturnType<typeof computeTotals> }) {
  const [open, setOpen] = useState(false)
  const s = totals.perLot[idx]
  const kdbPct = Math.round((s.kdbShare||0) * 100)
  const farPct = Math.round((s.farShare||0) * 100)
  return (
    <span className="relative inline-block">
      <button type="button" aria-label="Per-lot contribution" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[10px] leading-5 text-center">i</button>
      {open && (
        <div className="absolute z-10 left-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-sm text-xs">
          <div className="font-medium mb-1">Per‑Lot Contribution</div>
          <div className="flex items-center justify-between"><span>Footprint</span><span>{formatNumber(Math.round(s.footprint))} m²</span></div>
          <div className="flex items-center justify-between"><span>KDB share</span><span>{kdbPct}% of cap</span></div>
          <div className="flex items-center justify-between mt-2"><span>GFA</span><span>{formatNumber(Math.round(s.gfa))} m²</span></div>
          <div className="flex items-center justify-between"><span>FAR share</span><span>{farPct}% of cap</span></div>
        </div>
      )}
    </span>
  )
}

// Reload demo scenario
import demo from '../data/jakarta_demo.json'
function reloadDemo(this: any) { /* placeholder */ }

function InheritBadge({ value, base, percent }: { value: any, base: any, percent?: boolean }) {
  const same = base != null && value === base
  const label = base == null ? '—' : same ? 'From Project Setup' : 'Overridden'
  const cls = base == null ? 'bg-gray-100 text-gray-500' : same ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
  return <span className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full ${cls}`}>{label}{(percent && base!=null)? ` (${Math.round(base*100)}%)`: ''}</span>
}
