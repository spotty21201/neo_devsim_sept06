import { useEffect, useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import { Card } from '../components/Card'
import { StatusChip } from '../components/StatusChip'
import { KPI } from '../components/KPI'
import { CurrencyToggle } from '../components/CurrencyToggle'
import demo from '../data/jakarta_demo.json'
import { SimAPI, type Scenario, type CostEstimate, type OptimizeResult, type SimResult } from '../lib/api'
import { formatCurrencyIDR, formatCurrencyUSD, formatNumber } from '../lib/format'

export default function Dashboard() {
  const [scenario] = useState<Scenario>(demo as unknown as Scenario)
  const [sim, setSim] = useState<SimResult | null>(null)
  const [opt, setOpt] = useState<OptimizeResult | null>(null)
  const [cost, setCost] = useState<CostEstimate | null>(null)
  const [currency, setCurrency] = useState<'IDR'|'USD'>('IDR')

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        const [s, o] = await Promise.all([
          SimAPI.simulate(scenario),
          SimAPI.optimize({ scenario }),
        ])
        if (!mounted) return
        setSim(s)
        setOpt(o)
        // Simple demo cost lib
        const lib = [
          { component: 'Buildings', basis: 'gfa', rate: 6500000, unit: 'IDR/m² GFA' },
          { component: 'Roads', basis: 'area', rate: 900000, unit: 'IDR/m²' },
          { component: 'Parks & Landscape', basis: 'area', rate: 600000, unit: 'IDR/m²' },
          { component: 'Infrastructure', basis: 'lump', rate: 150000000000, unit: 'IDR' },
        ] as const
        const c = await SimAPI.estimateCost({ scenario, library: lib as any })
        if (!mounted) return
        setCost(c)
      } catch (e) {
        console.error(e)
      }
    }
    run()
    return () => { mounted = false }
  }, [scenario])

  const sweet = useMemo(() => {
    if (!opt) return null
    return { x: opt.best_floors, y: opt.best_total_gfa }
  }, [opt])

  const totalCost = cost?.totals.grand_total ?? 0
  const usd = cost?.totals.usd ?? 0
  const costPerGFA = sim && sim.total_gfa ? totalCost / sim.total_gfa : 0

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title="Compliance Overview">
        <div className="grid grid-cols-3 gap-4">
          <KPI label="FAR Utilization" value={sim ? `${Math.round(sim.far_util*100)}%` : '—'} sub={sim && <StatusChip status={sim.compliance.far_ok ? 'ok' : 'bad'} label={sim.compliance.far_ok ? 'Compliant' : 'Violation'} />} />
          <KPI label="KDB (Coverage)" value={sim ? `${Math.round(sim.kdb_util*100)}%` : '—'} sub={sim && <StatusChip status={sim.compliance.kdb_ok ? 'ok' : 'bad'} label={sim.compliance.kdb_ok ? 'Compliant' : 'Violation'} />} />
          <KPI label="Height Max" value={scenario.reg.max_floors ? `${Math.max(...scenario.lots.map(l=>l.typology.tower_floors))} / ${scenario.reg.max_floors} F` : '—'} sub={<StatusChip status={sim?.height_ok ? 'ok':'warn'} label={sim?.height_ok ? 'Within limit':'Check'} />} />
        </div>
      </Card>

      <Card title="Cost Summary" action={<div className="flex items-center gap-2 text-xs bg-gray-100 rounded-lg p-1">
        <button onClick={()=>setCurrency('IDR')} className={`px-2 py-1 rounded-md ${currency==='IDR' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>IDR</button>
        <button onClick={()=>setCurrency('USD')} className={`px-2 py-1 rounded-md ${currency==='USD' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>USD</button>
      </div>}>
        <div className="grid grid-cols-3 gap-4">
          <KPI label="Total Cost" value={currency==='IDR' ? formatCurrencyIDR(totalCost) : formatCurrencyUSD(usd)} />
          <KPI label="Cost / GFA" value={currency==='IDR' ? `${formatNumber(Math.round(costPerGFA/1000))} jt/m²` : `${formatNumber(Math.round((usd/(sim?.total_gfa||1))))} USD/m²`} />
          <KPI label="Total GFA" value={sim ? `${formatNumber(Math.round(sim.total_gfa))} m²` : '—'} />
        </div>
      </Card>

      <Card title="Target vs Achieved">
        <table className="w-full text-sm">
          <thead className="text-gray-500">
            <tr className="[&>th]:text-left [&>th]:py-2">
              <th>Metric</th><th>Target</th><th>Achieved</th><th>Status</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:py-2 border-t border-gray-100">
            <tr><td>FAR (KLB)</td><td>{scenario.reg.klb}</td><td>{sim ? (sim.total_gfa/(scenario.reg.site_area_m2)).toFixed(2) : '—'}</td><td>{sim && <StatusChip status={sim.compliance.far_ok ? 'ok' : 'bad'} label={sim.compliance.far_ok ? 'Compliant' : 'Exceeds'} />}</td></tr>
            <tr><td>KDB</td><td>{Math.round(scenario.reg.kdb*100)}%</td><td>{sim ? `${Math.round(sim.kdb_util*100)}%` : '—'}</td><td>{sim && <StatusChip status={sim.compliance.kdb_ok ? 'ok' : 'bad'} label={sim.compliance.kdb_ok ? 'Compliant' : 'Exceeds'} />}</td></tr>
            <tr><td>Height</td><td>{scenario.reg.max_floors ? `${scenario.reg.max_floors} F` : '—'}</td><td>{`${Math.max(...scenario.lots.map(l=>l.typology.tower_floors))} F`}</td><td>{sim && <StatusChip status={sim.height_ok ? 'ok' : 'bad'} label={sim.height_ok ? 'Compliant' : 'Exceeds'} />}</td></tr>
          </tbody>
        </table>
      </Card>

      <Card title="Sweet Spot">
        <div className="h-64">
          <Plot
            data={[
              {
                x: (opt?.feasible||[]).map(p=>p.floors),
                y: (opt?.feasible||[]).map(p=>p.gfa),
                mode: 'lines+markers',
                type: 'scatter',
                line: { color: '#111827' },
                marker: { size: 6, color: (opt?.feasible||[]).map(p=> p.ok ? '#16A34A' : '#DC2626') },
              },
              sweet ? { x: [sweet.x], y: [sweet.y], type: 'scatter', mode: 'markers', marker: { size: 10, color: '#16A34A' } } : {}
            ]}
            layout={{
              margin: { l: 36, r: 16, t: 10, b: 36 },
              font: { family: 'Inter, system-ui', color: '#111827' },
              xaxis: { title: 'Floors' },
              yaxis: { title: 'Total GFA (m²)', tickformat: ',d' },
              showlegend: false,
            }}
            config={{ displayModeBar: false }}
            className="h-full"
          />
        </div>
      </Card>
    </div>
  )
}
