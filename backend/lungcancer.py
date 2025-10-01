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