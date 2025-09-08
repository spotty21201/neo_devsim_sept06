import { useEffect, useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { useScenario } from '../state/ScenarioContext'
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet'
import { formatNumber } from '../lib/format'

export default function Project() {
  const { project, setProject, scenario, setScenario } = useScenario() as any
  const [name, setName] = useState(project?.name || 'Jakarta Demo')
  const [siteArea, setSiteArea] = useState<number>(project?.site_area_m2 || 138000)
  const [units, setUnits] = useState<'m2'|'ha'>(project?.units || 'm2')
  const [lat, setLat] = useState(project?.lat || -6.2)
  const [lng, setLng] = useState(project?.lng || 106.8)
  const [basemap, setBasemap] = useState(project?.basemap ?? true)
  // Regulatory quick inputs for derived caps
  const [kdb, setKdb] = useState<number | ''>(scenario.reg?.kdb ?? '')
  const [klb, setKlb] = useState<number | ''>(scenario.reg?.klb ?? '')
  const [maxFloors, setMaxFloors] = useState<number | ''>(scenario.reg?.max_floors ?? '')
  const [maxHeightM, setMaxHeightM] = useState<number | ''>(scenario.reg?.max_height_m ?? '')
  const [f2f, setF2f] = useState<number | ''>(scenario.reg?.floor_to_floor_m ?? 3.6)
  const [eff, setEff] = useState<number | ''>(scenario.reg?.efficiency_override ?? 0.75)
  const [drawMode, setDrawMode] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(()=>{ setProject({ ...project, name, site_area_m2: siteArea, units, lat, lng, basemap }) }, [name, siteArea, units, lat, lng, basemap])

  const siteAreaM2 = useMemo(() => units === 'm2' ? siteArea : siteArea * 10000, [units, siteArea])
  const siteAreaHa = useMemo(() => units === 'ha' ? siteArea : siteArea / 10000, [units, siteArea])
  const maxFootprint = typeof kdb === 'number' ? kdb * siteAreaM2 : null
  const maxGFA = typeof klb === 'number' ? klb * siteAreaM2 : null
  const areaPlausible = siteAreaM2 > 1000 && siteAreaM2 < 10000000
  const heightDerived = typeof maxFloors === 'number' && typeof f2f === 'number' ? maxFloors * (f2f as number) : null
  const heightConflict = (typeof maxHeightM === 'number' && heightDerived !== null) ? (heightDerived > (maxHeightM as number)) : false
  const kdbWarn = typeof kdb === 'number' ? (kdb > 1 || kdb < 0) : false
  const klbWarn = typeof klb === 'number' ? (klb <= 0 || klb > 8) : false

  function saveProject() {
    setProject({
      ...project,
      name,
      site_area_m2: siteAreaM2,
      units,
      lat,
      lng,
      basemap,
      // persist regulatory fields in project as well
      kdb: typeof kdb === 'number' ? kdb : project.kdb,
      klb: typeof klb === 'number' ? klb : project.klb,
      max_floors: typeof maxFloors === 'number' ? maxFloors : project.max_floors,
      max_height_m: typeof maxHeightM === 'number' ? maxHeightM : project.max_height_m,
      floor_to_floor_m: typeof f2f === 'number' ? f2f : project.floor_to_floor_m,
      efficiency_override: typeof eff === 'number' ? eff : project.efficiency_override,
      updated_at: Date.now(),
    })
    const newReg = { ...scenario.reg, site_area_m2: siteAreaM2 }
    if (typeof kdb === 'number') newReg.kdb = kdb
    if (typeof klb === 'number') newReg.klb = klb
    if (typeof maxFloors === 'number') newReg.max_floors = maxFloors
    if (typeof maxHeightM === 'number') newReg.max_height_m = maxHeightM
    if (typeof f2f === 'number') newReg.floor_to_floor_m = f2f
    if (typeof eff === 'number') newReg.efficiency_override = eff
    const nextId = scenario?.id || Math.random().toString(36).slice(2,10)
    setScenario({ ...scenario, id: nextId, reg: newReg })
    setSaved(true)
  }

  return (
    <div className="space-y-6">
      <Card title="Project Setup">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <Field label="Project Name"><input className="input" value={name} onChange={e=>setName(e.target.value)} /></Field>
          <Field label={`Site Area (${units==='m2'?'m²':'ha'})`}><input className="input" type="number" value={siteArea} onChange={e=>setSiteArea(Number(e.target.value))} /></Field>
          <Field label="Units">
            <select className="input" value={units} onChange={e=>setUnits(e.target.value as any)}>
              <option value="m2">m²</option>
              <option value="ha">ha</option>
            </select>
          </Field>
          <Field label="Latitude"><input className="input" type="number" value={lat} onChange={e=>setLat(Number(e.target.value))} /></Field>
          <Field label="Longitude"><input className="input" type="number" value={lng} onChange={e=>setLng(Number(e.target.value))} /></Field>
          <Field label="Basemap"><label className="inline-flex items-center gap-2 text-gray-700"><input type="checkbox" checked={basemap} onChange={e=>setBasemap(e.target.checked)} /> Show</label></Field>
        </div>
        <div className="mt-3 text-xs text-gray-600 flex items-center gap-3">
          <span>Auto-convert:</span>
          <span className="px-2 py-1 rounded-full bg-gray-100">{formatNumber(Math.round(siteAreaM2))} m²</span>
          <span className="px-2 py-1 rounded-full bg-gray-100">{siteAreaHa.toFixed(4)} ha</span>
          <span className={`px-2 py-1 rounded-full ${areaPlausible? 'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{areaPlausible? 'Plausible area':'Check area range'}</span>
        </div>
        {basemap && (
          <div className="mt-4 h-64 rounded-xl border border-gray-200 overflow-hidden">
            <MapContainer center={[lat, lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              <Marker position={[lat, lng]} />
              {Array.isArray(project.boundary) && project.boundary.length >= 3 && (
                <Polygon positions={project.boundary as any} pathOptions={{ color: '#2563EB' }} />
              )}
              <ClickToDraw enabled={drawMode} onPoint={(p)=> setProject({ ...project, boundary: [...(project.boundary||[]), p] })} />
            </MapContainer>
            <div className="p-2 bg-white/70 backdrop-blur-sm border-t border-gray-200 flex items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={drawMode} onChange={e=>setDrawMode(e.target.checked)} /> Draw</label>
              <button onClick={()=> setProject({ ...project, boundary: [] })} className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">Clear</button>
              <button onClick={()=> {
                if ((project.boundary||[]).length>=3) setProject({ ...project, boundary: [...project.boundary!, project.boundary![0]] })
              }} className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">Close Polygon</button>
              <label className="ml-auto flex items-center gap-2">Import
                <input type="file" accept=".geojson,.json,.kml" onChange={(e)=>handleImport(e, setProject, project)} className="text-xs" />
              </label>
            </div>
          </div>
        )}
      </Card>

      <Card title="Regulatory (Quick Inputs) & Derived Caps">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <Field label="KDB (site coverage %)"><input className="input" type="number" min={0} max={1} step={0.01} value={kdb as any} onChange={e=>setKdb(e.target.value===''? '': Number(e.target.value))} /></Field>
          <Field label="KLB / FAR"><input className="input" type="number" step={0.1} value={klb as any} onChange={e=>setKlb(e.target.value===''? '': Number(e.target.value))} /></Field>
          <Field label="Max Floors"><input className="input" type="number" value={maxFloors as any} onChange={e=>setMaxFloors(e.target.value===''? '': Number(e.target.value))} /></Field>
          <Field label="Max Height (m)"><input className={`input ${heightConflict? 'input-error':''}`} type="number" value={maxHeightM as any} onChange={e=>setMaxHeightM(e.target.value===''? '': Number(e.target.value))} /></Field>
          <Field label="Floor-to-Floor (m)"><input className="input" type="number" step={0.1} value={f2f as any} onChange={e=>setF2f(e.target.value===''? '': Number(e.target.value))} /></Field>
          <Field label="Efficiency (0-1)"><input className="input" type="number" step={0.01} value={eff as any} onChange={e=>setEff(e.target.value===''? '': Number(e.target.value))} /></Field>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-gray-200 p-3 bg-white">
            <div className="text-gray-600 text-xs">Max Footprint</div>
            <div className="text-lg font-semibold">{maxFootprint!=null ? `${formatNumber(Math.round(maxFootprint))} m²` : '—'}</div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 bg-white">
            <div className="text-gray-600 text-xs">Max GFA</div>
            <div className="text-lg font-semibold">{maxGFA!=null ? `${formatNumber(Math.round(maxGFA))} m²` : '—'}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-1 rounded-full ${kdbWarn? 'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{kdbWarn? 'KDB out of range (0–1)' : 'KDB within standard'}</span>
          <span className={`px-2 py-1 rounded-full ${klbWarn? 'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'}`}>{klbWarn? 'KLB check typical range (0.5–8)' : 'KLB plausible'}</span>
          {heightDerived!=null && maxHeightM!=null && (
            <span className={`px-2 py-1 rounded-full ${heightConflict? 'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>
              Derived height {heightDerived.toFixed(1)} m {heightConflict? 'exceeds' : '≤'} max {maxHeightM} m
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={saveProject} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800">Save Project</button>
          <span className="text-xs text-gray-500">Project ID: {project?.id} • Scenario ID: {scenario?.id || '—'} • Created: {project?.created_at ? new Date(project.created_at).toLocaleString() : '—'} • Updated: {project?.updated_at ? new Date(project.updated_at).toLocaleString() : '—'}</span>
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={drawMode} onChange={e=>setDrawMode(e.target.checked)} /> Draw Boundary</label>
        </div>

      </Card>

      <Card title="Regulatory Framework (Mini Table)">
        <table className="w-full text-sm">
          <thead className="text-gray-500">
            <tr className="[&>th]:text-left [&>th]:py-2"><th>Field</th><th>Value</th></tr>
          </thead>
          <tbody className="[&>tr>td]:py-2 border-t border-gray-100">
            <tr><td>Land Area (m²)</td><td>{formatNumber(Math.round(siteAreaM2))}</td></tr>
            <tr><td>KDB (%)</td><td>{typeof kdb==='number'? `${Math.round(kdb*100)}%` : '—'}</td></tr>
            <tr><td>KLB (FAR)</td><td>{typeof klb==='number'? klb : '—'}</td></tr>
            <tr><td>Max Building Height (floors/meters)</td><td>{[maxFloors? `${maxFloors} floors` : null, maxHeightM? `${maxHeightM} m` : null].filter(Boolean).join(' / ') || '—'}</td></tr>
            <tr className="bg-gray-50 font-semibold"><td>Max Footprint (m²)</td><td>{maxFootprint!=null ? formatNumber(Math.round(maxFootprint)) : '—'}</td></tr>
            <tr className="bg-gray-50 font-semibold"><td>Max GFA (m²)</td><td>{maxGFA!=null ? formatNumber(Math.round(maxGFA)) : '—'}</td></tr>
          </tbody>
        </table>
      </Card>

      {saved && (
        <div className="flex items-center gap-2">
          <a href="/inputs" className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800">Next: Define Tracts</a>
          <span className="text-xs text-gray-500">Move on to Step 3 and add roads/parks.</span>
        </div>
      )}
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

function ClickToDraw({ enabled, onPoint }: { enabled: boolean; onPoint: (p: [number, number]) => void }) {
  useMapEvents({ click(e) { if (enabled) onPoint([e.latlng.lat, e.latlng.lng]) } })
  return null
}

function handleImport(e: React.ChangeEvent<HTMLInputElement>, setProject: (p:any)=>void, project:any) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const text = String(reader.result)
      if (file.name.endsWith('.kml')) {
        const parser = new DOMParser()
        const xml = parser.parseFromString(text, 'text/xml')
        const coords = Array.from(xml.getElementsByTagName('coordinates'))[0]?.textContent || ''
        const pts = coords.trim().split(/\s+/).map(s=>s.split(',').map(Number)).map(([lng,lat])=> [lat, lng])
        if (pts.length>=3) setProject({ ...project, boundary: pts })
      } else {
        const gj = JSON.parse(text)
        let coords: any[] = []
        const geom = gj.type==='Feature' ? gj.geometry : (gj.type==='FeatureCollection' ? gj.features[0]?.geometry : gj)
        if (geom?.type==='Polygon') coords = geom.coordinates[0]
        if (geom?.type==='MultiPolygon') coords = geom.coordinates[0][0]
        const pts = coords.map(([lng,lat]: any)=> [lat, lng])
        if (pts.length>=3) setProject({ ...project, boundary: pts })
      }
    } catch {}
  }
  reader.readAsText(file)
}
