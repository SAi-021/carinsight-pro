"""
Evaluation and charts.

Builds the model-comparison table/CSV, a comparison bar chart, an
actual-vs-predicted scatter with a residuals histogram, and a feature-
importance chart. run_full_evaluation(retrain=False) reuses the saved
models and test split instead of retraining.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')          # non-interactive backend, no popup windows
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.ticker as mticker

ML_DIR   = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(ML_DIR)
for p in [ML_DIR, ROOT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

MODEL_DIR = os.path.join(ROOT_DIR, 'models')
PLOT_DIR  = os.path.join(ROOT_DIR, 'reports')
os.makedirs(PLOT_DIR, exist_ok=True)

MODEL_COLORS = {
    'Linear Regression'      : '#FF6B6B',
    'Random Forest'          : '#4ECDC4',
    'Gradient Boosting'      : '#FFA500',
    'XGBoost'                : '#4CAF50',
    'XGBoost (GBR fallback)' : '#4CAF50',
}
DEFAULT_COLOR = '#999999'

def get_color(name):
    return MODEL_COLORS.get(name, DEFAULT_COLOR)

def lakh_fmt(x, pos):
    return f'₹{x/1e5:.1f}L'


def load_metadata():
    path = os.path.join(MODEL_DIR, 'metadata.json')
    if not os.path.exists(path):
        raise FileNotFoundError("metadata.json not found. Run model_training.py first.")
    with open(path) as f:
        return json.load(f)


def print_comparison_table(results, best_model_name):
    rows = []
    for name, m in results.items():
        rows.append({
            'Model'        : name,
            'MAE (₹)'     : f"{m['MAE']:,.0f}",
            'MSE'          : f"{m['MSE']:,.0f}",
            'RMSE (₹)'    : f"{m['RMSE']:,.0f}",
            'R²'           : f"{m['R2']:.4f}",
            'CV R² (mean)' : f"{m['CV_R2_mean']:.4f}",
            'CV R² (std)'  : f"{m['CV_R2_std']:.4f}",
        })
    df = pd.DataFrame(rows)
    df['_sort'] = [results[r['Model']]['R2'] for _, r in df.iterrows()]
    df = df.sort_values('_sort', ascending=False).drop(columns='_sort')
    df.insert(0, 'Rank', range(1, len(df) + 1))

    print("\n" + "=" * 100)
    print("  MODEL COMPARISON TABLE  (all metrics)")
    print("=" * 100)
    print(df.to_string(index=False))
    print("=" * 100)
    print(f"  Best Model : {best_model_name}")
    print("=" * 100)
    return df


def plot_model_comparison(results, best_model_name, save_path=None):
    names  = list(results.keys())
    maes   = [results[n]['MAE']  for n in names]
    rmses  = [results[n]['RMSE'] for n in names]
    r2s    = [results[n]['R2']   for n in names]
    colors = [get_color(n) for n in names]
    short  = [n.replace('Gradient Boosting','Grad.Boost')
               .replace('Linear Regression','Linear Reg.')
               .replace('Random Forest','Rand.Forest') for n in names]

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    fig.suptitle('CarInsight Pro — Model Comparison', fontsize=15,
                 fontweight='bold')
    fig.patch.set_facecolor('#F8F9FA')

    for ax, vals, title, is_money in [
        (axes[0], maes,  'MAE ↓ (lower is better)',  True),
        (axes[1], rmses, 'RMSE ↓ (lower is better)', True),
        (axes[2], r2s,   'R² ↑ (higher is better)',  False),
    ]:
        bars = ax.bar(short, vals, color=colors, edgecolor='white',
                      linewidth=1, width=0.55)
        ax.set_title(title, fontsize=11, fontweight='bold', pad=8)
        ax.set_facecolor('#F8F9FA')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.tick_params(axis='x', rotation=12, labelsize=9)
        if is_money:
            ax.yaxis.set_major_formatter(mticker.FuncFormatter(lakh_fmt))
        else:
            ax.set_ylim(0, 1.10)

        for bar, val, nm in zip(bars, vals, names):
            star  = ' ★' if nm == best_model_name else ''
            label = f'₹{val/1e5:.2f}L{star}' if is_money else f'{val:.4f}{star}'
            ax.text(bar.get_x() + bar.get_width()/2,
                    bar.get_height() + max(vals)*0.015,
                    label, ha='center', va='bottom',
                    fontsize=8, fontweight='bold' if nm==best_model_name else 'normal')

    patches = [mpatches.Patch(color=get_color(n),
                label=f'{n} ★' if n==best_model_name else n) for n in names]
    fig.legend(handles=patches, loc='lower center', ncol=len(names),
               bbox_to_anchor=(0.5, -0.06), frameon=True, fontsize=9)

    plt.tight_layout(rect=[0, 0.04, 1, 1])
    path = save_path or os.path.join(PLOT_DIR, 'model_comparison.png')
    plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='#F8F9FA')
    plt.close()
    print(f"[SAVED] model_comparison.png -> {path}")


def plot_actual_vs_predicted(y_test, y_pred, model_name, save_path=None):
    # Left panel: actual vs predicted scatter with a perfect-fit line and ±20%
    # band. Right panel: residuals histogram centred on zero.
    residuals = y_test - y_pred
    r2   = 1 - np.sum(residuals**2) / np.sum((y_test - y_test.mean())**2)
    mae  = np.mean(np.abs(residuals))
    rmse = np.sqrt(np.mean(residuals**2))
    color = get_color(model_name)

    y_tL = y_test / 1e5
    y_pL = y_pred / 1e5
    res_L = residuals / 1e5

    # Equal axis range so the scatter is never cut off.
    all_vals = np.concatenate([y_tL, y_pL])
    axis_min = max(0, all_vals.min() - 0.5)
    axis_max = all_vals.max() + 1.0

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 7))
    fig.suptitle(f'Prediction Analysis — {model_name}',
                 fontsize=14, fontweight='bold', y=1.01)
    fig.patch.set_facecolor('#F8F9FA')

    ax1.set_facecolor('#F8F9FA')
    ax1.scatter(y_tL, y_pL, alpha=0.30, s=14, color=color,
                edgecolors='none', zorder=3, label='Predictions')

    ax1.plot([axis_min, axis_max], [axis_min, axis_max],
             color='#F44336', lw=2, linestyle='--',
             zorder=4, label='Perfect fit (y = x)')

    ax1.fill_between([axis_min, axis_max],
                     [axis_min*0.8, axis_max*0.8],
                     [axis_min*1.2, axis_max*1.2],
                     alpha=0.07, color='green', zorder=1, label='±20% band')

    ax1.set_xlim(axis_min, axis_max)
    ax1.set_ylim(axis_min, axis_max)
    ax1.set_aspect('equal', adjustable='box')

    ax1.set_xlabel('Actual Price (₹ Lakhs)', fontsize=11)
    ax1.set_ylabel('Predicted Price (₹ Lakhs)', fontsize=11)
    ax1.set_title('Actual vs Predicted', fontsize=12, fontweight='bold')

    ax1.legend(loc='upper left', fontsize=9, framealpha=0.9)

    stats = (f'R²   = {r2:.4f}\n'
             f'MAE  = ₹{mae/1e5:.2f}L\n'
             f'RMSE = ₹{rmse/1e5:.2f}L')
    ax1.text(0.97, 0.04, stats, transform=ax1.transAxes,
             fontsize=9.5, va='bottom', ha='right',
             bbox=dict(boxstyle='round,pad=0.5', facecolor='lightyellow',
                       edgecolor='#CCCCCC', alpha=0.95))

    ax1.spines['top'].set_visible(False)
    ax1.spines['right'].set_visible(False)

    ax2.set_facecolor('#F8F9FA')

    counts, bin_edges = np.histogram(res_L, bins=60)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    bar_width   = bin_edges[1] - bin_edges[0]

    ax2.bar(bin_centers, counts, width=bar_width * 0.92,
            color=color, edgecolor='white', linewidth=0.4,
            alpha=0.88, align='center')

    ax2.axvline(0, color='#F44336', lw=2, linestyle='--',
                label='Zero error', zorder=5)
    ax2.axvline(res_L.mean(), color='#222222', lw=1.5, linestyle=':',
                label=f'Mean = ₹{res_L.mean():.2f}L', zorder=5)

    ax2.set_xlabel('Residual  (Actual − Predicted,  ₹ Lakhs)', fontsize=11)
    ax2.set_ylabel('Frequency', fontsize=11)
    ax2.set_title('Residuals Distribution\n(Ideal = bell curve centred at 0)',
                  fontsize=11, fontweight='bold')
    ax2.set_ylim(bottom=0)

    ax2.legend(loc='upper right', fontsize=9, framealpha=0.9)

    res_stats = (f'Std  = ₹{res_L.std():.2f}L\n'
                 f'Skew = {pd.Series(res_L).skew():.2f}')
    ax2.text(0.03, 0.95, res_stats, transform=ax2.transAxes,
             fontsize=9, va='top', ha='left',
             bbox=dict(boxstyle='round,pad=0.5', facecolor='lightyellow',
                       edgecolor='#CCCCCC', alpha=0.95))

    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)

    plt.tight_layout()
    path = save_path or os.path.join(PLOT_DIR, 'actual_vs_predicted.png')
    plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='#F8F9FA')
    plt.close()
    print(f"[SAVED] actual_vs_predicted.png -> {path}")


def plot_feature_importance(model, feature_cols, model_name, save_path=None):
    # Horizontal bars sorted most-important first, with the score labelled to
    # the right of each bar and a light-to-dark alpha gradient.
    if not hasattr(model, 'feature_importances_'):
        print(f"[INFO] {model_name} — no feature importances. Skipping.")
        return

    imp  = model.feature_importances_
    idx  = np.argsort(imp)          # ascending, so barh puts the largest on top
    names_sorted  = [feature_cols[i] for i in idx]
    vals_sorted   = imp[idx]

    color = get_color(model_name)
    n     = len(vals_sorted)
    alphas = np.linspace(0.40, 1.0, n)

    fig, ax = plt.subplots(figsize=(11, max(6, n * 0.55)))
    fig.patch.set_facecolor('#F8F9FA')
    ax.set_facecolor('#F8F9FA')

    bars = ax.barh(names_sorted, vals_sorted,
                   color=color, edgecolor='white', linewidth=0.6,
                   height=0.65)

    for bar, alpha in zip(bars, alphas):
        bar.set_alpha(float(alpha))

    for bar, val in zip(bars, vals_sorted):
        ax.text(val + max(vals_sorted) * 0.012,
                bar.get_y() + bar.get_height() / 2,
                f'{val:.4f}',
                va='center', ha='left', fontsize=8.5)

    ax.set_xlabel('Importance Score', fontsize=11)
    ax.set_ylabel('Feature', fontsize=11)
    ax.set_title(f'Feature Importances — {model_name}',
                 fontsize=13, fontweight='bold')

    ax.set_xlim(0, max(vals_sorted) * 1.18)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()

    path = save_path or os.path.join(PLOT_DIR, 'feature_importance.png')
    plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='#F8F9FA')
    plt.close()
    print(f"[SAVED] feature_importance.png -> {path}")


def run_full_evaluation(retrain: bool = False):
    # retrain=False (default) loads the saved models and test split.
    # retrain=True re-runs the full preprocessing pipeline first.
    from sklearn.model_selection import train_test_split

    meta            = load_metadata()
    results         = meta['results']
    best_model_name = meta['best_model_name']
    feature_cols    = meta['feature_cols']

    df_table = print_comparison_table(results, best_model_name)
    csv_path = os.path.join(PLOT_DIR, 'model_comparison_table.csv')
    df_table.to_csv(csv_path, index=False)
    print(f"[SAVED] model_comparison_table.csv -> {csv_path}")

    plot_model_comparison(results, best_model_name)

    if retrain:
        from data_preprocessing import preprocess_pipeline
        DATA_PATH = os.path.join(ROOT_DIR, 'data', 'final_dataset.csv')
        CARS_PATH = os.path.join(ROOT_DIR, 'data', 'cars.csv')
        X, y, _, _, _ = preprocess_pipeline(DATA_PATH, CARS_PATH)
        _, X_test, _, y_test = train_test_split(X, y, test_size=0.2,
                                                random_state=42)
    else:
        split_path = os.path.join(MODEL_DIR, 'test_split.pkl')
        if os.path.exists(split_path):
            X_test, y_test = joblib.load(split_path)
            print("[INFO] Loaded saved test split")
        else:
            print("[INFO] test_split.pkl not found — re-running preprocessing only...")
            from data_preprocessing import preprocess_pipeline
            DATA_PATH = os.path.join(ROOT_DIR, 'data', 'final_dataset.csv')
            CARS_PATH = os.path.join(ROOT_DIR, 'data', 'cars.csv')
            X, y, _, _, _ = preprocess_pipeline(DATA_PATH, CARS_PATH)
            _, X_test, _, y_test = train_test_split(X, y, test_size=0.2,
                                                    random_state=42)

    all_models = joblib.load(os.path.join(MODEL_DIR, 'all_models.pkl'))
    scaler     = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))

    best_est, best_scaler = all_models[best_model_name]
    y_pred = best_est.predict(
        scaler.transform(X_test) if best_scaler else X_test
    )
    y_pred = np.clip(y_pred, 0, None)

    plot_actual_vs_predicted(y_test.values if hasattr(y_test,'values') else y_test,
                             y_pred, best_model_name)
    plot_feature_importance(best_est, feature_cols, best_model_name)

    print("\nEvaluation complete. Charts saved to reports/")
    return df_table


if __name__ == '__main__':
    run_full_evaluation(retrain=False)