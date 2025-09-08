# 🧩 PRV Document – Neo Development Simulator  
**(Development Simulator – Master Planning Automation SaaS)**  
**Prepared For:** Full-Stack GPT Dev / AI Engineering Team  
**Prepared By:** Senior Partner in Architecture & Urban Design  

---

## 🔍 PROBLEM STATEMENT

Urban designers, planners, and developers face increasing pressure to test complex master plan scenarios quickly — all while staying within evolving regulatory frameworks. Today’s processes are time-consuming, fragmented, and heavily manual.

### 🧱 Key Pain Points
- Manual FAR (KLB), GFA, and building coverage (KDB) calculations delay early-stage planning.  
- Zoning rules are difficult to integrate into creative massing strategies.  
- Lack of simulation tools tailored for iterative, regulation-aware planning.  
- Designers often need to redo entire models when one constraint changes.  
- Stakeholders (developers, regulators, architects) need **transparent compliance vs yield outputs**, not just raw numbers.  

---

## ✅ SYSTEM REQUIREMENTS

The system is a **web-based SaaS platform** powered by GPT logic + rule-based simulation. It allows users to automate early-stage master planning under real-world regulatory conditions.

### 1. 🖊 User Inputs (Sequential Problem Statement)
The UX should guide users through a **step-by-step input sequence** to ensure clarity and prevent missing data.

1. **Site Information**  
   - Total land area (ha/m²)  
   - Site location / ID  
   - Contextual constraints (adjacent roads, zoning overlays, environmental buffers)

2. **Regulatory Parameters**  
   - KDB (site coverage %)  
   - KLB (FAR)  
   - Max building height (floors/meters)

3. **Tract Definition**  
   - Roads and access corridors (non-GFA)  
   - Open space allocations (parks, plazas, water bodies)

4. **Development Components**  
   - Lot number and size (ha/m²)  
   - Assigned land use per lot (residential, retail, office, convention center, etc.)  
   - Podium assumptions (floors, footprint)  
   - Tower typologies (floorplate area, efficiency, max floors)

5. **Scenario Options**  
   - Ability to create multiple development versions (A, B, C) with different assumptions.  

---

### 2. ⚙️ Core Features / Engine Capabilities

| Function                   | Description                                                                 |
|----------------------------|-----------------------------------------------------------------------------|
| **Land Subdivision**       | Auto or manual lot/tract division                                           |
| **Land Use Assignment**    | Assign land uses per lot (resi, commercial, roads, parks, etc.)             |
| **GFA Calculation**        | Calculate built-up areas, footprints, towers, and podiums                   |
| **Typology Application**   | Apply floorplate logic, tower config (e.g., luxury resi vs mid-rise)        |
| **Massing Suggestion**     | Recommend no. of floors, tower position, open space allocation              |
| **Compliance Checker**     | Validate KDB, KLB, height, open space, etc.                                 |
| **Output Table Generator** | Auto-generate tables: area summary, GFA, compliance vs regulatory targets   |
| **Scenario Manager**       | Save and compare multiple design versions                                   |

---

### 3. 🧪 Simulation & Iteration Tools

| Tool                       | Description                                                                      |
|----------------------------|----------------------------------------------------------------------------------|
| **“What-If” Panel**        | Adjust podium height, floorplate, land use mix and re-run scenarios              |
| **Scenario Versions**      | Save & compare development options A, B, C                                       |
| **Regulatory Stress Test** | Show edge cases: e.g., “maximize yield without exceeding KLB”                    |
| **Dashboard View**         | KPI visualization: heatmaps, summary tables, charts                             |

---

### 4. 📤 Outputs

Outputs must balance **developer feasibility** and **regulatory compliance**. The SaaS should generate both **numerical tables** and **visual reports**.

| Output Type         | Format                                                                 |
|---------------------|------------------------------------------------------------------------|
| **Tables**          | - Regulatory framework (targets)  <br> - Development program summary  <br> - Compliance: “Target vs Achieved”  |
| **Maps/Diagrams**   | Editable 2D schematic massing / lot layout (SVG or Canvas-based)       |
| **Exports**         | PDF board-ready reports, CSV/XLS/Google Sheets exports, images         |
| **Scenario Archive**| Saved sessions with unique shareable links                             |

#### 4.1 Report Tables (Schemas & Calculations)

**Table 1 — Regulatory Framework**  
_Parameters + derived caps._
- **Fields:** `Land Area (m²)`, `KDB (%)`, `KLB (FAR)`, `Max Building Height (floors/meters)`, `Max Footprint (m²)`, `Max GFA (m²)`
- **Calcs:**  
  - `Max Footprint = Land Area × KDB`  
  - `Max GFA = Land Area × KLB`

