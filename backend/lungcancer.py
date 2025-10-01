# lungcancer.py
"""
Train a calibrated XGBoost lung-cancer model with explicit binary encodings.

Artifacts saved next to this file:
- scaler.pkl  : StandardScaler fitted on numeric columns (age, pack_years)
- model.pkl   : CalibratedClassifierCV(XGBClassifier, method="isotonic")
- meta.json   : training prevalence, feature order, binary meanings, versions

Usage:
  python lungcancer.py
Optionally set a CSV via env:
  Windows: set LUNG_CANCER_CSV=E:\path\lung_cancer_dataset.csv
  macOS/Linux: export LUNG_CANCER_CSV=/path/to/lung_cancer_dataset.csv
"""

import os, json, warnings
warnings.filterwarnings("ignore", category=UserWarning)

import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, average_precision_score, brier_score_loss,
    precision_recall_curve
)
from xgboost import XGBClassifier
import sklearn, xgboost

# ----- Paths -----
BASE_DIR = os.path.dirname(__file__)
CSV_PATH = os.getenv(
    "LUNG_CANCER_CSV",
    r"E:/3rd_YR_2nd_SEM/FDM/mini-project/LungCancer_predication/lung_cancer_dataset.csv"
)
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")
MODEL_PATH  = os.path.join(BASE_DIR, "model.pkl")
META_PATH   = os.path.join(BASE_DIR, "meta.json")

# ----- Columns (and explicit binary meanings) -----
NUMERIC_COLS = ["age", "pack_years"]
BINARY_COLS  = [
    "gender",
    "radon_exposure",
    "asbestos_exposure",
    "secondhand_smoke_exposure",
    "copd_diagnosis",
    "alcohol_consumption",
    "family_history",
]
TARGET = "lung_cancer"

# 0/1 meanings that we want to enforce across train + serve
BINARY_MEANING = {
    "gender": "0=female, 1=male",
    "radon_exposure": "0=no, 1=yes",
    "asbestos_exposure": "0=no, 1=yes",
    "secondhand_smoke_exposure": "0=no, 1=yes",
    "copd_diagnosis": "0=no, 1=yes",
    "alcohol_consumption": "0=no, 1=yes",
    "family_history": "0=no, 1=yes",
}

def _parse_bin(val):
    """Coerce common yes/no forms to 0/1. Unknown → 0."""
    if val is None:
        return 0
    s = str(val).strip().lower()
    if s in {"1","y","yes","true","t"}:
        return 1
    if s in {"0","n","no","false","f"}:
        return 0
    # numeric?
    try:
        f = float(s)
        return 1 if f >= 0.5 else 0
    except:
        return 0