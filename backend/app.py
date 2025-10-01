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
from typing import Optional, Any
import os
import json
import joblib
import pandas as pd
from fastapi import FastAPI, Query
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = os.path.dirname(__file__)
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
META_PATH = os.path.join(BASE_DIR, "meta.json")

missing = [p for p in [SCALER_PATH, MODEL_PATH] if not os.path.exists(p)]
if missing:
    raise FileNotFoundError(
        f"Missing artifacts: {', '.join(os.path.basename(p) for p in missing)}")

# Load artifacts
scaler = joblib.load(SCALER_PATH)
model = joblib.load(MODEL_PATH)

# Load meta (feature order + priors)
meta = {}
if os.path.exists(META_PATH):
    with open(META_PATH, "r") as f:
        meta = json.load(f)

FEATURE_ORDER = meta.get("feature_order", [
    "age", "pack_years", "gender", "radon_exposure", "asbestos_exposure",
    "secondhand_smoke_exposure", "copd_diagnosis", "alcohol_consumption", "family_history"
])
NUMERIC_COLS = meta.get("numeric_cols", ["age", "pack_years"])
PI_TRAIN = float(meta.get("pi_train")) if "pi_train" in meta else None

# Allow env overrides
_env_pi_train = os.getenv("PI_TRAIN", "")
if _env_pi_train:
    try:
        PI_TRAIN = float(_env_pi_train)
    except:
        pass

PI_DEPLOY = os.getenv("PI_DEPLOY", "")
try:
    PI_DEPLOY = float(PI_DEPLOY) if PI_DEPLOY else None
except:
    PI_DEPLOY = None

# --- helpers ---


def _clip01(x: float, eps: float = 1e-12) -> float:
    return max(min(float(x), 1.0 - eps), eps)


def _to_percent(p: Optional[float]) -> Optional[float]:
    if p is None:
        return None
    p = max(min(p, 0.9999), 0.0)
    return round(p * 100.0, 2)


def prior_adjust(p: float, pi_train: float, pi_deploy: float) -> float:
    p = _clip01(p)
    if not (0.0 < pi_train < 1.0 and 0.0 < pi_deploy < 1.0):
        return p
    odds = p / (1.0 - p)
    base = (pi_deploy / (1.0 - pi_deploy)) / (pi_train / (1.0 - pi_train))
    return _clip01((odds * base) / (1.0 + (odds * base)))


def parse_bin(val: Any) -> int:
    """Accept yes/no/true/false/1/0 in any case, numbers or strings."""
    if val is None:
        return 0
    if isinstance(val, bool):
        return 1 if val else 0
    s = str(val).strip().lower()
    if s in {"1", "y", "yes", "true", "t"}:
        return 1
    if s in {"0", "n", "no", "false", "f"}:
        return 0
    try:
        f = float(s)
        return 1 if f >= 0.5 else 0
    except:
        return 0


def parse_float(val: Any, default: float = 0.0) -> float:
    try:
        return float(val)
    except:
        return default


# --- API ---
app = FastAPI(title="Lung Cancer Risk API (Calibrated XGBoost)", version="2.2")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


class PatientInput(BaseModel):
    # accept Any and parse ourselves to allow yes/no strings OR 0/1 OR booleans
    age: Any
    pack_years: Any
    gender: Any
    radon_exposure: Any
    asbestos_exposure: Any
    secondhand_smoke_exposure: Any
    copd_diagnosis: Any
    alcohol_consumption: Any
    family_history: Any


@app.post("/predict")
def predict_risk(
    p: PatientInput,
    pi_deploy: Optional[float] = Query(
        default=None, description="Override deployment prevalence (0..1), e.g., 0.002 for 0.2%"
    ),
):
    # 1) parse inputs
    features_raw = {
        "age": parse_float(p.age, 0.0),
        "pack_years": parse_float(p.pack_years, 0.0),
        "gender": parse_bin(p.gender),
        "radon_exposure": parse_bin(p.radon_exposure),
        "asbestos_exposure": parse_bin(p.asbestos_exposure),
        "secondhand_smoke_exposure": parse_bin(p.secondhand_smoke_exposure),
        "copd_diagnosis": parse_bin(p.copd_diagnosis),
        "alcohol_consumption": parse_bin(p.alcohol_consumption),
        "family_history": parse_bin(p.family_history),
    }

    # 2) scale numerics with the saved scaler
    numeric_df = pd.DataFrame(
        [[features_raw["age"], features_raw["pack_years"]]], columns=NUMERIC_COLS)
    numeric_scaled = scaler.transform(numeric_df)
    features_scaled = features_raw.copy()
    features_scaled["age"] = float(
        numeric_scaled[0, NUMERIC_COLS.index("age")])
    features_scaled["pack_years"] = float(
        numeric_scaled[0, NUMERIC_COLS.index("pack_years")])

    # 3) vector in training order
    x_df = pd.DataFrame([features_scaled])[FEATURE_ORDER]

    # 4) predict (raw, trained prior)
    p_raw = _clip01(float(model.predict_proba(x_df)[0, 1]))

    # 5) adjust to deployment prior (query param overrides env)
    use_pi_deploy = pi_deploy if (pi_deploy is not None) else PI_DEPLOY
    used_adjustment = (PI_TRAIN is not None) and (
        use_pi_deploy is not None) and (0.0 < use_pi_deploy < 1.0)
    p_adj = prior_adjust(
        p_raw, PI_TRAIN, use_pi_deploy) if used_adjustment else None
    p_main = p_adj if used_adjustment else p_raw

    model_name = getattr(getattr(model, "estimator", model),
                         "__class__", type(model)).__name__
    return {
        "model": model_name,
        "risk_percentage": _to_percent(p_main),
        "raw_risk_percentage": _to_percent(p_raw),
        "adjusted_risk_percentage": _to_percent(p_adj) if p_adj is not None else None,
        "adjusted_for_prevalence": used_adjustment,
        "pi_train": PI_TRAIN,
        "pi_deploy": use_pi_deploy,
        "inputs_used": features_raw,  # pre-scale, human-readable
    }


@app.get("/")
def root():
    return {"status": "ok", "message": "Use POST /predict with PatientInput JSON"}


@app.get("/model-info")
@app.get("/model_info")
def model_info():
    model_name = getattr(getattr(model, "estimator", model),
                         "__class__", type(model)).__name__
    return {
        "feature_order": FEATURE_ORDER,
        "numeric_cols": NUMERIC_COLS,
        "binary_meaning": meta.get("binary_meaning"),
        "pi_train": PI_TRAIN,
        "pi_deploy": PI_DEPLOY,
        "notes": "Server parses yes/no/true/false/1/0; standardizes age & pack_years; others are 0/1 ints.",
        "model_class": model_name,
        "calibration_method": meta.get("calibration_method", "isotonic"),
        "model_family": meta.get("model_family", "XGBoost"),
    }