**Table 2 — Development Program Summary**  
_Lots & tracts with program detail._
- **Fields:** `ID (Lot/Tract)`, `Type (Lot/Tract)`, `Use`, `Lot/Tract Area (m²)`, `Building Footprint (m²)`, `Podium Floors (count)`, `Podium GFA (m²)`, `Tower Floorplate (m²)`, `Tower Floors (count)`, `Tower GFA (m²)`, `Total Lot GFA (m²)`, `Notes`
- **Per‑row Calcs:**  
  - `Podium GFA = Podium Floors × Building Footprint` (unless overridden by efficiency)  
  - `Tower GFA = Tower Floors × Tower Floorplate` (× efficiency if modeled)  
  - `Total Lot GFA = Podium GFA + Tower GFA`

**Table 3 — Regulatory/Target vs Achieved Program Figures**  
_Roll‑up compliance dashboard._
- **Fields:** `Parameter`, `Regulatory/Target Allowance`, `Achieved Program`, `Status/Buffer`  
- **Rows:**  
  - `Total Land Area (m²)`  
  - `Max Footprint Area (m²)` vs `Σ Building Footprints`  
  - `Max GFA (m²)` vs `Σ Total Lot GFA`  
  - `Max Building Height (floors/meters)` vs `Max Actual`  
  - `Parking (stalls or m²)` → **Target** (planning standard or input) vs **Achieved** (model output)  
  - `Open Space Allocation (m²/% of site)` → **Target** vs **Achieved**  
- **Calcs:**  
  - `Status/Buffer = Target − Achieved` (positive = within limit / capacity remaining)

**Table 4 — AI Notes: Recommendations & Insights**  
- **Fields:** `Insight Type`, `Message`, `Linked Parameter(s)`, `Rationale`, `Action Suggestion`  
- **Examples:** “FAR capped while KDB underused; consider increasing podium floors or widening park promenade.”

#### 4.2 Export Implementations (Sheets, XLS, PDF)

**Google Sheets Export**  
- **Tech:** Google Sheets API v4 (service account + OAuth); create workbook with 4 tabs (Table1–4).  
- **Endpoint:** `POST /export/sheets` → payload: scenario ID, destination (new sheet or append to existing by ID).  
- **Notes:** include formatting (bold headers, thousand separators, conditional formatting for Status/Buffer).

