import { useEffect, useState, useMemo } from 'react';
import {
  Shield, Users, Database, KeyRound, Mail, Trash2, RefreshCw,
  Search, X, CheckCircle2, AlertCircle, Crown, Layers,
  UserX, TrendingUp, Settings, Heart, DollarSign, Star,
} from 'lucide-react';
import API from '../api/axios';

/* ============================================================
   CarInsight Pro — Admin Panel
   - Split Finance / Wishlist stat tiles
   - Per-user activity counts (predictions/resale/reco/finance/wishlist)
   - "Manage" per user → modal to clear selected activity types
   ============================================================ */

const C = {
  gold:  'var(--gold, #f0a500)',
  goldDim:'var(--gold-dim, rgba(240,165,0,0.12))',
  text:  'var(--text, #e8eaed)',
  text2: 'var(--text2, #8892a4)',
  text3: 'var(--text3, #6b7280)',
  bg:    'var(--bg, #0a0c10)',
  bg2:   'var(--bg2, #0d1017)',
  bg4:   'var(--bg4, #1a1f2e)',
  border:'var(--border, #20242e)',
  green: 'var(--green, #22c55e)',
  red:   'var(--red, #ef4444)',
  blue:  'var(--blue, #3b82f6)',
  purp:  'var(--purp, #a855f7)',
  teal:  'var(--teal, #14b8a6)',
};

const card = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent)',
  backgroundColor: C.bg2,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 20,
};

const fmtDate = d => d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

// activity types shared by global clear + per-user clear
const CLEARABLE_TABLES = [
  { key: 'predictions',     label: 'Predictions',     countKey: 'predictions',     color: C.gold },
  { key: 'resale_logs',     label: 'Resale Logs',     countKey: 'resale_logs',     color: C.blue },
  { key: 'recommendations', label: 'Recommendations', countKey: 'recommendations', color: C.purp },
  { key: 'finance_logs',    label: 'Finance Logs',    countKey: 'finance_logs',    color: C.green },
  { key: 'wishlists',       label: 'Wishlist',        countKey: 'wishlists',       color: C.teal },
];

