import { Card } from '../components/Card'
import { useScenario } from '../state/ScenarioContext'
import { formatNumber } from '../lib/format'

export default function Program() {
  const { scenario } = useScenario()
  const lots = scenario.lots
  const tracts = scenario.tracts || []
  const siteArea = scenario.reg.site_area_m2 || 1

  const legend = [
    ['resi', '#60A5FA'],
    ['office', '#34D399'],
    ['hotel', '#F59E0B'],
    ['convention', '#F87171'],
    ['mixed', '#C084FC'],
    ['road', '#9CA3AF'],
    ['park', '#86EFAC'],
    ['water', '#67E8F9'],
  ]

  return (
    <div className="space-y-6">
      <Card title="Legend">
        <div className="flex flex-wrap gap-3 text-xs">
          {legend.map(([k,c]) => (
            <span key={k} className="inline-flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded" style={{ background: c as string }} /> {k}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Table 2 – Development Program Summary">
        <table className="w-full text-sm">
          <thead className="text-gray-500">
            <tr className="[&>th]:text-left [&>th]:py-2">
              <th>ID</th><th>Type</th><th>Use</th><th>Lot/Tract Area</th><th>Building Footprint</th><th>Podium Floors</th><th>Podium GFA</th><th>Tower Floorplate</th><th>Tower Floors</th><th>Tower GFA</th><th>Total Lot GFA</th><th>Notes</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:py-2 border-t border-gray-100">
            {lots.map(l => {
              const podGfa = l.typology.podium_levels * l.typology.podium_footprint_m2 * l.typology.efficiency
              const towGfa = l.typology.tower_floors * l.typology.tower_plate_m2 * l.typology.efficiency
              const total = podGfa + towGfa
              return (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>lot</td>
                  <td>{l.use}</td>
                  <td>{formatNumber(Math.round(l.area_m2))}</td>
                  <td>{formatNumber(Math.round(l.typology.podium_footprint_m2))}</td>
                  <td>{l.typology.podium_levels}</td>
                  <td>{formatNumber(Math.round(podGfa))}</td>
                  <td>{formatNumber(Math.round(l.typology.tower_plate_m2))}</td>
                  <td>{l.typology.tower_floors}</td>
                  <td>{formatNumber(Math.round(towGfa))}</td>
                  <td>{formatNumber(Math.round(total))}</td>
                  <td></td>
                </tr>
              )
            })}
            {tracts.map(t => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>tract</td>
                <td>{t.type}</td>
                <td>{formatNumber(Math.round(t.area_m2))}</td>
                <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>non‑buildable</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Tracts Summary (Export Schema)">
        <table className="w-full text-sm">
          <thead className="text-gray-500">
            <tr className="[&>th]:text-left [&>th]:py-2"><th>#</th><th>ID</th><th>Type</th><th>RoW (m)</th><th>Length (m)</th><th>Area (m²)</th><th>Area (ha)</th><th>% of Site</th></tr>
          </thead>
          <tbody className="[&>tr>td]:py-2 border-t border-gray-100">
            {tracts.map((t,i) => {
              const area = (t.type==='road' && !t.area_override && t.row_m!=null && t.length_m!=null) ? (t.row_m*t.length_m) : (t.area_m2||0)
              const pct = Math.round((area/siteArea)*100)
              return (
                <tr key={t.id}>
                  <td>{i+1}</td>
                  <td>{t.id}</td>
                  <td>{t.type}</td>
                  <td>{t.row_m ?? '—'}</td>
                  <td>{t.length_m ?? '—'}</td>
                  <td>{formatNumber(Math.round(area))}</td>
                  <td>{(area/10000).toFixed(4)}</td>
                  <td>{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
