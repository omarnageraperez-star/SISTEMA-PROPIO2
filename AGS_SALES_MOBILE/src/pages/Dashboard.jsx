import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  TrendingUp, ShoppingCart, Package, DollarSign, AlertTriangle, 
  ArrowUp, ArrowDown, Clock, Activity, RefreshCw, Plus, Sparkles, 
  ChevronRight, Wallet, ShieldCheck, Zap, Settings, FileText, CreditCard,
  ShoppingBag, Users, Search, Trash2, Send, Share2, X, Store
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';

const formatWithSettings = (n, settings) => {
  const num = parseFloat(n) || 0;
  const symbol = settings?.currency_symbol || '$';
  const decimals = parseInt(settings?.currency_decimals || '0', 10);
  return `${symbol} ${num.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

function MetricCard({ icon: Icon, label, value, color = '#f97316', trend }) {
  const colorMap = {
    '#f97316': { bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.2)', shadow: 'rgba(249, 115, 22, 0.1)' },
    '#22c55e': { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', shadow: 'rgba(34, 197, 94, 0.1)' },
    '#8b5cf6': { bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.2)', shadow: 'rgba(139, 92, 246, 0.1)' },
    '#ef4444': { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', shadow: 'rgba(239, 68, 68, 0.1)' }
  };
  const theme = colorMap[color] || colorMap['#f97316'];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(26, 31, 46, 0.8) 0%, rgba(15, 19, 31, 0.9) 100%)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: 22,
      padding: '16px 14px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 12,
      boxShadow: `0 12px 28px ${theme.shadow}, inset 0 1px 1px rgba(255,255,255,0.02)`,
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    }} className="dashboard-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 900, color: trend >= 0 ? '#22c55e' : '#ef4444' }}>
            {trend >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 950, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard({ auth }) {
  const fmt = (n) => formatWithSettings(n, auth.settings);
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [time, setTime]       = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => {
      fetchDashboard(true);
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  async function fetchDashboard(silent = false) {
    if (!silent) {
      setLoading(true);
      setError(false);
    } else {
      setIsRefreshing(true);
    }
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'reports/dashboard/'), {}, auth.token);
      if (res.ok) {
        setData(await res.json());
      } else if (!silent) {
        setError(true);
      }
    } catch {
      if (!silent) {
        setError(true);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  const todaySales    = data?.total_orders          ?? 0;
  const todayRevenue  = data?.total_sales           ?? 0;
  const totalProducts = data?.active_products       ?? 0;
  const lowStock      = data?.low_stock             ?? 0;
  const recentSales   = data?.recent_sales          ?? [];

  // Daily target setting (e.g. 300,000 COP)
  const dailyTarget = 300000;
  const targetPercent = Math.min(100, Math.round((todayRevenue / dailyTarget) * 100));

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return '¡Buenos días';
    if (h < 18) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  const roleName = {
    SUPERADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    CASHIER: 'Cajero',
    SELLER: 'Vendedor',
    WAREHOUSE: 'Bodega',
  }[auth.user?.role] || auth.user?.role;

  // Quote modal state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteCustomer, setQuoteCustomer]   = useState('');
  const [quotePhone, setQuotePhone]         = useState('');
  const [quoteItems, setQuoteItems]         = useState([]);
  const [allProducts, setAllProducts]       = useState([]);
  const [prodSearch, setProdSearch]         = useState('');
  const [savingQuote, setSavingQuote]       = useState(false);
  const [loadingProds, setLoadingProds]     = useState(false);

  const openQuoteModal = async () => {
    setShowQuoteModal(true);
    if (allProducts.length === 0) {
      setLoadingProds(true);
      try {
        const res = await apiRequest(apiUrl(auth.apiUrl, 'inventory/products/?page_size=1000'), {}, auth.token);
        if (res.ok) {
          const data = await res.json();
          setAllProducts(Array.isArray(data) ? data : (data.results || []));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingProds(false);
      }
    }
  };

  const addProductToQuote = (prod) => {
    setQuoteItems(prev => {
      const existing = prev.find(i => i.id === prod.id);
      if (existing) {
        return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, {
        id: prod.id,
        name: prod.name,
        price: parseFloat(prod.price_sell || prod.price || 0),
        qty: 1
      }];
    });
    Toast.fire({ icon: 'success', title: `Agregado: ${prod.name}` });
  };

  const updateItemQty = (id, delta) => {
    setQuoteItems(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const removeItemFromQuote = (id) => {
    setQuoteItems(prev => prev.filter(i => i.id !== id));
  };

  const quoteSubtotal = quoteItems.reduce((acc, i) => acc + (i.price * i.qty), 0);

  const shareQuoteWhatsApp = () => {
    if (quoteItems.length === 0) {
      Toast.fire({ icon: 'error', title: 'Agrega productos a la cotización' });
      return;
    }
    const businessName = auth.settings?.business_name || 'AGS SALES';
    const dateStr = new Date().toLocaleDateString('es-CO');
    let text = `📄 *COTIZACIÓN DE VENTA - ${businessName.toUpperCase()}*\n`;
    text += `📅 Fecha: ${dateStr}\n`;
    if (quoteCustomer) text += `👤 Cliente: ${quoteCustomer}\n`;
    text += `----------------------------------------\n`;

    quoteItems.forEach((item, idx) => {
      const lineTot = item.price * item.qty;
      text += `${idx + 1}. *${item.name}*\n`;
      text += `   ${item.qty} x ${fmt(item.price)} = *${fmt(lineTot)}*\n`;
    });

    text += `----------------------------------------\n`;
    text += `💰 *TOTAL COTIZADO: ${fmt(quoteSubtotal)}*\n`;
    text += `\n📌 _Cotización válida por 15 días. Sujeta a disponibilidad._\n`;
    text += `¡Gracias por tu preferencia!`;

    const encoded = encodeURIComponent(text);
    const phoneNum = quotePhone.replace(/\D/g, '');
    const url = phoneNum ? `https://wa.me/57${phoneNum}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const saveQuoteToSystem = async () => {
    if (quoteItems.length === 0) {
      Toast.fire({ icon: 'error', title: 'Agrega productos a la cotización' });
      return;
    }
    setSavingQuote(true);
    try {
      const payload = {
        status: 'PENDING',
        customer_name: quoteCustomer || 'Cliente Cotización',
        details: quoteItems.map(i => ({
          product: i.id,
          quantity: i.qty,
          unit_price: i.price
        }))
      };
      const res = await apiRequest(apiUrl(auth.apiUrl, 'sales/sales/'), {
        method: 'POST',
        body: JSON.stringify(payload)
      }, auth.token);

      if (res.ok) {
        DarkSwal.fire({
          icon: 'success',
          title: '¡Cotización Guardada!',
          text: 'La cotización ha sido guardada en el sistema en estado Pendiente.'
        });
        setShowQuoteModal(false);
        setQuoteItems([]);
        setQuoteCustomer('');
        setQuotePhone('');
      } else {
        const err = await res.json().catch(() => ({}));
        DarkSwal.fire({ icon: 'error', title: 'Error', text: err.detail || 'No se pudo guardar la cotización.' });
      }
    } catch (e) {
      console.error(e);
      DarkSwal.fire({ icon: 'error', title: 'Error de red', text: 'Verifica tu conexión.' });
    } finally {
      setSavingQuote(false);
    }
  };

  const buildLogoUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    const base = auth.apiUrl?.replace('/api/', '').replace(/\/$/, '') || '';
    return `${base}/${path.startsWith('/') ? path.slice(1) : path}`;
  };

  const businessName = auth.settings?.business_name || 'AGS SALES';
  const logoUrl = buildLogoUrl(auth.settings?.app_logo);

  return (
    <div className="page-container">
      
      {/* 🌟 1. TOP HEADER WITH BUSINESS LOGO & BUSINESS NAME */}
      <div className="safe-top" style={{
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(8, 10, 15, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          {/* Business Logo Box */}
          {logoUrl ? (
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: '#ffffff',
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.2)',
              flexShrink: 0
            }}>
              <img 
                src={logoUrl} 
                alt="Logo Negocio" 
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 10 }} 
              />
            </div>
          ) : (
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(249, 115, 22, 0.35)',
              flexShrink: 0
            }}>
              <Store size={22} color="#ffffff" />
            </div>
          )}

          {/* Business Name & User Greeting */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, color: 'var(--color-accent)', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {greeting()}, {auth.user?.username || 'Usuario'}
            </span>
            <h1 style={{ 
              fontSize: 17, 
              fontWeight: 950, 
              color: '#ffffff', 
              margin: 0, 
              letterSpacing: '-0.02em', 
              lineHeight: 1.15,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}>
              {businessName}
            </h1>
          </div>
        </div>

        <button
          onClick={() => navigate('/more')}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
          className="gear-btn"
        >
          <Settings size={19} color="#ffffff" />
        </button>
      </div>

      <div className="page-content" style={{ padding: '8px 16px 0' }}>
        
        {/* 🚀 MODULE 1: ACCESOS DIRECTOS */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--color-accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 }}>
            Accesos Rápidos
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Blue Card: Caja */}
            <div
              onClick={() => navigate('/cash-control')}
              style={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(37, 99, 235, 0.1) 100%)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                borderRadius: 20,
                padding: '16px 14px',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
              className="action-card"
            >
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'rgba(37, 99, 235, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <DollarSign size={20} color="#3b82f6" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>Caja</div>
                <div style={{ fontSize: 10, color: '#8a94a6', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Monitoreo</div>
              </div>
            </div>

            {/* Green Card: Nueva Cotización */}
            <div
              onClick={openQuoteModal}
              style={{
                background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.25) 0%, rgba(22, 163, 74, 0.1) 100%)',
                border: '1px solid rgba(22, 163, 74, 0.3)',
                borderRadius: 20,
                padding: '16px 14px',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}
              className="action-card"
            >
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'rgba(22, 163, 74, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText size={18} color="#22c55e" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>Cotización</div>
                <div style={{ fontSize: 10, color: '#8a94a6', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Nueva cotización</div>
              </div>
            </div>
          </div>
        </div>

        {/* 📊 MODULE 2: RESUMEN DE OPERACIONES */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--color-accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 4 }}>
            Operaciones & Resumen
          </p>
          
          <div style={{
            background: 'linear-gradient(180deg, rgba(20, 24, 38, 0.6) 0%, rgba(12, 15, 24, 0.8) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 24,
            padding: 16,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {/* Header / Sync status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="live-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#ffffff' }}>Resumen Diario</span>
              </div>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Caja en línea</span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton-box" style={{ height: 70, borderRadius: 14 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="skeleton-box" style={{ height: 70, borderRadius: 14 }} />
                  <div className="skeleton-box" style={{ height: 70, borderRadius: 14 }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                
                {/* Hero Card: Ventas Totales */}
                <div style={{
                  background: 'rgba(8, 11, 18, 0.6)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: 16,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'rgba(37, 99, 235, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CreditCard size={20} color="#3b82f6" />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>VENTAS DE HOY</span>
                    <div style={{ fontSize: 22, fontWeight: 950, color: '#ffffff', marginTop: 1, letterSpacing: '-0.02em' }}>
                      {fmt(todayRevenue)}
                    </div>
                  </div>
                </div>

                {/* Grid 2x2: Pedidos & Productos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* Card: Pedidos */}
                  <div style={{
                    background: 'rgba(8, 11, 18, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: 16,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PEDIDOS</span>
                    <div style={{ fontSize: 20, fontWeight: 950, color: '#ffffff', marginTop: 4 }}>
                      {todaySales}
                    </div>
                  </div>

                  {/* Card: Productos */}
                  <div 
                    onClick={() => navigate('/inventory')}
                    style={{
                      background: 'rgba(8, 11, 18, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: 16,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PRODUCTOS</span>
                    <div style={{ fontSize: 20, fontWeight: 950, color: '#ffffff', marginTop: 4 }}>
                      {totalProducts}
                    </div>
                  </div>
                </div>

                {/* Bajo Stock Alert Row */}
                <div
                  onClick={() => navigate('/inventory')}
                  style={{
                    background: lowStock > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(8, 11, 18, 0.6)',
                    border: `1px solid ${lowStock > 0 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.04)'}`,
                    borderRadius: 16,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} color={lowStock > 0 ? '#fbbf24' : '#64748b'} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: lowStock > 0 ? '#fbbf24' : '#ffffff' }}>Alertas de Bajo Stock</span>
                  </div>
                  <span style={{
                    fontSize: 12, 
                    fontWeight: 900, 
                    background: lowStock > 0 ? '#fbbf24' : 'rgba(255,255,255,0.08)',
                    color: lowStock > 0 ? '#451a03' : '#94a3b8',
                    padding: '2px 8px',
                    borderRadius: 8
                  }}>
                    {lowStock} {lowStock === 1 ? 'item' : 'items'}
                  </span>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* 📜 MODULE 3: PEDIDOS RECIENTES */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Pedidos recientes
            </h3>
            <button
              onClick={() => navigate('/sales')}
              style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Ver todo
            </button>
          </div>

          {recentSales.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentSales.slice(0, 5).map((sale, i) => (
                <div key={sale.id || i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#12151c',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 18,
                  padding: '14px 16px',
                  gap: 12
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FileText size={18} color="#3b82f6" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Pedido {sale.invoice_number || `PED-${String(sale.id).padStart(6, '0')}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#8a94a6', marginTop: 3 }}>
                      {sale.created_at ? new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : 'reciente'} • {sale.payment_method_name || 'Efectivo'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-block',
                      background: 'rgba(34, 197, 94, 0.18)',
                      color: '#4ade80',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      marginBottom: 4,
                    }}>
                      Completado
                    </span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                      {fmt(sale.total)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '30px 20px',
              background: '#12151c',
              border: '1px dashed rgba(255, 255, 255, 0.08)',
              borderRadius: 20,
              color: '#8a94a6'
            }}>
              <FileText size={28} color="#475569" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#ffffff' }}>Sin pedidos recientes</p>
              <p style={{ fontSize: 11, margin: '4px 0 0' }}>Los pedidos registrados aparecerán aquí</p>
            </div>
          )}
        </div>

      </div>

      {/* 📄 MODAL - NUEVA COTIZACIÓN DE VENTA */}
      {showQuoteModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }} onClick={e => e.target === e.currentTarget && setShowQuoteModal(false)}>
          <div className="modal-sheet" style={{
            height: '92vh',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            background: '#080a0f',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '16px 16px 0',
            overflowY: 'hidden'
          }}>
            {/* Top Navigation Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 14,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: 14
            }}>
              <button
                onClick={() => setShowQuoteModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#3b82f6',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 99,
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>

              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Nueva Cotización
              </h2>

              <button
                onClick={shareQuoteWhatsApp}
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 99,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Share2 size={14} color="white" />
                WhatsApp
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(30px + env(safe-area-inset-bottom, 16px))' }}>
              
              {/* Cliente */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a94a6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, marginLeft: 4 }}>
                  DATOS DEL CLIENTE
                </div>
                <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    placeholder="Nombre del cliente / Empresa *"
                    value={quoteCustomer}
                    onChange={e => setQuoteCustomer(e.target.value)}
                    style={{
                      background: '#090b10',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      color: '#ffffff',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <input
                    placeholder="Teléfono WhatsApp (Ej: 3001234567)"
                    type="tel"
                    value={quotePhone}
                    onChange={e => setQuotePhone(e.target.value)}
                    style={{
                      background: '#090b10',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      padding: '10px 14px',
                      color: '#ffffff',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Buscar y Agregar Productos */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a94a6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, marginLeft: 4 }}>
                  AGREGAR PRODUCTOS
                </div>
                <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 20, padding: 14 }}>
                  <div style={{
                    background: '#090b10',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10
                  }}>
                    <Search size={16} color="#8a94a6" />
                    <input
                      placeholder="Buscar producto para cotizar..."
                      value={prodSearch}
                      onChange={e => setProdSearch(e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: '#ffffff', outline: 'none', fontSize: 13 }}
                    />
                    {prodSearch && (
                      <button onClick={() => setProdSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={14} color="#8a94a6" />
                      </button>
                    )}
                  </div>

                  {/* Product Search Results Horizontal List */}
                  {loadingProds ? (
                    <div style={{ textAlign: 'center', padding: 12, color: '#8a94a6', fontSize: 12 }}>Cargando inventario...</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
                      {allProducts
                        .filter(p => !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.sku?.toLowerCase().includes(prodSearch.toLowerCase()))
                        .slice(0, 10)
                        .map(p => (
                          <div
                            key={p.id}
                            onClick={() => addProductToQuote(p)}
                            style={{
                              background: '#090b10',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: 14,
                              padding: '8px 12px',
                              flexShrink: 0,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              minWidth: 120
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
                              {p.name}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e' }}>
                              {fmt(p.price_sell || p.price || 0)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ítems Cotizados */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a94a6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, marginLeft: 4 }}>
                  ÍTEMS EN LA COTIZACIÓN ({quoteItems.length})
                </div>
                <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quoteItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 10px', color: '#8a94a6', fontSize: 13 }}>
                      Toca un producto arriba para agregarlo a la cotización.
                    </div>
                  ) : (
                    quoteItems.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090b10', padding: 10, borderRadius: 14 }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 800, marginTop: 2 }}>
                            {fmt(item.price * item.qty)}
                          </div>
                        </div>

                        {/* Qty Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', background: '#12151c', borderRadius: 99, border: '1px solid rgba(255,255,255,0.08)' }}>
                            <button
                              onClick={() => updateItemQty(item.id, -1)}
                              style={{ width: 28, height: 28, borderRadius: '50%', background: 'transparent', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
                            >
                              -
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', padding: '0 6px' }}>
                              {item.qty}
                            </span>
                            <button
                              onClick={() => updateItemQty(item.id, 1)}
                              style={{ width: 28, height: 28, borderRadius: '50%', background: 'transparent', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => removeItemFromQuote(item.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: 10, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Total & Acciones Finales */}
              <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 20, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 14, color: '#8a94a6', fontWeight: 600 }}>Total Cotizado:</span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#22c55e' }}>{fmt(quoteSubtotal)}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    onClick={shareQuoteWhatsApp}
                    style={{
                      background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 14,
                      padding: 14,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)'
                    }}
                  >
                    <Send size={18} color="white" />
                    Enviar por WhatsApp al Cliente
                  </button>

                  <button
                    onClick={saveQuoteToSystem}
                    disabled={savingQuote}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 14,
                      padding: 14,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    {savingQuote ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Guardando...</> : '💾 Guardar Cotización en Sistema'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .action-card:active {
          transform: scale(0.96);
        }
        .gear-btn:active {
          transform: scale(0.9);
          background: rgba(255, 255, 255, 0.18) !important;
        }
      `}</style>
    </div>
  );
}
