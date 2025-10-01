# app.py (logistic regression only, correct numeric scaling + health/model-info)
import os
from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import joblib
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = os.path.dirname(__file__)
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")
LOGREG_PATH = os.path.join(BASE_DIR, "lung_logreg.pkl")

missing = [p for p in [SCALER_PATH, LOGREG_PATH] if not os.path.exists(p)]
if missing:
    missing_str = ", ".join(os.path.basename(p) for p in missing)
    raise FileNotFoundError(
        f"Missing model artifacts: {missing_str}. Run `python lungcancer.py` to train and save them in the same folder as app.py."
    )
