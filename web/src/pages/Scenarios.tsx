import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScenario } from '../state/ScenarioContext'
import { Card } from '../components/Card'
import { formatNumber, formatCurrencyIDR } from '../lib/format'
import { StatusChip } from '../components/StatusChip'

export default function Scenarios() {
  const { saved, loadScenario, deleteScenario, saveScenario } = useScenario()
  const [name, setName] = useState('Scenario ' + (saved.length + 1))
  const nav = useNavigate()
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  function onSave() {
    const snap = saveScenario(name)
    setName('Scenario ' + (saved.length + 2))
    loadScenario(snap.id)
  }

  function rename(id: string, newName: string) {
    // simple local rename via save+delete
    const s = saved.find(x=>x.id===id)
    if (!s) return
    s.name = newName
    const list = saved.map(x=> x.id===id ? s : x)
    try { localStorage.setItem('neo:saved_scenarios', JSON.stringify(list)) } catch {}
    window.location.reload()
  }

  function duplicate(id: string) {
    const s = saved.find(x=>x.id===id)
    if (!s) return
    const snap = saveScenario(s.name + ' Copy', false)
    rename(snap.id, s.name + ' Copy')
  }

  return (
    <div className="space-y-6">
      <Card title="Save Current Scenario">
        <div className="text-xs text-gray-500 mb-2">Saves a snapshot of all inputs (project, regs, tracts, lots, typologies) and the latest outputs (KPIs, optimization, cost) for traceability and comparison.</div>
        <div className="flex items-center gap-2">
          <input className="input max-w-xs" value={name} onChange={e=>setName(e.target.value)} />
          <button onClick={onSave} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800">Save</button>
        </div>
      </Card>

      <Card title="Saved Scenarios">
        {saved.length === 0 ? (
          <div className="text-sm text-gray-500">No scenarios saved yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500">
              <tr className="[&>th]:text-left [&>th]:py-2">
                <th className="w-8"></th>
                <th>Name / ID</th>
                <th>Created</th>
                <th>Total GFA</th>
                <th>FAR%</th>
                <th>KDB%</th>
                <th>Status</th>
                <th>Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:py-2 border-t border-gray-100">
              {saved.map(s => {
                const far = s.sim ? Math.round(s.sim.far_util*100) : null
                const kdb = s.sim ? Math.round(s.sim.kdb_util*100) : null
                const ok = s.sim ? (s.sim.compliance.far_ok && s.sim.compliance.kdb_ok && s.sim.height_ok) : null
                const cost = s.cost?.totals?.grand_total
                const hash = simpleHash(JSON.stringify(s.scenario || s))
                return (
                <tr key={s.id}>
                  <td><input type="checkbox" checked={!!selected[s.id]} onChange={e=> setSelected({ ...selected, [s.id]: e.target.checked })} /></td>
                  <td>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-gray-500">ID {s.id} • {hash.slice(0,8)}</div>
                  </td>
                  <td>{new Date(s.created_at).toLocaleString()}</td>
                  <td>{s.sim ? `${formatNumber(Math.round(s.sim.total_gfa))} m²` : '—'}</td>
                  <td>
                    {far!=null ? <Bar pct={far} /> : '—'}
                  </td>
                  <td>
                    {kdb!=null ? <Bar pct={kdb} /> : '—'}
                  </td>
                  <td>{ok!=null ? (ok ? <StatusChip status="ok" label="Compliant" /> : <StatusChip status="bad" label="Issues" />) : '—'}</td>
                  <td>{cost!=null ? formatCurrencyIDR(Math.round(cost)) : '—'}</td>
                  <td className="text-right whitespace-nowrap">
                    <button onClick={()=>{ const nm = prompt('Rename scenario', s.name); if (nm) rename(s.id, nm) }} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 mr-2">Rename</button>
                    <button onClick={()=>duplicate(s.id)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 mr-2">Duplicate</button>
                    <button onClick={()=>{ loadScenario(s.id); nav('/simulate') }} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">Open</button>
                    <button onClick={()=>deleteScenario(s.id)} className="ml-2 px-3 py-1.5 text-xs rounded-lg text-red-600 hover:bg-red-50 border border-red-200">Delete</button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </Card>
      {Object.values(selected).some(Boolean) && (
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const ids = Object.entries(selected).filter(([,v])=>v).map(([k])=>k).slice(0,3)
            nav(`/compare?ids=${ids.join(',')}`)
          }} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800">Compare Selected</button>
          <span className="text-xs text-gray-500">Pick up to 3 scenarios.</span>
        </div>
      )}
    </div>
  )
}

function simpleHash(str: string) {
  let h = 0
  for (let i=0;i<str.length;i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0 }
  return (h>>>0).toString(16)
}

function Bar({ pct }: { pct: number }) {
  const color = pct<=90 ? 'bg-emerald-500' : pct<=100 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.min(pct,120)}%` }} /></div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  )
}
