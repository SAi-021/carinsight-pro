import { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, TrendingDown, CheckCircle } from 'lucide-react';
import API from '../api/axios';
import { fmtINR } from '../utils/format';

/* ============================================================
   CarInsight Pro — Resale Valuation
   Rewritten to use the project's real design system
   (page-wrap / ph / g2 / card / fg-fl-fi-fs / btn-gold).
   Hybrid engine: 60% ML + 40% rule-based depreciation.
   ============================================================ */

const fmtL = v => `₹${(Number(v) / 100000).toFixed(2)} Lakh`;

// Human-readable rupee hint under money inputs.
const fmtMoneyHint = v => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  if (n >= 1_00_00_000) return `≈ ₹${(n / 1_00_00_000).toFixed(2)} Crore`;
  if (n >= 1_00_000)    return `≈ ₹${(n / 1_00_000).toFixed(2)} Lakh`;
  if (n >= 1_000)       return `≈ ₹${n.toLocaleString('en-IN')}`;
  return `≈ ₹${n}`;
};

// Strip leading zeros ("0220" -> "220") but keep "" empty.
const stripZeros = s => (s === '' ? '' : String(s).replace(/^0+(?=\d)/, ''));

/* One factor row inside the breakdown panel */
const Factor = ({ label, value, highlight }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
  }}>
    <span style={{ color: 'var(--text2)', textTransform: 'capitalize' }}>{label}</span>
    <span style={{
      color: highlight ? 'var(--gold)' : 'var(--text)',
      fontWeight: highlight ? 700 : 500,
    }}>
      {typeof value === 'number' ? value.toFixed(3) : value}
    </span>
  </div>
);

