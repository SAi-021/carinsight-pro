import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, Lock, User, Eye, EyeOff, ArrowRight,
  Sparkles, TrendingUp, AlertCircle, CheckCircle2, ShieldCheck,
} from 'lucide-react';
import API from '../api/axios';

/* ============================================================
   CarInsight Pro — Premium Login / Signup (with email OTP)
   50/50 split: hero wireframe car (left) + auth form (right)
   Signup is now 2-step: form -> 4-digit OTP -> account created
   ============================================================ */

const FEATURES = [
  { icon: TrendingUp, label: 'R² 0.95 Gradient Boosting model' },
  { icon: Sparkles,   label: '7,889 Indian listings · 21 brands' },
];

const RESEND_COOLDOWN = 30;   // seconds, matches backend

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode]       = useState('login');   // 'login' | 'signup' | 'otp'
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [apiErr, setApiErr]   = useState('');
  const [ok, setOk]           = useState('');

  // ── OTP state ──
  const [otp, setOtp]         = useState(['', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef([]);

  // ── Forgot-password state ──
  // forgot flow modes: 'forgot' (enter email) -> 'reset' (otp + new password)
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp]     = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Password strength checks (strict): 8+, upper, lower, number, symbol
  const pwChecks = (pw) => ({
    len:    pw.length >= 8,
    upper:  /[A-Z]/.test(pw),
    lower:  /[a-z]/.test(pw),
    num:    /[0-9]/.test(pw),
    sym:    /[^A-Za-z0-9]/.test(pw),
  });
  const pwAllGood = (pw) => Object.values(pwChecks(pw)).every(Boolean);

  // Cooldown ticker for the resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const validate = () => {
    const e = {};
    if (mode === 'signup' && form.name.trim().length < 2) e.name = 'Please enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (mode === 'signup') {
      if (!pwAllGood(form.password)) e.password = 'Password does not meet all requirements';
    } else if (form.password.length < 1) {
      e.password = 'Enter your password';
    }
    return e;
  };

  // ── Forgot password: request reset code ──
  const requestReset = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setApiErr('Enter a valid email'); return;
    }
    setApiErr(''); setOk(''); setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email: resetEmail.trim() });
      setMode('reset');
      setCooldown(RESEND_COOLDOWN);
      setOk('If an account exists, a reset code has been sent.');
    } catch (err) {
      setApiErr(err?.response?.data?.detail || 'Could not send reset code.');
    } finally { setLoading(false); }
  };

  // ── Forgot password: verify code + set new password ──
  const doReset = async () => {
    if (resetOtp.trim().length !== 4) { setApiErr('Enter the 4-digit code.'); return; }
    if (!pwAllGood(newPwd)) { setApiErr('New password does not meet all requirements.'); return; }
    setApiErr(''); setOk(''); setLoading(true);
    try {
      await API.post('/auth/reset-password', {
        email: resetEmail.trim(), otp: resetOtp.trim(), new_password: newPwd,
      });
      setMode('login');
      setOk('Password reset successfully. Please log in.');
      setForm({ name: '', email: resetEmail, password: '' });
      setResetOtp(''); setNewPwd('');
    } catch (err) {
      setApiErr(err?.response?.data?.detail || 'Reset failed.');
    } finally { setLoading(false); }
  };

  const resendReset = async () => {
    if (cooldown > 0) return;
    setApiErr(''); setOk(''); setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email: resetEmail.trim() });
      setCooldown(RESEND_COOLDOWN);
      setOk('A new reset code has been sent.');
    } catch (err) {
      setApiErr(err?.response?.data?.detail || 'Could not resend.');
    } finally { setLoading(false); }
  };

  // ── LOGIN + SIGNUP-REQUEST-OTP submit ──
  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({}); setApiErr(''); setOk(''); setLoading(true);
    try {
      if (mode === 'signup') {
        // Step 1: request an OTP instead of creating the account directly
        await API.post('/auth/request-otp', {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        setOtp(['', '', '', '']);
        setMode('otp');
        setCooldown(RESEND_COOLDOWN);
        setOk(`We sent a 4-digit code to ${form.email.trim()}`);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
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

  // ── VERIFY OTP -> create account ──
  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 4) { setApiErr('Please enter the 4-digit code.'); return; }
    setApiErr(''); setOk(''); setLoading(true);
    try {
      await API.post('/auth/verify-otp', {
        email: form.email.trim(),
        otp: code,
      });
      // Success — account created. Send them to login.
      setMode('login');
      setOk('Email verified & account created. Please log in.');
      setForm({ name: '', email: form.email, password: '' });
      setOtp(['', '', '', '']);
    } catch (err) {
      setApiErr(err?.response?.data?.detail || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── RESEND OTP ──
  const resendOtp = async () => {
    if (cooldown > 0) return;
    setApiErr(''); setOk(''); setLoading(true);
    try {
      await API.post('/auth/request-otp', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setCooldown(RESEND_COOLDOWN);
      setOk('A new code has been sent.');
      setOtp(['', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setApiErr(err?.response?.data?.detail || 'Could not resend the code.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP box input handling ──
  const onOtpChange = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);   // keep only last digit
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 3) otpRefs.current[i + 1]?.focus();
  };
  const onOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'Enter') verifyOtp();
  };
  const onOtpPaste = (e) => {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
    if (text.length) {
      e.preventDefault();
      const next = ['', '', '', ''];
      for (let k = 0; k < text.length; k++) next[k] = text[k];
      setOtp(next);
      otpRefs.current[Math.min(text.length, 3)]?.focus();
    }
  };

  const onKey = (e) => { if (e.key === 'Enter') submit(); };

  const backToSignup = () => {
    setMode('signup'); setApiErr(''); setOk(''); setOtp(['', '', '', '']);
  };

  return (
    <div className="login-shell">

      {/* ═══════════════ LEFT — HERO ═══════════════ */}
      <aside className="login-hero"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const cx = (e.clientX - r.left) / r.width - 0.5;   // -0.5 .. 0.5
          const cy = (e.clientY - r.top) / r.height - 0.5;
          const bg = e.currentTarget.querySelector('.login-hero-bg');
          if (bg) {
            bg.style.transform =
              `translate(${cx * 22}px, ${cy * 16}px) rotateY(${cx * 6}deg) rotateX(${-cy * 4}deg)`;
          }
        }}
        onMouseLeave={(e) => {
          const bg = e.currentTarget.querySelector('.login-hero-bg');
          if (bg) bg.style.transform = 'translate(0,0) rotateY(0) rotateX(0)';
        }}
        style={{ perspective: '1000px' }}>
        <div className="login-hero-bg" />
        <div className="login-hero-overlay" />

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

        <div style={{ flex: 1 }} />

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
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28,
          }} className="mob-logo">
            <img src="/assets/logo-mark.svg" alt="" width={36} height={36} />
            <div style={{
              fontFamily: 'var(--font-d)', fontSize: 19, fontWeight: 700,
              letterSpacing: '0.04em',
            }}>CarInsight <span style={{ color: 'var(--gold)' }}>Pro</span></div>
          </div>

          {/* ════════════ OTP SCREEN ════════════ */}
          {mode === 'otp' ? (
            <>
              <h2 className="rise" style={{
                fontFamily: 'var(--font-d)', fontSize: 30, fontWeight: 700,
                color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <ShieldCheck size={26} style={{ color: 'var(--gold)' }} /> Verify your email
              </h2>
              <p className="rise-d1" style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 26 }}>
                Enter the 4-digit code we sent to{' '}
                <strong style={{ color: 'var(--text)' }}>{form.email}</strong>.
                It expires in 5 minutes.
              </p>

              {ok && (
                <div className="rise" style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', marginBottom: 16,
                  background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 9, fontSize: 13, color: 'var(--green)',
                }}>
                  <CheckCircle2 size={16} /> {ok}
                </div>
              )}
              {apiErr && (
                <div className="rise" style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', marginBottom: 16,
                  background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 9, fontSize: 13, color: 'var(--red)',
                }}>
                  <AlertCircle size={16} /> {apiErr}
                </div>
              )}

              {/* 4 OTP boxes */}
              <div className="rise-d2" style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={el => (otpRefs.current[i] = el)}
                    value={d}
                    onChange={(e) => onOtpChange(i, e.target.value)}
                    onKeyDown={(e) => onOtpKey(i, e)}
                    onPaste={onOtpPaste}
                    inputMode="numeric"
                    maxLength={1}
                    style={{
                      width: 58, height: 66, textAlign: 'center',
                      fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-d)',
                      color: 'var(--text)', background: 'var(--bg2)',
                      border: `2px solid ${d ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 12, outline: 'none', transition: 'border-color 0.15s',
                    }}
                  />
                ))}
              </div>

              {/* Verify button */}
              <button
                onClick={verifyOtp}
                disabled={loading || otp.join('').length !== 4}
                className="btn btn-gold btn-full btn-lg btn-press rise-d3"
                style={{
                  fontFamily: 'var(--font-d)', letterSpacing: '0.05em',
                  textTransform: 'uppercase', fontSize: 14,
                  opacity: otp.join('').length === 4 ? 1 : 0.6,
                }}>
                {loading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <span className="spin" /> Verifying…
                  </span>
                ) : (
                  <>Verify &amp; create account <ArrowRight size={16} strokeWidth={2.5} /></>
                )}
              </button>

              {/* Resend + change email */}
              <div className="rise-d4" style={{
                marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <button
                  type="button"
                  onClick={backToSignup}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: 12.5, color: 'var(--text2)', fontFamily: 'var(--font-b)',
                  }}>
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={cooldown > 0 || loading}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    cursor: cooldown > 0 ? 'default' : 'pointer',
                    fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-b)',
                    color: cooldown > 0 ? 'var(--text3)' : 'var(--gold)',
                  }}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </>
          ) : mode === 'forgot' ? (
            /* ════════════ FORGOT PASSWORD — enter email ════════════ */
            <>
              <h2 className="rise" style={{
                fontFamily: 'var(--font-d)', fontSize: 30, fontWeight: 700,
                color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 6,
              }}>
                Reset your password
              </h2>
              <p className="rise-d1" style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 26 }}>
                Enter your account email and we'll send you a 4-digit reset code.
              </p>

              {ok && <Banner type="ok" text={ok} />}
              {apiErr && <Banner type="err" text={apiErr} />}

              <div className="rise-d2" style={{ marginBottom: 22 }}>
                <label className="fl">Email address</label>
                <div className="field-wrap" style={{ position: 'relative' }}>
                  <Mail size={16} className="field-icon" />
                  <input
                    className="fi-premium"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && requestReset()}
                    autoFocus
                  />
                </div>
              </div>

              <button onClick={requestReset} disabled={loading}
                className="btn btn-gold btn-full btn-lg btn-press rise-d3"
                style={{ fontFamily: 'var(--font-d)', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 14 }}>
                {loading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className="spin" /> Sending…</span>
                         : <>Send reset code <ArrowRight size={16} strokeWidth={2.5} /></>}
              </button>

              <button type="button" onClick={() => { setMode('login'); setApiErr(''); setOk(''); }}
                style={{ marginTop: 18, background: 'none', border: 'none', cursor: 'pointer',
                         fontSize: 12.5, color: 'var(--text2)', fontFamily: 'var(--font-b)' }}>
                ← Back to sign in
              </button>
            </>
          ) : mode === 'reset' ? (
            /* ════════════ RESET — enter code + new password ════════════ */
            <>
              <h2 className="rise" style={{
                fontFamily: 'var(--font-d)', fontSize: 30, fontWeight: 700,
                color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <ShieldCheck size={26} style={{ color: 'var(--gold)' }} /> Set a new password
              </h2>
              <p className="rise-d1" style={{ fontSize: 13.5, color: 'var(--text2)', marginBottom: 26 }}>
                Enter the code sent to <strong style={{ color: 'var(--text)' }}>{resetEmail}</strong> and choose a new password.
              </p>

              {ok && <Banner type="ok" text={ok} />}
              {apiErr && <Banner type="err" text={apiErr} />}

              {/* Reset code */}
              <div className="rise-d2" style={{ marginBottom: 16 }}>
                <label className="fl">4-digit reset code</label>
                <div className="field-wrap" style={{ position: 'relative' }}>
                  <ShieldCheck size={16} className="field-icon" />
                  <input
                    className="fi-premium"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="0000"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    style={{ letterSpacing: '8px', fontWeight: 700 }}
                    autoFocus
                  />
                </div>
              </div>

              {/* New password */}
              <div className="rise-d3" style={{ marginBottom: 14 }}>
                <label className="fl">New password</label>
                <div className="field-wrap" style={{ position: 'relative' }}>
                  <Lock size={16} className="field-icon" />
                  <input
                    className="fi-premium"
                    style={{ paddingRight: 44 }}
                    type={showNewPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && doReset()}
                  />
                  <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                             background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                    {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                  {[['len', '8+ characters'], ['upper', 'Uppercase letter'], ['lower', 'Lowercase letter'],
                    ['num', 'A number'], ['sym', 'A symbol']].map(([key, label]) => {
                    const good = pwChecks(newPwd)[key];
                    return (
                      <span key={key} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
                        color: good ? 'var(--green)' : 'var(--text3)' }}>
                        {good ? <CheckCircle2 size={12} /> : <span style={{ width: 12, height: 12, borderRadius: '50%',
                          border: '1.5px solid var(--text3)', display: 'inline-block' }} />}
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <button onClick={doReset} disabled={loading || resetOtp.length !== 4 || !pwAllGood(newPwd)}
                className="btn btn-gold btn-full btn-lg btn-press rise-d4"
                style={{ fontFamily: 'var(--font-d)', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 14,
                         opacity: (resetOtp.length === 4 && pwAllGood(newPwd)) ? 1 : 0.6, marginTop: 8 }}>
                {loading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className="spin" /> Resetting…</span>
                         : <>Reset password <ArrowRight size={16} strokeWidth={2.5} /></>}
              </button>

              <div className="rise-d4" style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={() => { setMode('login'); setApiErr(''); setOk(''); }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                           fontSize: 12.5, color: 'var(--text2)', fontFamily: 'var(--font-b)' }}>
                  ← Back to sign in
                </button>
                <button type="button" onClick={resendReset} disabled={cooldown > 0 || loading}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: cooldown > 0 ? 'default' : 'pointer',
                           fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-b)',
                           color: cooldown > 0 ? 'var(--text3)' : 'var(--gold)' }}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </>
          ) : (
          /* ════════════ LOGIN / SIGNUP SCREEN ════════════ */
          <>
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
              : 'Join in 20 seconds — we\u2019ll email you a code to verify.'}
          </p>

          {/* Tab switcher */}
          <div className="tab-switch rise-d2">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); setErrors({}); setApiErr(''); setOk(''); }}>
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => { setMode('signup'); setErrors({}); setApiErr(''); setOk(''); }}>
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

          {/* Name (signup only) */}
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

          {/* Email */}
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

          {/* Password */}
          <div className="rise-d3" style={{ marginBottom: 22 }}>
            <label className="fl" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Password</span>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setResetEmail(form.email); setApiErr(''); setOk(''); }}
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
            {mode === 'signup' && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {[
                  ['len', '8+ characters'],
                  ['upper', 'Uppercase letter'],
                  ['lower', 'Lowercase letter'],
                  ['num', 'A number'],
                  ['sym', 'A symbol'],
                ].map(([key, label]) => {
                  const good = pwChecks(form.password)[key];
                  return (
                    <span key={key} style={{
                      fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
                      color: good ? 'var(--green)' : 'var(--text3)',
                    }}>
                      {good ? <CheckCircle2 size={12} /> : <span style={{
                        width: 12, height: 12, borderRadius: '50%',
                        border: '1.5px solid var(--text3)', display: 'inline-block',
                      }} />}
                      {label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit */}
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
                {mode === 'login' ? 'Sign in' : 'Send verification code'}
                <ArrowRight size={16} strokeWidth={2.5} />
              </>
            )}
          </button>

          {/* Footer micro-copy */}
          <p className="rise-d4" style={{
            marginTop: 22, fontSize: 11.5, color: 'var(--text3)',
            textAlign: 'center', lineHeight: 1.6,
          }}>
            By continuing you agree to our Terms &amp; Privacy Policy.
          </p>
          </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── small reusable status banner ── */
function Banner({ type, text }) {
  const ok = type === 'ok';
  return (
    <div className="rise" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px', marginBottom: 16,
      background: ok ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      borderRadius: 9, fontSize: 13, color: ok ? 'var(--green)' : 'var(--red)',
    }}>
      {ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {text}
    </div>
  );
}