**Excel (XLSX) Export**  
- **Tech:** `exceljs` (Node) or `XlsxWriter` (Python).  
- **Endpoint:** `POST /export/xlsx` → returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` blob.  
- **Structure:** 4 worksheets mirroring schemas above; freeze header row; auto‑width; number formats; conditional formatting on compliance buffers.

**PDF Export**  
- **Tech:** `puppeteer`/`playwright` (HTML → PDF) or `pdfkit/jsPDF` for programmatic layout.  
- **Endpoint:** `POST /export/pdf` → payload: scenario ID + template (Board‑Ready / Technical Annex).  
- **Layout:** cover page (project + scenario), executive summary, three tables, charts (optimization graphs), AI Notes; footer with timestamp & scenario hash.

**General Export Rules**  
- All exports include **metadata** (project, scenario ID, inputs hash, timestamp).  
- Number formatting: thousands separators, 0 decimals for m² unless specified.  
- Units clearly labeled; include legend for any color scales in charts.

---
------------------|------------------------------------------------------------------------|
| **Tables**          | - Regulatory framework (targets)  <br> - Development program summary  <br> - Compliance: “Target vs Achieved”  |
| **Maps/Diagrams**   | Editable 2D schematic massing / lot layout (SVG or Canvas-based)       |
| **Exports**         | PDF board-ready reports, CSV table exports, images                     |
| **Scenario Archive**| Saved sessions with unique shareable links                             |

---

### 5. 🧑‍💻 User Experience & Workflow

1. **Guided Input Form** → Define site + regulations + tracts + lots.  
2. **Simulate** → System auto-generates massing, GFAs, compliance tables.  
3. **Review Dashboard** → Charts, heatmaps, “regulatory vs achieved” summaries.  
4. **Iterate** → Adjust assumptions (e.g., tower plate or podium levels) and re-run.  
5. **Export** → Generate PDFs/CSVs for developer boards, regulatory review, or investor decks.  

---

### 6. 🔗 Optional Integrations (Future-Ready)

| Type          | Purpose                                                                   |
|---------------|---------------------------------------------------------------------------|
| **GIS / Map** | Use Mapbox or PostGIS for site context and overlays                      |
| **Financial** | Plug-in for calculating IRR, yield, pricing strategies                    |
| **3D Export** | Export schematic massing to Rhino/Revit or WebGL viewer                   |

---

## 🌐 VISION STATEMENT

**Development Simulator** is the next-generation urban design platform that empowers planners and developers to:

> “**Simulate master plans like a zoning consultant, design like an architect, and iterate like an AI.**”

It transforms compliance-heavy planning into a rapid, creative, and intelligent process — helping cities and developers reach optimal outcomes faster.

---

## 🚀 MVP SCOPE (BUILD TARGET)

| Module               | Functionality                                                                 |
|----------------------|-------------------------------------------------------------------------------|
| **Regulatory Engine**| KDB/KLB validation, height/floor limits                                       |
| **Subdivision Tool** | Create and assign land uses to lots/tracts                                   |
| **GFA Calculator**   | Massing + floorplate rules + yield metrics                                   |
| **Output Generator** | Tables, charts, diagrams (PDF/CSV)                                           |
| **Scenario Manager** | Create and compare multiple development versions                             |
| **UX Interface**     | Clean, simple web UI with step-by-step workflow                              |

---

## 🧱 RECOMMENDED STACK (for Dev Team)

| Layer         | Tools / Tech                                                           |
|---------------|------------------------------------------------------------------------|
| **Frontend**  | React.js or Vue.js, Tailwind UI, Plotly or D3.js                       |
| **Backend**   | Python (FastAPI, Pandas, NumPy) or Node.js                             |
| **Database**  | PostgreSQL (+ PostGIS if spatial logic is needed later)                |
| **AI Engine** | OpenAI GPT-4o (for rule logic, prompt generation, explanation engine)  |
| **Hosting**   | AWS, Vercel, or Azure                                                  |
| **Exporting** | PDFKit, CSV generators, SVG/Canvas-based diagram layers                |

---

## ⚙️ Optimization & Sweet Spot Engine (Core Requirement)

> **Purpose:** Identify the **best-performing configuration** ("sweet spot") that **maximizes yield** (e.g., GFA or NPV) **subject to constraints** (KDB/KLB/height/footprint ≤ lot).

### A. Decision Variables (per lot / global)
- **Podium levels** (integer range, e.g., 3–7)
- **Tower floors** (integer range, limited by height cap)
- **Tower floorplate** (continuous, m², bounded by daylight/efficiency rules)
- **Footprint allocation** (continuous, m², ≤ lot area)
- **Use mix ratios** (for mixed-use towers, signature stack)

### B. Constraints (hard)
- **KDB:** Σ(footprints) ≤ KDB × SiteArea
- **FAR/KLB:** Σ(GFA) ≤ KLB × SiteArea
- **Height:** floors × floor‑to‑floor ≤ max height (m) **and** floors ≤ max floors
- **Footprint vs Lot:** footprint ≤ lot area (per lot)
- **Tract Exclusion:** tracts (roads/park/water) generate **no GFA**

### C. Objectives (single- or multi‑objective)
- **Maximize total GFA** (default)
- Optional with finance overlay: **Maximize NPV/IRR**, **maximize sellable GFA**, **minimize coverage for more open space**, **balance skyline variance**

### D. Algorithms (implementation tiers)
1) **Parameter Sweep / Grid Search (MVP)**  
   - Enumerate discrete ranges (floors, podium levels) × sample continuous ranges (floorplate), compute results, filter by constraints.  
   - **Tech:** Pandas/NumPy vectorized computation; fast and transparent.
2) **Heuristic Optimization (Phase 2)**  
   - **Bayesian optimization** (e.g., `scikit-optimize`) for continuous variables.  
   - **Genetic algorithms / NSGA‑II** (`pymoo`) for multi‑objective (yield vs open space vs height profile).  
   - **Mixed-Integer Programming** (OR‑Tools / PuLP) for cases with strict integer choices.
3) **Auto‑Optimize Button**  
   - Runs tier 1 quickly; escalates to tier 2 if user selects "Advanced" or if sweet spot sits on boundary.

### E. KPIs & Fitness Function
- **YieldKPIs:** total GFA, sellable GFA, podium GFA, resi/office/hotel split, FAR utilization %, KDB utilization %
- **Compliance Buffer:** distance to each constraint (e.g., 952,200 − ΣGFA)
- **Livability Signals (advisory):** tower slenderness (H/B), plate size bounds (e.g., 1,800–2,600 m²), daylight proxy

### F. Visualization (Sweet Spot UI)
1. **Yield vs Variable Curve**  
   - X: chosen variable (e.g., tower floors); Y: total GFA/NPV.  
   - Overlays: **constraint lines** (KDB/FAR/height).  
   - Annotate **sweet spot** and **feasible region** shading.
2. **2D Heatmap**  
   - Axes: podium levels vs tower floorplate.  
   - Color: FAR utilization %; mask infeasible cells.
3. **Scenario Spider/Radar**  
   - Compare A/B/C on KPIs (GFA, coverage, open space %, compliance buffer, skyline variance).
4. **Scenario Stacked Bars**  
   - Program composition by use per scenario.

**Frontend Tech:** Plotly (recommended for interactivity) or D3.js.  
**Performance:** Debounced recompute; client‑side cache of last sweep; server‑side memoization by hash of inputs.

### G. UX Additions
- **Optimize Panel** (right rail): choose **objective**, **variables to optimize**, **bounds**, **locks** (e.g., "fix podium at 5F").
- **Feasibility Chips** in charts (✅ feasible, ⚠ near cap, ⛔ violates constraint). 
- **One‑click Presets:** "Max FAR within KDB", "Park‑First (minimize coverage)", "Signature Emphasis".
- **Explainability:** GPT "Why this is optimal" summary with references to constraints.

### H. Data Model Extensions
- `OptimizationRun`: inputs hash, variable ranges, solver used, timestamp.  
- `OptimizationResult`: best solution vector, KPIs, constraint buffers, pareto set (if multi‑objective).  
- `Scenario`: links to `OptimizationResult` for reproducibility and export.

### I. API Sketch (FastAPI)
- `POST /simulate` → returns compliance + KPIs for a single configuration.  
- `POST /optimize` → accepts objective + var bounds; returns best config + sweep data for graphs.  
- `GET /scenarios/{id}` → retrieve stored scenario & charts payloads.

### J. Performance & Ops
- **Vectorized math** for sweeps; optional **WebWorkers**/server workers for long runs.  
- **Timeboxing**: cap iteration counts on free tier; show progress + partial results.  
- **Caching**: Redis/Edge cache by input hash; warm popular presets (e.g., Jakarta 13.8 ha).

---

## 💰 Land Development & Construction Cost Module (Extension)

> **Purpose:** Provide cost estimation for entire project components (towers, podiums, convention center, signature tower, roads, parks, landscapes, infrastructure) derived from computed GFA and tract areas.

### A. Inputs
- **Unit Cost Libraries** (configurable by region & currency):
  - Towers (luxury resi, office, hotel) → cost per m² GFA
  - Podiums (retail/F&B, convention) → cost per m² GFA
  - Roads → cost per m² paved
  - Parks/Landscapes → cost per m² landscaped
  - Infrastructure (utilities, lagoons) → cost per m² or lump sum
- **Currency Selection:** toggle IDR / USD
- **IDR Units:**
  - Billion (M / milyar)
  - Million (jt / juta)

### B. Calculations
- **Building Cost (per lot):** `Total Lot GFA × CostRateBuildingType`
- **Roads Cost:** `Road Area × RoadCost/m²`
- **Park/Landscape Cost:** `Park Area × LandscapeCost/m²`
- **Infra Cost:** `Infra Tracts × CostRate`
- **Total Development Cost = Σ(all categories)`

