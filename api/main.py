from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
import math

app = FastAPI(title="Neo Development Simulator API", version="0.0.1")

# CORS for local dev UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


class RegSet(BaseModel):
    site_area_m2: float
    kdb: float = Field(..., description="Site coverage %, 0-1")
    klb: float = Field(..., description="FAR (GFA / SiteArea)")
    max_floors: Optional[int] = None
    max_height_m: Optional[float] = None
    floor_to_floor_m: Optional[float] = None
    efficiency_override: Optional[float] = Field(default=None, description="If set, overrides lot efficiencies (0-1)")


class Typology(BaseModel):
    podium_levels: int
    podium_footprint_m2: float
    tower_floors: int
    tower_plate_m2: float
    efficiency: float = 0.8


class Lot(BaseModel):
    id: str
    area_m2: float
    use: Literal["resi", "office", "hotel", "retail", "convention", "infra", "mixed"] = "resi"
    typology: Typology


class Tract(BaseModel):
    id: str
    area_m2: float
    type: Literal["road", "park", "water", "infra"] = "road"
    buildable: bool = False


class Scenario(BaseModel):
    id: str
    reg: RegSet
    lots: List[Lot]
    tracts: Optional[List[Tract]] = []


class SimResult(BaseModel):
    # legacy fields
    total_gfa: float
    far_util: float
    kdb_util: float
    height_ok: bool
    compliance: dict
    # new API fields (for UI mapping)
    total_gfa_m2: Optional[float] = None
    far_utilization_pct: Optional[float] = None
    far_buffer_m2: Optional[float] = None
    kdb_utilization_pct: Optional[float] = None
    kdb_buffer_m2: Optional[float] = None
    sellable_pct: Optional[float] = None
    nonsellable_pct: Optional[float] = None
    by_lot: Optional[List[dict]] = None


def compute_gfa(lot: Lot, eff_override: Optional[float]) -> float:
    eff = eff_override if (eff_override is not None) else lot.typology.efficiency
    pod_gfa = lot.typology.podium_levels * lot.typology.podium_footprint_m2 * eff
    tow_gfa = lot.typology.tower_floors * lot.typology.tower_plate_m2 * eff
    return pod_gfa + tow_gfa


@app.post("/simulate", response_model=SimResult)
def simulate(scn: Scenario):
    total_gfa = sum(compute_gfa(l, scn.reg.efficiency_override) for l in scn.lots)
    total_footprint = sum(min(l.area_m2, l.typology.podium_footprint_m2) for l in scn.lots)

    far_cap = scn.reg.klb * scn.reg.site_area_m2
    kdb_cap = scn.reg.kdb * scn.reg.site_area_m2

    far_util = total_gfa / far_cap if far_cap else 0
    kdb_util = total_footprint / kdb_cap if kdb_cap else 0

    def lot_height_ok(l: Lot) -> bool:
        floors_check = (scn.reg.max_floors is None or l.typology.tower_floors <= scn.reg.max_floors)
        meters_check = True
        if scn.reg.max_height_m is not None and scn.reg.floor_to_floor_m is not None:
            meters_check = (l.typology.tower_floors * scn.reg.floor_to_floor_m) <= scn.reg.max_height_m + 1e-6
        return floors_check and meters_check

    height_ok = all(lot_height_ok(l) for l in scn.lots)

    compliance = {
        "far_ok": total_gfa <= far_cap + 1e-6,
        "kdb_ok": total_footprint <= kdb_cap + 1e-6,
        "height_ok": height_ok,
        "buffers": {
            "far": far_cap - total_gfa,
            "kdb": kdb_cap - total_footprint,
        },
    }

    # Non-sellable tracts share
    tract_area = 0.0
    for t in (scn.tracts or []):
        area = t.area_m2
        if getattr(t, "type", None) == "road" and not getattr(t, "area_override", False) and getattr(t, "row_m", None) and getattr(t, "length_m", None):
            area = float(getattr(t, "row_m")) * float(getattr(t, "length_m"))
        tract_area += float(area or 0)
    sellable = max(0.0, scn.reg.site_area_m2 - tract_area)
    sellable_pct = (sellable / scn.reg.site_area_m2 * 100.0) if scn.reg.site_area_m2 else 0.0
    nonsellable_pct = 100.0 - sellable_pct

    # per-lot GFA
    per_lot = []
    for l in scn.lots:
        per_lot.append({
            "lot_id": l.id,
            "total_gfa_m2": compute_gfa(l, scn.reg.efficiency_override),
        })

    return SimResult(
        total_gfa=total_gfa,
        far_util=far_util,
        kdb_util=kdb_util,
        height_ok=height_ok,
        compliance=compliance,
        total_gfa_m2=total_gfa,
        far_utilization_pct=far_util * 100.0,
        far_buffer_m2=compliance["buffers"]["far"],
        kdb_utilization_pct=kdb_util * 100.0,
        kdb_buffer_m2=compliance["buffers"]["kdb"],
        sellable_pct=sellable_pct,
        nonsellable_pct=nonsellable_pct,
        by_lot=per_lot,
    )


