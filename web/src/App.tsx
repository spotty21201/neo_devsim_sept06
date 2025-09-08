import Dashboard from './pages/Dashboard'
import { AppLayout } from './components/AppLayout'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Inputs from './pages/Inputs'
import Simulate from './pages/Simulate'
import Scenarios from './pages/Scenarios'
import Compare from './pages/Compare'
import Costs from './pages/Costs'
import { ScenarioProvider } from './state/ScenarioContext'
import Project from './pages/Project'
import Program from './pages/Program'
import Exports from './pages/Exports'

export default function App() {
  return (
    <BrowserRouter>
      <ScenarioProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project" element={<Project />} />
            <Route path="/inputs" element={<Inputs />} />
            <Route path="/program" element={<Program />} />
            <Route path="/simulate" element={<Simulate />} />
            <Route path="/scenarios" element={<Scenarios />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/exports" element={<Exports />} />
          </Routes>
        </AppLayout>
      </ScenarioProvider>
    </BrowserRouter>
  )
}
