import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Car, RefreshCw, Star,
  DollarSign, Heart, History, LogOut, Gauge, Activity, Shield,
  Menu, X, Sun, Moon,
} from 'lucide-react';

const NAV = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/predict',     icon: Car,             label: 'Predict Price' },
  { to: '/resale',      icon: RefreshCw,       label: 'Resale Value' },
  { to: '/recommend',   icon: Star,            label: 'Recommend' },
  { to: '/finance',     icon: DollarSign,      label: 'Finance' },
  { to: '/wishlist',    icon: Heart,           label: 'Wishlist' },
  { to: '/history',     icon: History,         label: 'History' },
  { to: '/diagnostics', icon: Activity,        label: 'Diagnostics' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const name = localStorage.getItem('userName') || 'User';
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  const [open, setOpen] = useState(false);   // mobile drawer open?

  // Theme: 'light' (day, default) or 'dark' (night)
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'light'
  );
  useEffect(() => {
    if (theme === 'dark') document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');
    localStorage.setItem('theme', theme);
    // notify charts/components to recompute colors
    window.dispatchEvent(new Event('themechange'));
  }, [theme]);
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  // Close the drawer whenever the route changes (after tapping a link)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Lock background scroll while the drawer is open on mobile
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const navItems = isAdmin
    ? [...NAV, { to: '/admin', icon: Shield, label: 'Admin Panel' }]
    : NAV;

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <>
      {/* ☰ Hamburger — only visible on small screens (CSS controls it) */}
      <button
        className="sb-hamburger"
        onClick={() => setOpen(true)}
        aria-label="Open menu">
        <Menu size={22} />
      </button>

      {/* Dim backdrop behind the drawer (mobile only) */}
      {open && <div className="sb-backdrop" onClick={() => setOpen(false)} />}

      {/* The sidebar itself.
          - On desktop: always visible (sidebar-desk).
          - On mobile: slides in when `open` (sb-open). */}
      <aside className={`sb-aside ${open ? 'sb-open' : ''}`}>
        {/* Logo + close button (close shows on mobile only) */}
        <div className="sb-logo-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Gauge size={20} color="#000" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-d)',
                fontSize: 17, fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--text)',
              }}>CarInsight</div>
              <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pro</div>
            </div>
          </div>
          <button className="sb-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: 8 }}>
            Menu
          </div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8,
              marginBottom: 2,
              fontSize: 13, fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.15s',
              background: isActive ? 'var(--gold-dim)' : 'transparent',
              color: isActive ? 'var(--gold)' : 'var(--text2)',
              borderLeft: isActive ? '2px solid var(--gold)' : '2px solid transparent',
            })}>
              <Icon size={16} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Theme toggle + User + Logout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
          <button className="theme-toggle" onClick={toggleTheme}
            aria-label="Toggle day or night theme">
            {theme === 'dark'
              ? (<><Sun size={15} /> Switch to Day</>)
              : (<><Moon size={15} /> Switch to Night</>)}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--gold)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#000',
              flexShrink: 0,
            }}>
              {name.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{isAdmin ? 'Administrator' : 'Logged in'}</div>
            </div>
          </div>
          <button onClick={logout} className="btn btn-ghost" style={{ width: '100%', fontSize: 13, justifyContent: 'center' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>
    </>
  );
}
