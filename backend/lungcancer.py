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

def load_dataframe():
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"CSV not found at: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)

     # Drop identifiers if present
    for col in ["patient_id", "id", "uuid"]:
        if col in df.columns:
            df = df.drop(columns=[col])

    # Coerce binary columns explicitly
    for c in BINARY_COLS + [TARGET]:
        if c in df.columns:
            df[c] = df[c].apply(_parse_bin).astype(int)
        else:
            raise ValueError(f"Expected column missing in CSV: {c}")

    # Coerce numeric
    for c in NUMERIC_COLS:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0).astype(float)
        else:
            raise ValueError(f"Expected numeric column missing: {c}")

    # Final column order for X
    feature_order = NUMERIC_COLS + BINARY_COLS
    X = df[feature_order].copy()
    y = df[TARGET].astype(int).copy()
    return X, y, feature_order
    
def split_and_scale(X, y):
    Xtr, Xte, ytr, yte = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    scaler = StandardScaler()
    Xtr.loc[:, NUMERIC_COLS] = scaler.fit_transform(Xtr[NUMERIC_COLS].astype(float))
    Xte.loc[:, NUMERIC_COLS] = scaler.transform(Xte[NUMERIC_COLS].astype(float))
    return Xtr, Xte, ytr, yte, scaler

def train_calibrated_xgb(Xtr, ytr):
    # handle imbalance
    pos = int(ytr.sum())
    neg = int(len(ytr) - pos)
    spw = (neg / max(pos,1)) if pos else 1.0

    xgb = XGBClassifier(
        n_estimators=600,
        learning_rate=0.05,
        max_depth=4,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        objective="binary:logistic",
        eval_metric="logloss",
        n_jobs=-1,
        random_state=42,
        scale_pos_weight=spw,
        # (optional) add monotone constraints if you want strictly increasing on key risks
        # monotone_constraints="(1,1,0,1,1,1,1,1,1)",
    )
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    clf = CalibratedClassifierCV(estimator=xgb, method="isotonic", cv=skf)
    clf.fit(Xtr, ytr)
    return clf

