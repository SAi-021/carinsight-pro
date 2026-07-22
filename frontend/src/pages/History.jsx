import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History as HistIcon, Download, Car, RefreshCw, Search,
  TrendingUp, Award, Layers, Zap, Filter, X,
  CheckCircle2, AlertCircle, ChevronRight, IndianRupee,
  Star, DollarSign,
} from 'lucide-react';
import API from '../api/axios';
import { fmtINR, fmtLakhParts, fmtKM } from '../utils/format';
import { SkelLine, SkelBlock } from '../components/Skeleton';

/* ============================================================
   CarInsight Pro — History (4 tabs)
   Predictions (full-featured) · Resale · Recommendations · Finance
   - Predictions tab keeps stats strip, CSV export, confidence
     filters and the premium empty state (unchanged from before).
   - Three new tabs added for the other activity types.
   ============================================================ */

const confColor = {
  High:       'var(--green)',
  Medium:     'var(--blue)',
  Low:        'var(--gold)',
  'Very Low': 'var(--red)',
};

const TABS = [
  { id:'predict',   label:'Predictions',     icon:TrendingUp, color:'var(--gold)',   chip:'icon-chip-gold' },
  { id:'resale',    label:'Resale',          icon:RefreshCw,  color:'var(--blue)',   chip:'icon-chip-blue' },
  { id:'recommend', label:'Recommendations', icon:Star,       color:'var(--purple)', chip:'icon-chip-purp' },
  { id:'finance',   label:'Finance',         icon:DollarSign, color:'var(--green)',  chip:'icon-chip-green' },
];

