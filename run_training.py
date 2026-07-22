"""
=============================================================
  CarInsight Pro — Run ML Pipeline
  File   : run_training.py  (place in project ROOT folder)
  Usage  : python run_training.py
=============================================================
"""

import sys
import os

# ── FIX: Add ml/ folder to Python path so imports work ───────────────────────
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))   # CarInsightPro/
ML_DIR   = os.path.join(ROOT_DIR, 'ml')                 # CarInsightPro/ml/

sys.path.insert(0, ML_DIR)    # so  'from model_training import ...'  works
sys.path.insert(0, ROOT_DIR)  # so  cross-imports inside ml/ also work

# ── Now safe to import ────────────────────────────────────────────────────────
from model_training import train_all
from evaluation     import run_full_evaluation

if __name__ == '__main__':
    print("\n Starting CarInsight Pro ML Training Pipeline...\n")

    results, trained_models, best_model_name, feature_cols = train_all()

    print("\n Running Evaluation & Generating Charts...\n")
    df_table = run_full_evaluation()

    print("\n Pipeline complete! Files saved:")
    print("   models/best_model.pkl")
    print("   models/scaler.pkl")
    print("   models/le_brand.pkl")
    print("   models/all_models.pkl")
    print("   models/metadata.json")
    print("   reports/model_comparison.png")
    print("   reports/actual_vs_predicted.png")
    print("   reports/feature_importance.png")
    print("   reports/model_comparison_table.csv")
  #  print("\n  Next step: build the FastAPI backend")
