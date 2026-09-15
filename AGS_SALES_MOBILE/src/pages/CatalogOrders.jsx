import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Clock, CheckCircle, XCircle, AlertCircle, User, MapPin, Phone, CreditCard, ChevronRight, RefreshCw, Filter, Bell } from 'lucide-react';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl, parseError, formatCurrency } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';
import { sendNativeNotification } from '../lib/notifications';

const STATUS_CONFIG = {
  'PENDING': { color: '#f59e0b', label: 'Pendiente', icon: Clock },
  'CONFIRMED': { color: '#3b82f6', label: 'Confirmado', icon: CheckCircle },
  'PREPARING': { color: '#8b5cf6', label: 'En Preparación', icon: AlertCircle },
  'READY': { color: '#10b981', label: 'Listo', icon: CheckCircle },
  'DELIVERED': { color: '#64748b', label: 'Entregado', icon: CheckCircle },
  'CANCELLED': { color: '#ef4444', label: 'Cancelado', icon: XCircle },
};

const ORDER_TYPE_CONFIG = {
  'DINE_IN': { label: '🍽️ Mesa', icon: '🍽️' },
  'TAKEOUT': { label: '🥡 Llevar', icon: '🥡' },
  'DELIVERY': { label: '🚗 Domicilio', icon: '🚗' },
};

