# app.py
"""
FastAPI server:
- Accepts booleans as yes/no/true/false/1/0 (strings or numbers)
- Accepts age, pack_years as provided (no UI standardization)
- Encodes + standardizes server-side to match training
- Returns raw and (optionally) prevalence-adjusted probabilities

Run:
  uvicorn app:app --reload --port 8000
"""