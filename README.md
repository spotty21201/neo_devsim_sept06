# Neo Development Simulator – MVP Skeleton

This repository contains a minimal full‑stack scaffold for the Neo Development Simulator described in `neo_development_simulator_prv.md`.

- `web/` – React + Vite + Tailwind UI shell and dashboard components (Inter font, minimal look).
- `api/` – FastAPI server with stubbed endpoints: `/simulate`, `/optimize`, `/cost/estimate`.

## Quick Start

Backend (API):

```
pip install -r api/requirements.txt
uvicorn api.main:app --reload
```

Open http://localhost:8000/docs for interactive API.

Frontend (Web):

```
cd web
npm install
npm run dev
```

Visit the dev server printed by Vite.

## Notes

- The UI is a minimal dashboard matching the reference style (Inter, clean cards, subtle borders).
- Endpoints are deterministic and designed to be easily swapped to real engines.
- Sample payloads are in `api/samples/` to test simulate/optimize/cost.

