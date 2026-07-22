import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar        from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Login          from './pages/Login';
import Dashboard      from './pages/Dashboard';
import PredictPrice   from './pages/PredictPrice';
import ResaleValue    from './pages/ResaleValue';
import Recommend      from './pages/Recommend';
import Finance        from './pages/Finance';
import Wishlist       from './pages/Wishlist';
import History        from './pages/History';
import Diagnostics from './pages/Diagnostics';
import Admin from './pages/Admin';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

export default function App() {
  // Apply saved theme on first load (default = light/day).
  useEffect(() => {
    const t = localStorage.getItem('theme') || 'light';
    if (t === 'dark') document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/predict" element={
          <ProtectedRoute>
            <AppLayout><PredictPrice /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/resale" element={
          <ProtectedRoute>
            <AppLayout><ResaleValue /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/recommend" element={
          <ProtectedRoute>
            <AppLayout><Recommend /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/finance" element={
          <ProtectedRoute>
            <AppLayout><Finance /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/wishlist" element={
          <ProtectedRoute>
            <AppLayout><Wishlist /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute>
            <AppLayout><History /></AppLayout>
          </ProtectedRoute>
        } />
        <Route path="/diagnostics" element={
          <ProtectedRoute>
            <AppLayout><Diagnostics /></AppLayout>
          </ProtectedRoute>
          } />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AppLayout><Admin /></AppLayout>
          </ProtectedRoute>
          } />
      </Routes>
    </BrowserRouter>
  );
}
