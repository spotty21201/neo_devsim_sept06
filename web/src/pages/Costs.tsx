import Plot from 'react-plotly.js'
import { Card } from '../components/Card'
import { useScenario } from '../state/ScenarioContext'
import { formatCurrencyIDR, formatCurrencyUSD, formatNumber } from '../lib/format'
import baseLib from '../data/cost_library_idr.json'

export default function Costs() {
  const { scenario } = useScenario()
  const [currency, setCurrency] = useState<'IDR'|'USD'>('IDR')
  const [fxRate, setFxRate] = useState(0.000064)
  const [sensitivity, setSensitivity] = useState(0)
  const [rates, setRates] = useState<Record<string, number>>(()=>{
    const m: Record<string, number> = {}
    ;(baseLib as any[]).forEach((i: any)=>{ m[i.component] = i.rate })
    return m
  })
  const [contingencyPct, setContingencyPct] = useState(10)
  const [softPct, setSoftPct] = useState(8)

  const effRates = useMemo(()=>{
    const f = 1 + sensitivity/100
    const out: Record<string, number> = {}
    Object.entries(rates).forEach(([k,v])=> out[k] = Math.round(v * f))
    return out
  }, [rates, sensitivity])

  const { buildingsGFA, roadsArea, parksArea, infraArea } = useMemo(()=>{
    let gfa = 0
    for (const l of scenario.lots) {
      const eff = (scenario.reg.efficiency_override ?? l.typology.efficiency)
      gfa += l.typology.podium_levels * l.typology.podium_footprint_m2 * eff
      gfa += l.typology.tower_floors * l.typology.tower_plate_m2 * eff
    }
    const tracts = scenario.tracts || []
    let roads = 0, parks = 0, infra = 0
    for (const t of tracts) {
      const area = (t.type==='road' && !(t as any).area_override && (t as any).row_m!=null && (t as any).length_m!=null) ? ((t as any).row_m * (t as any).length_m) : ((t as any).area_m2||0)
      if (t.type==='road') roads += area
      else if (t.type==='park' || (t as any).type==='water') parks += area
      else if (t.type==='infra') infra += area
    }
    return { buildingsGFA: gfa, roadsArea: roads, parksArea: parks, infraArea: infra }
  }, [scenario])

  const rows = useMemo(()=>{
    const items = [
      { component: 'Buildings', qty: buildingsGFA, unit: 'm² GFA', unit_cost: effRates['Buildings']||6500000 },
      { component: 'Roads', qty: roadsArea, unit: 'm²', unit_cost: effRates['Roads']||900000 },
      { component: 'Parks & Landscape', qty: parksArea, unit: 'm²', unit_cost: effRates['Parks & Landscape']||600000 },
      { component: 'Infrastructure', qty: infraArea || 1, unit: infraArea? 'm²' : 'lump', unit_cost: effRates['Infrastructure']||150000000000 },
    ]
    return items.map(r => ({ ...r, total_cost: r.qty * r.unit_cost }))
  }, [buildingsGFA, roadsArea, parksArea, infraArea, effRates])

  const totals = useMemo(()=>{
    const direct = rows.reduce((a,r)=> a + r.total_cost, 0)
    const contingency = direct * (contingencyPct/100)
    const soft = direct * (softPct/100)
    const grand_total = direct + contingency + soft
    return { direct, contingency, soft, grand_total, usd: grand_total * fxRate }
  }, [rows, contingencyPct, softPct, fxRate])

  function exportCSV() {
    const header = ['Component','Quantity','Unit','Unit Cost (IDR)','Direct (IDR)','Cont+Soft (IDR)','Total (IDR)']
    const lines = [header.join(',')]
    const contSoft = totals.contingency + totals.soft
    const directSum = rows.reduce((a,r)=> a + r.total_cost, 0) || 1
    for (const r of rows) {
      const direct = r.total_cost
      const rowContSoft = contSoft * (direct / directSum)
      const rowTotal = direct + rowContSoft
      lines.push([r.component, Math.round(r.qty), r.unit, Math.round(r.unit_cost), Math.round(direct), Math.round(rowContSoft), Math.round(rowTotal)].join(','))
    }
    lines.push(['Totals','', '', '', Math.round(totals.direct), Math.round(contSoft), Math.round(totals.grand_total)].join(','))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'table5_cost_summary.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card title="Cost Summary (Table 5)">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 text-xs">
              <button onClick={()=>setCurrency('IDR')} className={`px-2 py-1 rounded-md ${currency==='IDR' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>IDR</button>
              <button onClick={()=>setCurrency('USD')} className={`px-2 py-1 rounded-md ${currency==='USD' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>USD</button>
            </div>
            <label className="flex items-center gap-2">
              <span className="text-gray-500">FX</span>
              <input className="input w-28" type="number" step="0.000001" value={fxRate} onChange={e=>setFxRate(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-500">Sensitivity</span>
              <input type="range" min={-10} max={10} value={sensitivity} onChange={e=>setSensitivity(Number(e.target.value))} />
              <span className="w-10 text-right text-gray-700">{sensitivity}%</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-500">Contingency</span>
              <input className="input w-20" type="number" value={contingencyPct} onChange={e=>setContingencyPct(Number(e.target.value))} />%
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-500">Soft</span>
              <input className="input w-20" type="number" value={softPct} onChange={e=>setSoftPct(Number(e.target.value))} />%
            </label>
          </div>
          <button onClick={exportCSV} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Export CSV</button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-gray-500">
            <tr className="[&>th]:text-left [&>th]:py-2">
              <th>Component</th><th>Qty</th><th>Unit</th><th>Unit Cost (IDR)</th><th>Total</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:py-2 border-t border-gray-100">
            {rows.map(r => (
              <tr key={r.component}>
                <td>{r.component}</td>
                <td>{formatNumber(Math.round(r.qty))}</td>
                <td>{r.unit}</td>
                <td><input className="input w-32" type="number" value={rates[r.component] ?? r.unit_cost} onChange={e=> setRates(prev=> ({ ...prev, [r.component]: Number(e.target.value) }))} /></td>
                <td>{currency==='IDR' ? formatCurrencyIDR(Math.round(r.total_cost)) : formatCurrencyUSD(Math.round(r.total_cost * fxRate))}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-200">
              <td colSpan={3}></td>
              <td className="text-gray-500">Direct</td>
              <td>{currency==='IDR' ? formatCurrencyIDR(Math.round(totals.direct)) : formatCurrencyUSD(Math.round((totals.direct * fxRate)))}</td>
            </tr>
            <tr>
              <td colSpan={3}></td>
              <td className="text-gray-500">Contingency + Soft</td>
              <td>
                {currency==='IDR' ? formatCurrencyIDR(Math.round(totals.contingency + totals.soft)) : formatCurrencyUSD(Math.round((totals.contingency + totals.soft) * fxRate))}
                <span className="ml-2 text-xs text-gray-500">({contingencyPct}% + {softPct}%)</span>
              </td>
            </tr>
            <tr className="border-t border-gray-200 font-medium">
              <td colSpan={3}></td>
              <td>Total</td>
              <td>{currency==='IDR' ? formatCurrencyIDR(Math.round(totals.grand_total)) : formatCurrencyUSD(Math.round(totals.usd))}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Cost Breakdown">
          <div className="h-72">
            <Plot
              data={[{ type: 'pie', labels: [...rows.map(r=>r.component), 'Cont+Soft'], values: [...rows.map(r=>r.total_cost), (totals.contingency+totals.soft)], textinfo: 'label+percent' }]}
              layout={{ margin: { l: 16, r: 16, t: 16, b: 16 }, font: { family: 'Inter, system-ui' } }}
              config={{ displayModeBar: false }}
              className="h-full"
            />
          </div>
        </Card>
        <Card title="Cost per Component">
          <div className="h-72">
            <Plot
              data={[{ type: 'bar', x: rows.map(r=>r.component), y: currency==='IDR' ? rows.map(r=>Math.round(r.total_cost/1e9)) : rows.map(r=>Math.round((r.total_cost * fxRate)/1e6)), marker:{color:'#111827'} }]}
              layout={{ margin: { l: 64, r: 16, t: 16, b: 40 }, font: { family: 'Inter, system-ui' }, yaxis: { tickformat: ',d', title: currency==='IDR' ? 'IDR billion' : 'USD million' }, showlegend: false }}
              config={{ displayModeBar: false }}
              className="h-full"
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
