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