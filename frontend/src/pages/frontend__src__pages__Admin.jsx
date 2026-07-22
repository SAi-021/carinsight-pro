import { useEffect, useState, useMemo } from 'react';
import {
  Shield, Users, Database, KeyRound, Mail, Trash2, RefreshCw,
  Search, X, CheckCircle2, AlertCircle, Crown, Activity, Layers,
} from 'lucide-react';
import API from '../api/axios';
import { SkelBlock } from '../components/Skeleton';

/* ============================================================
   CarInsight Pro — Admin Panel
   Admin-only. Backend gates every endpoint with get_current_admin.
   - System stats (users, predictions, etc.)
   - User table with reset-password (email) + change-password
   - Clear-database panel (confirmation required)
   ============================================================ */

const fmtDate = d => d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

const CLEARABLE_TABLES = [
  { key: 'predictions',     label: 'Predictions' },
  { key: 'resale_logs',     label: 'Resale Logs' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'finance_logs',    label: 'Finance Logs' },
  { key: 'wishlists',       label: 'Wishlist' },
];

export default function Admin() {
  const [stats, setStats]     = useState(null);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');
  const [toast, setToast]     = useState(null);
  const [busyId, setBusyId]   = useState(null);

  // change-password modal
  const [pwModal, setPwModal] = useState(null);   // { user }
  const [pwValue, setPwValue] = useState('');

  // clear-database panel
  const [selTables, setSelTables] = useState(CLEARABLE_TABLES.map(t => t.key));
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  const showToast = (msg, type = 's') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      API.get('/admin/stats'),
      API.get('/admin/users'),
    ])
      .then(([s, u]) => { setStats(s.data); setUsers(u.data); })
      .catch(err => {
        console.error(err);
        showToast(err.response?.data?.detail || 'Failed to load admin data', 'e');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    users.filter(u =>
      !filter ||
      u.name.toLowerCase().includes(filter.toLowerCase()) ||
      u.email.toLowerCase().includes(filter.toLowerCase())
    ), [users, filter]);

  /* ───── Reset password + email it ───── */
  const resetPassword = async (user) => {
    setBusyId(user.id);
    try {
      const { data } = await API.post('/admin/reset-password', { user_id: user.id });
      if (data.email_sent) {
        showToast(`New password emailed to ${user.email}`);
      } else {
        // Email not configured — show the generated password so admin can relay it
        showToast(`Password reset. New password: ${data.new_password} (email not configured)`, 'w');
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Reset failed', 'e');
    } finally {
      setBusyId(null);
    }
  };

  /* ───── Change password directly (modal) ───── */
  const submitChangePassword = async () => {
    if (pwValue.length < 6) { showToast('Password must be at least 6 characters', 'e'); return; }
    setBusyId(pwModal.user.id);
    try {
      await API.post('/admin/change-password', {
        user_id: pwModal.user.id,
        new_password: pwValue,
      });
      showToast(`Password updated for ${pwModal.user.email}`);
      setPwModal(null); setPwValue('');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Change failed', 'e');
    } finally {
      setBusyId(null);
    }
  };

  /* ───── Clear database ───── */
  const clearDatabase = async () => {
    if (confirmText !== 'DELETE') { showToast('Type DELETE to confirm', 'e'); return; }
    if (!selTables.length)        { showToast('Select at least one table', 'e'); return; }
    setClearing(true);
    try {
      const { data } = await API.post('/admin/clear-database', {
        tables: selTables, confirm: 'DELETE',
      });
      showToast(data.message || 'Database cleared');
      setConfirmText('');
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Clear failed', 'e');
    } finally {
      setClearing(false);
    }
  };

  const toggleTable = (key) =>
    setSelTables(t => t.includes(key) ? t.filter(x => x !== key) : [...t, key]);

  return (
    <div className="page-wrap fade">
      {/* ══════════════ HEADER ══════════════ */}
      <header className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="icon-chip icon-chip-gold" style={{ width: 44, height: 44 }}>
            <Shield size={20} strokeWidth={2} />
          </span>
          <div>
            <h1>Admin <span>panel</span></h1>
            <p>Manage users, reset passwords, and maintain the database</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="btn btn-ghost btn-press" style={{ fontSize: 12 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'rotate 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </header>

      {/* ══════════════ STATS ══════════════ */}
      {loading ? (
        <div className="g3" style={{ marginBottom: 20 }}>
          {[1,2,3].map(i => <SkelBlock key={i} height={88} />)}
        </div>
      ) : stats ? (
        <>
          <div className="g3" style={{ marginBottom: 14 }}>
            <StatTile icon={Users}    chip="icon-chip-blue"  value={stats.total_users}       label="Registered users" />
            <StatTile icon={Crown}    chip="icon-chip-gold"  value={stats.total_admins}      label="Admin accounts" />
            <StatTile icon={Activity} chip="icon-chip-green" value={stats.total_predictions} label="Total predictions" />
          </div>
          <div className="g3" style={{ marginBottom: 24 }}>
            <StatTile icon={RefreshCw} chip="icon-chip-teal" value={stats.total_resale_logs}     label="Resale valuations" />
            <StatTile icon={Layers}    chip="icon-chip-purp" value={stats.total_recommendations} label="Recommendations" />
            <StatTile icon={Database}  chip="icon-chip-red"  value={stats.total_finance_logs + stats.total_wishlist} label="Finance + wishlist rows" />
          </div>
        </>
      ) : null}

      {/* ══════════════ USERS TABLE ══════════════ */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <Users size={16} style={{ color: 'var(--gold)' }} />
          <span style={{ fontFamily: 'var(--font-d)', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            Registered Users
          </span>
          <div className="field-wrap" style={{ position: 'relative', marginLeft: 'auto', maxWidth: 280, flex: 1 }}>
            <Search size={14} className="field-icon" />
            <input className="fi-premium" style={{ padding: '8px 32px 8px 36px', fontSize: 12.5 }}
              placeholder="Search name or email…" value={filter}
              onChange={e => setFilter(e.target.value)} />
            {filter && (
              <button onClick={() => setFilter('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24 }}><SkelBlock height={200} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty" style={{ minHeight: 160 }}>
            <Users size={40} strokeWidth={1} />
            <p>No users found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['#','Name','Email','Role','Predictions','Joined','Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--text3)', fontFamily: 'var(--font-d)', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ color: 'var(--text)', fontWeight: 600 }}>{u.name}</td>
                    <td style={{ color: 'var(--text2)' }}>{u.email}</td>
                    <td>
                      {u.is_admin
                        ? <span className="badge b-gold"><Crown size={9} style={{ marginRight: 3 }} /> Admin</span>
                        : <span className="badge b-blue">User</span>}
                    </td>
                    <td style={{ color: 'var(--text2)', fontFamily: 'var(--font-d)', fontWeight: 600 }}>{u.predictions}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                        <button onClick={() => resetPassword(u)} disabled={busyId === u.id}
                          className="btn btn-ghost btn-press" style={{ fontSize: 11, padding: '5px 10px' }}
                          title="Generate a new password and email it to the user">
                          {busyId === u.id ? <span className="spin" style={{ width: 12, height: 12 }} /> : <Mail size={12} />} Reset + Email
                        </button>
                        <button onClick={() => { setPwModal({ user: u }); setPwValue(''); }}
                          className="btn btn-ghost btn-press" style={{ fontSize: 11, padding: '5px 10px' }}
                          title="Set a specific password directly">
                          <KeyRound size={12} /> Set Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════ DANGER ZONE — CLEAR DB ══════════════ */}
      <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
        <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red)' }}>
          <Trash2 size={16} /> Clear Database
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
          Permanently delete all rows from the selected activity tables. User accounts and trained-model
          metrics are never affected. This cannot be undone.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CLEARABLE_TABLES.map(t => (
            <button key={t.key} onClick={() => toggleTable(t.key)}
              className="btn-press"
              style={{
                padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
                fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-b)',
                border: '1px solid',
                borderColor: selTables.includes(t.key) ? 'var(--red)' : 'var(--border2)',
                background: selTables.includes(t.key) ? 'rgba(239,68,68,0.12)' : 'var(--bg2)',
                color: selTables.includes(t.key) ? 'var(--red)' : 'var(--text2)',
              }}>
              {selTables.includes(t.key) ? '✓ ' : ''}{t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="fi" placeholder='Type DELETE to confirm'
            value={confirmText} onChange={e => setConfirmText(e.target.value)}
            style={{ maxWidth: 220 }} />
          <button onClick={clearDatabase} disabled={clearing || confirmText !== 'DELETE'}
            className="btn btn-red btn-press"
            style={{ opacity: confirmText === 'DELETE' ? 1 : 0.5 }}>
            {clearing ? <span className="spin" /> : <Trash2 size={14} />}
            {clearing ? 'Clearing…' : 'Clear Selected Tables'}
          </button>
        </div>
      </div>

      {/* ══════════════ SET-PASSWORD MODAL ══════════════ */}
      {pwModal && (
        <div onClick={() => setPwModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 420, width: '100%' }}>
            <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={16} style={{ color: 'var(--gold)' }} /> Set Password
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 16 }}>
              Directly set a new password for <strong style={{ color: 'var(--text)' }}>{pwModal.user.email}</strong>.
              No email is sent.
            </p>
            <div className="fg">
              <label className="fl">New Password</label>
              <input className="fi" type="text" autoFocus
                placeholder="At least 6 characters"
                value={pwValue} onChange={e => setPwValue(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setPwModal(null)} className="btn btn-ghost">Cancel</button>
              <button onClick={submitChangePassword} disabled={busyId === pwModal.user.id} className="btn btn-gold">
                {busyId === pwModal.user.id ? <span className="spin" /> : <CheckCircle2 size={14} />} Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TOAST ══════════════ */}
      {toast && (
        <div className={toast.type === 'e' ? 'toast toast-e' : 'toast toast-s'}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 300,
            display: 'flex', alignItems: 'center', gap: 8, maxWidth: 440,
            padding: '12px 18px', borderRadius: 10,
            background: toast.type === 'e' ? 'rgba(239,68,68,0.15)' : toast.type === 'w' ? 'rgba(240,165,0,0.15)' : 'rgba(34,197,94,0.15)',
            border: `1px solid ${toast.type === 'e' ? 'var(--red)' : toast.type === 'w' ? 'var(--gold)' : 'var(--green)'}`,
            color: toast.type === 'e' ? 'var(--red)' : toast.type === 'w' ? 'var(--gold)' : 'var(--green)',
            fontSize: 13, fontWeight: 500,
          }}>
          {toast.type === 'e' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ───── Stat tile ───── */
function StatTile({ icon: Icon, chip, value, label }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className={`icon-chip ${chip}`}><Icon size={16} strokeWidth={2} /></span>
      <div>
        <div style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
          {value ?? 0}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}