class OptimizeRequest(BaseModel):
    scenario: Scenario
    floors_range: List[int] = Field(default_factory=lambda: [30, 40, 50, 60])
    plate_range_m2: List[float] = Field(default_factory=lambda: [1800, 2000, 2200, 2400])
    podium_levels_range: List[int] = Field(default_factory=lambda: [3, 5, 7])
    locks: Optional[Dict[str, Any]] = None  # e.g., {"podium_levels": 5}


class OptimizeResult(BaseModel):
    best_floors: int
    best_plate_m2: float
    best_total_gfa: float
    feasible: List[dict]
    # new fields
    series: Optional[List[dict]] = None
    sweet_spot: Optional[dict] = None
    constraints: Optional[dict] = None


@app.post("/optimize", response_model=OptimizeResult)
def optimize(req: OptimizeRequest):
    best = (None, None, None, -math.inf)  # (floors, plate, podium, gfa)
    feasible = []
    locks = req.locks or {}
    for pl in req.podium_levels_range:
        for f in req.floors_range:
            for p in req.plate_range_m2:
                lots = []
                for l in req.scenario.lots:
                    lt = l.copy(deep=True)
                    lt.typology.podium_levels = int(locks.get("podium_levels", pl))
                    lt.typology.tower_floors = int(locks.get("tower_floors", f))
                    lt.typology.tower_plate_m2 = float(locks.get("tower_plate_m2", p))
                    lots.append(lt)
                tmp = req.scenario.copy(deep=True)
                tmp.lots = lots
                sim = simulate(tmp)
                ok = all(sim.compliance[k] for k in ["far_ok", "kdb_ok", "height_ok"])
                if ok and sim.total_gfa > best[3]:
                    best = (f, p, pl, sim.total_gfa)
                feasible.append({"podium": pl, "floors": f, "plate": p, "gfa": sim.total_gfa, "ok": ok})

    bf, bp, bpl, bgfa = best
    if bf is None:
        bf, bp, bpl, bgfa = 0, 0.0, 0, 0.0

    # Build series per floors (max gfa per floors)
    per_f: dict[int, float] = {}
    for pt in feasible:
        f = pt["floors"]
        per_f[f] = max(per_f.get(f, 0.0), float(pt["gfa"]))
    series = [{"x": f, "y": per_f[f]} for f in sorted(per_f.keys())]

    constraints = {
        "far_cap_m2": req.scenario.reg.klb * req.scenario.reg.site_area_m2,
        "kdb_cap_m2": req.scenario.reg.kdb * req.scenario.reg.site_area_m2,
        "height_cap_f": req.scenario.reg.max_floors,
    }
    sweet_spot = {"x": bf, "y": bgfa, "vars": {"plate": bp, "podium": bpl}}

    return OptimizeResult(best_floors=bf, best_plate_m2=bp, best_total_gfa=bgfa, feasible=feasible, series=series, sweet_spot=sweet_spot, constraints=constraints)


class CostLibraryItem(BaseModel):
    component: str
    basis: Literal["gfa", "area", "lump"] = "gfa"
    rate: float
    unit: str


class CostRequest(BaseModel):
    scenario: Scenario
    library: List[CostLibraryItem]
    fx_rate: float = 0.000064  # IDR->USD example
    contingency_pct: float = 0.1
    soft_cost_pct: float = 0.08


class CostRow(BaseModel):
    component: str
    qty: float
    unit_cost: float
    total_cost: float


class CostEstimate(BaseModel):
    rows: List[CostRow]
    totals: dict


@app.post("/cost/estimate", response_model=CostEstimate)
def estimate_cost(req: CostRequest):
    sim = simulate(req.scenario)
    rows: List[CostRow] = []

    # Very simple mapping for demo purposes
    for item in req.library:
        if item.basis == "gfa":
            qty = sim.total_gfa
        elif item.basis == "area":
            qty = req.scenario.reg.site_area_m2
        else:
            qty = 1.0
        total = qty * item.rate
        rows.append(CostRow(component=item.component, qty=qty, unit_cost=item.rate, total_cost=total))

    direct = sum(r.total_cost for r in rows)
    contingency = direct * req.contingency_pct
    soft = direct * req.soft_cost_pct
    grand = direct + contingency + soft
    totals = {"direct": direct, "contingency": contingency, "soft": soft, "grand_total": grand, "usd": grand * req.fx_rate}
    return CostEstimate(rows=rows, totals=totals)

