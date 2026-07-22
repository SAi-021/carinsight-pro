import { useState, useEffect } from 'react';
import {
  Heart, Trash2, Plus, X, Calendar, Gauge, Fuel, Building2,
  Car, IndianRupee, StickyNote, CheckCircle2, AlertCircle,
  Sparkles, ChevronDown, ShoppingBag,
} from 'lucide-react';
import API from '../api/axios';
import { fmtINR, fmtLakhParts, fmtKM } from '../utils/format';
import { SkelLine, SkelBlock } from '../components/Skeleton';

/* ============================================================
   CarInsight Pro — Premium Wishlist
   Card grid with brand-name watermark + slide-in add form
   (theme-aware: light + dark)
   ============================================================ */

const FUEL_OPTIONS = [
  { value: 'petrol',   label: 'Petrol'   },
  { value: 'diesel',   label: 'Diesel'   },
  { value: 'cng',      label: 'CNG'      },
  { value: 'electric', label: 'Electric' },
  { value: 'lpg',      label: 'LPG'      },
];

export default function Wishlist() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({
    brand: '', brand_model: '', year: 2022, fuel: 'petrol',
    km_driven: 40000, price: 500000, notes: '',
  });
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState({});
  const [toast, setToast]     = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const showToast = (msg, type = 's') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchList = async () => {
    try {
      const { data } = await API.get('/wishlist');
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const validate = () => {
    const e = {};
    if (!form.brand.trim())       e.brand = 'Required';
    if (!form.brand_model.trim()) e.brand_model = 'Required';
    if (!form.price || form.price <= 0) e.price = 'Enter a price';
    if (!form.year || form.year < 1990) e.year = 'Invalid year';
    return e;
  };

  const handleAdd = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setSaving(true);
    try {
      await API.post('/wishlist', {
        ...form,
        brand: form.brand.trim().toLowerCase(),
        brand_model: form.brand_model.trim().toLowerCase(),
        year: parseInt(form.year),
        km_driven: parseFloat(form.km_driven),
        price: parseFloat(form.price),
      });
      showToast('Added to wishlist');
      setShowAdd(false);
      setForm({
        brand: '', brand_model: '', year: 2022, fuel: 'petrol',
        km_driven: 40000, price: 500000, notes: '',
      });
      fetchList();
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Failed to add', 'e');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/wishlist/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
      showToast('Removed');
    } catch (e) {
      showToast('Failed to remove', 'e');
    }
  };

  /* Aggregate stats */
  const totalValue = items.reduce((s, i) => s + (i.price || 0), 0);
  const avgPrice   = items.length ? totalValue / items.length : 0;
  const avgYear    = items.length
    ? Math.round(items.reduce((s, i) => s + (i.year || 0), 0) / items.length)
    : 0;

  return (
    <div className="page-wrap fade">

      {/* ══════════════ HEADER ══════════════ */}
      <header className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="icon-chip icon-chip-red" style={{ width: 44, height: 44 }}>
            <Heart size={20} strokeWidth={2} fill="currentColor" />
          </span>
          <div>
            <h1>My <span>wishlist</span></h1>
            <p>Save cars you're interested in · {items.length} saved · use Predict Price to vet each one</p>
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setErrors({}); }}
          className="btn btn-gold btn-press"
          style={{
            fontFamily: 'var(--font-d)', letterSpacing: '0.05em',
            textTransform: 'uppercase', fontSize: 13,
          }}>
          {showAdd ? <><X size={14} /> Cancel</> : <><Plus size={14} strokeWidth={2.5} /> Add a car</>}
        </button>
      </header>

      {/* ══════════════ STATS BAR (only when items exist) ══════════════ */}
      {!loading && items.length > 0 && (
        <div className="rise" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
          marginBottom: 20,
        }}>
          <StatChip icon={ShoppingBag} chipClass="icon-chip-gold"
            label="Saved cars" value={items.length} />
          <StatChip icon={IndianRupee} chipClass="icon-chip-green"
            label="Total value"
            value={`${fmtLakhParts(totalValue).rupee}${fmtLakhParts(totalValue).value} ${fmtLakhParts(totalValue).unit}`} />
          <StatChip icon={Calendar} chipClass="icon-chip-blue"
            label="Avg model year" value={avgYear || '—'} />
        </div>
      )}

      {/* ══════════════ ADD FORM (slide-in) ══════════════ */}
      {showAdd && (
        <div className="card rise" style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span className="icon-chip icon-chip-gold">
              <Sparkles size={16} strokeWidth={2} />
            </span>
            <div>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: 17, fontWeight: 600, letterSpacing: '0.02em' }}>
                Add a car to wishlist
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                Save it now, decide later · all fields editable
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>

            <Field icon={Building2} label="Brand" value={form.brand}
              onChange={(v) => set('brand', v)} placeholder="e.g. maruti"
              error={errors.brand} />

            <Field icon={Car} label="Model" value={form.brand_model}
              onChange={(v) => set('brand_model', v)} placeholder="e.g. maruti swift"
              error={errors.brand_model} />

            <Field icon={Calendar} label="Year" type="number" value={form.year}
              onChange={(v) => set('year', v)} min={1990} max={2026}
              error={errors.year} />

            <Field icon={IndianRupee} label="Asking price (₹)" type="number" value={form.price}
              onChange={(v) => set('price', v)}
              hint={form.price > 0 ? `≈ ${fmtINR(form.price)}` : ''}
              error={errors.price} />

            <Field icon={Gauge} label="KM driven" type="number" value={form.km_driven}
              onChange={(v) => set('km_driven', v)}
              hint={form.km_driven > 0 ? `≈ ${fmtKM(form.km_driven)}` : ''} />

            <SelectField icon={Fuel} label="Fuel" value={form.fuel}
              onChange={(v) => set('fuel', v)} options={FUEL_OPTIONS} />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="fl">Notes (optional)</label>
            <div className="field-wrap" style={{ position: 'relative' }}>
              <StickyNote size={15} className="field-icon" />
              <input
                className="fi-premium"
                style={{ padding: '11px 14px 11px 40px', fontSize: 13.5 }}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="e.g. Test-drive scheduled Saturday, seller seems flexible" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              onClick={handleAdd} disabled={saving}
              className="btn btn-gold btn-press"
              style={{
                fontFamily: 'var(--font-d)', letterSpacing: '0.05em',
                textTransform: 'uppercase', fontSize: 13, padding: '12px 22px',
              }}>
              {saving
                ? <><span className="spin" /> Saving…</>
                : <><Heart size={14} fill="currentColor" /> Save to wishlist</>}
            </button>
            <button
              onClick={() => { setShowAdd(false); setErrors({}); }}
              className="btn btn-ghost btn-press"
              style={{ fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ LIST ══════════════ */}
      {loading ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14,
        }}>
          {[1,2,3].map(i => <SkelBlock key={i} height={220} />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState onAddClick={() => setShowAdd(true)} />
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16,
        }}>
          {items.map((item, idx) => (
            <WishlistCard key={item.id} item={item} delay={idx}
              onDelete={() => handleDelete(item.id)} />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={toast.type === 'e' ? 'toast toast-e' : 'toast toast-s'}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.type === 'e' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   Individual wishlist card with brand watermark
   ─────────────────────────────────────────────────────────── */
function WishlistCard({ item, onDelete, delay }) {
  const priceParts = fmtLakhParts(item.price);
  const brandUpper = (item.brand || '').toUpperCase();
  const delayClass = ['rise', 'rise-d1', 'rise-d2', 'rise-d3', 'rise-d4'][Math.min(delay, 4)];

  return (
    <div className={`card ${delayClass}`} style={{
      position: 'relative', overflow: 'hidden',
      padding: 20, transition: 'all 0.25s',
      cursor: 'default',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(240,165,0,0.12)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)';  e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Brand wash */}
      <div style={{
        position: 'absolute',
        top: -10, right: -14,
        fontFamily: 'var(--font-d)',
        fontSize: 100, fontWeight: 700,
        color: 'var(--gold)',
        opacity: 0.05,
        lineHeight: 0.9,
        letterSpacing: '-0.04em',
        pointerEvents: 'none',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        {brandUpper}
      </div>

      {/* Remove button */}
      <button onClick={onDelete}
        className="btn-press"
        style={{
          position: 'absolute', top: 14, right: 14,
          background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 7, padding: '5px 9px',
          cursor: 'pointer', color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-b)',
          transition: 'all 0.2s', zIndex: 2,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
        title="Remove from wishlist">
        <Trash2 size={11} /> Remove
      </button>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Brand + model */}
        <div style={{
          fontSize: 10, color: 'var(--text3)',
          letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
          marginBottom: 4, paddingRight: 90,
        }}>
          {item.brand || '—'}
        </div>
        <div style={{
          fontFamily: 'var(--font-d)', fontSize: 19, fontWeight: 600,
          color: 'var(--text)', marginBottom: 14,
          textTransform: 'capitalize', paddingRight: 90,
          lineHeight: 1.15, letterSpacing: '-0.01em',
        }}>
          {item.brand_model || item.brand}
        </div>

        {/* Price (mega) */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 4,
          fontFamily: 'var(--font-d)', fontWeight: 700,
          color: 'var(--gold)',
          fontSize: 32, letterSpacing: '-0.02em',
          lineHeight: 1, marginBottom: 14,
        }}>
          <span style={{ fontSize: 20, opacity: 0.85 }}>{priceParts.rupee}</span>
          {priceParts.value}
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>
            {priceParts.unit}
          </span>
        </div>

        {/* Spec tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <SpecTag icon={Calendar} value={item.year} />
          <SpecTag icon={Gauge} value={fmtKM(item.km_driven)} />
          <SpecTag icon={Fuel} value={item.fuel?.toUpperCase()} />
        </div>

        {/* Notes */}
        {item.notes && (
          <div style={{
            padding: '10px 12px', marginBottom: 10,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <StickyNote size={12} style={{
              color: 'var(--gold)', flexShrink: 0, marginTop: 2, opacity: 0.7,
            }} />
            <div style={{
              fontSize: 12, color: 'var(--text2)', lineHeight: 1.5,
              fontStyle: 'italic',
            }}>
              {item.notes}
            </div>
          </div>
        )}

        {/* Saved timestamp */}
        <div style={{
          fontSize: 10.5, color: 'var(--text3)',
          letterSpacing: '0.06em', fontWeight: 500,
          paddingTop: 10, borderTop: '1px dashed var(--border)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Heart size={10} fill="currentColor" style={{ color: 'var(--gold)', opacity: 0.5 }} />
          Saved {new Date(item.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </div>
      </div>
    </div>
  );
}

/* Pill-shaped spec tag */
function SpecTag({ icon: Icon, value }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 100,
      padding: '4px 10px',
      fontSize: 11, color: 'var(--text2)',
      fontFamily: 'var(--font-b)',
    }}>
      <Icon size={10} style={{ color: 'var(--text3)' }} />
      {value}
    </span>
  );
}

/* Stat chip strip */
function StatChip({ icon: Icon, chipClass, label, value }) {
  return (
    <div className="card" style={{
      padding: 16, display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span className={`icon-chip ${chipClass}`} style={{ width: 36, height: 36 }}>
        <Icon size={16} strokeWidth={2} />
      </span>
      <div>
        <div style={{
          fontFamily: 'var(--font-d)', fontSize: 18, fontWeight: 700,
          color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.01em',
        }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* Empty state */
function EmptyState({ onAddClick }) {
  return (
    <div className="card" style={{
      padding: 60, textAlign: 'center',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 320,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/assets/hero-car-clean.svg)',
        backgroundSize: '120% auto',
        backgroundPosition: 'center 60%',
        backgroundRepeat: 'no-repeat',
        opacity: 0.05,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <span className="icon-chip icon-chip-red" style={{ width: 56, height: 56, marginBottom: 18 }}>
          <Heart size={26} strokeWidth={1.8} />
        </span>
        <div style={{
          fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 600,
          color: 'var(--text)', marginBottom: 8, letterSpacing: '0.02em',
        }}>
          Your wishlist is empty
        </div>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 380, marginBottom: 18 }}>
          Save cars you're considering, jot down notes, and revisit them later.
          We'll keep prices, specs, and your thoughts in one place.
        </p>
        <button onClick={onAddClick}
          className="btn btn-gold btn-press"
          style={{
            fontFamily: 'var(--font-d)', letterSpacing: '0.06em',
            textTransform: 'uppercase', fontSize: 13,
          }}>
          <Plus size={14} strokeWidth={2.5} /> Add your first car
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   Field primitives
   ─────────────────────────────────────────────────────────── */
function Field({ icon: Icon, label, value, onChange, placeholder, type = 'text', min, max, hint, error }) {
  return (
    <div>
      <label className="fl">{label}</label>
      <div className="field-wrap" style={{ position: 'relative' }}>
        <Icon size={15} className="field-icon" />
        <input
          className="fi-premium"
          style={{ padding: '11px 14px 11px 40px', fontSize: 13.5,
            borderColor: error ? 'var(--red)' : undefined,
          }}
          type={type} value={value}
          min={min} max={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {error && <div className="ferr">{error}</div>}
      {hint && !error && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

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