export default function Admin() {
  const [stats, setStats]     = useState(null);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');
  const [toast, setToast]     = useState(null);
  const [busyId, setBusyId]   = useState(null);

  const [pwModal, setPwModal]   = useState(null);
  const [pwValue, setPwValue]   = useState('');
  const [delModal, setDelModal] = useState(null);

  // global clear
  const [selTables, setSelTables] = useState(CLEARABLE_TABLES.map(t => t.key));
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  // per-user manage modal
  const [manageModal, setManageModal] = useState(null);   // { user }
  const [manageSel, setManageSel]     = useState([]);      // selected table keys
  const [manageConfirm, setManageConfirm] = useState('');
  const [managing, setManaging] = useState(false);

  const myEmail = (localStorage.getItem('userEmail') || '').toLowerCase();

  const showToast = (msg, type = 's') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const load = () => {
    setLoading(true);
    Promise.all([API.get('/admin/stats'), API.get('/admin/users')])
      .then(([s, u]) => { setStats(s.data); setUsers(u.data); })
      .catch(err => showToast(err.response?.data?.detail || 'Failed to load admin data', 'e'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    users.filter(u => !filter ||
      u.name.toLowerCase().includes(filter.toLowerCase()) ||
      u.email.toLowerCase().includes(filter.toLowerCase())
    ), [users, filter]);

  const resetPassword = async (user) => {
    setBusyId(user.id);
    try {
      const { data } = await API.post('/admin/reset-password', { user_id: user.id });
      if (data.email_sent) showToast(`New password emailed to ${user.email}`);
      else showToast(`Password reset — new password: ${data.new_password}`, 'w');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Reset failed', 'e');
    } finally { setBusyId(null); }
  };

  const submitChangePassword = async () => {
    {
      const pw = pwValue;
      const problem =
        pw.length < 8           ? 'Password must be at least 8 characters'
        : !/[A-Z]/.test(pw)     ? 'Password must include an uppercase letter'
        : !/[a-z]/.test(pw)     ? 'Password must include a lowercase letter'
        : !/[0-9]/.test(pw)     ? 'Password must include a number'
        : !/[^A-Za-z0-9]/.test(pw) ? 'Password must include a symbol (e.g. ! @ # $)'
        : null;
      if (problem) { showToast(problem, 'e'); return; }
    }
    setBusyId(pwModal.user.id);
    try {
      await API.post('/admin/change-password', { user_id: pwModal.user.id, new_password: pwValue });
      showToast(`Password updated for ${pwModal.user.email}`);
      setPwModal(null); setPwValue('');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Change failed', 'e');
    } finally { setBusyId(null); }
  };

  const deleteUser = async () => {
    const user = delModal.user;
    setBusyId(user.id);
    try {
      const { data } = await API.delete(`/admin/user/${user.id}`);
      showToast(data.message || `Deleted ${user.email}`);
      setDelModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'e');
    } finally { setBusyId(null); }
  };

  const clearDatabase = async () => {
    if (confirmText !== 'DELETE') { showToast('Type DELETE to confirm', 'e'); return; }
    if (!selTables.length)        { showToast('Select at least one table', 'e'); return; }
    setClearing(true);
    try {
      const { data } = await API.post('/admin/clear-database', { tables: selTables, confirm: 'DELETE' });
      showToast(data.message || 'Database cleared');
      setConfirmText(''); load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Clear failed', 'e');
    } finally { setClearing(false); }
  };

  const toggleTable = (key) =>
    setSelTables(t => t.includes(key) ? t.filter(x => x !== key) : [...t, key]);

  /* ── per-user manage ── */
  const openManage = (user) => {
    setManageModal({ user });
    setManageSel([]);            // start with nothing selected
    setManageConfirm('');
  };
  const toggleManage = (key) =>
    setManageSel(t => t.includes(key) ? t.filter(x => x !== key) : [...t, key]);

  const runManageClear = async () => {
    const user = manageModal.user;
    if (!manageSel.length) { showToast('Select at least one activity type', 'e'); return; }

    const clearingAll = manageSel.length === CLEARABLE_TABLES.length;
    if (clearingAll && manageConfirm !== 'DELETE') {
      showToast("Type DELETE to clear ALL of this user's data", 'e');
      return;
    }

    setManaging(true);
    try {
      const body = { user_id: user.id, tables: manageSel };
      if (clearingAll) body.confirm = 'DELETE';
      const { data } = await API.post('/admin/clear-user-data', body);
      showToast(data.message || 'User data cleared');
      setManageModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Clear failed', 'e');
    } finally { setManaging(false); }
  };

  const manageClearingAll = manageSel.length === CLEARABLE_TABLES.length;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 28 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            width: 50, height: 50, borderRadius: 13, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.gold}, #b87300)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', boxShadow: `0 6px 20px ${C.goldDim}`,
          }}>
            <Shield size={24} strokeWidth={2.2} />
          </span>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
              Admin <span style={{ color: C.gold }}>Panel</span>
            </h1>
            <p style={{ fontSize: 13, color: C.text2, margin: '4px 0 0' }}>
              Manage users, reset passwords, and maintain the database
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading} style={btnGhost}>
          <RefreshCw size={14} style={{ animation: loading ? 'adspin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* STATS — finance & wishlist now SEPARATE */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 14, marginBottom: 26 }}>
          <StatTile icon={Users}      color={C.blue}  value={stats.total_users}           label="Registered users" />
          <StatTile icon={Crown}      color={C.gold}  value={stats.total_admins}          label="Admin accounts" />
          <StatTile icon={TrendingUp} color={C.green} value={stats.total_predictions}     label="Total predictions" />
          <StatTile icon={RefreshCw}  color={C.teal}  value={stats.total_resale_logs}     label="Resale valuations" />
          <StatTile icon={Star}       color={C.purp}  value={stats.total_recommendations} label="Recommendations" />
          <StatTile icon={DollarSign} color={C.green} value={stats.total_finance_logs}    label="Finance" />
          <StatTile icon={Heart}      color={C.red}   value={stats.total_wishlist}        label="Wishlist" />
        </div>
      )}

      {/* USERS TABLE */}
      <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <Users size={17} style={{ color: C.gold }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Registered Users</span>
          <span style={{ fontSize: 12, color: C.text3, background: C.goldDim, padding: '2px 9px', borderRadius: 20 }}>{users.length}</span>
          <div style={{ position: 'relative', marginLeft: 'auto', maxWidth: 280, flex: 1, minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.text3 }} />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search name or email…"
              style={inputStyle('8px 32px 8px 36px')} />
            {filter && <button onClick={() => setFilter('')} style={iconBtn}><X size={13} /></button>}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>Loading users…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.text3 }}>
            <Users size={42} strokeWidth={1} style={{ opacity: 0.35 }} />
            <p style={{ marginTop: 10 }}>No users found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg4 }}>
                  {['#','Name','Email','Role','Pred','Resale','Reco','Fin','Wish','Joined','Actions'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} style={{ borderTop: `1px solid ${C.border}`, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.bg4}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...td, color: C.text3, fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...td, color: C.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {u.name}
                      {u.email.toLowerCase() === myEmail && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: C.gold, fontWeight: 700 }}>(you)</span>
                      )}
                    </td>
                    <td style={{ ...td, color: C.text2 }}>{u.email}</td>
                    <td style={td}>
                      {u.is_admin
                        ? <span style={{ ...badge, background: C.goldDim, color: C.gold }}><Crown size={9} style={{ marginRight: 4 }} />Admin</span>
                        : <span style={{ ...badge, background: 'rgba(59,130,246,0.13)', color: C.blue }}>User</span>}
                    </td>
                    <CountCell value={u.predictions}     color={C.gold} />
                    <CountCell value={u.resale_logs}     color={C.blue} />
                    <CountCell value={u.recommendations} color={C.purp} />
                    <CountCell value={u.finance_logs}    color={C.green} />
                    <CountCell value={u.wishlists}       color={C.teal} />
                    <td style={{ ...td, color: C.text3, fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                        <button onClick={() => resetPassword(u)} disabled={busyId === u.id}
                          style={actBtn(C.gold)} title="Generate a new password and email it">
                          <Mail size={12} /> Reset
                        </button>
                        <button onClick={() => { setPwModal({ user: u }); setPwValue(''); }}
                          style={actBtn(C.teal)} title="Set a specific password">
                          <KeyRound size={12} /> Set
                        </button>
                        <button onClick={() => openManage(u)} disabled={busyId === u.id}
                          style={actBtn(C.blue)} title="Clear selected activity data for this user">
                          <Settings size={12} /> Manage
                        </button>
                        <button onClick={() => setDelModal({ user: u })} disabled={busyId === u.id}
                          style={actBtn(C.red)} title="Delete user and all their data">
                          <UserX size={12} /> Delete
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

      {/* CLEAR DATABASE (ALL USERS) */}
      <div style={{ ...card, borderLeft: `3px solid ${C.red}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8, color: C.red }}>
          <Trash2 size={17} /> Clear Database <span style={{ fontSize: 11, color: C.text3, fontWeight: 500 }}>(all users)</span>
        </h3>
        <p style={{ fontSize: 12.5, color: C.text2, margin: '0 0 16px', lineHeight: 1.6 }}>
          Permanently delete all rows from the selected activity tables, across <strong>every</strong> user.
          User accounts and trained-model metrics are never affected. This cannot be undone.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CLEARABLE_TABLES.map(t => {
            const on = selTables.includes(t.key);
            return (
              <button key={t.key} onClick={() => toggleTable(t.key)}
                style={{
                  padding: '6px 13px', borderRadius: 100, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                  border: '1px solid', borderColor: on ? C.red : C.border,
                  background: on ? 'rgba(239,68,68,0.12)' : 'transparent',
                  color: on ? C.red : C.text2, transition: 'all 0.15s',
                }}>
                {on ? '✓ ' : ''}{t.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type DELETE to confirm"
            style={{ ...inputStyle('10px 12px'), maxWidth: 220 }} />
          <button onClick={clearDatabase} disabled={clearing || confirmText !== 'DELETE'}
            style={{ ...btnSolid(C.red, '#fff'), opacity: confirmText === 'DELETE' ? 1 : 0.45 }}>
            <Trash2 size={14} /> {clearing ? 'Clearing…' : 'Clear Selected Tables'}
          </button>
        </div>
      </div>

      {/* SET-PASSWORD MODAL */}
      {pwModal && (
        <Modal onClose={() => setPwModal(null)}>
          <h3 style={modalH}><KeyRound size={17} style={{ color: C.gold }} /> Set Password</h3>
          <p style={modalP}>Set a new password for <strong style={{ color: C.text }}>{pwModal.user.email}</strong>. The new password will be emailed to the user.</p>
          <input type="text" autoFocus value={pwValue} onChange={e => setPwValue(e.target.value)} placeholder="8+ chars, upper, lower, number, symbol"
            style={{ ...inputStyle('11px 13px'), width: '100%', boxSizing: 'border-box', marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setPwModal(null)} style={btnGhost}>Cancel</button>
            <button onClick={submitChangePassword} disabled={busyId === pwModal.user.id} style={btnSolid(C.gold, '#000')}>
              <CheckCircle2 size={14} /> Update
            </button>
          </div>
        </Modal>
      )}

      {/* MANAGE (per-user clear) MODAL */}
      {manageModal && (
        <Modal onClose={() => setManageModal(null)}>
          <h3 style={{ ...modalH, color: C.blue }}><Settings size={17} /> Manage User Data</h3>
          <p style={modalP}>
            Select which activity data to permanently clear for{' '}
            <strong style={{ color: C.text }}>{manageModal.user.name}</strong> ({manageModal.user.email}).
            The account itself stays — only the selected records are deleted.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {CLEARABLE_TABLES.map(t => {
              const on = manageSel.includes(t.key);
              const cnt = manageModal.user[t.countKey] ?? 0;
              return (
                <label key={t.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: cnt === 0 ? 'not-allowed' : 'pointer',
                    padding: '10px 13px', borderRadius: 9,
                    border: '1px solid', borderColor: on ? t.color : C.border,
                    background: on ? `${t.color}14` : 'transparent',
                    opacity: cnt === 0 ? 0.5 : 1, transition: 'all 0.15s',
                  }}>
                  <input type="checkbox" checked={on} disabled={cnt === 0}
                    onChange={() => toggleManage(t.key)}
                    style={{ width: 16, height: 16, accentColor: t.color, cursor: cnt === 0 ? 'not-allowed' : 'pointer' }} />
                  <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{t.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cnt > 0 ? t.color : C.text3 }}>
                    {cnt} record{cnt === 1 ? '' : 's'}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Typed confirm ONLY when clearing all 5 */}
          {manageClearingAll && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: C.red, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={13} /> You're clearing ALL data for this user. Type DELETE to confirm.
              </p>
              <input value={manageConfirm} onChange={e => setManageConfirm(e.target.value)} placeholder="Type DELETE"
                style={{ ...inputStyle('10px 12px'), width: '100%', boxSizing: 'border-box' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setManageModal(null)} style={btnGhost}>Cancel</button>
            <button onClick={runManageClear}
              disabled={managing || !manageSel.length || (manageClearingAll && manageConfirm !== 'DELETE')}
              style={{ ...btnSolid(C.red, '#fff'),
                opacity: (!manageSel.length || (manageClearingAll && manageConfirm !== 'DELETE')) ? 0.45 : 1 }}>
              <Trash2 size={14} /> {managing ? 'Clearing…' : 'Clear Selected'}
            </button>
          </div>
        </Modal>
      )}

      {/* DELETE-USER MODAL */}
      {delModal && (
        <Modal onClose={() => setDelModal(null)}>
          <h3 style={{ ...modalH, color: C.red }}><UserX size={17} /> Delete User</h3>
          <p style={modalP}>
            Permanently delete <strong style={{ color: C.text }}>{delModal.user.name}</strong> ({delModal.user.email})
            and <strong style={{ color: C.red }}>all their data</strong> — predictions, resale logs, recommendations,
            finance logs, and wishlist. This cannot be undone.
          </p>
          {delModal.user.email.toLowerCase() === myEmail && (
            <p style={{ ...modalP, color: C.gold }}>
              ⚠ This is your own account. Deleting it will log you out.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setDelModal(null)} style={btnGhost}>Cancel</button>
            <button onClick={deleteUser} disabled={busyId === delModal.user.id} style={btnSolid(C.red, '#fff')}>
              <Trash2 size={14} /> {busyId === delModal.user.id ? 'Deleting…' : 'Delete Permanently'}
            </button>
          </div>
        </Modal>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300, display: 'flex', alignItems: 'center', gap: 9, maxWidth: 460,
          padding: '13px 18px', borderRadius: 11, fontSize: 13, fontWeight: 500,
          background: toast.type === 'e' ? 'rgba(239,68,68,0.15)' : toast.type === 'w' ? 'rgba(240,165,0,0.15)' : 'rgba(34,197,94,0.15)',
          border: `1px solid ${toast.type === 'e' ? C.red : toast.type === 'w' ? C.gold : C.green}`,
          color: toast.type === 'e' ? C.red : toast.type === 'w' ? C.gold : C.green,
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          {toast.type === 'e' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes adspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── helper components ── */
function CountCell({ value, color }) {
  const v = value ?? 0;
  return (
    <td style={{ ...td, textAlign: 'center' }}>
      <span style={{
        display: 'inline-block', minWidth: 24, fontSize: 12.5, fontWeight: 700,
        color: v > 0 ? color : C.text3,
      }}>{v}</span>
    </td>
  );
}

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        {children}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, color, value, label }) {
  return (
    <div style={{
      background: C.bg2, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 18, display: 'flex', alignItems: 'center', gap: 13,
      transition: 'transform 0.15s, border-color 0.15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = color; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = C.border; }}>
      <span style={{ width: 42, height: 42, borderRadius: 11, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        <Icon size={19} strokeWidth={2} />
      </span>
      <div>
        <div style={{ fontSize: 25, fontWeight: 700, color: C.text, lineHeight: 1 }}>{value ?? 0}</div>
        <div style={{ fontSize: 11.5, color: C.text2, marginTop: 5 }}>{label}</div>
      </div>
    </div>
  );
}

/* ── shared styles ── */
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
  padding: '9px 15px', borderRadius: 9, fontSize: 13, fontWeight: 500,
  background: 'transparent', border: `1px solid ${C.border}`, color: C.text2,
};
const btnSolid = (bg, fg) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
  padding: '10px 17px', borderRadius: 9, fontSize: 13, fontWeight: 600, border: 'none', background: bg, color: fg,
});
const actBtn = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
  padding: '6px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
  background: `${color}18`, border: `1px solid ${color}40`, color,
});
const badge = { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600 };
const th = { textAlign: 'left', padding: '11px 14px', color: C.text3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', fontWeight: 600 };
const td = { padding: '12px 14px' };
const inputStyle = (pad) => ({
  width: '100%', padding: pad, fontSize: 13, background: C.bg,
  border: `1px solid ${C.border}`, borderRadius: 9, color: C.text, outline: 'none', boxSizing: 'border-box',
});
const iconBtn = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.text3 };
const modalH = { fontSize: 17, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, color: C.text };
const modalP = { fontSize: 13, color: C.text2, margin: '0 0 18px', lineHeight: 1.6 };
