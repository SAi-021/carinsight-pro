import { useState } from 'react';
import {
  IndianRupee, TrendingDown, TrendingUp, CheckCircle2, AlertTriangle,
  Wallet, Percent, Calendar, Sparkles, Banknote, CreditCard, ArrowRight,
  Cog, Calculator, Info, LineChart,
} from 'lucide-react';
import API from '../api/axios';
import { fmtINR, fmtLakhParts } from '../utils/format';
import { SkelPriceCard } from '../components/Skeleton';

/* Finance vs cash decision engine (theme-aware).
   The decision factors in opportunity cost: if you finance, the money you
   didn't spend up front stays invested and earns a return, which can make
   financing cheaper overall than paying cash. */

const PRESETS = [
  { label: '₹6L · 5 yr · 9.5%', form: { car_price: 600000, down_payment: 100000, interest_rate: 9.5, tenure_months: 60, cash_discount: 2, investment_rate: 8 } },
  { label: '₹10L · 7 yr · 8.5%', form: { car_price: 1000000, down_payment: 200000, interest_rate: 8.5, tenure_months: 84, cash_discount: 3, investment_rate: 8 } },
  { label: '₹15L · 5 yr · 10%', form: { car_price: 1500000, down_payment: 300000, interest_rate: 10, tenure_months: 60, cash_discount: 4, investment_rate: 8 } },
];

