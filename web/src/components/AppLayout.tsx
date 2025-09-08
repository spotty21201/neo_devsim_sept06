import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useScenario } from '../state/ScenarioContext'
import { SimAPI } from '../lib/api'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { project, lastSim, setLastSim, setLastOpt, scenario } = useScenario() as any
  const links = [
    ['Project','/project'],
    ['Dashboard','/'],
    ['Inputs','/inputs'],
    ['Simulate','/simulate'],
    ['Scenarios','/scenarios'],
    ['Costs','/costs'],
    ['Exports','/exports'],
    ['Settings','/settings'],
  ]
  const loc = useLocation()
  const nav = useNavigate()
  const [running, setRunning] = useState(false)

  async function handleRunSimulate() {
    try {
      setRunning(true)
      const sim = await SimAPI.simulate(scenario)
      setLastSim(sim)
      setLastOpt(null)
      nav('/simulate')
      console.info('simulate_run', { success: true, at: Date.now() })
    } catch (e: any) {
      console.error('simulate_run_error', e)
      alert(`Simulation failed: ${e?.message || e}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="flex">
        <aside className="w-68 shrink-0 border-r border-gray-200 bg-gray-100">
          <div className="h-16 flex items-center gap-2 px-4">
            <div className="size-7 rounded-md bg-gray-900" />
            <div className="leading-tight text-[13px] select-none">
              <div className="font-semibold tracking-tight">Neo</div>
              <div className="font-semibold tracking-tight">Development</div>
              <div className="font-semibold tracking-tight">Simulator</div>
            </div>
          </div>
          <nav className="px-2 py-2 text-sm">
            {links.map(([label,href])=> {
              const active = loc.pathname===href
              const base = 'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-150'
              const cls = active
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-700 hover:bg-gray-200'
              return (
                <Link key={label} to={href} className={`${base} ${cls}`}>
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="mt-auto px-4 py-3 border-t border-gray-100">
            <div className="leading-tight text-[11px] text-gray-600 whitespace-normal break-words">
              <div>v0.9 (alpha)</div>
              <div className="h-2" aria-hidden="true" />
              <div className="text-black">Kolabs.Design | AIM | HDA</div>
              <div className="h-2" aria-hidden="true" />
              <div>Inspired by</div>
              <div>Development Simulator (2001)</div>
              <div>by Doddy Samiaji of</div>
              <div>Design Machine Group, Seattle</div>
            </div>
          </div>
        </aside>
        <main className="flex-1">
          <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6">
            <div className="text-sm text-gray-500 flex items-center gap-2">{project?.name || 'Project'} › {loc.pathname==='/'? 'Dashboard' : loc.pathname.slice(1)} {scenario?.id && <span className="px-2 py-0.5 rounded-full bg-gray-100">Scenario {scenario.id}</span>}</div>
            <div className="flex items-center gap-2">
              {loc.pathname === '/project' ? (
                <Link to="/inputs" className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800">Next: Inputs</Link>
              ) : (
                <>
                  <button disabled={!lastSim} className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Export</button>
                  <button onClick={handleRunSimulate} disabled={running} className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">{running ? 'Running…' : 'Run Simulate'}</button>
                </>
              )}
            </div>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
