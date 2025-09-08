import { Card } from '../components/Card'
import { useScenario } from '../state/ScenarioContext'
import { SimAPI } from '../lib/api'

export default function Exports() {
  const { scenario, lastSim } = useScenario()

  async function call(path: '/export/xlsx'|'/export/pdf'|'/export/sheets') {
    const res = await fetch((import.meta as any).env.VITE_API_URL + path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenario })
    })
    const txt = await res.text()
    alert(`Export placeholder response:\n${txt.slice(0,400)}...`)
  }

  return (
    <div className="space-y-6">
      <Card title="Exports">
        <div className="text-sm text-gray-600 mb-3">Board‑ready exports will include metadata (project, scenario ID/hash, timestamp) and Tables 1–5. Placeholders below return a stub response.</div>
        <div className="flex flex-wrap gap-2">
          <button disabled={!lastSim} onClick={()=>call('/export/xlsx')} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Export XLSX (placeholder)</button>
          <button disabled={!lastSim} onClick={()=>call('/export/pdf')} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Export PDF (placeholder)</button>
          <button disabled={!lastSim} onClick={()=>call('/export/sheets')} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Export to Sheets (placeholder)</button>
        </div>
      </Card>
    </div>
  )
}

