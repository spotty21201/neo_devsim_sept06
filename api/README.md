# Neo Development Simulator API (MVP stubs)

Quick start:

1. Create a virtualenv and install requirements:

```
pip install -r api/requirements.txt
```

2. Run the server:

```
uvicorn api.main:app --reload
```

3. Visit docs at `/docs`.

Endpoints:
- POST `/simulate` – deterministic compliance + KPIs
- POST `/optimize` – simple grid search over floors/plate
- POST `/cost/estimate` – cost table using a unit cost library

Samples:
- `api/samples/jakarta_demo.json` – example Scenario payload
- `api/samples/cost_library_idr.json` – simple unit cost library (IDR)

Example (cost estimate):

```
curl -X POST http://localhost:8000/cost/estimate \
  -H 'content-type: application/json' \
  -d '{
    "scenario": '"$(cat api/samples/jakarta_demo.json)"',
    "library": '"$(cat api/samples/cost_library_idr.json)"'
  }'
```