export default function ResaleValue() {
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);

  const [form, setForm] = useState({
    brand: '', brand_model: '', year: 2018, km_driven: 55000,
    fuel: 'petrol', mileage: 17, condition: 'Good', accident: 'No',
    owner: 1, selling_type: 'Individual', transmission: 'manual',
    fitness_status: 'Valid', purchase_price: 700000, current_price: 550000,
  });
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [showFactors, setShowFactors] = useState(false);

  // Load brands once (datalist autocomplete)
  useEffect(() => {
    API.get('/brands').then(r => setBrands(r.data.brands || [])).catch(() => {});
  }, []);

  // Load models when brand changes
  useEffect(() => {
    if (form.brand) {
      API.get(`/models/${form.brand}`)
        .then(r => setModels(r.data.models || []))
        .catch(() => setModels([]));
    } else {
      setModels([]);
    }
  }, [form.brand]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isElectric   = form.fuel === 'electric';
  const mileageLabel = isElectric ? 'Mileage (km/kWh)' : 'Mileage (km/l)';
  const mileageHint  = isElectric
    ? 'For an EV: 200 km on 20 kWh → 10 km/kWh'
    : '';

  const handleSubmit = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await API.post('/resale-value', {
        ...form,
        year: parseInt(form.year), km_driven: parseFloat(form.km_driven),
        mileage: parseFloat(form.mileage), owner: parseInt(form.owner),
        purchase_price: parseFloat(form.purchase_price),
        current_price: parseFloat(form.current_price),
      });
      setResult(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error calculating resale value');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrap fade">
      <div className="ph">
        <h1><span>Resale</span> Valuation</h1>
        <p>Hybrid engine • 60% ML prediction + 40% rule-based depreciation • 12 real-world factors</p>
      </div>

      <div className="g2">
        {/* ══════════════ FORM ══════════════ */}
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 15, fontWeight: 600, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 7 }}>
            <RefreshCw size={15} style={{ color: 'var(--gold)' }} /> Vehicle Details
          </h3>

          <div className="g2">
            <div className="fg">
              <label className="fl">Brand</label>
              <input className="fi" placeholder="e.g. maruti" value={form.brand}
                onChange={e => set('brand', e.target.value)} list="rv-brand-list" />
              <datalist id="rv-brand-list">
                {brands.map(b => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div className="fg">
              <label className="fl">Model</label>
              <input className="fi" placeholder="e.g. maruti swift" value={form.brand_model}
                onChange={e => set('brand_model', e.target.value)} list="rv-model-list" />
              <datalist id="rv-model-list">
                {models.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Year</label>
              <input className="fi" type="number" min="1990" max="2026"
                value={form.year} onChange={e => set('year', e.target.value)} />
            </div>
            <div className="fg">
              <label className="fl">KM Driven</label>
              <input className="fi" type="number" min="0" value={form.km_driven}
                onChange={e => set('km_driven', stripZeros(e.target.value))} />
              {form.km_driven !== '' && (
                <div className="fhint">{Number(form.km_driven).toLocaleString('en-IN')} km</div>
              )}
            </div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Fuel</label>
              <select className="fs" value={form.fuel} onChange={e => set('fuel', e.target.value)}>
                {['petrol','diesel','cng','lpg','electric'].map(f =>
                  <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">{mileageLabel}</label>
              <input className="fi" type="number" value={form.mileage}
                onChange={e => set('mileage', e.target.value)} />
              {mileageHint && <div className="fhint">{mileageHint}</div>}
            </div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Condition</label>
              <select className="fs" value={form.condition} onChange={e => set('condition', e.target.value)}>
                {['Excellent','Good','Average','Poor','Accidented'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Accident History</label>
              <select className="fs" value={form.accident} onChange={e => set('accident', e.target.value)}>
                <option value="No">No Accident</option>
                <option value="Yes">Yes, Accidented</option>
              </select>
            </div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Owners</label>
              <select className="fs" value={form.owner} onChange={e => set('owner', e.target.value)}>
                {[0,1,2,3,4].map(o =>
                  <option key={o} value={o}>{['Test Drive','1st','2nd','3rd','4th+'][o]} Owner</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Transmission</label>
              <select className="fs" value={form.transmission} onChange={e => set('transmission', e.target.value)}>
                <option value="manual">Manual</option>
                <option value="automatic">Automatic</option>
              </select>
            </div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Fitness Certificate</label>
              <select className="fs" value={form.fitness_status} onChange={e => set('fitness_status', e.target.value)}>
                <option value="Valid">Valid</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Selling Type</label>
              <select className="fs" value={form.selling_type} onChange={e => set('selling_type', e.target.value)}>
                <option value="Individual">Individual</option>
                <option value="Dealer">Dealer</option>
              </select>
            </div>
          </div>

          <div className="g2">
            <div className="fg">
              <label className="fl">Purchase Price (₹)</label>
              <input className="fi" type="number" min="0" value={form.purchase_price}
                onChange={e => set('purchase_price', stripZeros(e.target.value))} />
              {form.purchase_price !== '' && <div className="fhint">{fmtMoneyHint(form.purchase_price)}</div>}
            </div>
            <div className="fg">
              <label className="fl">Current Market Price (₹)</label>
              <input className="fi" type="number" min="0" value={form.current_price}
                onChange={e => set('current_price', stripZeros(e.target.value))} />
              {form.current_price !== '' && <div className="fhint">{fmtMoneyHint(form.current_price)}</div>}
            </div>
          </div>

          <button className="btn btn-gold btn-full btn-lg" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="spin" /> : <RefreshCw size={15} />}
            {loading ? 'Calculating...' : 'Calculate Resale Value'}
          </button>
        </div>

        {/* ══════════════ RESULT ══════════════ */}
        <div>
          {result ? (
            <div className="card card-gold fade" style={{ position: 'sticky', top: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
                Valuation Result
              </h3>

              {/* Final price headline */}
              <div style={{ textAlign: 'center', padding: '16px 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Estimated Resale Value
                </div>
                <div style={{ fontFamily: 'var(--font-d)', fontSize: 40, fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>
                  {fmtL(result.final_price)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
                  {fmtINR(result.final_price)}
                </div>
              </div>

              {/* ML vs Rule vs Final */}
              <div className="g3" style={{ gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'ML Price',   value: result.ml_price,   color: 'var(--blue)' },
                  { label: 'Rule Price', value: result.rule_price, color: 'var(--teal)' },
                  { label: 'Final',      value: result.final_price, color: 'var(--gold)', big: true },
                ].map(({ label, value, color, big }) => (
                  <div key={label} style={{
                    background: 'var(--bg2)', borderRadius: 8, padding: '12px 8px',
                    textAlign: 'center',
                    border: big ? `1px solid ${color}` : '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-d)', fontSize: big ? 16 : 14, fontWeight: 700, color }}>{fmtL(value)}</div>
                  </div>
                ))}
              </div>

              {/* Key facts */}
              <div style={{ marginBottom: 4 }}>
                <Factor label="Car Age"           value={`${result.car_age} years`} />
                <Factor label="Blend"             value={result.blend} />
                <Factor label="Scrap Value Floor" value={fmtL(result.scrap_value)} />
              </div>

              {/* Factor breakdown toggle */}
              <button onClick={() => setShowFactors(!showFactors)}
                className="btn btn-ghost btn-full"
                style={{ marginTop: 16, fontSize: 13, justifyContent: 'center' }}>
                {showFactors ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showFactors ? 'Hide' : 'Show'} 12-Factor Breakdown
              </button>

              {showFactors && result.factors && Object.keys(result.factors).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {Object.entries(result.factors)
                    .filter(([k]) => k !== 'owner_note')
                    .map(([k, v]) => (
                      <Factor key={k}
                        label={k.replace(/_/g, ' ').replace(/factor/g, '').trim()}
                        value={v}
                        highlight={k === 'owner_factor'} />
                    ))}
                  {result.factors.owner_note && (
                    <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
                      {result.factors.owner_note}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginTop: 16, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8 }}>
                <CheckCircle size={14} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                  Hybrid estimate combining the ML model with a depreciation formula across 12 factors.
                </span>
              </div>
            </div>
          ) : (
            <div className="card empty" style={{ minHeight: 320 }}>
              <TrendingDown size={52} strokeWidth={1} />
              <p>Fill in the vehicle details and calculate</p>
              <small>12 real-world factors applied to estimate resale value</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
