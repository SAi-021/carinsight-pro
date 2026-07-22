import { useState } from 'react';
import {
  Star, Car, Fuel, Calendar, Gauge, Users, Wallet, Sparkles,
  Trophy, Medal, Award, Heart, AlertCircle, ChevronDown,
  Target, Briefcase, MapPin, Mountain,
} from 'lucide-react';
import API from '../api/axios';
import { fmtINR, fmtLakhParts, fmtKM } from '../utils/format';
import { SkelLine, SkelBlock } from '../components/Skeleton';

/* ============================================================
   CarInsight Pro — Premium Recommendations
   Podium layout: #1 hero on top, #2 + #3 side-by-side below
   (theme-aware: light + dark)
   ============================================================ */

const PURPOSE_META = {
  Personal:    { icon: Target,    color: 'icon-chip-gold',  hint: 'Daily commute, family use' },
  Taxi:        { icon: MapPin,    color: 'icon-chip-blue',  hint: 'Commercial, fleet ops' },
  Company:     { icon: Briefcase, color: 'icon-chip-purp',  hint: 'Executive / corporate' },
  'Long Drive':{ icon: MapPin,    color: 'icon-chip-teal',  hint: 'Highway-heavy use' },
  'Off-road':  { icon: Mountain,  color: 'icon-chip-green', hint: 'SUV / rugged terrain' },
};

const PRESETS = [
  { label: '₹5L · Personal',       form: { budget: 500000,  purpose: 'Personal',   seats: 5, fuel_pref: '' } },
  { label: '₹10L · Long Drive',    form: { budget: 1000000, purpose: 'Long Drive', seats: 5, fuel_pref: 'diesel' } },
  { label: '₹3L · Taxi · CNG',     form: { budget: 300000,  purpose: 'Taxi',       seats: 5, fuel_pref: 'cng' } },
];

