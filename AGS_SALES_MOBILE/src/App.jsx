import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sparkles, ShoppingCart, ShoppingBag, CreditCard, Receipt, ScanLine, Tag, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import defaultLogo from './default_logo.png';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Setup from './pages/Setup';
import More from './pages/More';
import CashControl from './pages/CashControl';
import Credits from './pages/Credits';
import BottomNav from './components/BottomNav';
import { storage } from './lib/storage';
import { loadAndApplyTheme } from './lib/theme';
import { register401Callback } from './lib/api';
import { checkForOtaUpdate } from './lib/ota';
import { requestNotificationPermissions, sendNativeNotification, triggerHaptic } from './lib/notifications';
import { hasPermission } from './lib/permissionsConfig';

function Protected({ auth, children }) {
  if (!auth?.token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [auth, setAuth] = useState({ token: null, user: null, apiUrl: null, settings: null });
  const [showAppSplash, setShowAppSplash] = useState(true);
  const [splashStepText, setSplashStepText] = useState('🛒 Iniciando Terminal POS...');
  const [businessSettings, setBusinessSettings] = useState({
    business_name: 'AGS SALES',
    app_logo: ''
  });
  const lastSaleIdRef = useRef(null);
  const notifiedProductsRef = useRef(new Set());
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    window.showToast = (message, type = 'success') => {
      setToast({ show: true, message, type });
    };
  }, []);

  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 2800);
      return () => clearTimeout(t);
    }
  }, [toast.show]);

  const fetchSettings = async (token, apiUrl) => {
    try {
      const res = await fetch(`${apiUrl}users/settings/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Failed to fetch settings:", e);
    }
    return null;
  };

  useEffect(() => {
    (async () => {
      const startTime = Date.now();
      await loadAndApplyTheme();
      await requestNotificationPermissions();
      const token = await storage.get('token');
      const user  = await storage.get('user');
      const apiUrl = await storage.get('apiUrl');
      if (apiUrl) {
        checkForOtaUpdate(apiUrl);
      }
      
      let settings = null;
      let logoUrl = '';
      let bName = 'AGS SALES';

      if (apiUrl) {
        try {
          const cleanUrl = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
          const settingsController = new AbortController();
          const settingsTimeout = setTimeout(() => settingsController.abort(), 4000);
          const res = await fetch(`${cleanUrl}users/settings/`, { signal: settingsController.signal });
          clearTimeout(settingsTimeout);
          if (res.ok) {
            settings = await res.json();
            bName = settings.business_name || 'AGS SALES';
            logoUrl = settings.app_logo || '';
            if (logoUrl && !logoUrl.startsWith('data:') && !logoUrl.startsWith('http')) {
              const base = apiUrl.replace('/api/', '').replace(/\/$/, '');
              logoUrl = `${base}/${logoUrl.startsWith('/') ? logoUrl.slice(1) : logoUrl}`;
            }
          }
        } catch (e) {
          console.warn("Could not load public settings:", e);
        }
      }

      setBusinessSettings({
        business_name: bName,
        app_logo: logoUrl
      });

      if (token && apiUrl && !settings) {
        settings = await fetchSettings(token, apiUrl);
      }

      setAuth({ token, user, apiUrl, settings });

      // Rotate POS Status Messages
      setTimeout(() => setSplashStepText('📦 Cargando Productos e Inventario...'), 900);
      setTimeout(() => setSplashStepText('💳 Sincronizando Cajas y Precios...'), 1800);
      setTimeout(() => setSplashStepText('✅ ¡Terminal POS Lista!'), 2700);

      // Enforce 3.2s minimum splash duration
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 3200 - elapsed);
      setTimeout(() => {
        setShowAppSplash(false);
      }, remaining);
    })();

    register401Callback(() => {
      handleLogout();
    });
  }, []);

  // Real-time Mobile User Profile & Permissions Sync (every 5 seconds)
  const authRef = useRef(auth);
  useEffect(() => { authRef.current = auth; }, [auth]);

  useEffect(() => {
    if (!auth.token || !auth.apiUrl) return;

    const syncProfileMobile = async () => {
      try {
        const { token, apiUrl, user, settings } = authRef.current;
        if (!token || !apiUrl) return;
        const res = await fetch(`${apiUrl}users/profile/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const freshUser = await res.json();
          const prevPermsStr = JSON.stringify(user?.custom_permissions || {});
          const freshPermsStr = JSON.stringify(freshUser.custom_permissions || {});

          if (user && user.id === freshUser.id && prevPermsStr !== freshPermsStr && settings?.notify_permission_change !== 'false') {
            sendNativeNotification({
              title: '🔒 Permisos Actualizados',
              body: `Hola ${freshUser.username}, tus permisos en el sistema han sido modificados en tiempo real.`
            });
          }

          await storage.set('user', freshUser);
          setAuth(prev => ({ ...prev, user: freshUser }));
        }
      } catch (e) {}
    };

    syncProfileMobile();
    const interval = setInterval(syncProfileMobile, 5000);
    return () => clearInterval(interval);
  }, [auth.token, auth.apiUrl]); // solo depende del token y la URL, no de user/settings

  // Monitor Real-time Sales for Admin Push Notifications (every 60 seconds)
  useEffect(() => {
    if (!auth.token || !auth.apiUrl) return;
    const isAdmin = ['SUPERADMIN', 'ADMIN'].includes(auth.user?.role);
    if (!isAdmin) return;

    const checkAdminSales = async () => {
      if (authRef.current.settings?.notify_admin_on_sale === 'false') return;
      try {
        const { token, apiUrl } = authRef.current;
        const res = await fetch(`${apiUrl}sales/sales/?page=1&page_size=1`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const latestSale = Array.isArray(data) ? data[0] : (data.results?.[0]);
          if (latestSale) {
            if (lastSaleIdRef.current !== null && lastSaleIdRef.current !== latestSale.id) {
              const num = latestSale.invoice_number || `#${latestSale.id}`;
              const val = latestSale.total_amount ? `$${Number(latestSale.total_amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : '';
              sendNativeNotification({
                title: '🛒 Nueva Venta en Tiempo Real',
                body: `Factura ${num} por ${val} (Atendido por: ${latestSale.user_username || 'Cajero'}).`
              });
            }
            lastSaleIdRef.current = latestSale.id;
          }
        }
      } catch (e) {}
    };

    checkAdminSales();
    const interval = setInterval(checkAdminSales, 60000);
    return () => clearInterval(interval);
  }, [auth.token, auth.apiUrl, auth.user?.role]); // settings leída del ref, no como dep

  // Monitor Real-time Low Stock for Push Notifications (every 15 seconds)
  useEffect(() => {
    if (!auth.token || !auth.apiUrl) return;

    const checkLowStockMobile = async () => {
      try {
        const res = await fetch(`${auth.apiUrl}inventory/products/low-stock/`, {
          headers: { Authorization: `Bearer ${auth.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const currentLowStockIds = new Set();
          
          data.forEach(p => {
            currentLowStockIds.add(p.id);
            // If not notified yet
            if (!notifiedProductsRef.current.has(p.id)) {
              const stockNum = Number(p.stock);
              const isZero = stockNum <= 0;
              sendNativeNotification({
                title: isZero ? '🚫 Producto Agotado' : '⚠️ Stock Mínimo Crítico',
                body: isZero 
                  ? `El producto "${p.name}" se ha agotado por completo.` 
                  : `"${p.name}" tiene stock bajo: ${stockNum} unidades (Mínimo: ${p.min_stock}).`
              });
              notifiedProductsRef.current.add(p.id);
            }
          });

          // Clean up products that are no longer in low stock (e.g. replenished)
          for (const id of notifiedProductsRef.current) {
            if (!currentLowStockIds.has(id)) {
              notifiedProductsRef.current.delete(id);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to check low stock:", e);
      }
    };

    checkLowStockMobile();
    const interval = setInterval(checkLowStockMobile, 180000);
    return () => clearInterval(interval);
  }, [auth.token, auth.apiUrl]);

  const handleLogin = ({ token, user, apiUrl, settings }) => {
    requestNotificationPermissions();
    triggerHaptic('success');
    setAuth({ token, user, apiUrl, settings: settings || null });
  };

  const handleLogout = async () => {
    await storage.remove('token');
    await storage.remove('user');
    setAuth({ token: null, user: null, apiUrl: null, settings: null });
  };

  // Called by More.jsx after saving settings — refreshes settings from server so every page sees updated logo/name
  const handleSettingsUpdate = async (newSettings) => {
    setAuth(prev => ({ ...prev, settings: newSettings }));
    // Also re-fetch from server to ensure full sync
    if (auth.token && auth.apiUrl) {
      const fresh = await fetchSettings(auth.token, auth.apiUrl);
      if (fresh) setAuth(prev => ({ ...prev, settings: fresh }));
    }
  };

  if (showAppSplash) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#080a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 24
      }}>
        {/* Ambient POS Glow Background */}
        <div style={{
          position: 'absolute',
          width: 460,
          height: 460,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, rgba(37, 99, 235, 0.08) 45%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none'
        }} />

        {/* 🛒 POS TERMINAL & SHOPPING CART CENTERPIECE */}
        <div style={{
          position: 'relative',
          width: 140,
          height: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 32,
          animation: 'cartFloat 3s ease-in-out infinite',
          zIndex: 10
        }}>
          {/* Main POS Container Card with Neon Glow */}
          <div style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            background: 'linear-gradient(145deg, #141824, #1e2435)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            animation: 'posGlowPulse 2.5s ease-in-out infinite',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Laser Scanner Line Sweep */}
            <div style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 2,
              background: 'linear-gradient(90deg, transparent, #f97316, #3b82f6, transparent)',
              boxShadow: '0 0 10px #f97316',
              animation: 'posLaserScan 2s ease-in-out infinite',
              zIndex: 5
            }} />

            {/* Shopping Cart Icon with Badge */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={54} color="#f97316" strokeWidth={2.2} />
              
              {/* Badge Item count (+1) */}
              <div style={{
                position: 'absolute',
                top: -8,
                right: -10,
                background: '#2563eb',
                color: 'white',
                fontSize: 10,
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: 99,
                boxShadow: '0 0 10px rgba(37, 99, 235, 0.8)',
                animation: 'itemDrop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.6s both'
              }}>
                +1
              </div>
            </div>

            {/* Sub-label inside card */}
            <span style={{ fontSize: 9, fontWeight: 900, color: '#3b82f6', letterSpacing: '0.15em', marginTop: 6, textTransform: 'uppercase' }}>
              POS READY
            </span>
          </div>

          {/* Floating Micro Price Tag Badge (Left) */}
          <div style={{
            position: 'absolute',
            top: -10,
            left: -12,
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            borderRadius: 12,
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
            animation: 'itemDrop 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both'
          }}>
            <Tag size={16} color="#4ade80" />
          </div>

          {/* Floating Receipt Print (Right) */}
          <div style={{
            position: 'absolute',
            bottom: -10,
            right: -14,
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: 12,
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
            animation: 'itemDrop 1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.9s both'
          }}>
            <Receipt size={16} color="#60a5fa" />
          </div>
        </div>

        {/* 🏢 BUSINESS NAME & BRANDING */}
        <div style={{ textAlign: 'center', zIndex: 10 }}>
          {businessSettings.app_logo && (
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#ffffff',
              padding: 4,
              margin: '0 auto 12px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img src={businessSettings.app_logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}

          <h1 style={{
            fontSize: 28,
            fontWeight: 950,
            color: '#ffffff',
            margin: 0,
            letterSpacing: '0.02em',
            textTransform: 'uppercase'
          }}>
            {businessSettings.business_name || 'AGS SALES'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
            <Sparkles size={14} color="#f97316" />
            <span style={{ fontSize: 11, fontWeight: 900, color: '#f97316', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              SISTEMA PUNTO DE VENTA POS
            </span>
          </div>
        </div>

        {/* 📊 HIGH-TECH PROGRESS BAR & STATUS */}
        <div style={{
          position: 'absolute',
          bottom: '10%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          zIndex: 10,
          width: '80%',
          maxWidth: 280
        }}>
          {/* Progress Bar Track */}
          <div style={{
            width: '100%',
            height: 5,
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 99,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #f97316, #2563eb)',
              boxShadow: '0 0 12px #f97316',
              borderRadius: 99,
              width: '100%',
              animation: 'progressSweep 1.8s linear infinite'
            }} />
          </div>

          <span style={{
            fontSize: 11,
            color: '#94a3b8',
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: '0.04em'
          }}>
            {splashStepText}
          </span>
        </div>
        <style>{`
            left: -150%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent 30%,
              rgba(255, 255, 255, 0.15) 50%,
              transparent 70%
            );
            transform: skewX(-25deg);
            animation: shineSweep 2.5s ease-in-out infinite 3.5s;
          }
          @keyframes shineSweep {
            0% { left: -150%; }
            100% { left: 150%; }
          }

          .sparkle-anim {
            animation: sparklePulse 1.5s ease-in-out infinite alternate 2.8s;
          }
          @keyframes sparklePulse {
            0% { transform: scale(0.9) rotate(0deg); filter: drop-shadow(0 0 2px #f97316); }
            100% { transform: scale(1.1) rotate(15deg); filter: drop-shadow(0 0 6px #f97316); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/setup" element={<Setup />} />

          <Route
            path="/*"
            element={
              <Protected auth={auth}>
                <AppRoutes auth={auth} onLogout={handleLogout} onSettingsUpdate={handleSettingsUpdate} />
              </Protected>
            }
          />
        </Routes>

        {/* Custom iOS-Style Notification Toast */}
        {toast.show && (
          <div style={{
            position: 'fixed',
            top: 'calc(max(env(safe-area-inset-top, 0px), 36px) + 12px)',
            left: '5%',
            width: '90%',
            maxWidth: 360,
            background: 'rgba(20, 24, 33, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 20,
            padding: '12px 18px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'toastSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            {toast.type === 'success' && <CheckCircle2 size={22} color="#22c55e" />}
            {toast.type === 'error' && <XCircle size={22} color="#ef4444" />}
            {toast.type === 'warning' && <AlertTriangle size={22} color="#f59e0b" />}
            {toast.type === 'info' && <Info size={22} color="#3b82f6" />}
            <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', flex: 1 }}>{toast.message}</span>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}

function AppRoutes({ auth, onLogout, onSettingsUpdate }) {
  const user = auth.user;
  const canAccessInventory = hasPermission(user, 'inventory.access');
  const canAccessReports   = hasPermission(user, 'reports.access');
  const canAccessCash      = hasPermission(user, 'cash.access');
  const canAccessPOS       = hasPermission(user, 'pos.access');
  const canAccessSales     = hasPermission(user, 'sales.view_history');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Routes>
        <Route path="/" element={<Dashboard auth={auth} />} />
        <Route path="/inventory" element={canAccessInventory ? <Inventory auth={auth} /> : <Navigate to="/" replace />} />
        <Route path="/pos" element={canAccessPOS ? <POS auth={auth} /> : <Navigate to="/" replace />} />
        <Route path="/sales" element={canAccessSales ? <Sales auth={auth} /> : <Navigate to="/" replace />} />
        <Route path="/reports" element={canAccessReports ? <Reports auth={auth} /> : <Navigate to="/" replace />} />
        <Route path="/cash-control" element={canAccessCash ? <CashControl auth={auth} /> : <Navigate to="/" replace />} />
        <Route path="/credits" element={hasPermission(user, 'sales.credits') ? <Credits auth={auth} /> : <Navigate to="/" replace />} />
        <Route path="/more" element={<More auth={auth} onLogout={onLogout} onSettingsUpdate={onSettingsUpdate} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav user={auth.user} />
    </div>
  );
}