export default function Finance() {
  const [form, setForm] = useState({
    car_price: 600000, down_payment: 100000,
    interest_rate: 9.5, tenure_months: 60, cash_discount: 2, investment_rate: 8,
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(''); setLoading(true); setResult(null);
    try {
      const { data } = await API.post('/finance-decision', {
        car_price:       parseFloat(form.car_price),
        down_payment:    parseFloat(form.down_payment),
        interest_rate:   parseFloat(form.interest_rate),
        tenure_months:   parseInt(form.tenure_months),
        cash_discount:   parseFloat(form.cash_discount),
        investment_rate: parseFloat(form.investment_rate),
      });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (p) => { setForm(p.form); setResult(null); setError(''); };

  const isCash       = result?.decision === 'cash';
  const accentColor  = isCash ? 'var(--green)' : 'var(--blue)';
  const accentChip   = isCash ? 'icon-chip-green' : 'icon-chip-blue';
  const emiParts     = result ? fmtLakhParts(result.monthly_emi) : null;

  const loanAmt = parseFloat(form.car_price || 0) - parseFloat(form.down_payment || 0);
  const validInputs = form.car_price > 0 && form.down_payment >= 0 &&
                      form.down_payment < form.car_price &&
                      form.interest_rate > 0 && form.tenure_months > 0;

  return (
    <div className="page-wrap fade">

      <header className="ph">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="icon-chip icon-chip-green" style={{ width: 44, height: 44 }}>
            <Calculator size={20} strokeWidth={2} />
          </span>
          <div>
            <h1>Finance <span>vs cash</span></h1>
            <p>EMI calculator + smart decision engine · accounts for what your spare cash could earn if invested</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>
            Try:
          </span>
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className="btn btn-ghost btn-press" style={{ fontSize: 12, padding: '6px 12px' }}>
              <Sparkles size={12} /> {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="bento" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>

        {/* ───── INPUT (2 cols) ───── */}
        <div className="card bento-2x1 rise" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span className="icon-chip icon-chip-gold">
              <Cog size={16} strokeWidth={2} />
            </span>
            <div>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: 17, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
                Loan details
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                We'll crunch EMI, total outgo + opportunity cost
              </div>
            </div>
          </div>

          <Field icon={IndianRupee} label="Car price (₹)" type="number" value={form.car_price}
            onChange={(v) => set('car_price', v)}
            hint={form.car_price > 0 ? `≈ ${fmtINR(form.car_price)}` : ''} />

          <Field icon={Wallet} label="Down payment (₹)" type="number" value={form.down_payment}
            onChange={(v) => set('down_payment', v)}
            hint={
              form.down_payment > 0 && form.car_price > 0
                ? `${fmtINR(form.down_payment)} · ${Math.round((form.down_payment / form.car_price) * 100)}% of car price`
                : ''
            } />

          <Field icon={Percent} label="Interest rate (% p.a.)" type="number" step="0.1" value={form.interest_rate}
            onChange={(v) => set('interest_rate', v)}
            hint="Typical Indian car loans: 8.5–11%" />

          <Field icon={Calendar} label="Loan tenure (months)" type="number" value={form.tenure_months}
            onChange={(v) => set('tenure_months', v)}
            hint={form.tenure_months > 0 ? `${(form.tenure_months / 12).toFixed(1)} years` : ''} />

          <Field icon={Percent} label="Cash discount (%)" type="number" step="0.1" value={form.cash_discount}
            onChange={(v) => set('cash_discount', v)}
            hint="Dealer discount if you pay full cash" />

          <Field icon={LineChart} label="Expected investment return (% p.a.)" type="number" step="0.1" value={form.investment_rate}
            onChange={(v) => set('investment_rate', v)}
            hint="If you financed, your spare cash could earn this (FD ≈ 7%, equity ≈ 12%)" />

          {validInputs && (
            <div style={{
              padding: '12px 14px', marginTop: 16,
              background: 'rgba(240,165,0,0.06)',
              border: '1px dashed var(--gold-dim)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                Loan amount needed
              </div>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700, color: 'var(--gold)', letterSpacing: '-0.01em' }}>
                {fmtINR(loanAmt)}
              </div>
            </div>
          )}

          <button onClick={submit} disabled={loading || !validInputs}
            className="btn btn-gold btn-full btn-lg btn-press"
            style={{ marginTop: 18, fontFamily: 'var(--font-d)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 14 }}>
            {loading
              ? <><span className="spin" /> Calculating…</>
              : <><Calculator size={16} strokeWidth={2.5} /> Calculate & compare</>}
          </button>

          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, fontSize: 12.5, color: 'var(--red)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          {!validInputs && form.down_payment >= form.car_price && (
            <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={12} /> Down payment must be less than car price
            </div>
          )}
        </div>

        {/* ───── RESULT (3 cols) ───── */}
        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {loading ? (
            <SkelPriceCard />
          ) : result ? (
            <>
              {/* MEGA DECISION CARD */}
              <div className="mega-price-card rise" style={{
                borderColor: accentColor,
                boxShadow: `0 0 0 1px ${accentColor}, 0 0 24px ${isCash ? 'rgba(34,197,94,0.22)' : 'rgba(59,130,246,0.22)'}, 0 0 60px ${isCash ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                  <span className={`icon-chip ${accentChip}`} style={{ width: 38, height: 38 }}>
                    {isCash ? <Banknote size={18} strokeWidth={2.2} /> : <CreditCard size={18} strokeWidth={2.2} />}
                  </span>
                  <div>
                    <div className="mega-price-label" style={{ color: accentColor, marginBottom: 0 }}>
                      Our recommendation
                    </div>
                    <div style={{ fontFamily: 'var(--font-d)', fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.1, marginTop: 2 }}>
                      {isCash ? 'Pay in cash' : 'Take the loan'}
                    </div>
                  </div>
                </div>

                <div style={{
                  marginTop: 12, padding: '12px 14px',
                  background: 'var(--bg2)',
                  borderRadius: 9, fontSize: 13, color: 'var(--text2)',
                  lineHeight: 1.55,
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <CheckCircle2 size={14} style={{ color: accentColor, flexShrink: 0, marginTop: 2 }} />
                  <span>{result.recommendation}</span>
                </div>

                <div className="mega-price-meta">
                  <div className="mega-price-meta-item">
                    <span className="mega-price-meta-label">You save</span>
                    <span className="mega-price-meta-value" style={{ color: accentColor }}>
                      {fmtLakhParts(result.savings).rupee}{fmtLakhParts(result.savings).value} {fmtLakhParts(result.savings).unit}
                    </span>
                  </div>
                  <div className="mega-price-meta-item">
                    <span className="mega-price-meta-label">Monthly EMI</span>
                    <span className="mega-price-meta-value">
                      {emiParts.rupee}{emiParts.value} {emiParts.unit}
                    </span>
                  </div>
                  <div className="mega-price-meta-item">
                    <span className="mega-price-meta-label">Loan tenure</span>
                    <span className="mega-price-meta-value">{form.tenure_months} mo</span>
                  </div>
                </div>
              </div>

              {/* SIDE-BY-SIDE COMPARISON */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Finance card */}
                <div className="card rise-d1" style={{
                  borderTop: '3px solid var(--blue)',
                  background: !isCash ? 'rgba(59,130,246,0.04)' : 'var(--bg3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span className="icon-chip icon-chip-blue" style={{ width: 28, height: 28 }}>
                      <CreditCard size={14} strokeWidth={2.2} />
                    </span>
                    <div style={{ fontFamily: 'var(--font-d)', fontSize: 12, fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      If you finance
                    </div>
                  </div>

                  {[
                    ['Loan amount',    fmtINR(result.loan_amount)],
                    ['Monthly EMI',    fmtINR(result.monthly_emi)],
                    ['Total interest', fmtINR(result.total_interest)],
                    ['Total outgo',    fmtINR(result.total_payment)],
                    ['Invest. earned', '+ ' + fmtINR(result.investment_gain)],
                    ['Effective cost', fmtINR(result.effective_finance_cost), true],
                  ].map(([k, v, bold]) => (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '9px 0', borderBottom: '1px solid var(--border)',
                      fontSize: 12.5,
                    }}>
                      <span style={{ color: 'var(--text2)' }}>{k}</span>
                      <span style={{
                        color: bold ? 'var(--text)' : (k === 'Invest. earned' ? 'var(--green)' : 'var(--text2)'),
                        fontFamily: 'var(--font-d)', fontWeight: bold ? 700 : 600,
                        fontSize: bold ? 14 : 12.5,
                      }}>
                        {v}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Cash card */}
                <div className="card rise-d2" style={{
                  borderTop: '3px solid var(--green)',
                  background: isCash ? 'rgba(34,197,94,0.04)' : 'var(--bg3)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span className="icon-chip icon-chip-green" style={{ width: 28, height: 28 }}>
                      <Banknote size={14} strokeWidth={2.2} />
                    </span>
                    <div style={{ fontFamily: 'var(--font-d)', fontSize: 12, fontWeight: 700, color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      If you pay cash
                    </div>
                  </div>

                  {[
                    ['Sticker price', fmtINR(parseFloat(form.car_price))],
                    ['Cash discount', `${result.cash_discount_pct}%`],
                    ['Down payment', 'Not needed'],
                    ['Opportunity lost', '— ' + fmtINR(result.investment_gain)],
                    ['You pay',       fmtINR(result.cash_price), true],
                  ].map(([k, v, bold]) => (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '9px 0', borderBottom: '1px solid var(--border)',
                      fontSize: 12.5,
                    }}>
                      <span style={{ color: 'var(--text2)' }}>{k}</span>
                      <span style={{
                        color: bold ? 'var(--text)' : (k === 'Opportunity lost' ? 'var(--red)' : 'var(--text2)'),
                        fontFamily: 'var(--font-d)', fontWeight: bold ? 700 : 600,
                        fontSize: bold ? 14 : 12.5,
                      }}>
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* DELTA STRIP */}
              <div className="card rise-d3" style={{
                padding: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 14, flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`icon-chip ${accentChip}`} style={{ width: 34, height: 34 }}>
                    {isCash ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                      Effective comparison (after investment returns)
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 2 }}>
                      Finance: <strong style={{ color: 'var(--text)' }}>{fmtINR(result.effective_finance_cost)}</strong>
                      {' '}vs cash <strong style={{ color: 'var(--text)' }}>{fmtINR(result.cash_price)}</strong>
                    </div>
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 700,
                  color: accentColor, letterSpacing: '-0.01em',
                  display: 'flex', alignItems: 'baseline', gap: 6,
                }}>
                  <ArrowRight size={18} />
                  {fmtLakhParts(result.savings).rupee}{fmtLakhParts(result.savings).value}
                  <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>{fmtLakhParts(result.savings).unit}</span>
                </div>
              </div>
            </>
          ) : (
            /* EMPTY STATE */
            <div className="card" style={{
              padding: 32, textAlign: 'center',
              minHeight: 360,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'url(/assets/hero-car-clean.svg)',
                backgroundSize: '160% auto',
                backgroundPosition: 'center 60%',
                backgroundRepeat: 'no-repeat',
                opacity: 0.05,
                pointerEvents: 'none',
              }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <span className="icon-chip icon-chip-green" style={{ width: 52, height: 52, marginBottom: 18 }}>
                  <Calculator size={22} strokeWidth={1.8} />
                </span>
                <div style={{ fontFamily: 'var(--font-d)', fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 6, letterSpacing: '0.02em' }}>
                  Cash or EMI?
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55, maxWidth: 320 }}>
                  Punch in your numbers on the left. We'll compute EMI, total interest,
                  and factor in what your spare cash could earn if invested — then tell
                  you which option actually costs less.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, type = 'text', step, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="fl">{label}</label>
      <div className="field-wrap" style={{ position: 'relative' }}>
        <Icon size={15} className="field-icon" />
        <input
          className="fi-premium"
          style={{ padding: '11px 14px 11px 40px', fontSize: 13.5 }}
          type={type} value={value} step={step}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