export default function CatalogOrders({ auth }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const pollingRef = useRef(null);

  const fmt = (n) => formatCurrency(n, auth.settings?.currency_symbol || '$', parseInt(auth.settings?.currency_decimals || '0', 10));

  useEffect(() => {
    fetchOrders();
    startPolling();
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const startPolling = () => {
    // Verificar nuevos pedidos cada 30 segundos
    pollingRef.current = setInterval(checkNewOrders, 30000);
  };

  const checkNewOrders = async () => {
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'catalog-orders/orders/check-new-orders/'), {}, auth.token);
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.pending_count);
        
        if (data.has_new && data.order) {
          // Mostrar notificación nativa
          sendNativeNotification(
            '¡Nuevo Pedido del Catálogo!',
            `Pedido #${data.order.order_number} de ${data.order.customer_name} - ${fmt(data.order.total)}`,
            { sound: true }
          );
          
          // Actualizar lista de pedidos
          fetchOrders();
          
          // Mostrar toast
          Toast.fire({
            icon: 'info',
            title: `Nuevo pedido #${data.order.order_number}`,
            timer: 5000
          });
        }
      }
    } catch (e) {
      console.error('Error checking new orders:', e);
    }
  };

  useEffect(() => {
    if (statusFilter === 'ALL') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.status === statusFilter));
    }
  }, [statusFilter, orders]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'catalog-orders/orders/active/'), {}, auth.token);
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : data.results || []);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
      DarkSwal.fire('Error', 'No se pudieron cargar los pedidos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    const result = await DarkSwal.fire({
      title: 'Cambiar Estado',
      text: `¿Cambiar pedido #${order.order_number} a ${STATUS_CONFIG[newStatus].label}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f97316',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await apiRequest(
        apiUrl(auth.apiUrl, `catalog-orders/orders/${order.id}/update-status/`),
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus, processed_by: auth.user?.id }),
        },
        auth.token
      );

      if (res.ok) {
        Toast.fire({ icon: 'success', title: 'Estado actualizado' });
        fetchOrders();
      } else {
        const err = await parseError(res);
        DarkSwal.fire('Error', err, 'error');
      }
    } catch (e) {
      DarkSwal.fire('Error', 'Error de conexión', 'error');
    }
  };

  const handleConvertToSale = async (order) => {
    const result = await DarkSwal.fire({
      title: 'Convertir a Venta',
      text: `¿Convertir pedido #${order.order_number} a venta del sistema POS?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, convertir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f97316',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await apiRequest(
        apiUrl(auth.apiUrl, `catalog-orders/orders/${order.id}/convert-to-sale/`),
        { method: 'POST' },
        auth.token
      );

      if (res.ok) {
        Toast.fire({ icon: 'success', title: 'Pedido convertido a venta' });
        fetchOrders();
      } else {
        const err = await parseError(res);
        DarkSwal.fire('Error', err, 'error');
      }
    } catch (e) {
      DarkSwal.fire('Error', 'Error de conexión', 'error');
    }
  };

  const getStatusActions = (order) => {
    const actions = [];
    const currentStatus = order.status;

    if (currentStatus === 'PENDING') {
      actions.push({ status: 'CONFIRMED', label: 'Confirmar', color: '#3b82f6' });
      actions.push({ status: 'CANCELLED', label: 'Cancelar', color: '#ef4444' });
    } else if (currentStatus === 'CONFIRMED') {
      actions.push({ status: 'PREPARING', label: 'Iniciar Preparación', color: '#8b5cf6' });
      actions.push({ status: 'CANCELLED', label: 'Cancelar', color: '#ef4444' });
    } else if (currentStatus === 'PREPARING') {
      actions.push({ status: 'READY', label: 'Marcar como Listo', color: '#10b981' });
    } else if (currentStatus === 'READY') {
      actions.push({ status: 'DELIVERED', label: 'Entregar', color: '#64748b' });
    }

    return actions;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <div className="page-container fade-in-up">
      <TopBar 
        title="Pedidos del Catálogo" 
        subtitle="Gestiona pedidos web"
        rightContent={
          pendingCount > 0 && (
            <div style={{
              background: '#ef4444',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <Bell size={14} />
              {pendingCount} pendientes
            </div>
          )
        }
      />

      <div className="page-content" style={{ padding: '16px 16px 0', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 16px))' }}>
        {/* Filters */}
        <div style={{
          background: 'rgba(20, 24, 38, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 16,
          padding: '12px',
          marginBottom: 16,
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          alignItems: 'center'
        }}>
          <Filter size={16} color="#64748b" />
          {['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: statusFilter === status 
                  ? (STATUS_CONFIG[status]?.color || '#f97316') 
                  : 'rgba(255,255,255,0.05)',
                color: statusFilter === status ? 'white' : '#94a3b8',
                transition: 'all 0.2s'
              }}
            >
              {status === 'ALL' ? 'Todos' : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
          <button
            onClick={fetchOrders}
            style={{
              padding: '8px',
              borderRadius: 8,
              background: 'rgba(249, 115, 22, 0.1)',
              border: 'none',
              cursor: 'pointer',
              color: '#f97316'
            }}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Orders List */}
        {-loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ color: '#64748b', fontSize: 14 }}>Cargando pedidos...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <ShoppingBag size={48} color="#334155" style={{ marginBottom: 16 }} />
            <div style={{ color: '#64748b', fontSize: 14 }}>No hay pedidos para mostrar</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredOrders.map(order => {
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG['PENDING'];
              const StatusIcon = statusConfig.icon;
              const orderTypeConfig = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG['DINE_IN'];

              return (
                <div
                  key={order.id}
                  onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 16,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
                          #{order.order_number}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {orderTypeConfig.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={12} color="#64748b" />
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{order.customer_name}</span>
                      </div>
                      {order.table_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <MapPin size={12} color="#64748b" />
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{order.table_name}</span>
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      background: `${statusConfig.color}20`,
                      border: `1px solid ${statusConfig.color}40`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <StatusIcon size={12} color={statusConfig.color} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusConfig.color }}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {formatDateTime(order.created_at)}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                        {order.items?.length || 0} items
                      </span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#f97316' }}>
                      {fmt(order.total)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: 20,
            maxWidth: 500,
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: 20,
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>
                  Pedido #{selectedOrder.order_number}
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                  {formatDateTime(selectedOrder.created_at)}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 8
                }}
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 20 }}>
              {/* Customer Info */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>Información del Cliente</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} color="#64748b" />
                    <span style={{ fontSize: 14, color: '#e2e8f0' }}>{selectedOrder.customer_name}</span>
                  </div>
                  {selectedOrder.customer_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Phone size={16} color="#64748b" />
                      <span style={{ fontSize: 14, color: '#e2e8f0' }}>{selectedOrder.customer_phone}</span>
                    </div>
                  )}
                  {selectedOrder.customer_address && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={16} color="#64748b" />
                      <span style={{ fontSize: 14, color: '#e2e8f0' }}>{selectedOrder.customer_address}</span>
                    </div>
                  )}
                  {selectedOrder.table_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={16} color="#64748b" />
                      <span style={{ fontSize: 14, color: '#e2e8f0' }}>Mesa: {selectedOrder.table_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>Items del Pedido</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedOrder.items?.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                          {item.product_name}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          Cantidad: {item.quantity} × {fmt(item.unit_price)}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f97316' }}>
                        {fmt(item.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Notas</h4>
                  <p style={{ fontSize: 13, color: '#94a3b8', background: 'rgba(255, 255, 255, 0.03)', padding: 12, borderRadius: 8 }}>
                    {selectedOrder.notes}
                  </p>
                </div>
              )}

              {/* Totals */}
              <div style={{ marginBottom: 20, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Subtotal</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{fmt(selectedOrder.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Impuestos</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{fmt(selectedOrder.tax)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#f97316' }}>{fmt(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {getStatusActions(selectedOrder).map(action => (
                    <button
                      key={action.status}
                      onClick={() => handleStatusChange(selectedOrder, action.status)}
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: 12,
                        borderRadius: 8,
                        background: action.color,
                        border: 'none',
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                {!selectedOrder.related_sale && selectedOrder.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleConvertToSale(selectedOrder)}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #f97316, #ea580c)',
                      border: 'none',
                      color: 'white',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    <CreditCard size={16} />
                    Convertir a Venta POS
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