# --- Export placeholders ---
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
import io, base64
import xlsxwriter
from datetime import datetime


def scenario_meta(scn: Optional[Scenario]):
    if not scn:
        return {}
    return {
        "project": "Neo Development Simulator",
        "scenario_id": scn.id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@app.post("/export/xlsx")
def export_xlsx(payload: dict):
    scn = None
    try:
        if payload.get("scenario"):
            scn = Scenario.model_validate(payload["scenario"])
    except Exception:
        scn = None
    content = "Table,Note\nPlaceholder,Implement exceljs/XlsxWriter later\n"
    return PlainTextResponse(content, media_type="text/csv", headers={"X-Meta": str(scenario_meta(scn))})


@app.post("/export/pdf")
def export_pdf(payload: dict):
    scn = None
    try:
        if payload.get("scenario"):
            scn = Scenario.model_validate(payload["scenario"])
    except Exception:
        scn = None
    return JSONResponse({"status": "placeholder", "message": "PDF export pending (Playwright/Puppeteer)", "meta": scenario_meta(scn)})


@app.post("/export/sheets")
def export_sheets(payload: dict):
    scn = None
    try:
        if payload.get("scenario"):
            scn = Scenario.model_validate(payload["scenario"])
    except Exception:
        scn = None
    return JSONResponse({"status": "placeholder", "message": "Sheets export pending (Google Sheets API)", "meta": scenario_meta(scn)})


def _table1(ws, scn: Scenario):
    ws.write_row(0, 0, ["Field", "Value"])
    ws.write_row(1, 0, ["Land Area (m²)", scn.reg.site_area_m2])
    ws.write_row(2, 0, ["KDB (%)", scn.reg.kdb * 100])
    ws.write_row(3, 0, ["KLB (FAR)", scn.reg.klb])
    height = ""
    if scn.reg.max_floors:
        height = f"{scn.reg.max_floors} floors"
    if scn.reg.max_height_m:
        height = (height + " / " if height else "") + f"{scn.reg.max_height_m} m"
    ws.write_row(4, 0, ["Max Building Height", height])
    ws.write_row(5, 0, ["Max Footprint (m²)", scn.reg.kdb * scn.reg.site_area_m2])
    ws.write_row(6, 0, ["Max GFA (m²)", scn.reg.klb * scn.reg.site_area_m2])


def _compute_program(scn: Scenario):
    rows = []
    total_footprint = 0.0
    total_gfa = 0.0
    for l in scn.lots:
        eff = scn.reg.efficiency_override if scn.reg.efficiency_override is not None else l.typology.efficiency
        pod_gfa = l.typology.podium_levels * l.typology.podium_footprint_m2 * eff
        tow_gfa = l.typology.tower_floors * l.typology.tower_plate_m2 * eff
        total = pod_gfa + tow_gfa
        footprint = min(l.area_m2, l.typology.podium_footprint_m2)
        rows.append([l.id, "lot", l.use, l.area_m2, footprint, l.typology.podium_levels, pod_gfa, l.typology.tower_plate_m2, l.typology.tower_floors, tow_gfa, total, ""])
        total_footprint += footprint
        total_gfa += total
    for t in (scn.tracts or []):
        area = t.area_m2
        if t.type == "road" and (not getattr(t, "area_override", False)) and getattr(t, "row_m", None) and getattr(t, "length_m", None):
            area = float(t.row_m) * float(t.length_m)
        rows.append([t.id, "tract", t.type, area, "—", "—", "—", "—", "—", "—", "—", "non-buildable"])
    return rows, total_footprint, total_gfa


def _table2(ws, scn: Scenario):
    headers = [
        "ID","Type","Use","Lot/Tract Area","Building Footprint","Podium Floors","Podium GFA","Tower Floorplate","Tower Floors","Tower GFA","Total Lot GFA","Notes"
    ]
    ws.write_row(0,0, headers)
    rows, _, _ = _compute_program(scn)
    for i, r in enumerate(rows, start=1):
        ws.write_row(i, 0, r)


def _table3(ws, scn: Scenario):
    rows, total_fp, total_gfa = _compute_program(scn)
    max_fp = scn.reg.kdb * scn.reg.site_area_m2
    max_gfa = scn.reg.klb * scn.reg.site_area_m2
    ws.write_row(0,0,["Row","Target","Achieved","Status","Buffer"])
    ws.write_row(1,0,["Total Land Area", scn.reg.site_area_m2, scn.reg.site_area_m2, "—","—"])
    ws.write_row(2,0,["Max Footprint vs ΣFootprints", max_fp, total_fp, "OK" if total_fp<=max_fp else "Exceeds", max_fp-total_fp])
    ws.write_row(3,0,["Max GFA vs ΣGFA", max_gfa, total_gfa, "OK" if total_gfa<=max_gfa else "Exceeds", max_gfa-total_gfa])
    ws.write_row(4,0,["Max Height vs Actual", scn.reg.max_floors or "—", max([l.typology.tower_floors for l in scn.lots] + [0]), "—","—"])
    open_space = sum([(t.area_m2 if getattr(t, 'type', None) in ("park","water") else 0) for t in (scn.tracts or [])])
    ws.write_row(5,0,["Open Space", "—", open_space, "—","—"])
    ws.write_row(6,0,["Parking","—","—","—","—"])


def _table5(ws, scn: Scenario):
    ws.write_row(0,0,["Component","Area/GFA (m²)","Unit Cost (IDR/m²)","Total Cost (IDR)"])
    rows, _, total_gfa = _compute_program(scn)
    buildings = total_gfa
    site = scn.reg.site_area_m2
    ws.write_row(1,0,["Buildings", buildings, 6500000, buildings*6500000])
    ws.write_row(2,0,["Roads", site*0.15, 900000, site*0.15*900000])
    ws.write_row(3,0,["Parks & Landscape", site*0.22, 600000, site*0.22*600000])
    ws.write_row(4,0,["Infrastructure", 1, 150000000000, 150000000000])


@app.post("/export/xlsx-real")
def export_xlsx_real(payload: dict):
    scn = Scenario.model_validate(payload["scenario"]) if payload.get("scenario") else None
    if not scn:
        return JSONResponse({"error":"missing scenario"}, status_code=400)
    graph_png = payload.get("graph_png")
    project = payload.get("project") or {}

    bio = io.BytesIO()
    wb = xlsxwriter.Workbook(bio, {"in_memory": True})
    # Cover page and credits
    PRODUCT_NAME = "Neo Development Simulator"
    PRODUCT_VERSION = "v0.9 (alpha)"
    TAGLINE = "Simulate your developments at the speed of intelligence."
    CREDITS = "Kolabs.Design | AIM | HDA"
    CREDIT_LINE = "Inspired by Development Simulator (2001) by Doddy Samiaji of Design Machine Group, Seattle"

    cover = wb.add_worksheet("Cover")
    big = wb.add_format({"bold": True, "font_size": 24})
    small = wb.add_format({"font_size": 12})
    gray = wb.add_format({"font_size": 10, "color": "#666666"})
    cover.write(1, 1, PRODUCT_NAME, big)
    cover.write(3, 1, TAGLINE, small)
    cover.write(5, 1, f"Project: {project.get('name','—')}", small)
    cover.write(6, 1, f"Location: {project.get('location','—')}", small)
    cover.write(7, 1, f"Scenario: {scn.id}", small)
    cover.write(8, 1, f"Generated: {datetime.utcnow().isoformat()}Z", small)
    cover.write(9, 1, f"Version: {PRODUCT_VERSION}", small)
    cover.write(11, 1, CREDITS, small)
    cover.write(12, 1, CREDIT_LINE, gray)
    cover.set_footer(CREDITS)
    meta_ws = wb.add_worksheet("Regulatory Framework")
    _table1(meta_ws, scn)
    meta_ws.set_footer(CREDITS)
    prog_ws = wb.add_worksheet("Program Summary")
    _table2(prog_ws, scn)
    prog_ws.set_footer(CREDITS)
    comp_ws = wb.add_worksheet("Target vs Achieved")
    _table3(comp_ws, scn)
    comp_ws.set_footer(CREDITS)
    notes_ws = wb.add_worksheet("AI Notes")
    notes_ws.write_row(0,0,["Insight Type","Message","Linked Parameters","Rationale","Action"])
    notes_ws.set_footer(CREDITS)
    cost_ws = wb.add_worksheet("Cost Summary")
    _table5(cost_ws, scn)
    cost_ws.set_footer(CREDITS)

    if graph_png:
        try:
            if graph_png.startswith("data:image/png;base64,"):
                b64 = graph_png.split(",",1)[1]
            else:
                b64 = graph_png
            img = base64.b64decode(b64)
            img_bio = io.BytesIO(img)
            chart_ws = wb.add_worksheet("Optimization Graph")
            chart_ws.insert_image(1,1, "graph.png", {"image_data": img_bio})
            chart_ws.set_footer(CREDITS)
        except Exception:
            pass

    wb.close()
    bio.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="neo_simulator_export.xlsx"'}
    return StreamingResponse(bio, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