export default function Recommend() {
  const [form, setForm] = useState({
    budget: 500000, purpose: 'Personal', seats: 5, fuel_pref: '',
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(''); setLoading(true); setResult(null);

    const budgetNum = parseFloat(form.budget);
    if (!budgetNum || budgetNum <= 0 || isNaN(budgetNum)) {
      setError('Please enter a budget greater than ₹0.');
      setLoading(false);
      return;
    }
    if (budgetNum < 50000) {
      setError('Budget must be at least ₹50,000.');
      setLoading(false);
      return;
    }

    try {
      const { data } = await API.post('/recommend', {
        budget:    budgetNum,
        purpose:   form.purpose,
        seats:     parseInt(form.seats),
        fuel_pref: form.fuel_pref || null,
      });
      setResult(data);
    } catch (err) {
      const d = err?.response?.data?.detail;
      let msg = 'No cars matched your criteria. Try a higher budget.';
      if (typeof d === 'string') {
        msg = d;
      } else if (Array.isArray(d) && d.length > 0) {
        msg = d.map(e => e?.msg || 'Invalid input').join('; ');
      } else if (d && typeof d === 'object' && d.msg) {
        msg = d.msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (p) => { setForm(p.form); setResult(null); setError(''); };

  const purpose = PURPOSE_META[form.purpose] || PURPOSE_META.Personal;
  const PurposeIcon = purpose.icon;

  return (
    <div className="page-wrap fade">

      {/* ══════════════ HEADER ══════════════ */}
      <header className="ph">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="icon-chip icon-chip-purp" style={{ width: 44, height: 44 }}>
            <Star size={20} strokeWidth={2} fill="currentColor" />
          </span>
          <div>
            <h1>Car <span>recommendations</span></h1>
            <p>Top 3 matches scored on 7 factors — budget fit, age, mileage, fuel, purpose, brand reputation, listing popularity</p>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text3)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4,
          }}>
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

      {/* ══════════════ PREFERENCES CARD (full width) ══════════════ */}
      <div className="card rise" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span className={`icon-chip ${purpose.color}`}>
            <PurposeIcon size={16} strokeWidth={2} />
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-d)', fontSize: 17, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>
              Your preferences
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
              {purpose.hint}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <div>
            <label className="fl">Budget (₹)</label>
            <div className="field-wrap" style={{ position: 'relative' }}>
              <Wallet size={15} className="field-icon" />
              <input className="fi-premium" type="number" min="50000"
                style={{ padding: '11px 14px 11px 40px', fontSize: 13.5 }}
                value={form.budget}
                onChange={(e) => set('budget', e.target.value)}
                placeholder="e.g. 500000" />
            </div>
            {form.budget > 0 && (
              <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4, fontWeight: 600 }}>
                ≈ {fmtLakhParts(form.budget).rupee}{fmtLakhParts(form.budget).value} {fmtLakhParts(form.budget).unit}
              </div>
            )}
          </div>

          <SelectField icon={Target} label="Purpose" value={form.purpose}
            onChange={(v) => set('purpose', v)}
            options={['Personal','Taxi','Company','Long Drive','Off-road'].map(p => ({ value: p, label: p }))} />

          <SelectField icon={Users} label="Seats needed" value={form.seats}
            onChange={(v) => set('seats', parseInt(v))}
            options={[2,4,5,6,7,8,9].map(s => ({ value: s, label: `${s} seats` }))} />

          <SelectField icon={Fuel} label="Fuel preference" value={form.fuel_pref}
            onChange={(v) => set('fuel_pref', v)}
            options={[
              { value: '',        label: 'Any fuel' },
              { value: 'petrol',  label: 'Petrol' },
              { value: 'diesel',  label: 'Diesel' },
              { value: 'cng',     label: 'CNG' },
              { value: 'electric',label: 'Electric' },
            ]} />
        </div>

        <button onClick={submit} disabled={loading}
          className="btn btn-gold btn-press"
          style={{
            marginTop: 22, padding: '13px 28px',
            fontFamily: 'var(--font-d)', fontSize: 14,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
          {loading
            ? <><span className="spin" /> Scoring cars…</>
            : <><Star size={16} strokeWidth={2.5} fill="currentColor" /> Find my top 3 cars</>}
        </button>

        {error && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, fontSize: 12.5, color: 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>

      {/* ══════════════ RESULT ══════════════ */}
      {loading && <LoadingPodium />}

      {result && !loading && (
        <>
          {/* Summary strip */}
          <div className="card rise" style={{
            marginBottom: 18, padding: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="icon-chip icon-chip-gold" style={{ width: 32, height: 32 }}>
                <Trophy size={14} strokeWidth={2.2} />
              </span>
              <div>
                <div style={{
                  fontFamily: 'var(--font-d)', fontSize: 13, fontWeight: 700,
                  color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>
                  Top picks ready
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  Scored <strong style={{ color: 'var(--text)' }}>{result.total_found}</strong> cars within
                  budget of <strong style={{ color: 'var(--gold)' }}>
                    {fmtLakhParts(result.budget_lakh * 100000).rupee}{fmtLakhParts(result.budget_lakh * 100000).value} {fmtLakhParts(result.budget_lakh * 100000).unit}
                  </strong>
                </div>
              </div>
            </div>
            <span className="badge b-gold" style={{ alignSelf: 'center' }}>
              {result.cars.length} matches
            </span>
          </div>

          {/* WARNING BANNER */}
          {result.warning && (
            <div className="rise" style={{
              marginBottom: 16, padding: '12px 16px',
              background: 'rgba(240,165,0,0.08)',
              border: '1px solid rgba(240,165,0,0.35)',
              borderRadius: 9,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <AlertCircle size={16} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{
                  fontFamily: 'var(--font-d)', fontSize: 11, fontWeight: 700,
                  color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase',
                  marginBottom: 3,
                }}>
                  Heads up
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>
                  {result.warning}
                </div>
                {result.used_filter && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>
                    Filter applied: {result.used_filter}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PODIUM */}
          {result.cars[0] && <PodiumCard car={result.cars[0]} rank={1} />}

          {(result.cars[1] || result.cars[2]) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: result.cars[2] ? '1fr 1fr' : '1fr',
              gap: 16, marginTop: 16,
            }}>
              {result.cars[1] && <PodiumCard car={result.cars[1]} rank={2} />}
              {result.cars[2] && <PodiumCard car={result.cars[2]} rank={3} />}
            </div>
          )}
        </>
      )}

      {!result && !loading && (
        <EmptyState />
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   The podium card — handles all 3 ranks with different sizing
   ─────────────────────────────────────────────────────────── */
function PodiumCard({ car, rank }) {
  const isHero = rank === 1;

  const rankMeta = {
    1: { icon: Trophy, label: 'Best match',  color: 'var(--gold)',  chipBg: 'rgba(240,165,0,0.12)' },
    2: { icon: Medal,  label: 'Runner up',   color: '#9aa6b5',      chipBg: 'rgba(154,166,181,0.14)' },
    3: { icon: Award,  label: 'Third pick',  color: '#cd7f32',      chipBg: 'rgba(205,127,50,0.15)' },
  };
  const meta = rankMeta[rank];
  const RankIcon = meta.icon;

  const priceParts = fmtLakhParts(car.selling_price);
  const brandUpper = (car.brand || '').toUpperCase();

  return (
    <div className={`rise-d${rank}`} style={{
      position: 'relative',
      borderRadius: isHero ? 16 : 12,
      padding: isHero ? '32px 32px 28px' : '24px',
      background: isHero
        ? `radial-gradient(circle at 20% 0%, rgba(240,165,0,0.14) 0%, transparent 50%),
           radial-gradient(circle at 80% 100%, rgba(59,130,246,0.06) 0%, transparent 50%),
           var(--bg3)`
        : 'var(--bg3)',
      border: `1px solid ${isHero ? meta.color : 'var(--border2)'}`,
      boxShadow: isHero
        ? `0 0 0 1px ${meta.color}, 0 0 28px var(--gold-glow), 0 0 60px rgba(240,165,0,0.10)`
        : 'var(--shadow-card)',
      overflow: 'hidden',
    }}>

      {/* Brand-name wash background */}
      <div style={{
        position: 'absolute',
        top: isHero ? -10 : -8,
        right: isHero ? -20 : -10,
        fontFamily: 'var(--font-d)',
        fontSize: isHero ? 180 : 110,
        fontWeight: 700,
        color: meta.color,
        opacity: isHero ? 0.09 : 0.08,
        lineHeight: 0.9,
        letterSpacing: '-0.04em',
        pointerEvents: 'none',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        {brandUpper}
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* TOP: rank chip + score */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: isHero ? 16 : 12,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: isHero ? '6px 14px' : '4px 10px',
            background: meta.chipBg,
            border: `1px solid ${meta.color}`,
            borderRadius: 100,
            fontSize: isHero ? 11 : 10,
            fontWeight: 700,
            color: meta.color,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            <RankIcon size={isHero ? 14 : 12} strokeWidth={2.2} fill="currentColor" />
            #{rank} · {meta.label}
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text3)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
              Match score
            </div>
            <div style={{
              fontFamily: 'var(--font-d)',
              fontSize: isHero ? 28 : 22,
              fontWeight: 700,
              color: meta.color,
              lineHeight: 1, marginTop: 2,
            }}>
              {car.score.toFixed(1)}
              <span style={{ fontSize: isHero ? 14 : 11, color: 'var(--text3)', fontWeight: 500, marginLeft: 4 }}>
                /100
              </span>
            </div>
            {car.match_quality && (
              <div style={{
                marginTop: 6,
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 100,
                fontSize: 9.5, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                background:
                  car.match_quality === 'Excellent' ? 'rgba(34,197,94,0.15)' :
                  car.match_quality === 'Good'      ? 'rgba(59,130,246,0.15)' :
                  car.match_quality === 'Over budget' ? 'rgba(239,68,68,0.15)' :
                                                       'rgba(168,85,247,0.15)',
                color:
                  car.match_quality === 'Excellent' ? 'var(--green)' :
                  car.match_quality === 'Good'      ? 'var(--blue)' :
                  car.match_quality === 'Over budget' ? 'var(--red)' :
                                                       'var(--purple)',
              }}>
                {car.match_quality}
              </div>
            )}
            {car.budget_use_pct != null && (
              <div style={{
                fontSize: 10, color: 'var(--text3)', marginTop: 4,
                fontFamily: 'var(--font-d)', fontWeight: 500,
              }}>
                Uses {car.budget_use_pct}% of budget
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE: model name + price */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16, marginBottom: isHero ? 20 : 14,
        }}>
          <div>
            <div style={{
              fontSize: 10, color: 'var(--text3)',
              letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
              marginBottom: 4,
            }}>
              {car.brand}
            </div>
            <h3 style={{
              fontFamily: 'var(--font-d)',
              fontSize: isHero ? 32 : 22,
              fontWeight: 700,
              color: 'var(--text)',
              textTransform: 'capitalize',
              letterSpacing: '-0.01em', lineHeight: 1.1,
            }}>
              {car.brand_model || car.brand}
            </h3>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 4,
              fontFamily: 'var(--font-d)', fontWeight: 700,
              color: meta.color,
              fontSize: isHero ? 44 : 28,
              letterSpacing: '-0.02em', lineHeight: 1,
            }}>
              <span style={{ fontSize: isHero ? 28 : 18, opacity: 0.85 }}>{priceParts.rupee}</span>
              {priceParts.value}
              <span style={{ fontSize: isHero ? 16 : 13, color: 'var(--text2)', fontWeight: 500 }}>
                {priceParts.unit}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              ≈ {fmtINR(car.selling_price)}
            </div>
          </div>
        </div>

        {/* SPECS strip */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: isHero ? 14 : 10,
          padding: isHero ? '14px 0' : '10px 0',
          borderTop: '1px dashed var(--border2)',
          borderBottom: '1px dashed var(--border2)',
          marginBottom: isHero ? 18 : 12,
        }}>
          <Spec icon={Calendar} label="Year" value={car.year} hero={isHero} />
          <Spec icon={Gauge} label="Driven" value={fmtKM(car.km_driven)} hero={isHero} />
          <Spec icon={Fuel} label="Fuel" value={car.fuel?.toUpperCase()} hero={isHero} />
          <Spec icon={Car} label="Make" value={car.brand?.toUpperCase()} hero={isHero} />
        </div>

        {/* WHY THIS CAR */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 9,
          padding: isHero ? '14px 16px' : '11px 13px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span className="icon-chip" style={{
            width: 26, height: 26, borderRadius: 6,
            background: meta.chipBg, color: meta.color,
            flexShrink: 0,
          }}>
            <Sparkles size={12} strokeWidth={2.2} />
          </span>
          <div>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: meta.color,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: 3,
            }}>
              Why this car
            </div>
            <p style={{
              fontSize: isHero ? 13 : 12,
              color: 'var(--text2)',
              lineHeight: 1.55,
            }}>
              {car.reason || 'Strong match across multiple factors.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Single spec pill inside a podium card */
function Spec({ icon: Icon, label, value, hero }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      fontSize: hero ? 12.5 : 11.5, color: 'var(--text2)',
    }}>
      <Icon size={hero ? 13 : 12} style={{ color: 'var(--text3)' }} />
      <span style={{ color: 'var(--text3)', fontSize: hero ? 10 : 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: 500, fontFamily: 'var(--font-d)' }}>{value}</span>
    </div>
  );
}

/* Loading state: 3 skeleton blocks shaped like the podium */
function LoadingPodium() {
  return (
    <>
      <div className="rise" style={{
        height: 280, borderRadius: 16, padding: 32,
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <SkelLine width={130} height={22} />
        <SkelLine width={300} height={36} />
        <SkelLine width={200} height={50} />
        <SkelLine width="100%" height={1} style={{ marginTop: 'auto' }} />
        <SkelLine width="80%" height={36} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[2,3].map(r => (
          <div key={r} className="rise-d2" style={{
            height: 220, borderRadius: 12, padding: 24,
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <SkelLine width={120} height={18} />
            <SkelLine width="80%" height={28} />
            <SkelLine width={100} height={32} />
            <SkelBlock height={60} />
          </div>
        ))}
      </div>
    </>
  );
}

/* Empty state */
function EmptyState() {
  return (
    <div className="card" style={{
      padding: 60, textAlign: 'center',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 360,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/assets/hero-car-clean.svg)',
        backgroundSize: '110% auto',
        backgroundPosition: 'center 60%',
        backgroundRepeat: 'no-repeat',
        opacity: 0.05,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 380 }}>
        <span className="icon-chip icon-chip-purp" style={{ width: 56, height: 56, marginBottom: 18 }}>
          <Trophy size={26} strokeWidth={1.8} />
        </span>
        <div style={{
          fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 600,
          color: 'var(--text)', marginBottom: 8, letterSpacing: '0.02em',
        }}>
          Set your budget and preferences
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          We'll score 7,889 listings on 7 factors — age, mileage, budget fit, fuel match,
          purpose alignment, brand reputation, and listing popularity — then surface your
          top 3 picks.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   Reusable select field with icon
   ─────────────────────────────────────────────────────────── */
function SelectField({ icon: Icon, label, value, onChange, options }) {
  return (
    <div>
      <label className="fl">{label}</label>
      <div className="field-wrap" style={{ position: 'relative' }}>
        <Icon size={15} className="field-icon" />
        <ChevronDown size={14} style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text3)', pointerEvents: 'none',
        }} />
        <select
          className="fi-premium"
          style={{
            padding: '11px 36px 11px 40px', fontSize: 13.5,
            appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
            cursor: 'pointer',
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
