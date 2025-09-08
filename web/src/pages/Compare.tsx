import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Plot from 'react-plotly.js'
import { useScenario, type ScenarioSnapshot } from '../state/ScenarioContext'
import { Card } from '../components/Card'
import { StatusChip } from '../components/StatusChip'
import { SimAPI } from '../lib/api'
import { formatCurrencyIDR, formatCurrencyUSD, formatNumber } from '../lib/format'
import { useNavigate } from 'react-router-dom'

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function Compare() {
  const { saved, loadScenario } = useScenario()
  const q = useQuery()
  const ids = (q.get('ids') || '').split(',').filter(Boolean)
  const [rows, setRows] = useState<ScenarioSnapshot[]>([])
  const [currency, setCurrency] = useState<'IDR'|'USD'>('IDR')
  const colors = ['#111827', '#2563EB', '#16A34A']
  const nav = useNavigate()

  useEffect(() => {
    let list: ScenarioSnapshot[]
    if (ids.length) list = saved.filter(s => ids.includes(s.id)).slice(0, 3)
    else list = saved.slice(0, 3)
    setRows(list)
  }, [ids.join(','), saved])

  useEffect(() => {
    async function ensureSims() {
      const updated = await Promise.all(rows.map(async r => {
        if (r.sim) return r
        try { return { ...r, sim: await SimAPI.simulate(r.scenario) } } catch { return r }
      }))
      setRows(updated)
    }
    if (rows.some(r => !r.sim)) ensureSims()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map(r=>r.id+Boolean(r.sim)).join('|')])

  useEffect(() => {
    async function ensureCosts() {
      const lib = [
        { component: 'Buildings', basis: 'gfa', rate: 6500000, unit: 'IDR/m² GFA' },
        { component: 'Roads', basis: 'area', rate: 900000, unit: 'IDR/m²' },
        { component: 'Parks & Landscape', basis: 'area', rate: 600000, unit: 'IDR/m²' },
        { component: 'Infrastructure', basis: 'lump', rate: 150000000000, unit: 'IDR' },
      ] as const
      const updated = await Promise.all(rows.map(async r => {
        if (r.cost) return r
        try { return { ...r, cost: await SimAPI.estimateCost({ scenario: r.scenario, library: lib as any }) } } catch { return r }
      }))
      setRows(updated)
    }
    if (rows.some(r => !r.cost)) ensureCosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map(r=>r.id+Boolean(r.cost)).join('|')])

  const names = rows.map(r => r.name)
  const gfas = rows.map(r => r.sim ? Math.round(r.sim.total_gfa) : 0)
  const farUtil = rows.map(r => r.sim ? Math.round(r.sim.far_util * 100) : 0)
  const kdbUtil = rows.map(r => r.sim ? Math.round(r.sim.kdb_util * 100) : 0)
  const totalCost = rows.map(r => r.cost ? Math.round(r.cost.totals.grand_total) : 0)
  const usd = rows.map(r => r.cost ? Math.round(r.cost.totals.usd) : 0)
  const costPerGFA = rows.map((_, i) => gfas[i] > 0 ? Math.round((totalCost[i] / gfas[i]) / 1000) : 0) // in jt/m²
  const farBuffers = rows.map(r => r.sim ? Math.round(r.sim.compliance.buffers.far) : 0)
  const kdbBuffers = rows.map(r => r.sim ? Math.round(r.sim.compliance.buffers.kdb) : 0)
  const bestGfa = Math.max(0, ...gfas)
  const deltaVsBest = gfas.map(g => bestGfa>0 ? Math.round((g - bestGfa) / bestGfa * 100) : 0)
  const bestIdx = rows.length ? rows.reduce((bi, _r, i) => (gfas[i] > (gfas[bi] || 0) ? i : bi), 0) : -1
  const best = bestIdx >= 0 ? rows[bestIdx] : null

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="Scenario Compare – KPIs" action={<button
        onClick={() => { if (best) { loadScenario(best.id); nav('/simulate') } }}
        disabled={!best}
        className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
      >Make Best Current</button>}>
        <table className="w-full text-sm">
          <thead className="text-gray-500">
            <tr className="[&>th]:text-left [&>th]:py-2"><th>Scenario</th><th>Total GFA</th><th>Δ vs Best</th><th>FAR Util</th><th>KDB Util</th><th>FAR Buffer (m²)</th><th>KDB Buffer (m²)</th><th>Total Cost</th><th>Cost / GFA</th><th>Compliance</th></tr>
          </thead>
          <tbody className="[&>tr>td]:py-2 border-t border-gray-100">
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="flex items-center gap-2"><span className="inline-block size-2 rounded-full" style={{ background: colors[i%colors.length] }} /> {r.name}</td>
                <td>{r.sim ? `${formatNumber(gfas[i])} m²` : '—'}</td>
                <td className={deltaVsBest[i]===0? 'text-gray-500' : 'text-gray-700'}>{r.sim ? `${deltaVsBest[i]}%` : '—'}</td>
                <td>{r.sim ? `${farUtil[i]}%` : '—'}</td>
                <td>{r.sim ? `${kdbUtil[i]}%` : '—'}</td>
                <td className={farBuffers[i] < 0 ? 'text-red-600' : ''}>{r.sim ? formatNumber(farBuffers[i]) : '—'}</td>
                <td className={kdbBuffers[i] < 0 ? 'text-red-600' : ''}>{r.sim ? formatNumber(kdbBuffers[i]) : '—'}</td>
                <td>{r.cost ? (currency==='IDR' ? formatCurrencyIDR(totalCost[i]) : formatCurrencyUSD(usd[i])) : '—'}</td>
                <td>{r.cost ? (currency==='IDR' ? `${formatNumber(costPerGFA[i])} jt/m²` : `${formatNumber(Math.round((usd[i]/(gfas[i]||1))))} USD/m²`) : '—'}</td>
                <td>{r.sim ? (
                  r.sim.compliance.far_ok && r.sim.compliance.kdb_ok && r.sim.height_ok ?
                  <StatusChip status="ok" label="Compliant" /> :
                  <StatusChip status="bad" label="Issues" />
                ) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Total GFA (m²)">
        <div className="h-72">
          <Plot
            data={[{ type: 'bar', x: names, y: gfas, marker: { color: colors } }]}
            layout={{ margin: { l: 48, r: 16, t: 16, b: 40 }, font: { family: 'Inter, system-ui' }, yaxis: { tickformat: ',d' }, showlegend: false }}
            config={{ displayModeBar: false }}
            className="h-full"
          />
        </div>
      </Card>

      <Card title="Utilization %">
        <div className="h-72">
          <Plot
            data={[
              { type: 'bar', x: names, y: farUtil, name: 'FAR', marker: { color: '#111827' } },
              { type: 'bar', x: names, y: kdbUtil, name: 'KDB', marker: { color: '#2563EB' } },
            ]}
            layout={{ barmode: 'group', margin: { l: 48, r: 16, t: 16, b: 40 }, font: { family: 'Inter, system-ui' }, yaxis: { ticksuffix: '%', range: [0, 120] } }}
            config={{ displayModeBar: false }}
            className="h-full"
          />
        </div>
      </Card>

      <Card title="Costs">
        <div className="flex items-center justify-end mb-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 text-xs">
            <button onClick={()=>setCurrency('IDR')} className={`px-2 py-1 rounded-md ${currency==='IDR' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>IDR</button>
            <button onClick={()=>setCurrency('USD')} className={`px-2 py-1 rounded-md ${currency==='USD' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>USD</button>
          </div>
        </div>
        <div className="h-72">
          <Plot
            data={[{ type: 'bar', x: names, y: currency==='IDR' ? totalCost : usd, marker: { color: colors } }]}
            layout={{ margin: { l: 64, r: 16, t: 16, b: 40 }, font: { family: 'Inter, system-ui' }, yaxis: { tickformat: ',d', title: currency==='IDR' ? 'IDR' : 'USD' }, showlegend: false }}
            config={{ displayModeBar: false }}
            className="h-full"
          />
        </div>
        <div className="h-72 mt-6">
          <Plot
            data={[{ type: 'bar', x: names, y: costPerGFA, marker: { color: '#111827' } }]}
            layout={{ margin: { l: 64, r: 16, t: 16, b: 40 }, font: { family: 'Inter, system-ui' }, yaxis: { tickformat: ',d', title: 'IDR jt/m²' }, showlegend: false }}
            config={{ displayModeBar: false }}
            className="h-full"
          />
        </div>
      </Card>
    </div>
  )
}