const fmtL = v => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${(n / 100000).toFixed(2)} L`;
};

export default function History() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('predict');

  const [predItems, setPredItems]   = useState([]);
  const [resale, setResale]         = useState(undefined);
  const [recos, setRecos]           = useState(undefined);
  const [finance, setFinance]       = useState(undefined);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');
  const [confFilter, setConfFilter] = useState('all');
  const [toast, setToast]     = useState(null);

  const showToast = (msg, type = 's') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPredictions = () => {
    setLoading(true);
    API.get('/history?limit=100')
      .then(r => setPredItems(r.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  const loadResale = () => {
    setLoading(true);
    API.get('/history/resale').then(r => setResale(r.data || [])).catch(() => setResale([])).finally(() => setLoading(false));
  };
  const loadRecos = () => {
    setLoading(true);
    API.get('/history/recommendations').then(r => setRecos(r.data || [])).catch(() => setRecos([])).finally(() => setLoading(false));
  };
  const loadFinance = () => {
    setLoading(true);
    API.get('/history/finance').then(r => setFinance(r.data || [])).catch(() => setFinance([])).finally(() => setLoading(false));
  };

  useEffect(() => { loadPredictions(); }, []);

  useEffect(() => {
    if (activeTab === 'resale'    && resale  === undefined) loadResale();
    if (activeTab === 'recommend' && recos   === undefined) loadRecos();
    if (activeTab === 'finance'   && finance === undefined) loadFinance();
    setFilter(''); setConfFilter('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const refreshActive = () => {
    if (activeTab === 'predict')   loadPredictions();
    if (activeTab === 'resale')    loadResale();
    if (activeTab === 'recommend') loadRecos();
    if (activeTab === 'finance')   loadFinance();
  };

  /* ═══════════ CSV EXPORT — works for ALL 4 tabs ═══════════ */
  const escapeCsv = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const writeCsv = (filenameTab, headers, rows) => {
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url; a.download = `carinsight_${filenameTab}_${date}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} ${filenameTab} records`);
  };

  const fdate = d => d ? new Date(d).toLocaleString('en-IN') : '';

  // Builds and downloads the CSV for whichever tab is active.
  const downloadCSV = () => {
    if (activeTab === 'predict') {
      if (!predItems.length) { showToast('No predictions to export', 'e'); return; }
      const headers = ['#','Brand','Model','Year','KM Driven','Fuel','Transmission','Owner','Seller Type','Predicted Price','Predicted Price (Lakh)','Confidence','Fallback Level','Model Used','Date'];
      const rows = predItems.map((item, i) => [
        i + 1, item.brand || '', item.brand_model || '', item.year || '',
        item.km_driven || '', item.fuel || '', item.transmission || '',
        item.owner ?? '', item.seller_type || '',
        Math.round(item.predicted_price || 0),
        ((item.predicted_price || 0) / 100000).toFixed(2),
        item.confidence || '', item.fallback_level ?? '', item.model_used || '',
        fdate(item.created_at),
      ]);
      writeCsv('predictions', headers, rows);

    } else if (activeTab === 'resale') {
      if (!resale?.length) { showToast('No resale records to export', 'e'); return; }
      const headers = ['#','Brand','Model','Year','KM Driven','Fuel','Condition','ML Price','Rule Price','Final Value','Final Value (Lakh)','Car Age','Date'];
      const rows = resale.map((r, i) => [
        i + 1, r.brand || '', r.brand_model || '', r.year || '',
        r.km_driven || '', r.fuel || '', r.condition || '',
        Math.round(r.ml_price || 0), Math.round(r.rule_price || 0),
        Math.round(r.final_price || 0), ((r.final_price || 0) / 100000).toFixed(2),
        r.car_age ?? '', fdate(r.created_at),
      ]);
      writeCsv('resale', headers, rows);

    } else if (activeTab === 'recommend') {
      if (!recos?.length) { showToast('No recommendations to export', 'e'); return; }
      const headers = ['#','Budget','Budget (Lakh)','Purpose','Seats','Fuel Preference','Top Pick','Top Pick Price','# Results','Date'];
      const rows = recos.map((r, i) => [
        i + 1, Math.round(r.budget || 0), ((r.budget || 0) / 100000).toFixed(2),
        r.purpose || '', r.seats ?? '', r.fuel_pref || 'Any',
        r.top_pick || '', Math.round(r.top_price || 0),
        r.num_results ?? 0, fdate(r.created_at),
      ]);
      writeCsv('recommendations', headers, rows);

    } else if (activeTab === 'finance') {
      if (!finance?.length) { showToast('No finance records to export', 'e'); return; }
      const headers = ['#','Car Price','Down Payment','Interest Rate (%)','Tenure (months)','Monthly EMI','Total Payment','Cash Price','Decision','Savings','Date'];
      const rows = finance.map((r, i) => [
        i + 1, Math.round(r.car_price || 0), Math.round(r.down_payment || 0),
        r.interest_rate ?? '', r.tenure_months ?? '',
        Math.round(r.monthly_emi || 0), Math.round(r.total_payment || 0),
        Math.round(r.cash_price || 0), r.decision || '',
        Math.round(r.savings || 0), fdate(r.created_at),
      ]);
      writeCsv('finance', headers, rows);
    }
  };

  // Is there anything to export on the current tab? (controls button disabled state)
  const activeHasData =
    activeTab === 'predict'   ? predItems.length > 0
  : activeTab === 'resale'    ? (resale?.length > 0)
  : activeTab === 'recommend' ? (recos?.length > 0)
  : activeTab === 'finance'   ? (finance?.length > 0)
  : false;

  const filteredPred = useMemo(() => {
    return predItems.filter(i => {
      if (filter && !(i.brand_model || i.brand || '').toLowerCase().includes(filter.toLowerCase())) return false;
      if (confFilter !== 'all' && i.confidence !== confFilter) return false;
      return true;
    });
  }, [predItems, filter, confFilter]);

  const stats = useMemo(() => {
    if (!predItems.length) return null;
    const total    = predItems.length;
    const avgPrice = predItems.reduce((s, i) => s + (i.predicted_price || 0), 0) / total;
    const highConf = predItems.filter(i => i.confidence === 'High').length;
    const brands   = new Set(predItems.map(i => i.brand).filter(Boolean)).size;
    return { total, avgPrice, highConf, brands };
  }, [predItems]);

  const searchRows = (rows) => {
    if (!filter) return rows || [];
    const f = filter.toLowerCase();
    return (rows || []).filter(r => JSON.stringify(r).toLowerCase().includes(f));
  };

  return (
    <div className="page-wrap fade">

      {/* HEADER */}
      <header className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="icon-chip icon-chip-blue" style={{ width: 44, height: 44 }}>
            <HistIcon size={20} strokeWidth={2} />
          </span>
          <div>
            <h1>Your <span>history</span></h1>
            <p>All your activity · predictions, resale, recommendations and finance</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={refreshActive} disabled={loading} className="btn btn-ghost btn-press" style={{ fontSize: 12 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'rotate 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={downloadCSV} disabled={!activeHasData} className="btn btn-gold btn-press"
            title={!activeHasData ? 'Nothing to export on this tab yet' : 'Export this tab to CSV'}
            style={{ fontSize: 12, fontFamily: 'var(--font-d)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <Download size={13} strokeWidth={2.5} /> Download CSV
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className="rise" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const on = t.id === activeTab;
          const count = t.id === 'predict' ? predItems.length
                      : t.id === 'resale'  ? (resale?.length)
                      : t.id === 'recommend' ? (recos?.length)
                      : (finance?.length);
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className="btn-press"
              style={{
                display:'inline-flex', alignItems:'center', gap:8, cursor:'pointer',
                padding:'9px 16px', borderRadius:100, fontSize:13, fontWeight:600,
                border:'1px solid', borderColor: on ? t.color : 'var(--border2)',
                background: on ? 'rgba(240,165,0,0.08)' : 'var(--bg3)',
                color: on ? t.color : 'var(--text2)', transition:'all 0.18s',
                fontFamily:'var(--font-b)',
              }}>
              <Icon size={14} /> {t.label}
              {count !== undefined && (
                <span style={{ fontSize:10.5, fontWeight:700, padding:'1px 7px', borderRadius:20,
                  background: on ? t.color : 'var(--bg4)', color: on ? '#000' : 'var(--text2)' }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* PREDICTIONS TAB */}
      {activeTab === 'predict' && (
        <>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              {[1,2,3,4].map(i => <SkelBlock key={i} height={88} />)}
            </div>
          ) : stats ? (
            <div className="rise" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              <StatTile icon={Layers} chipClass="icon-chip-gold" value={stats.total} label="Total predictions" />
              <StatTile icon={IndianRupee} chipClass="icon-chip-green"
                value={`${fmtLakhParts(stats.avgPrice).rupee}${fmtLakhParts(stats.avgPrice).value} ${fmtLakhParts(stats.avgPrice).unit}`}
                label="Avg predicted price" />
              <StatTile icon={CheckCircle2} chipClass="icon-chip-blue" value={stats.highConf}
                label={`High confidence (${Math.round(stats.highConf / stats.total * 100)}%)`} />
              <StatTile icon={Award} chipClass="icon-chip-purp" value={stats.brands} label="Unique brands explored" />
            </div>
          ) : null}

          <div className="card rise-d1" style={{ padding: 0, overflow: 'hidden' }}>
            {predItems.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div className="field-wrap" style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
                  <Search size={14} className="field-icon" />
                  <input className="fi-premium" style={{ padding: '9px 36px 9px 36px', fontSize: 12.5, background: 'var(--bg2)' }}
                    placeholder="Search by brand or model…" value={filter} onChange={(e) => setFilter(e.target.value)} />
                  {filter && (
                    <button onClick={() => setFilter('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={12} style={{ color: 'var(--text3)' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Confidence:</span>
                  {['all','High','Medium','Low','Very Low'].map(c => (
                    <button key={c} onClick={() => setConfFilter(c)} className="btn-press"
                      style={{
                        padding: '4px 10px', borderRadius: 100, border: 'none',
                        fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--font-b)',
                        background: confFilter === c ? (c === 'all' ? 'var(--gold)' : confColor[c]) : 'var(--bg4)',
                        color: confFilter === c ? '#000' : 'var(--text2)', cursor: 'pointer', transition: 'all 0.18s',
                        textTransform: c === 'all' ? 'capitalize' : 'none',
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)' }}>
                  {filteredPred.length === predItems.length
                    ? `${predItems.length} ${predItems.length === 1 ? 'entry' : 'entries'}`
                    : `${filteredPred.length} of ${predItems.length}`}
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ padding: 24 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                    <SkelLine width={40} /><SkelLine width={180} /><SkelLine width={80} /><SkelLine width={100} /><SkelLine width={120} />
                  </div>
                ))}
              </div>
            ) : predItems.length === 0 ? (
              <EmptyPredict onClick={() => navigate('/predict')} />
            ) : filteredPred.length === 0 ? (
              <div style={{ padding: 56, textAlign: 'center', color: 'var(--text3)' }}>
                <Search size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontFamily: 'var(--font-d)', fontSize: 15, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>No results</div>
                <div style={{ fontSize: 12 }}>Try a different brand name or clear the confidence filter</div>
                <button onClick={() => { setFilter(''); setConfFilter('all'); }} className="btn btn-ghost btn-press" style={{ marginTop: 14, fontSize: 12 }}>
                  <X size={12} /> Clear filters
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {['#','Car','Year','Driven','Fuel','Predicted Price','Confidence','Date'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPred.map((item, i) => (
                      <tr key={item.id} style={{ transition: 'background 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(240,165,0,0.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ ...tdStyle, color: 'var(--text3)', fontFamily: 'var(--font-d)', fontWeight: 600 }}>{i + 1}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span className="icon-chip icon-chip-gold" style={{ width: 26, height: 26, borderRadius: 6 }}>
                              <Car size={11} strokeWidth={2.2} />
                            </span>
                            <div>
                              <div style={{ color: 'var(--text)', fontWeight: 600, textTransform: 'capitalize', fontSize: 13 }}>
                                {item.brand_model || item.brand || '—'}
                              </div>
                              {item.brand && item.brand_model && (
                                <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.brand}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--text2)', fontFamily: 'var(--font-d)', fontWeight: 600 }}>{item.year}</td>
                        <td style={{ ...tdStyle, color: 'var(--text2)' }}>{fmtKM(item.km_driven)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'var(--bg2)', border: '1px solid var(--border2)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text2)' }}>{item.fuel}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: 'var(--font-d)', fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>
                            {fmtLakhParts(item.predicted_price).rupee}{fmtLakhParts(item.predicted_price).value}
                            <span style={{ fontSize: 10.5, color: 'var(--text2)', fontWeight: 500, marginLeft: 3 }}>{fmtLakhParts(item.predicted_price).unit}</span>
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.06em', background: `${confColor[item.confidence] || 'var(--text3)'}22`, color: confColor[item.confidence] || 'var(--text3)' }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                            {item.confidence}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--text3)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* OTHER 3 TABS */}
      {activeTab !== 'predict' && (
        <div className="card rise-d1" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
            <div className="field-wrap" style={{ position:'relative', flex:1, maxWidth:320 }}>
              <Search size={14} className="field-icon" />
              <input className="fi-premium" style={{ padding:'9px 36px 9px 36px', fontSize:12.5, background:'var(--bg2)' }}
                placeholder="Search…" value={filter} onChange={e => setFilter(e.target.value)} />
              {filter && (
                <button onClick={() => setFilter('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                  <SkelLine width={40} /><SkelLine width={160} /><SkelLine width={90} /><SkelLine width={110} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {activeTab === 'resale'    && <ResaleTable rows={searchRows(resale)} onEmpty={() => navigate('/resale')} />}
              {activeTab === 'recommend' && <RecoTable   rows={searchRows(recos)} onEmpty={() => navigate('/recommend')} />}
              {activeTab === 'finance'   && <FinanceTable rows={searchRows(finance)} onEmpty={() => navigate('/finance')} />}
            </>
          )}
        </div>
      )}

      {toast && (
        <div className={toast.type === 'e' ? 'toast toast-e' : 'toast toast-s'} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'e' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function ResaleTable({ rows, onEmpty }) {
  if (!rows.length) return <TabEmpty label="resale valuations" icon={RefreshCw} chip="icon-chip-blue" onClick={onEmpty} cta="Calculate a resale value" />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: 'var(--bg2)' }}>
          {['#','Car','Year','Driven','Condition','Final Value','Date'].map(h => <th key={h} style={thStyle}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <RowHover key={r.id || i}>
              <td style={{ ...tdStyle, color:'var(--text3)' }}>{i+1}</td>
              <td style={{ ...tdStyle, color:'var(--text)', fontWeight:600, textTransform:'capitalize' }}>{r.brand_model || r.brand || '—'}</td>
              <td style={{ ...tdStyle, color:'var(--text2)' }}>{r.year || '—'}</td>
              <td style={{ ...tdStyle, color:'var(--text2)' }}>{fmtKM(r.km_driven)}</td>
              <td style={tdStyle}><Pill>{r.condition}</Pill></td>
              <td style={{ ...tdStyle, color:'var(--blue)', fontWeight:700, fontFamily:'var(--font-d)' }}>{fmtL(r.final_price)}</td>
              <td style={{ ...tdStyle, color:'var(--text3)', fontSize:11 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
            </RowHover>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecoTable({ rows, onEmpty }) {
  if (!rows.length) return <TabEmpty label="recommendations" icon={Star} chip="icon-chip-purp" onClick={onEmpty} cta="Get recommendations" />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: 'var(--bg2)' }}>
          {['#','Budget','Purpose','Seats','Fuel','Top Pick','Results','Date'].map(h => <th key={h} style={thStyle}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <RowHover key={r.id || i}>
              <td style={{ ...tdStyle, color:'var(--text3)' }}>{i+1}</td>
              <td style={{ ...tdStyle, color:'var(--purple)', fontWeight:700, fontFamily:'var(--font-d)' }}>{fmtL(r.budget)}</td>
              <td style={{ ...tdStyle, color:'var(--text2)' }}>{r.purpose || '—'}</td>
              <td style={{ ...tdStyle, color:'var(--text2)' }}>{r.seats || '—'}</td>
              <td style={tdStyle}><Pill>{r.fuel_pref || 'Any'}</Pill></td>
              <td style={{ ...tdStyle, color:'var(--text)', fontWeight:600, textTransform:'capitalize' }}>{r.top_pick || '—'}</td>
              <td style={{ ...tdStyle, color:'var(--text2)' }}>{r.num_results ?? 0}</td>
              <td style={{ ...tdStyle, color:'var(--text3)', fontSize:11 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
            </RowHover>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinanceTable({ rows, onEmpty }) {
  if (!rows.length) return <TabEmpty label="finance calculations" icon={DollarSign} chip="icon-chip-green" onClick={onEmpty} cta="Compare finance options" />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: 'var(--bg2)' }}>
          {['#','Car Price','EMI / month','Tenure','Decision','You Save','Date'].map(h => <th key={h} style={thStyle}>{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <RowHover key={r.id || i}>
              <td style={{ ...tdStyle, color:'var(--text3)' }}>{i+1}</td>
              <td style={{ ...tdStyle, color:'var(--text)', fontWeight:600, fontFamily:'var(--font-d)' }}>{fmtL(r.car_price)}</td>
              <td style={{ ...tdStyle, color:'var(--green)', fontWeight:700, fontFamily:'var(--font-d)' }}>{fmtL(r.monthly_emi)}</td>
              <td style={{ ...tdStyle, color:'var(--text2)' }}>{r.tenure_months ? `${r.tenure_months} mo` : '—'}</td>
              <td style={tdStyle}>
                <span style={{ display:'inline-block', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:100, textTransform:'uppercase', letterSpacing:'0.06em',
                  background: r.decision === 'cash' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                  color: r.decision === 'cash' ? 'var(--green)' : 'var(--blue)' }}>
                  {(r.decision || '—').toUpperCase()}
                </span>
              </td>
              <td style={{ ...tdStyle, color:'var(--gold)', fontWeight:700, fontFamily:'var(--font-d)' }}>{fmtL(r.savings)}</td>
              <td style={{ ...tdStyle, color:'var(--text3)', fontSize:11 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}</td>
            </RowHover>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowHover({ children }) {
  return (
    <tr style={{ transition: 'background 0.15s' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(240,165,0,0.04)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      {children}
    </tr>
  );
}

function Pill({ children }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'var(--bg2)', border: '1px solid var(--border2)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text2)' }}>
      {children || '—'}
    </span>
  );
}

function StatTile({ icon: Icon, chipClass, value, label }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
      <span className={`icon-chip ${chipClass}`}><Icon size={16} strokeWidth={2} /></span>
      <div>
        <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function EmptyPredict({ onClick }) {
  return (
    <div style={{ padding: 64, textAlign: 'center', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/assets/hero-car-clean.svg)', backgroundSize: '110% auto', backgroundPosition: 'center 60%', backgroundRepeat: 'no-repeat', opacity: 0.05, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 380 }}>
        <span className="icon-chip icon-chip-blue" style={{ width: 56, height: 56, marginBottom: 18 }}>
          <HistIcon size={26} strokeWidth={1.8} />
        </span>
        <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>No predictions yet</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 18 }}>
          Once you make your first price prediction, it'll appear here. Filter, search, and export your prediction history as CSV.
        </p>
        <button onClick={onClick} className="btn btn-gold btn-press" style={{ fontFamily: 'var(--font-d)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 13 }}>
          <Zap size={14} strokeWidth={2.5} /> Make first prediction <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function TabEmpty({ label, icon: Icon, chip, onClick, cta }) {
  return (
    <div style={{ padding: 56, textAlign: 'center', display:'flex', flexDirection:'column', alignItems:'center', minHeight: 280, justifyContent:'center' }}>
      <span className={`icon-chip ${chip}`} style={{ width: 54, height: 54, marginBottom: 16 }}>
        <Icon size={24} strokeWidth={1.7} />
      </span>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
        No {label} yet
      </div>
      <p style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 360, lineHeight: 1.6, marginBottom: 16 }}>
        Once you use this feature, your history will appear here.
      </p>
      <button onClick={onClick} className="btn btn-ghost btn-press" style={{ fontSize: 12.5 }}>
        {cta} <ChevronRight size={13} />
      </button>
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '11px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 12.5, whiteSpace: 'nowrap' };
