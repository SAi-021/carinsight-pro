"""
=============================================================
  CarInsight Pro — Run ML Pipeline
  File   : run_training.py  (project root)

  USAGE
  ─────
  First time (or when dataset changes):
    python run_training.py

  Just regenerate charts (FAST — skips all training):
    python run_training.py --charts-only

  Only retrain without charts:
    python run_training.py --train-only
=============================================================
"""

import sys
import os
import argparse

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR   = os.path.join(ROOT_DIR, 'ml')
sys.path.insert(0, ML_DIR)
sys.path.insert(0, ROOT_DIR)

from evaluation import run_full_evaluation

def main():
    parser = argparse.ArgumentParser(description='CarInsight Pro ML Pipeline')
    parser.add_argument('--charts-only', action='store_true',
                        help='Only regenerate charts, skip training (FAST)')
    parser.add_argument('--train-only',  action='store_true',
                        help='Only train models, skip chart generation')
    args = parser.parse_args()

    if args.charts_only:
        # ── FAST MODE: just regenerate charts from saved models ───────────────
        print("\n📊 Charts-only mode — loading saved models...\n")
        run_full_evaluation(retrain=False)
        print("\n✅ Charts regenerated in reports/ (no retraining done)")
        return

    # ── FULL TRAIN ────────────────────────────────────────────────────────────
    from model_training import train_all
    print("\n🚀 Starting CarInsight Pro ML Training Pipeline...\n")
    print("   ⏱  This takes 5–10 minutes. Run with --charts-only next time.\n")

    results, trained_models, best_model_name, feature_cols = train_all()

    if not args.train_only:
        print("\n📊 Generating evaluation charts...\n")
        run_full_evaluation(retrain=False)   # uses saved test_split.pkl

    print("\n✅ Pipeline complete!")
    print("   models/best_model.pkl       ← loaded by FastAPI backend")
    print("   models/test_split.pkl       ← used by --charts-only")
    print("   reports/model_comparison.png")
    print("   reports/actual_vs_predicted.png")
    print("   reports/feature_importance.png")
    print("   reports/model_comparison_table.csv")
    print("\n💡 Next time you only need charts:")
    print("   python run_training.py --charts-only")
    print("\n➡️  Next step: build the FastAPI backend")

if __name__ == '__main__':
    main()
