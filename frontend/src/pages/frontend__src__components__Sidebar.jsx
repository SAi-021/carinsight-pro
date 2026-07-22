import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Car, RefreshCw, Star,
  DollarSign, Heart, History, LogOut, Gauge, Activity, Shield
} from 'lucide-react';

const NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/predict',    icon: Car,             label: 'Predict Price' },
  { to: '/resale',     icon: RefreshCw,       label: 'Resale Value' },
  { to: '/recommend',  icon: Star,            label: 'Recommend' },
  { to: '/finance',    icon: DollarSign,      label: 'Finance' },
  { to: '/wishlist',   icon: Heart,           label: 'Wishlist' },
  { to: '/history',    icon: History,         label: 'History' },
  { to: '/diagnostics', label: 'Diagnostics', icon: Activity }
];

export default function Sidebar() {
  const navigate = useNavigate();
  const name = localStorage.getItem('userName') || 'User';
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // Admins get an extra Admin Panel link at the end of the menu
  const navItems = isAdmin
    ? [...NAV, { to: '/admin', icon: Shield, label: 'Admin Panel' }]
    : NAV;

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0,
      width: 'var(--sidebar-w)', height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      zIndex: 100, overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Gauge size={20} color="#000" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17, fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
            }}>CarInsight</div>
            <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pro</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: 8 }}>
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
            background: isActive ? 'var(--accent-dim)' : 'transparent',
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
          })}>
            <Icon size={16} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div style={{
        padding: '16px 12px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', marginBottom: 4,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#000',
            flexShrink: 0,
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Logged in</div>
          </div>
        </div>
        <button onClick={logout} className="btn btn-secondary" style={{ width: '100%', fontSize: 13 }}>
          <LogOut size={14} /> Logout
        </button>
      </div>
    </aside>
  );
}
