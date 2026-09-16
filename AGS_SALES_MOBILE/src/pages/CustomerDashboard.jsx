import React, { useState, useEffect } from 'react';
import { User, LogOut, ShoppingCart, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl, parseError, formatCurrency } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';

const STATUS_CONFIG = {
  'PENDING': { color: '#f59e0b', label: 'Pendiente', icon: Clock },
  'CONFIRMED': { color: '#3b82f6', label: 'Confirmado', icon: CheckCircle },
  'PREPARING': { color: '#8b5cf6', label: 'En Preparación', icon: AlertCircle },
  'READY': { color: '#10b981', label: 'Listo', icon: CheckCircle },
  'DELIVERED': { color: '#64748b', label: 'Entregado', icon: CheckCircle },
  'CANCELLED': { color: '#ef4444', label: 'Cancelado', icon: XCircle },
};

export default function CustomerDashboard({ auth, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerToken, setCustomerToken] = useState(localStorage.getItem('customerToken'));
  const [customerUser, setCustomerUser] = useState(JSON.parse(localStorage.getItem('customerUser') || '{}'));

  const fmt = (n) => formatCurrency(n, auth.settings?.currency_symbol || '$', parseInt(auth.settings?.currency_decimals || '0', 10));

  useEffect(() => {
    if (!customerToken) {
      DarkSwal.fire('No autenticado', 'Debes iniciar sesión para ver tus pedidos', 'error');
      return;
    }
    fetchOrders();
  }, [customerToken]);

  const fetchOrders = async () => {
    try {
      const res = await apiRequest(
        apiUrl(auth.apiUrl, 'catalog-orders/orders/'),
        { method: 'GET' },
        customerToken
      );
      if (res.ok) {
        const data = await res.json();
        setOrders(data.results || data || []);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerUser');
    setCustomerToken(null);
    setCustomerUser({});
    Toast.fire({ icon: 'success', title: 'Sesión cerrada' });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!customerToken) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#f8fafc' }}>
        <TopBar title="Cliente" onLogout={onLogout} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <User size={64} color="#64748b" style={{ marginBottom: 20 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>No has iniciado sesión</h2>
            <p style={{ color: '#64748b', marginBottom: 20 }}>Inicia sesión para ver tus pedidos</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#f8fafc' }}>
      <TopBar title="Mis Pedidos" onLogout={onLogout} />
      
      {/* Customer Info Header */}
      <div style={{ background: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(16px)', padding: 20, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>
              {customerUser.first_name?.[0] || 'C'}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{customerUser.first_name} {customerUser.last_name}</h2>
              <p style={{ fontSize: 12, color: '#64748b' }}>{customerUser.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={14} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ width: 40, height: 40, border: '4px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <p style={{ color: '#64748b' }}>Cargando pedidos...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: 'rgba(30, 41, 59, 0.5)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <ShoppingCart size={48} color="#64748b" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Sin pedidos</h3>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>Aún no has realizado pedidos</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.map((order) => (
              <div
                key={order.id}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: 16,
                  padding: 16,
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Pedido #{order.order_number}</h3>
                    <p style={{ fontSize: 12, color: '#64748b' }}>{formatDate(order.created_at)}</p>
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: `${STATUS_CONFIG[order.status]?.color}20`,
                      color: STATUS_CONFIG[order.status]?.color,
                      border: `1px solid ${STATUS_CONFIG[order.status]?.color}40`
                    }}
                  >
                    {STATUS_CONFIG[order.status]?.label}
                  </span>
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  {order.items?.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: idx < order.items.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: 14, color: '#e2e8f0' }}>{item.product_name}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{order.items?.length || 0} items</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#f97316' }}>{fmt(order.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