### C. Outputs
- **Table 5 — Development & Construction Cost Summary**
  - **Fields:** `Component`, `Area (m²) / GFA (m²)`, `Unit Cost (IDR/m² or USD/m²)`, `Total Cost (IDR milyar/jt or USD)`
  - **Rows:** Convention Center, Signature Tower, Podium + Resi Towers (each lot), Roads, Parks/Landscapes, Infrastructure
- **Currency Toggle:**
  - IDR Billion (Milyar) / IDR Million (Juta)
  - USD equivalent (fx rate configurable)
- **Charts:**
  - Pie chart: cost breakdown by component
  - Bar chart: cost per lot/tract

### D. Exports
- Integrated into **Google Sheets/XLSX/PDF** with other tables.
- Cost table as additional sheet/tab + included in Board‑Ready PDF.

### E. Future Enhancements
- Link to **financial model** for NPV/IRR.
- Regionalized cost libraries; user can upload CSV with unit cost updates.
- Sensitivity analysis: vary ±10% unit cost; scenario compare.

---

## 🔮 FUTURE EXTENSIONS (POST-MVP)
- 3D schematic massing viewer (WebGL or Rhino-export).  
- AI-based precedent matching (compare typology with real-world cases).  
- Market & financial overlays: pricing, phasing, absorption rate simulations.  
- Daylight/shadow studies and passive design evaluation.  
- Interactive zoning sandbox for government policy testing.  

