import { useEffect, useState } from 'react';
import {
  Activity, Trophy, TrendingUp, AlertTriangle, CheckCircle2,
  BarChart3, Target, Layers, RefreshCw, Cpu, Award, ArrowRight,
  Grid3x3, LineChart as LineIcon, Search,
} from 'lucide-react';
import API from '../api/axios';
import { fmtINR, fmtLakhParts } from '../utils/format';
import { SkelLine, SkelBlock } from '../components/Skeleton';

/* ============================================================
   CarInsight Pro — Model Diagnostics
   Tabbed interface, 5 models, full metrics + plots
   ============================================================ */

const TABS = [
  { id: 'overview', label: 'Overview',    icon: Trophy   },
  { id: 'regression', label: 'Regression', icon: TrendingUp },
  { id: 'classification', label: 'Classification', icon: Target },
  { id: 'plots', label: 'Diagnostic plots', icon: LineIcon },
];

export default function Diagnostics() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [activeTab, setActiveTab]   = useState('overview');

  const load = () => {
    setLoading(true); setError('');
    API.get('/diagnostics')
      .then(r => {
        setData(r.data);
        setSelectedModel(r.data.best_model);
      })
      .catch(err => setError(
        err?.response?.data?.detail ||
        'Could not load diagnostics. Run training first: python ml/run_training.py'
      ))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="page-wrap fade">
        <header className="ph">
          <h1><span>Model</span> diagnostics</h1>
          <p>Loading metrics for all trained models…</p>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
          {[1,2,3,4].map(i => <SkelBlock key={i} height={110} />)}
        </div>
        <SkelBlock height={400} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-wrap fade">
        <header className="ph">
          <h1><span>Model</span> diagnostics</h1>
        </header>
        <div className="card" style={{
          padding: 40, textAlign: 'center',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 16,
        }}>
          <span className="icon-chip icon-chip-gold" style={{ width: 56, height: 56 }}>
            <AlertTriangle size={26} />
          </span>
          <div style={{
            fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 600,
            color: 'var(--text)',
          }}>
            Diagnostics not available
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 480, lineHeight: 1.6 }}>
            {error}
          </div>
          <div style={{
            background: 'var(--bg2)', padding: '12px 16px',
            border: '1px dashed var(--gold-dim)', borderRadius: 8,
            fontFamily: 'monospace', fontSize: 12.5, color: 'var(--gold)',
            marginTop: 6,
          }}>
            python ml/run_training.py
          </div>
        </div>
      </div>
    );
  }

  const modelNames   = Object.keys(data.results);
  const m            = data.results[selectedModel] || {};
  const bestRibbon   = selectedModel === data.best_model;

  return (
    <div className="page-wrap fade">

      {/* ══════════════ HEADER ══════════════ */}
      <header className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="icon-chip icon-chip-purp" style={{ width: 44, height: 44 }}>
            <Activity size={20} strokeWidth={2} />
          </span>
          <div>
            <h1><span>Model</span> diagnostics</h1>
            <p>
              All 5 trained models · regression + classification metrics ·
              overfitting / underfitting checks · best model: <strong style={{ color: 'var(--gold)' }}>{data.best_model}</strong>
            </p>
          </div>
        </div>
        <button onClick={load} className="btn btn-ghost btn-press" style={{ fontSize: 12 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </header>

      {/* ══════════════ TOP STATS STRIP ══════════════ */}
      <div className="rise" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
        marginBottom: 20,
      }}>
        <SmallTile icon={Trophy}  chipClass="icon-chip-gold"
          value={data.best_model} label="Best model" small />
        <SmallTile icon={Layers}  chipClass="icon-chip-blue"
          value={data.train_size?.toLocaleString() || '—'} label="Training rows" />
        <SmallTile icon={Cpu}     chipClass="icon-chip-green"
          value={data.feature_count} label="Features used" />
        <SmallTile icon={Award}   chipClass="icon-chip-purp"
          value={modelNames.length} label="Models trained" />
      </div>

      {/* ══════════════ MODEL TABS ══════════════ */}
      <div className="rise-d1" style={{
        display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap',
        padding: 4, background: 'var(--bg2)',
        border: '1px solid var(--border)', borderRadius: 10,
      }}>
        {modelNames.map(name => {
          const isActive = name === selectedModel;
          const isBest   = name === data.best_model;
          return (
            <button key={name}
              onClick={() => setSelectedModel(name)}
              className="btn-press"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 7, border: 'none',
                background: isActive ? 'var(--gold)' : 'transparent',
                color: isActive ? '#000' : 'var(--text2)',
                fontFamily: 'var(--font-d)', fontSize: 12,
                fontWeight: 600, letterSpacing: '0.04em',
                textTransform: 'uppercase', cursor: 'pointer',
                transition: 'all 0.18s',
              }}>
              {isBest && <Trophy size={11} fill="currentColor" />}
              {name}
            </button>
          );
        })}
      </div>

      {/* ══════════════ SUB-TABS ══════════════ */}
      <div className="rise-d2" style={{
        display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap',
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn-press"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 100, border: '1px solid',
                borderColor: isActive ? 'var(--gold)' : 'var(--border2)',
                background: isActive ? 'rgba(240,165,0,0.08)' : 'var(--bg3)',
                color: isActive ? 'var(--gold)' : 'var(--text2)',
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-b)',
                cursor: 'pointer', transition: 'all 0.18s',
              }}>
              <Icon size={13} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════ CONTENT BY TAB ══════════════ */}
      {activeTab === 'overview' && (
        <OverviewTab metrics={m} modelName={selectedModel} isBest={bestRibbon} />
      )}
      {activeTab === 'regression' && (
        <RegressionTab metrics={m} />
      )}
      {activeTab === 'classification' && (
        <ClassificationTab metrics={m} />
      )}
      {activeTab === 'plots' && (
        <PlotsTab modelName={selectedModel} learningCurve={data.learning_curves?.[selectedModel]} />
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   OVERVIEW TAB — health check + headline metrics
   ─────────────────────────────────────────────────────────── */
function OverviewTab({ metrics, modelName, isBest }) {
  if (!metrics?.MAE) return null;

  const healthStatus = metrics.is_overfitting ? 'overfit'
                     : metrics.is_underfitting ? 'underfit'
                     : 'healthy';

  const healthMeta = {
    overfit:  { color: 'var(--red)',   chip: 'icon-chip-red',   icon: AlertTriangle, label: 'Overfitting detected',
                msg: 'The model memorized the training data. It learned noise instead of patterns.',
                fix: 'Reduce max_depth, increase min_samples_leaf, or add regularization (reg_alpha/reg_lambda).' },
    underfit: { color: 'var(--gold)',  chip: 'icon-chip-gold',  icon: AlertTriangle, label: 'Underfitting detected',
                msg: 'The model is too simple to capture the patterns in the data.',
                fix: 'Increase n_estimators, deepen max_depth, or lower the learning rate for more iterations.' },
    healthy:  { color: 'var(--green)', chip: 'icon-chip-green', icon: CheckCircle2,  label: 'Model is healthy',
                msg: 'Train and test scores are close — model generalizes well.',
                fix: null },
  }[healthStatus];
  const HealthIcon = healthMeta.icon;

  return (
    <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* HERO HEADLINE NUMBERS */}
      <div className="card" style={{
        padding: 28, position: 'relative', overflow: 'hidden',
        background: isBest
          ? `radial-gradient(circle at 20% 0%, rgba(240,165,0,0.14) 0%, transparent 50%), var(--bg3)`
          : 'var(--bg3)',
        border: isBest ? '1px solid var(--gold)' : '1px solid var(--border)',
        boxShadow: isBest ? '0 0 0 1px var(--gold), 0 0 24px var(--gold-glow)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {isBest && (
            <span className="icon-chip icon-chip-gold" style={{ width: 30, height: 30 }}>
              <Trophy size={14} fill="currentColor" />
            </span>
          )}
          <div style={{
            fontFamily: 'var(--font-d)', fontSize: 11, fontWeight: 700,
            color: isBest ? 'var(--gold)' : 'var(--text3)',
            letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>
            {isBest ? 'Champion model' : 'Model performance'} · {modelName}
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 24, marginTop: 8,
        }}>
          <HeadlineNumber label="R²" value={`${(metrics.R2 * 100).toFixed(1)}%`} sub="Variance explained" color="var(--gold)" />
          <HeadlineNumber label="Accuracy" value={`${(metrics.accuracy * 100).toFixed(1)}%`} sub="Correct tier" color="var(--blue)" />
          <HeadlineNumber label="MAPE" value={`${metrics.MAPE.toFixed(1)}%`} sub="Avg % error" color="var(--purple)" />
          <HeadlineNumber label="RMSE" value={`₹${(metrics.RMSE / 100000).toFixed(2)}L`} sub="Avg rupee error" color="var(--green)" />
        </div>
      </div>

      {/* HEALTH CHECK */}
      <div className="card rise-d1" style={{
        padding: 20,
        background: healthStatus === 'overfit' ? 'rgba(239,68,68,0.04)' :
                    healthStatus === 'underfit' ? 'rgba(240,165,0,0.04)' :
                    'rgba(34,197,94,0.04)',
        borderColor: healthMeta.color,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span className={`icon-chip ${healthMeta.chip}`} style={{ width: 36, height: 36 }}>
            <HealthIcon size={16} strokeWidth={2.2} />
          </span>
          <div>
            <div style={{
              fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 600,
              color: healthMeta.color, letterSpacing: '0.02em',
            }}>
              {healthMeta.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {healthMeta.msg}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
          marginTop: 16, padding: '14px 0',
          borderTop: '1px dashed var(--border)',
        }}>
          <SmallMetric label="Train R²" value={metrics.R2_train.toFixed(4)} />
          <SmallMetric label="Test R²" value={metrics.R2.toFixed(4)} />
          <SmallMetric label="Gap" value={metrics.overfit_gap.toFixed(4)}
            color={Math.abs(metrics.overfit_gap) > 0.10 ? 'var(--red)' : 'var(--green)'} />
        </div>

        {healthMeta.fix && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'var(--bg2)',
            border: '1px solid var(--border)', borderRadius: 8,
            fontSize: 12.5, color: 'var(--text2)',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <ArrowRight size={13} style={{ color: healthMeta.color, flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: 'var(--text)' }}>How to fix: </strong>
              {healthMeta.fix}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   REGRESSION TAB — all numerical metrics
   ─────────────────────────────────────────────────────────── */
function RegressionTab({ metrics }) {
  if (!metrics?.MAE) return null;
  const rows = [
    ['MAE',         `₹${metrics.MAE.toLocaleString('en-IN')}`,
     'Mean absolute error — average rupee difference', 'var(--gold)'],
    ['MSE',         metrics.MSE.toLocaleString('en-IN'),
     'Mean squared error — penalizes large errors more', 'var(--blue)'],
    ['RMSE',        `₹${metrics.RMSE.toLocaleString('en-IN')}`,
     'Root mean squared error — typical error in rupees', 'var(--green)'],
    ['MAPE',        `${metrics.MAPE.toFixed(2)}%`,
     'Mean absolute percentage error — % off on average', 'var(--purple)'],
    ['R² (test)',   `${(metrics.R2 * 100).toFixed(2)}%`,
     'Variance explained on unseen data', 'var(--gold)'],
    ['R² (train)',  `${(metrics.R2_train * 100).toFixed(2)}%`,
     'Variance explained on training data', 'var(--text2)'],
    ['CV R² mean',  `${(metrics.CV_R2_mean * 100).toFixed(2)}%`,
     '5-fold cross-validation average', 'var(--blue)'],
    ['CV R² std',   metrics.CV_R2_std.toFixed(4),
     'Standard deviation across folds (lower = more stable)', 'var(--text2)'],
  ];

  return (
    <div className="card rise" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span className="icon-chip icon-chip-blue" style={{ width: 32, height: 32 }}>
          <TrendingUp size={15} strokeWidth={2.2} />
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
            Regression metrics
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
            How accurate the predicted rupee price is
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 0 }}>
        {rows.map(([label, value, desc, color]) => (
          <div key={label} style={{
            display: 'grid', gridTemplateColumns: '160px 1fr 200px',
            gap: 16, alignItems: 'center',
            padding: '14px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text3)',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {label}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
              {desc}
            </div>
            <div style={{
              fontFamily: 'var(--font-d)', fontSize: 20, fontWeight: 700,
              color, textAlign: 'right', letterSpacing: '-0.01em',
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   CLASSIFICATION TAB — confusion matrix + per-class
   ─────────────────────────────────────────────────────────── */
function ClassificationTab({ metrics }) {
  if (!metrics?.confusion_matrix) return null;

  const cm = metrics.confusion_matrix;
  const tiers = metrics.tier_labels || [];

  // Row totals for normalization
  const rowTotals = cm.map(row => row.reduce((a, b) => a + b, 0));

  return (
    <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top-line classification metrics */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span className="icon-chip icon-chip-purp" style={{ width: 32, height: 32 }}>
            <Target size={15} strokeWidth={2.2} />
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              Classification metrics
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
              How often the model lands in the correct price tier
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
        }}>
          <BigMetric label="Accuracy"  value={`${(metrics.accuracy*100).toFixed(1)}%`}  color="var(--gold)" />
          <BigMetric label="Precision" value={`${(metrics.precision*100).toFixed(1)}%`} color="var(--blue)" />
          <BigMetric label="Recall"    value={`${(metrics.recall*100).toFixed(1)}%`}    color="var(--green)" />
          <BigMetric label="F1 Score"  value={`${(metrics.f1*100).toFixed(1)}%`}        color="var(--purple)" />
        </div>
      </div>

      {/* Confusion matrix */}
      <div className="card rise-d1" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span className="icon-chip icon-chip-gold" style={{ width: 32, height: 32 }}>
            <Grid3x3 size={15} strokeWidth={2.2} />
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              Confusion matrix
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
              Diagonal = correct, off-diagonal = mistakes
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', margin: '0 auto', fontFamily: 'var(--font-d)' }}>
            <thead>
              <tr>
                <th style={{
                  padding: 12, fontSize: 10, fontWeight: 700,
                  color: 'var(--text3)', letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Actual ↓ / Predicted →
                </th>
                {tiers.map(t => (
                  <th key={t} style={{
                    padding: '12px 8px', fontSize: 10, fontWeight: 700,
                    color: 'var(--text2)', letterSpacing: '0.06em',
                    textAlign: 'center', minWidth: 100,
                  }}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cm.map((row, i) => (
                <tr key={i}>
                  <th style={{
                    padding: '10px 12px', fontSize: 11, fontWeight: 700,
                    color: 'var(--text2)', textAlign: 'right',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                  }}>
                    {tiers[i]}
                  </th>
                  {row.map((val, j) => {
                    const pct = rowTotals[i] > 0 ? (val / rowTotals[i]) * 100 : 0;
                    const isDiagonal = i === j;
                    const bg = isDiagonal
                      ? `rgba(240,165,0,${0.1 + (pct/100) * 0.6})`
                      : `rgba(239,68,68,${(pct/100) * 0.4})`;
                    return (
                      <td key={j} style={{
                        padding: '14px 8px', textAlign: 'center',
                        border: '1px solid var(--border)',
                        background: bg,
                        minWidth: 100,
                      }}>
                        <div style={{
                          fontSize: 16, fontWeight: 700,
                          color: isDiagonal ? 'var(--gold)' : 'var(--text)',
                        }}>
                          {val}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text3)',
                          marginTop: 2, fontFamily: 'var(--font-b)',
                        }}>
                          {pct.toFixed(0)}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{
          fontSize: 11.5, color: 'var(--text3)', marginTop: 14,
          padding: '10px 14px',
          background: 'var(--bg2)', border: '1px dashed var(--border2)',
          borderRadius: 7, fontStyle: 'italic',
        }}>
          Read each row left-to-right: "Of all the cars that were actually <strong style={{ color: 'var(--text2)' }}>{tiers[0]}</strong>,
          {' '}{cm[0]?.[0] || 0} were correctly predicted as {tiers[0]}, and the rest were misclassified into other tiers."
        </div>
      </div>

      {/* Per-class breakdown */}
      <div className="card rise-d2" style={{ padding: 24 }}>
        <div style={{
          fontFamily: 'var(--font-d)', fontSize: 13, fontWeight: 700,
          color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          Per-tier performance
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tier','Precision','Recall','F1','Support'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Tier' ? 'left' : 'right',
                  padding: '10px 12px', fontSize: 10, fontWeight: 700,
                  color: 'var(--text3)', letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(metrics.per_class || {}).map(([tier, d]) => (
              <tr key={tier}>
                <td style={{
                  padding: '12px', fontSize: 12.5, color: 'var(--text)',
                  fontWeight: 500, borderBottom: '1px solid var(--border)',
                }}>
                  {tier}
                </td>
                <td style={{ padding: '12px', fontSize: 13, color: 'var(--blue)', fontFamily: 'var(--font-d)', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                  {(d.precision*100).toFixed(1)}%
                </td>
                <td style={{ padding: '12px', fontSize: 13, color: 'var(--green)', fontFamily: 'var(--font-d)', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                  {(d.recall*100).toFixed(1)}%
                </td>
                <td style={{ padding: '12px', fontSize: 13, color: 'var(--purple)', fontFamily: 'var(--font-d)', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                  {(d.f1*100).toFixed(1)}%
                </td>
                <td style={{ padding: '12px', fontSize: 12.5, color: 'var(--text2)', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                  {d.support}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   PLOTS TAB — load PNGs from backend
   ─────────────────────────────────────────────────────────── */
function PlotsTab({ modelName, learningCurve }) {
  // The auth header is needed for image requests — easiest path is to embed via fetch
  // and convert to blob URL. For simplicity we use the public URL pattern with
  // axios baseURL + token query (axios interceptor handles auth on regular calls).
  const baseURL = API.defaults.baseURL || '';
  const token = localStorage.getItem('token') || '';
  // We use a small helper to render each plot via img with a fetch-based blob

  return (
    <div className="rise" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <PlotCard
        title="Predicted vs actual"
        subtitle="Scatter of predicted prices vs real prices. Closer to the diagonal = better."
        kind="pred_vs_actual"
        modelName={modelName}
        icon={LineIcon}
        chipClass="icon-chip-blue"
      />
      <PlotCard
        title="Confusion matrix"
        subtitle="Heatmap of price-tier predictions. Diagonal cells = correct."
        kind="confusion_matrix"
        modelName={modelName}
        icon={Grid3x3}
        chipClass="icon-chip-purp"
      />
      <PlotCard
        title="Learning curve"
        subtitle="Train and CV R² as training size grows. Detects bias / variance."
        kind="learning_curve"
        modelName={modelName}
        icon={Activity}
        chipClass="icon-chip-gold"
        wide
      />
    </div>
  );
}

function PlotCard({ title, subtitle, kind, modelName, icon: Icon, chipClass, wide }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [err, setErr]       = useState(false);

  useEffect(() => {
    setImgUrl(null); setErr(false);
    if (!modelName) return;
    API.get(`/diagnostics/image/${kind}/${encodeURIComponent(modelName)}`, { responseType: 'blob' })
      .then(r => setImgUrl(URL.createObjectURL(r.data)))
      .catch(() => setErr(true));
    return () => imgUrl && URL.revokeObjectURL(imgUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, modelName]);

  return (
    <div className="card" style={{
      padding: 18,
      gridColumn: wide ? '1 / span 2' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className={`icon-chip ${chipClass}`} style={{ width: 30, height: 30 }}>
          <Icon size={14} strokeWidth={2.2} />
        </span>
        <div>
          <div style={{
            fontFamily: 'var(--font-d)', fontSize: 13, fontWeight: 600,
            color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {subtitle}
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--bg2)', borderRadius: 8,
        minHeight: 320, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {err ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>
            <AlertTriangle size={24} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontSize: 12 }}>Plot not available. Run training first.</div>
          </div>
        ) : !imgUrl ? (
          <SkelBlock height={300} />
        ) : (
          <img src={imgUrl} alt={title}
            style={{ maxWidth: '100%', maxHeight: 500, display: 'block' }} />
        )}
      </div>
    </div>
  );
}

/* ─── small component primitives ─── */
function SmallTile({ icon: Icon, chipClass, value, label, small }) {
  return (
    <div className="card" style={{
      padding: 16, display: 'flex', alignItems: 'center', gap: 12,
      transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <span className={`icon-chip ${chipClass}`}>
        <Icon size={16} strokeWidth={2} />
      </span>
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          fontFamily: 'var(--font-d)',
          fontSize: small ? 16 : 22,
          fontWeight: 700, color: 'var(--text)', lineHeight: 1.1,
          letterSpacing: '-0.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function HeadlineNumber({ label, value, sub, color }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text3)',
        letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-d)', fontSize: 36, fontWeight: 700,
        color, lineHeight: 1, letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
        {sub}
      </div>
    </div>
  );
}

function SmallMetric({ label, value, color = 'var(--text)' }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text3)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 600,
        color, marginTop: 4,
      }}>
        {value}
      </div>
    </div>
  );
}

function BigMetric({ label, value, color }) {
  return (
    <div style={{
      padding: 14, background: 'var(--bg2)',
      border: '1px solid var(--border)', borderRadius: 8,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text3)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-d)', fontSize: 26, fontWeight: 700,
        color, marginTop: 6, letterSpacing: '-0.01em',
      }}>
        {value}
      </div>
    </div>
  );
}
