"""
Model training pipeline.

Trains five regressors (Linear Regression, Random Forest, Gradient Boosting,
XGBoost, LightGBM), tuning the tree models with RandomizedSearchCV. For each
model it computes regression metrics (MAE, RMSE, R², MAPE, CV R²), price-tier
classification metrics (accuracy, precision, recall, F1, confusion matrix),
and overfitting/underfitting diagnostics, then saves plots and the best model.

Best model = highest test R²; ties (within 0.5% R²) break to the lowest CV
R² standard deviation, i.e. the most stable model.
"""

import os
import sys
import json
import joblib
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from sklearn.model_selection import (
    train_test_split, RandomizedSearchCV,
    cross_val_score, learning_curve
)
from sklearn.linear_model    import LinearRegression
from sklearn.ensemble        import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing   import StandardScaler
from sklearn.metrics         import (
    mean_absolute_error, mean_squared_error, r2_score,
    mean_absolute_percentage_error,
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix,
)

warnings.filterwarnings('ignore')

try:
    from xgboost import XGBRegressor
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("[WARN] XGBoost not installed.  pip install xgboost")

try:
    from lightgbm import LGBMRegressor
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    print("[WARN] LightGBM not installed.  pip install lightgbm")

ML_DIR   = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(ML_DIR)
for p in [ML_DIR, ROOT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

from data_preprocessing import preprocess_pipeline

MODEL_DIR   = os.path.join(ROOT_DIR, 'models')
REPORTS_DIR = os.path.join(ROOT_DIR, 'reports')
DATA_PATH   = os.path.join(ROOT_DIR, 'data', 'final_dataset.csv')
CARS_PATH   = os.path.join(ROOT_DIR, 'data', 'cars.csv')
os.makedirs(MODEL_DIR,   exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

# Price tiers used for the classification-style metrics.
TIER_EDGES  = [0, 500_000, 1_000_000, 2_000_000, 5_000_000, float('inf')]
TIER_LABELS = ['Budget (<5L)', 'Mid (5-10L)', 'Premium (10-20L)',
               'Luxury (20-50L)', 'Ultra (>50L)']

def to_tier(prices):
    return pd.cut(prices, bins=TIER_EDGES, labels=False,
                  include_lowest=True).astype(int)


# Hyperparameter search spaces for the tuned models.
RF_PARAMS = {
    'n_estimators'     : [200, 300, 500],
    'max_depth'        : [None, 15, 25, 35],
    'min_samples_split': [2, 4, 6],
    'min_samples_leaf' : [1, 2, 3],
    'max_features'     : ['sqrt', 'log2'],
}
GBR_PARAMS = {
    'n_estimators'    : [200, 300, 400],
    'learning_rate'   : [0.03, 0.05, 0.1],
    'max_depth'       : [4, 5, 6, 7],
    'subsample'       : [0.7, 0.8, 0.9],
    'min_samples_leaf': [1, 2, 3],
}
XGB_PARAMS = {
    'n_estimators'    : [200, 300, 400],
    'learning_rate'   : [0.03, 0.05, 0.1],
    'max_depth'       : [4, 5, 6, 7],
    'subsample'       : [0.7, 0.8, 0.9],
    'colsample_bytree': [0.7, 0.8, 1.0],
    'reg_alpha'       : [0, 0.1, 0.5, 1.0],
    'reg_lambda'      : [1, 1.5, 2, 3],
    'min_child_weight': [1, 3, 5],
}
LGBM_PARAMS = {
    'n_estimators'     : [200, 300, 400],
    'learning_rate'    : [0.03, 0.05, 0.1],
    'num_leaves'       : [31, 63, 127],
    'max_depth'        : [-1, 6, 8, 10],
    'min_child_samples': [10, 20, 30],
    'subsample'        : [0.7, 0.8, 0.9],
    'colsample_bytree' : [0.7, 0.8, 1.0],
    'reg_alpha'        : [0, 0.1, 0.5],
    'reg_lambda'       : [0, 0.1, 0.5],
}


def build_models():
    # Returns {name: (model, param_dist, needs_scaling)}.
    models = {
        'Linear Regression': (LinearRegression(), None, True),
        'Random Forest'    : (RandomForestRegressor(random_state=42, n_jobs=-1),
                              RF_PARAMS, False),
        'Gradient Boosting': (GradientBoostingRegressor(random_state=42),
                              GBR_PARAMS, False),
    }
    if XGBOOST_AVAILABLE:
        models['XGBoost'] = (
            XGBRegressor(random_state=42, n_jobs=-1,
                         eval_metric='rmse', verbosity=0),
            XGB_PARAMS, False
        )
    if LIGHTGBM_AVAILABLE:
        models['LightGBM'] = (
            LGBMRegressor(random_state=42, n_jobs=-1, verbosity=-1),
            LGBM_PARAMS, False
        )
    return models


def tune_and_train(name, model, param_dist, X_train, y_train, n_iter=25, cv=5):
    if param_dist:
        print(f"  [TUNE] {name} — RandomizedSearchCV (n_iter={n_iter}, cv={cv})")
        search = RandomizedSearchCV(
            model, param_distributions=param_dist,
            n_iter=n_iter, cv=cv, scoring='r2',
            n_jobs=-1, random_state=42, verbose=0
        )
        search.fit(X_train, y_train)
        print(f"         Best params: {search.best_params_}")
        return search.best_estimator_
    else:
        print(f"  [FIT ] {name}")
        model.fit(X_train, y_train)
        return model


def compute_all_metrics(name, model, X_train, X_test, y_train, y_test,
                        scaler=None, cv=5):
    if scaler is not None:
        X_test_t  = scaler.transform(X_test)
        X_train_t = scaler.transform(X_train)
        X_cv = X_train_t
    else:
        X_test_t  = X_test
        X_train_t = X_train
        X_cv = X_train

    y_pred_test  = np.clip(model.predict(X_test_t),  0, None)
    y_pred_train = np.clip(model.predict(X_train_t), 0, None)

    # Regression metrics
    mae   = mean_absolute_error(y_test, y_pred_test)
    mse   = mean_squared_error(y_test, y_pred_test)
    rmse  = np.sqrt(mse)
    r2    = r2_score(y_test, y_pred_test)
    r2_tr = r2_score(y_train, y_pred_train)
    mape  = mean_absolute_percentage_error(y_test, y_pred_test) * 100
    cv_scores = cross_val_score(model, X_cv, y_train, cv=cv,
                                scoring='r2', n_jobs=-1)

    # Classification metrics on the price tier
    y_test_tier = to_tier(pd.Series(y_test).reset_index(drop=True))
    y_pred_tier = to_tier(pd.Series(y_pred_test).reset_index(drop=True))

    accuracy  = accuracy_score(y_test_tier, y_pred_tier)
    precision = precision_score(y_test_tier, y_pred_tier,
                                average='macro', zero_division=0)
    recall    = recall_score(y_test_tier, y_pred_tier,
                             average='macro', zero_division=0)
    f1        = f1_score(y_test_tier, y_pred_tier,
                         average='macro', zero_division=0)
    cm        = confusion_matrix(y_test_tier, y_pred_tier,
                                 labels=list(range(len(TIER_LABELS))))

    per_class = {}
    for tier_idx, tier_name in enumerate(TIER_LABELS):
        p = precision_score(y_test_tier, y_pred_tier, labels=[tier_idx],
                            average='macro', zero_division=0)
        r = recall_score(y_test_tier, y_pred_tier, labels=[tier_idx],
                         average='macro', zero_division=0)
        f = f1_score(y_test_tier, y_pred_tier, labels=[tier_idx],
                     average='macro', zero_division=0)
        per_class[tier_name] = {
            'precision': round(p, 4), 'recall': round(r, 4),
            'f1': round(f, 4),
            'support': int((y_test_tier == tier_idx).sum()),
        }

    # Overfitting / underfitting diagnostics
    overfit_gap     = r2_tr - r2
    is_overfitting  = overfit_gap > 0.10
    is_underfitting = r2_tr < 0.85 and name != 'Linear Regression'

    metrics = {
        'MAE': round(mae, 2), 'MSE': round(mse, 2), 'RMSE': round(rmse, 2),
        'R2': round(r2, 4), 'R2_train': round(r2_tr, 4),
        'MAPE': round(mape, 2),
        'CV_R2_mean': round(cv_scores.mean(), 4),
        'CV_R2_std' : round(cv_scores.std(),  4),
        'accuracy': round(accuracy, 4),
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1': round(f1, 4),
        'confusion_matrix': cm.tolist(),
        'per_class': per_class,
        'overfit_gap': round(overfit_gap, 4),
        'is_overfitting': bool(is_overfitting),
        'is_underfitting': bool(is_underfitting),
        'tier_labels': TIER_LABELS,
    }

    print(f"\n  {'='*60}")
    print(f"  {name}")
    print(f"  {'='*60}")
    print(f"  REGRESSION")
    print(f"  {'-'*60}")
    print(f"  {'MAE':<18} ₹{mae:>14,.0f}")
    print(f"  {'MSE':<18}  {mse:>15,.0f}")
    print(f"  {'RMSE':<18} ₹{rmse:>14,.0f}")
    print(f"  {'MAPE':<18}  {mape:>14.2f}%")
    print(f"  {'R² (test)':<18}  {r2:>14.4f}")
    print(f"  {'R² (train)':<18}  {r2_tr:>14.4f}")
    print(f"  {'CV R² mean':<18}  {cv_scores.mean():>14.4f}")
    print(f"  {'CV R² std':<18}  {cv_scores.std():>14.4f}")
    print(f"\n  CLASSIFICATION (price tier, 5 buckets)")
    print(f"  {'-'*60}")
    print(f"  {'Accuracy':<18}  {accuracy:>14.4f}  ({accuracy*100:.1f}% in correct tier)")
    print(f"  {'Precision (macro)':<18}  {precision:>14.4f}")
    print(f"  {'Recall (macro)':<18}  {recall:>14.4f}")
    print(f"  {'F1 (macro)':<18}  {f1:>14.4f}")
    print(f"\n  DIAGNOSTICS")
    print(f"  {'-'*60}")
    if is_overfitting:
        print(f"  OVERFITTING — train {r2_tr:.3f} vs test {r2:.3f} (gap {overfit_gap:.3f})")
        print(f"      -> Reduce max_depth, increase min_samples_leaf or regularisation")
    elif is_underfitting:
        print(f"  UNDERFITTING — train R² only {r2_tr:.3f}")
        print(f"      -> More estimators, deeper max_depth, lower learning_rate")
    else:
        print(f"  Healthy: gap {overfit_gap:.3f} between train and test")
    print(f"  {'='*60}")

    return metrics, y_pred_test


# Dark theme used for the diagnostic plots (matches the app's UI).
DARK = {
    'bg': '#0d1017', 'bg2': '#131720', 'gold': '#f0a500',
    'text': '#e8eaf0', 'text2': '#8892a4', 'text3': '#4d5668',
    'border': '#1e2433', 'green': '#22c55e', 'blue': '#3b82f6',
    'red': '#ef4444', 'purple': '#a855f7',
}

def _style(ax):
    ax.set_facecolor(DARK['bg2'])
    for s in ax.spines.values(): s.set_color(DARK['border'])
    ax.tick_params(colors=DARK['text2'], which='both')
    ax.xaxis.label.set_color(DARK['text'])
    ax.yaxis.label.set_color(DARK['text'])
    ax.title.set_color(DARK['text'])
    ax.grid(True, color=DARK['border'], linestyle='--', alpha=0.4)


def plot_learning_curve(name, model, X, y, scaler=None, path=None):
    X_t = scaler.transform(X) if scaler is not None else X
    try:
        sizes, tr, val = learning_curve(
            model, X_t, y, cv=5, scoring='r2',
            train_sizes=np.linspace(0.1, 1.0, 8),
            n_jobs=-1, random_state=42
        )
    except Exception as e:
        print(f"  [WARN] Learning curve failed for {name}: {e}")
        return None

    tr_m, tr_s = tr.mean(axis=1), tr.std(axis=1)
    vl_m, vl_s = val.mean(axis=1), val.std(axis=1)

    fig, ax = plt.subplots(figsize=(8, 5), facecolor=DARK['bg'])
    ax.plot(sizes, tr_m, color=DARK['gold'], lw=2, marker='o', label='Training R²')
    ax.fill_between(sizes, tr_m-tr_s, tr_m+tr_s, alpha=0.15, color=DARK['gold'])
    ax.plot(sizes, vl_m, color=DARK['blue'], lw=2, marker='s', label='Cross-val R²')
    ax.fill_between(sizes, vl_m-vl_s, vl_m+vl_s, alpha=0.15, color=DARK['blue'])
    ax.set_xlabel('Training set size')
    ax.set_ylabel('R² score')
    ax.set_title(f'Learning Curve — {name}', pad=14)
    ax.legend(loc='lower right', facecolor=DARK['bg2'],
              edgecolor=DARK['border'], labelcolor=DARK['text'])
    ax.set_ylim(min(0, vl_m.min() - 0.05), 1.02)
    _style(ax)
    plt.tight_layout()
    plt.savefig(path, dpi=110, facecolor=DARK['bg'])
    plt.close()
    return {'sizes': sizes.tolist(),
            'train_mean': tr_m.tolist(), 'val_mean': vl_m.tolist(),
            'train_std' : tr_s.tolist(), 'val_std' : vl_s.tolist()}


def plot_predicted_vs_actual(name, y_test, y_pred, path):
    fig, ax = plt.subplots(figsize=(8, 6), facecolor=DARK['bg'])
    ax.scatter(y_test / 1e5, y_pred / 1e5, alpha=0.35, s=14,
               color=DARK['gold'], edgecolors='none')
    lim = max(y_test.max(), y_pred.max()) / 1e5
    ax.plot([0, lim], [0, lim], color=DARK['blue'], lw=1.4,
            linestyle='--', label='Perfect prediction')
    ax.set_xlabel('Actual price (Lakh ₹)')
    ax.set_ylabel('Predicted price (Lakh ₹)')
    ax.set_title(f'Predicted vs Actual — {name}', pad=14)
    ax.set_xscale('log'); ax.set_yscale('log')
    ax.set_xlim(0.2, lim * 1.1); ax.set_ylim(0.2, lim * 1.1)
    ax.legend(loc='upper left', facecolor=DARK['bg2'],
              edgecolor=DARK['border'], labelcolor=DARK['text'])
    _style(ax)
    plt.tight_layout()
    plt.savefig(path, dpi=110, facecolor=DARK['bg'])
    plt.close()


def plot_confusion_matrix(name, cm, path):
    fig, ax = plt.subplots(figsize=(7, 6), facecolor=DARK['bg'])
    cm_norm = cm.astype('float') / cm.sum(axis=1, keepdims=True).clip(min=1)
    ax.imshow(cm_norm, cmap='YlOrBr', vmin=0, vmax=1)
    for i in range(len(TIER_LABELS)):
        for j in range(len(TIER_LABELS)):
            n   = cm[i, j]
            pct = cm_norm[i, j] * 100
            color = '#000' if cm_norm[i, j] > 0.45 else DARK['text']
            ax.text(j, i, f"{n}\n{pct:.0f}%", ha='center', va='center',
                    fontsize=9, color=color, fontweight='600')
    ax.set_xticks(range(len(TIER_LABELS)))
    ax.set_yticks(range(len(TIER_LABELS)))
    ax.set_xticklabels(TIER_LABELS, rotation=35, ha='right')
    ax.set_yticklabels(TIER_LABELS)
    ax.set_xlabel('Predicted tier')
    ax.set_ylabel('Actual tier')
    ax.set_title(f'Confusion Matrix — {name}', pad=14)
    _style(ax)
    plt.tight_layout()
    plt.savefig(path, dpi=110, facecolor=DARK['bg'])
    plt.close()


def select_best_model(results, tie_threshold=0.005):
    # Highest test R² wins; near-ties break to the most stable model (lowest CV std).
    sorted_models = sorted(results.items(),
                          key=lambda kv: kv[1]['R2'], reverse=True)
    top_r2 = sorted_models[0][1]['R2']
    contenders = [(n, m) for n, m in sorted_models
                  if top_r2 - m['R2'] <= tie_threshold]
    if len(contenders) == 1:
        return contenders[0][0]
    print(f"\n  [TIE-BREAK] {len(contenders)} models within {tie_threshold*100:.1f}% of leader:")
    for n, m in contenders:
        print(f"    - {n:25s} R²={m['R2']:.4f}  CV std={m['CV_R2_std']:.4f}")
    contenders.sort(key=lambda kv: kv[1]['CV_R2_std'])
    winner = contenders[0][0]
    print(f"  [TIE-BREAK] Picked '{winner}' — lowest CV R² std (most stable)")
    return winner


def train_all(data_path=DATA_PATH, cars_path=CARS_PATH):
    print("=" * 60)
    print("  CarInsight Pro — ML Training")
    print("  5 models · regression + classification metrics · diagnostics")
    print("=" * 60)

    X, y, df_clean, le_brand, feature_cols = preprocess_pipeline(
        data_path, cars_path, augment=True
    )

    # Save a model_price_score lookup for the predictor to reuse at inference.
    raw_df = pd.read_csv(data_path)
    raw_df.columns = raw_df.columns.str.lower().str.strip()
    if 'brand_model' in raw_df.columns and 'selling_price' in raw_df.columns:
        medians = raw_df.groupby('brand_model')['selling_price'].median()
        mn, mx = medians.min(), medians.max()
        lookup = {k: round((v - mn) / (mx - mn + 1), 4)
                  for k, v in medians.items()}
        with open(os.path.join(MODEL_DIR, 'model_price_lookup.json'), 'w') as f:
            json.dump(lookup, f, indent=2)
        print(f"[SAVED] model_price_lookup.json ({len(lookup)} models)")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"\n[INFO] Train: {len(X_train)} | Test: {len(X_test)}")
    print(f"[INFO] Features: {len(feature_cols)}")
    print(f"[INFO] Price range: ₹{int(y.min()):,} – ₹{int(y.max()):,}")

    scaler = StandardScaler()
    scaler.fit(X_train)

    model_defs = build_models()
    results = {}
    trained_models = {}
    feature_importance = {}
    learning_curves = {}

    print(f"\n[TRAINING {len(model_defs)} MODELS]")
    print("=" * 60)

    for name, (base_model, param_dist, needs_scaling) in model_defs.items():
        X_tr_used = scaler.transform(X_train) if needs_scaling else X_train
        fitted = tune_and_train(name, base_model, param_dist, X_tr_used, y_train)

        metrics, y_pred = compute_all_metrics(
            name, fitted, X_train, X_test, y_train, y_test,
            scaler=scaler if needs_scaling else None
        )
        results[name] = metrics
        trained_models[name] = (fitted, scaler if needs_scaling else None)

        safe_name = name.lower().replace(' ', '_')

        plot_predicted_vs_actual(
            name, np.array(y_test), np.array(y_pred),
            os.path.join(REPORTS_DIR, f'pred_vs_actual_{safe_name}.png')
        )
        plot_confusion_matrix(
            name, np.array(metrics['confusion_matrix']),
            os.path.join(REPORTS_DIR, f'confusion_matrix_{safe_name}.png')
        )
        print(f"  [PLOT] Learning curve for {name} ...")
        lc = plot_learning_curve(
            name, fitted, X_train, y_train,
            scaler=scaler if needs_scaling else None,
            path=os.path.join(REPORTS_DIR, f'learning_curve_{safe_name}.png')
        )
        if lc is not None:
            learning_curves[name] = lc

        if hasattr(fitted, 'feature_importances_'):
            importances = fitted.feature_importances_
            feature_importance[name] = sorted(
                [{'feature': f, 'importance': float(imp)}
                 for f, imp in zip(feature_cols, importances)],
                key=lambda d: d['importance'], reverse=True
            )

    print(f"\n{'=' * 60}")
    print("[MODEL SELECTION]")
    print("=" * 60)
    best_model_name = select_best_model(results, tie_threshold=0.005)

    print(f"\n[LEADERBOARD]")
    print(f"  {'Rank':<6}{'Model':<22}{'R²':<10}{'Accuracy':<11}{'F1':<10}{'CV std':<10}")
    print(f"  {'-'*68}")
    sorted_models = sorted(results.items(), key=lambda kv: kv[1]['R2'], reverse=True)
    for i, (name, m) in enumerate(sorted_models, 1):
        marker = ">>" if name == best_model_name else "  "
        print(f"  {marker} {i:<3}  {name:<22}{m['R2']:<10.4f}"
              f"{m['accuracy']:<11.4f}{m['f1']:<10.4f}{m['CV_R2_std']:<10.4f}")

    print(f"\n{'=' * 60}")
    print(f"  BEST MODEL : {best_model_name}")
    print(f"     R²       = {results[best_model_name]['R2']}")
    print(f"     RMSE     = ₹{results[best_model_name]['RMSE']:,.0f}")
    print(f"     MAE      = ₹{results[best_model_name]['MAE']:,.0f}")
    print(f"     MAPE     = {results[best_model_name]['MAPE']:.2f}%")
    print(f"     Accuracy = {results[best_model_name]['accuracy']*100:.1f}% (correct tier)")
    print(f"     F1       = {results[best_model_name]['f1']:.4f}")
    print(f"{'=' * 60}")

    best_est, _ = trained_models[best_model_name]
    joblib.dump(best_est,       os.path.join(MODEL_DIR, 'best_model.pkl'))
    joblib.dump(scaler,         os.path.join(MODEL_DIR, 'scaler.pkl'))
    joblib.dump(le_brand,       os.path.join(MODEL_DIR, 'le_brand.pkl'))
    joblib.dump(trained_models, os.path.join(MODEL_DIR, 'all_models.pkl'))
    joblib.dump((X_test, y_test), os.path.join(MODEL_DIR, 'test_split.pkl'))

    metadata = {
        'best_model_name': best_model_name,
        'feature_cols'   : feature_cols,
        'tier_labels'    : TIER_LABELS,
        'tier_edges'     : [e if e != float('inf') else None for e in TIER_EDGES],
        'results'        : results,
        'needs_scaling'  : {n: (sc is not None)
                            for n, (_, sc) in trained_models.items()},
    }
    with open(os.path.join(MODEL_DIR, 'metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)

    diagnostics = {
        'best_model'         : best_model_name,
        'tier_labels'        : TIER_LABELS,
        'results'            : results,
        'feature_importance' : feature_importance,
        'learning_curves'    : learning_curves,
        'train_size'         : len(X_train),
        'test_size'          : len(X_test),
        'feature_count'      : len(feature_cols),
        'price_min'          : float(y.min()),
        'price_max'          : float(y.max()),
    }
    with open(os.path.join(REPORTS_DIR, 'diagnostics.json'), 'w') as f:
        json.dump(diagnostics, f, indent=2)

    print(f"\n[SAVED] Models      -> {MODEL_DIR}/")
    print(f"[SAVED] Diagnostics -> {REPORTS_DIR}/")
    print(f"        diagnostics.json")
    print(f"        learning_curve_*.png ({len(learning_curves)} files)")
    print(f"        pred_vs_actual_*.png ({len(model_defs)} files)")
    print(f"        confusion_matrix_*.png ({len(model_defs)} files)")

    return results, trained_models, best_model_name, feature_cols


if __name__ == '__main__':
    train_all()