import { useEffect, useMemo, useRef, useState } from 'react'
import { useScenario } from '../state/ScenarioContext'
import { Card } from '../components/Card'
import { KPI } from '../components/KPI'
import { StatusChip } from '../components/StatusChip'
import Plot from 'react-plotly.js'
import { SimAPI } from '../lib/api'
import { Link } from 'react-router-dom'
import { formatNumber } from '../lib/format'

export default function Simulate() {
  const { scenario, lastSim, setLastSim, lastOpt, setLastOpt } = useScenario()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [computedAt, setComputedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!lastSim) runSim()
    if (!lastOpt) runOptimize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runSim() {
    setError(null)
    setLoading(true)
    try {
      const s = await SimAPI.simulate(scenario)
      setLastSim(s)
      setComputedAt(Date.now())
    } finally {
      setLoading(false)
    }
  }

  async function runOptimize() {
    const o = await SimAPI.optimize({ scenario, floors_range: range(bounds.floors[0], bounds.floors[1], 5), plate_range_m2: range(bounds.plate[0], bounds.plate[1], 200), podium_levels_range: range(bounds.podium[0], bounds.podium[1], 1), locks: { ...(locks.podium && { podium_levels: locks.podium }), ...(locks.floors && { tower_floors: locks.floors }), ...(locks.plate && { tower_plate_m2: locks.plate }) } })
    setLastOpt(o)
  }

  // Optimize panel state
  const [bounds, setBounds] = useState({ floors: [30, 60] as [number, number], plate: [1800, 2600] as [number, number], podium: [3, 7] as [number, number] })
  const [locks, setLocks] = useState<{ podium?: number; floors?: number; plate?: number }>({})
  const plotRef = useRef<any>(null)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="Simulation Results">
        <div className="grid grid-cols-3 gap-4">
          <KPI label="Total GFA" tooltip="Sum of podium and tower areas across all lots, after efficiency. This is your buildable/sellable floor area." value={lastSim ? `${formatNumber(Math.round((lastSim as any).total_gfa_m2 ?? lastSim.total_gfa))} m²` : '—'} />
          <KPI label="FAR Utilization" tooltip="Percent of your allowed GFA (FAR × site area) that you’re using. Higher is closer to the legal cap. Uses tower plate and podium floors via GFA, not footprint." value={lastSim ? `${Math.round(((lastSim as any).far_utilization_pct ?? (lastSim.far_util*100)) as number)}%` : '—'} sub={lastSim && <StatusChip status={lastSim.compliance.far_ok ? 'ok' : 'bad'} label={lastSim.compliance.far_ok ? 'Compliant' : 'Exceeds'} />} />
          <KPI label="KDB Utilization" tooltip="Percent of allowed ground coverage used (Σ footprints ÷ (KDB × site area)). Footprint = ground‑level area; tower floor plate does not affect KDB. Podium floors change GFA but not KDB." value={lastSim ? `${Math.round(((lastSim as any).kdb_utilization_pct ?? (lastSim.kdb_util*100)) as number)}%` : '—'} sub={lastSim && <StatusChip status={lastSim.compliance.kdb_ok ? 'ok' : 'bad'} label={lastSim.compliance.kdb_ok ? 'Compliant' : 'Exceeds'} />} />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Scenario {scenario.id} • hash {simpleHash(JSON.stringify(scenario)).slice(0,8)} {computedAt && `• Last computed ${new Date(computedAt).toLocaleString()}`}
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            {error}
            <button onClick={runSim} className="ml-2 px-2 py-1 text-xs rounded border border-red-200 hover:bg-red-100">Retry</button>
          </div>
        )}
        {lastSim && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-700">
            <div className="rounded-lg border border-gray-200 p-3 bg-white">
              <div className="text-gray-500">Buffers</div>
              <div title="Additional GFA you can still add before hitting the FAR cap.">FAR buffer: {formatNumber(Math.round(((lastSim as any).far_buffer_m2 ?? lastSim.compliance.buffers.far) as number))} m²</div>
              <div title="Extra footprint you can still place before exceeding KDB.">KDB buffer: {formatNumber(Math.round(((lastSim as any).kdb_buffer_m2 ?? lastSim.compliance.buffers.kdb) as number))} m²</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-white">
              <div className="text-gray-500">Compliance</div>
              <div>FAR: {lastSim.compliance.far_ok ? 'OK' : 'Exceeds'}</div>
              <div>KDB: {lastSim.compliance.kdb_ok ? 'OK' : 'Exceeds'}</div>
              <div title="Tallest building vs height cap: floors × floor-to-floor ≤ max meters.">Height: {lastSim.height_ok ? 'OK' : 'Check'}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-white" title="Share of site that is non-sellable (tracts) vs buildable (lots). Tracts don’t generate GFA.">
              <div className="text-gray-500">Land Split</div>
              <LandSplit scenario={scenario} override={{ sellable: (lastSim as any).sellable_pct, nonsellable: (lastSim as any).nonsellable_pct }} />
            </div>
          </div>
        )}
        <div className="mt-4 text-sm text-gray-500">{loading ? 'Computing…' : 'Up to date'}</div>
      </Card>

      <Card title="Optimization" action={<button onClick={runOptimize} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800" title="Runs a quick sweep and finds the sweet spot within constraints.">Auto‑Optimize</button>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
          <div title="Min–max tower floors to test in the curve. Lock to freeze at a fixed height.">
            <div className="text-gray-600 text-xs mb-1">Floors range</div>
            <div className="flex items-center gap-2"><input className="input" type="number" value={bounds.floors[0]} onChange={e=>setBounds(b=>({ ...b, floors: [Number(e.target.value), b.floors[1]] }))} /><span>to</span><input className="input" type="number" value={bounds.floors[1]} onChange={e=>setBounds(b=>({ ...b, floors: [b.floors[0], Number(e.target.value)] }))} /></div>
            <label className="mt-1 inline-flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={!!locks.floors} onChange={e=>setLocks(l=> ({ ...l, floors: e.target.checked ? Math.round((bounds.floors[0]+bounds.floors[1])/2) : undefined }))} /> Lock</label>
          </div>
          <div title="Min–max typical tower floorplate tested in the heatmap/curve.">
            <div className="text-gray-600 text-xs mb-1">Plate range (m²)</div>
            <div className="flex items-center gap-2"><input className="input" type="number" value={bounds.plate[0]} onChange={e=>setBounds(b=>({ ...b, plate: [Number(e.target.value), b.plate[1]] }))} /><span>to</span><input className="input" type="number" value={bounds.plate[1]} onChange={e=>setBounds(b=>({ ...b, plate: [b.plate[0], Number(e.target.value)] }))} /></div>
            <label className="mt-1 inline-flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={!!locks.plate} onChange={e=>setLocks(l=> ({ ...l, plate: e.target.checked ? Math.round((bounds.plate[0]+bounds.plate[1])/2) : undefined }))} /> Lock</label>
          </div>
          <div title="Podium floor count tested; affects podium GFA and KDB usage.">
            <div className="text-gray-600 text-xs mb-1">Podium levels</div>
            <div className="flex items-center gap-2"><input className="input" type="number" value={bounds.podium[0]} onChange={e=>setBounds(b=>({ ...b, podium: [Number(e.target.value), b.podium[1]] }))} /><span>to</span><input className="input" type="number" value={bounds.podium[1]} onChange={e=>setBounds(b=>({ ...b, podium: [b.podium[0], Number(e.target.value)] }))} /></div>
            <label className="mt-1 inline-flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={!!locks.podium} onChange={e=>setLocks(l=> ({ ...l, podium: e.target.checked ? Math.round((bounds.podium[0]+bounds.podium[1])/2) : undefined }))} /> Lock</label>
          </div>
        </div>
        <div className="h-64" title="Shows how changing tower floors impacts total GFA. Green dot is the highest compliant yield. Dashed lines indicate legal caps. Footprint (KDB) is about ground coverage and does not change with floors.">
          {lastOpt ? (
            <Plot
              onInitialized={(fig, gd) => { (plotRef as any).current = gd }}
              data={buildCurveData(lastOpt as any, lastSim as any, scenario)}
              layout={{
                title: 'Floors vs Total GFA',
                margin: { l: 70, r: 110, t: 40, b: 50 },
                font: { family: 'Inter, system-ui', color: '#111827' },
                xaxis: {
                  title: { text: 'Tower floors (stories)', font: { size: 11 } },
                  tickfont: { size: 12 },
                  dtick: 5,
                  tickformat: 'd',
                },
                yaxis: {
                  title: { text: 'Total GFA (m²)', font: { size: 11 } },
                  tickfont: { size: 12 },
                  tickformat: '~s',
                  separatethousands: true,
                },
                showlegend: true,
                legend: { x: 1.02, xanchor: 'left', y: 1 },
              }}
              config={{ displayModeBar: false }}
              className="h-full"
            />
          ) : (
            <div className="h-full rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-400">No results yet. Click Run Simulate or enable Auto-Optimize to generate curves.</div>
          )}
        </div>
        {lastOpt && (
          <div className="mt-2">
            <button onClick={async()=>{
              if (!(plotRef as any).current) return
              const Plotly = await import('plotly.js-dist-min')
              // @ts-ignore
              const url = await (Plotly as any).toImage((plotRef as any).current, { format: 'png', width: 900, height: 500 })
              const a = document.createElement('a'); a.href = url; a.download = 'optimization_curve.png'; a.click()
            }} className="px-3 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">Download Graph PNG</button>
            <button onClick={async()=>{
              if (!(plotRef as any).current) return
              const Plotly = await import('plotly.js-dist-min')
              // @ts-ignore
              const url = await (Plotly as any).toImage((plotRef as any).current, { format: 'png', width: 1200, height: 600 })
              const res = await fetch((import.meta as any).env.VITE_API_URL + '/export/xlsx-real', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario, graph_png: url })
              })
              const blob = await res.blob()
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'neo_simulator_export.xlsx'; a.click()
            }} className="ml-2 px-3 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">Export XLSX (Tables 1–5)</button>
          </div>
        )}
        {lastOpt && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Sweet Spot Heatmap (Podium × Tower Floor Plate)</div>
            <Plot
              data={(function(){
                const heat = buildHeat(lastOpt.feasible)
                return [{
                  z: heat.z,
                  x: heat.xs,
                  y: heat.ys,
                  customdata: heat.g,
                  type: 'heatmap',
                  colorscale: 'Greens',
                  hovertemplate: 'Podium %{y} × Plate %{x} m²' + '<br>Yield: %{z}% of max' + '<br>Total GFA: %{customdata:,} m²<extra></extra>',
                }]
              })()}
              layout={{
                margin: { l: 70, r: 20, t: 10, b: 50 },
                font: { family: 'Inter, system-ui' },
                xaxis: { title: { text: 'Tower floor plate (m²)', font: { size: 11 } }, tickfont: { size: 12 } },
                yaxis: { title: { text: 'Podium levels (floors)', font: { size: 11 } }, tickfont: { size: 12 } },
              }}
              config={{ displayModeBar: false }}
              className="h-64"
            />
          </div>
        )}

        {lastOpt && lastSim && (
          <div className="mt-4 text-sm text-gray-700">
            <div className="font-medium mb-1">Why this is optimal</div>
            <p>
              Best configuration achieves {formatNumber(Math.round(lastOpt.best_total_gfa))} m² total GFA within constraints. The dotted horizontal line is the FAR cap ({formatNumber(Math.round((scenario.reg.klb||0)*scenario.reg.site_area_m2))} m²). The dotted vertical line is the height cap ({scenario.reg.max_floors ? `${scenario.reg.max_floors} floors` : 'no cap'}). Green points are feasible; red points violate at least one constraint. The sweet‑spot marker maximizes yield without crossing caps.
            </p>
            <div className="mt-3">
              <Link to="/" className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800">Next: Dashboard</Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function range(a: number, b: number, step: number) {
  const out: number[] = []
  for (let x=a; x<=b; x+=step) out.push(x)
  return out
}

function uniq(arr: any[]) { return Array.from(new Set(arr)) }

function buildHeat(points: any[]) {
  const xs = uniq(points.map(p=>p.plate)).sort((a,b)=>a-b)
  const ys = uniq(points.map(p=>p.podium)).sort((a,b)=>a-b)
  const z = ys.map(()=> xs.map(()=> 0))
  const g = ys.map(()=> xs.map(()=> 0))
  const max = Math.max(...points.map(p=>p.gfa)) || 1
  // fill with max GFA per (podium, plate)
  for (const p of points) {
    const yi = ys.indexOf(p.podium)
    const xi = xs.indexOf(p.plate)
    g[yi][xi] = Math.max(g[yi][xi], Math.round(p.gfa))
  }
  for (let yi=0; yi<ys.length; yi++) {
    for (let xi=0; xi<xs.length; xi++) {
      z[yi][xi] = Math.round((g[yi][xi]/max)*100)
    }
  }
  return { xs, ys, z, g }
}

function simpleHash(str: string) {
  let h = 0
  for (let i=0;i<str.length;i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0 }
  return (h>>>0).toString(16)
}

function buildCurveData(lastOpt: any, lastSim: any, scenario: any) {
  const traces: any[] = []
  const hasSeries = Array.isArray(lastOpt?.series) && lastOpt.series.length > 0
  const farCap = lastOpt?.constraints?.far_cap_m2 ?? ((scenario.reg.klb||0) * scenario.reg.site_area_m2)
  const heightCap = lastOpt?.constraints?.height_cap_f ?? scenario.reg.max_floors
  const kdbPctConst = lastSim ? Math.round((((lastSim as any).kdb_utilization_pct ?? (lastSim.kdb_util*100)) as number)) : undefined

  if (hasSeries) {
    const xs = lastOpt.series.map((p:any)=>p.x)
    const ys = lastOpt.series.map((p:any)=>p.y)
    const custom = xs.map((x:number, i:number)=> [Math.round((ys[i]/(farCap||1))*100), kdbPctConst ?? null, (heightCap? (x<=heightCap?'OK':'Exceeded') : '—')])
    traces.push({ name: 'Feasible', x: xs, y: ys, mode: 'lines+markers', type: 'scatter', line:{color:'#111827'}, marker:{size:6, color:'#111827'}, hovertemplate: '<b>%{x} floors</b><br>Total GFA: %{y:,} m²<br>FAR util: %{customdata[0]}% · KDB util: %{customdata[1]}%<br>Height OK: %{customdata[2]}<extra></extra>', customdata: custom })
  } else {
    const feas = (lastOpt.feasible||[])
    const xs = feas.map((p:any)=>p.floors)
    const ys = feas.map((p:any)=>p.gfa)
    const custom = xs.map((x:number, i:number)=> [Math.round((ys[i]/(farCap||1))*100), kdbPctConst ?? null, (heightCap? (x<=heightCap?'OK':'Exceeded') : '—')])
    traces.push({ name: 'Feasible', x: xs, y: ys, mode: 'markers', type: 'scatter', marker:{ size:6, color: '#111827' }, hovertemplate: '<b>%{x} floors</b><br>Total GFA: %{y:,} m²<br>FAR util: %{customdata[0]}% · KDB util: %{customdata[1]}%<br>Height OK: %{customdata[2]}<extra></extra>', customdata })
  }
  const sweet = lastOpt?.sweet_spot
  traces.push({ name: 'Sweet spot', x: [sweet?.x ?? lastOpt.best_floors], y: [sweet?.y ?? lastOpt.best_total_gfa], type: 'scatter', mode: 'markers', marker: { size: 10, color: '#16A34A' } })
  const xsBase = (hasSeries ? lastOpt.series.map((p:any)=>p.x) : (lastOpt.feasible||[]).map((p:any)=>p.floors)).sort((a:number,b:number)=>a-b)
  traces.push({ name: 'FAR cap (m²)', x: xsBase, y: xsBase.map(()=> farCap), type:'scatter', mode:'lines', line:{ dash:'dot', color:'#9CA3AF'} })
  if (heightCap) {
    const ymax = Math.max(...(hasSeries ? lastOpt.series.map((p:any)=>p.y) : (lastOpt.feasible||[]).map((p:any)=>p.gfa)))
    traces.push({ name: 'Height cap (floors)', x: [heightCap, heightCap], y: [0, ymax], type:'scatter', mode:'lines', line:{ dash:'dot', color:'#DC2626'} })
  }
  return traces
}

function LandSplit({ scenario, override }: { scenario: any; override?: { sellable?: number; nonsellable?: number } }) {
  const site = scenario.reg.site_area_m2 || 1
  const tracts = (scenario.tracts||[]) as any[]
  const tractArea = tracts.reduce((a,t)=> a + ((t.type==='road' && !t.area_override && t.row_m!=null && t.length_m!=null) ? t.row_m*t.length_m : (t.area_m2||0)), 0)
  const buildable = Math.max(0, site - tractArea)
  const sellablePct = override?.sellable ?? Math.round(buildable/site*100)
  const nonsellablePct = override?.nonsellable ?? Math.round(tractArea/site*100)
  return (
    <div>
      <div>Total site: {formatNumber(Math.round(site))} m²</div>
      <div>Tracts (non‑sellable): {formatNumber(Math.round(tractArea))} m² ({nonsellablePct}%)</div>
      <div>Buildable land: {formatNumber(Math.round(buildable))} m² ({sellablePct}%)</div>
    </div>
  )
}
