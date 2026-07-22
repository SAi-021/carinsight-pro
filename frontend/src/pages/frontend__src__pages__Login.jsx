import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight,
  Sparkles, TrendingUp, AlertCircle, CheckCircle2,
} from 'lucide-react';
import API from '../api/axios';

/* ============================================================
   CarInsight Pro — Premium Login / Signup
   50/50 split: hero wireframe car (left) + auth form (right)
   ============================================================ */

const FEATURES = [
  { icon: TrendingUp, label: 'R² 0.95 Gradient Boosting model' },
  { icon: Sparkles,   label: '7,889 Indian listings · 21 brands' },
];

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode]       = useState('login');
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [apiErr, setApiErr]   = useState('');
  const [ok, setOk]           = useState('');

  const validate = () => {
    const e = {};
    if (mode === 'signup' && form.name.trim().length < 2) e.name = 'Please enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (form.password.length < 6) e.password = 'Minimum 6 characters';
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setApiErr(''); setOk(''); setLoading(true);
    try {
      if (mode === 'signup') {
        await API.post('/auth/signup', {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        setOk('Account created. Please log in.');
        setMode('login');
        setForm({ name: '', email: form.email, password: '' });
      } else {
        const { data } = await API.post('/auth/login', {
          email: form.email.trim(),
          password: form.password,
        });
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('userName', data.name || form.email.split('@')[0]);
        localStorage.setItem('isAdmin', data.is_admin ? 'true' : 'false');
        navigate('/dashboard');
      }
    } catch (err) {
      setApiErr(err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="login-shell">

      {/* ═══════════════ LEFT — HERO ═══════════════ */}
      <aside className="login-hero">
        <div className="login-hero-bg" />
        <div className="login-hero-overlay" />

        {/* Top: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 2 }}>
          <img src="/assets/logo-mark.svg" alt="CarInsight Pro" width={44} height={44}
               style={{ filter: 'drop-shadow(0 4px 16px rgba(240,165,0,0.4))' }} />
          <div>
            <div style={{
              fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700,
              letterSpacing: '0.04em', color: 'var(--text)', lineHeight: 1,
            }}>CarInsight</div>
            <div style={{
              fontSize: 10, color: 'var(--gold)', letterSpacing: '0.18em',
              textTransform: 'uppercase', fontWeight: 700, marginTop: 2,
            }}>Pro · ML Edition</div>
          </div>
        </div>

        {/* Spacer to push value-prop down */}
        <div style={{ flex: 1 }} />

        {/* Value prop block */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 480 }}>
          <span className="feature-pill rise">
            <span className="pulse-dot" /> LIVE INFERENCE · R² 0.9501
          </span>

          <h1 className="rise-d1" style={{
            fontFamily: 'var(--font-d)', fontSize: 44, fontWeight: 700,
            letterSpacing: '-0.01em', lineHeight: 1.08,
            color: 'var(--text)', marginTop: 18, marginBottom: 14,
          }}>
            Price every <span style={{ color: 'var(--gold)' }}>used car</span><br />
            with confidence.
          </h1>

          <p className="rise-d2" style={{
            fontSize: 14.5, color: 'var(--text2)', lineHeight: 1.65,
            marginBottom: 28, maxWidth: 440,
          }}>
            Get instant, data-backed price predictions and resale valuations
            for any used car. Buy smarter, sell at a fair price, and skip the
            guesswork.
          </p>

          <div className="rise-d3" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            {FEATURES.map(({ icon: Icon, label }, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'rgba(13,16,23,0.5)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}>
                <span className="icon-chip icon-chip-gold" style={{ width: 28, height: 28, borderRadius: 7 }}>
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

      </aside>

      {/* ═══════════════ RIGHT — FORM ═══════════════ */}
      <main className="login-form-side">
        <div className="login-form-wrap">

          {/* Mobile-only logo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 28,
          }} className="mob-logo">
            <img src="/assets/logo-mark.svg" alt="" width={36} height={36} />
            <div style={{
              fontFamily: 'var(--font-d)', fontSize: 19, fontWeight: 700,
              letterSpacing: '0.04em',
            }}>CarInsight <span style={{ color: 'var(--gold)' }}>Pro</span></div>
          </div>

          <h2 className="rise" style={{
            fontFamily: 'var(--font-d)', fontSize: 30, fontWeight: 700,
            color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 6,
          }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="rise-d1" style={{
            fontSize: 13.5, color: 'var(--text2)', marginBottom: 26,
          }}>
            {mode === 'login'
              ? 'Sign in to access your predictions, resale logs, and wishlist.'
              : 'Join in 20 seconds — no credit card, just an email.'}
          </p>

          {/* Tab switcher */}
          <div className="tab-switch rise-d2">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); setErrors({}); setApiErr(''); }}>
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => { setMode('signup'); setErrors({}); setApiErr(''); }}>
              Sign up
            </button>
          </div>

          {/* Status banners */}
          {ok && (
            <div className="rise" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', marginBottom: 16,
              background: 'rgba(34,197,94,0.10)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 9, fontSize: 13, color: 'var(--green)',
            }}>
              <CheckCircle2 size={16} /> {ok}
            </div>
          )}
          {apiErr && (
            <div className="rise" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', marginBottom: 16,
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 9, fontSize: 13, color: 'var(--red)',
            }}>
              <AlertCircle size={16} /> {apiErr}
            </div>
          )}

          {/* ──── Name (signup only) ──── */}
          {mode === 'signup' && (
            <div className="rise-d2" style={{ marginBottom: 14 }}>
              <label className="fl">Full name</label>
              <div className="field-wrap" style={{ position: 'relative' }}>
                <User size={16} className="field-icon" />
                <input
                  className="fi-premium"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={onKey}
                  autoFocus
                />
              </div>
              {errors.name && <div className="ferr">{errors.name}</div>}
            </div>
          )}

          {/* ──── Email ──── */}
          <div className="rise-d3" style={{ marginBottom: 14 }}>
            <label className="fl">Email address</label>
            <div className="field-wrap" style={{ position: 'relative' }}>
              <Mail size={16} className="field-icon" />
              <input
                className="fi-premium"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onKeyDown={onKey}
                autoFocus={mode === 'login'}
              />
            </div>
            {errors.email && <div className="ferr">{errors.email}</div>}
          </div>

          {/* ──── Password ──── */}
          <div className="rise-d3" style={{ marginBottom: 22 }}>
            <label className="fl" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Password</span>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setApiErr('Password reset is coming soon. For now, please email support@carinsight.example to recover your account.')}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: 10, color: 'var(--gold)',
                    letterSpacing: '0.05em', fontWeight: 600, fontFamily: 'var(--font-b)',
                  }}>
                  Forgot?
                </button>
              )}
            </label>
            <div className="field-wrap" style={{ position: 'relative' }}>
              <Lock size={16} className="field-icon" />
              <input
                className="fi-premium"
                style={{ paddingRight: 44 }}
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={onKey}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', padding: 4,
                }}
                aria-label="Toggle password visibility">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <div className="ferr">{errors.password}</div>}
            {mode === 'signup' && !errors.password && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                Use at least 6 characters. We hash with bcrypt.
              </div>
            )}
          </div>

          {/* ──── Submit ──── */}
          <button
            onClick={submit}
            disabled={loading}
            className="btn btn-gold btn-full btn-lg btn-press rise-d4"
            style={{
              fontFamily: 'var(--font-d)', letterSpacing: '0.05em',
              textTransform: 'uppercase', fontSize: 14,
            }}>
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <span className="spin" /> Working…
              </span>
            ) : (
              <>
                {mode === 'login' ? 'Sign in' : 'Create account'}
                <ArrowRight size={16} strokeWidth={2.5} />
              </>
            )}
          </button>

          {/* Footer micro-copy */}
          <p className="rise-d4" style={{
            marginTop: 22, fontSize: 11.5, color: 'var(--text3)',
            textAlign: 'center', lineHeight: 1.6,
          }}>
            By continuing you agree to our Terms & Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
