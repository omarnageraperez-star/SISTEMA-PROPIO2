import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, Clock, CheckCircle, XCircle, AlertCircle, User, MapPin, Phone, 
  CreditCard, ChevronRight, RefreshCw, Filter, Bell, Navigation, CheckCircle2, LogOut
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl, parseError, formatCurrency } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';
import { sendNativeNotification } from '../lib/notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

const STATUS_CONFIG = {
  'PENDING': { color: '#f59e0b', label: 'Pendiente', icon: Clock },
  'CONFIRMED': { color: '#3b82f6', label: 'Confirmado', icon: CheckCircle },
  'PREPARING': { color: '#8b5cf6', label: 'En Preparación', icon: AlertCircle },
  'READY': { color: '#10b981', label: 'Listo / En Reparto', icon: CheckCircle },
  'DELIVERED': { color: '#64748b', label: 'Entregado', icon: CheckCircle2 },
  'CANCELLED': { color: '#ef4444', label: 'Cancelado', icon: XCircle },
};

const ORDER_TYPE_CONFIG = {
  'DINE_IN': { label: '🍽️ Mesa', icon: '🍽️' },
  'TAKEOUT': { label: '🥡 Llevar', icon: '🥡' },
  'DELIVERY': { label: '🛵 Domicilio', icon: '🛵' },
};

export default function CatalogOrders({ auth, onLogout }) {
  const navigate = useNavigate();
  const isDeliveryDriver = auth.user?.role === 'DELIVERY';

  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(isDeliveryDriver ? 'READY' : 'ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [gpsActive, setGpsActive] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const pollingRef = useRef(null);
  const gpsRef = useRef(null);

  const fmt = (n) => formatCurrency(n, auth.settings?.currency_symbol || '$', parseInt(auth.settings?.currency_decimals || '0', 10));

  // ─── GPS Tracking para domiciliarios ───
  useEffect(() => {
    if (!isDeliveryDriver) return;

    const hasActiveDeliveries = orders.some(o => o.status === 'READY' && o.order_type === 'DELIVERY');

    if (hasActiveDeliveries && !gpsRef.current) {
      // Iniciar rastreo GPS
      setGpsActive(true);
      gpsRef.current = setInterval(async () => {
        try {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
          await apiRequest(
            apiUrl(auth.apiUrl, 'catalog-orders/orders/update-location/'),
            {
              method: 'POST',
              body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            },
            auth.token
          );
        } catch (e) {
          console.log('GPS error:', e);
        }
      }, 15000);

      // Enviar ubicación inmediatamente al iniciar
      (async () => {
        try {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
          await apiRequest(
            apiUrl(auth.apiUrl, 'catalog-orders/orders/update-location/'),
            {
              method: 'POST',
              body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            },
            auth.token
          );
        } catch (e) { console.log('GPS initial error:', e); }
      })();

    } else if (!hasActiveDeliveries && gpsRef.current) {
      // Detener rastreo GPS cuando ya no hay pedidos activos
      clearInterval(gpsRef.current);
      gpsRef.current = null;
      setGpsActive(false);
    }

    return () => {
      if (gpsRef.current) {
        clearInterval(gpsRef.current);
        gpsRef.current = null;
      }
    };
  }, [orders, isDeliveryDriver]);

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
    // Verificar nuevos pedidos cada 15 segundos
    pollingRef.current = setInterval(checkNewOrders, 15000);
  };

  const checkNewOrders = async () => {
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'catalog-orders/orders/check-new-orders/'), {}, auth.token);
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.pending_count);
        
        if (data.has_new && data.order) {
          sendNativeNotification(
            '¡Nuevo Pedido del Catálogo!',
            `Pedido #${data.order.order_number} de ${data.order.customer_name} - ${fmt(data.order.total)}`,
            { sound: true }
          );
          
          fetchOrders();
          Toast.fire({
            icon: 'info',
            title: `Nuevo pedido #${data.order.order_number}`,
            timer: 4000
          });
        }
      }
    } catch (e) {
      console.error('Error checking new orders:', e);
    }
  };

  useEffect(() => {
    let result = orders;
    if (isDeliveryDriver) {
      if (statusFilter === 'ALL') {
        result = orders.filter(o => ['READY', 'DELIVERED'].includes(o.status));
      } else {
        result = orders.filter(o => o.status === statusFilter);
      }
    } else {
      if (statusFilter !== 'ALL') {
        result = orders.filter(o => o.status === statusFilter);
      }
    }
    setFilteredOrders(result);
  }, [statusFilter, orders, isDeliveryDriver]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'catalog-orders/orders/'), {}, auth.token);
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

  const openInMaps = (address) => {
    if (!address) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_system');
  };

  const handleStatusChange = async (order, newStatus) => {
    // Prevenir múltiples clics en el mismo pedido
    if (updatingOrderId === order.id) {
      return;
    }

    const isDeliverAction = newStatus === 'DELIVERED';
    const result = await DarkSwal.fire({
      title: isDeliverAction ? 'Confirmar Entrega' : 'Cambiar Estado',
      text: isDeliverAction 
        ? `¿Confirmas que el pedido #${order.order_number} ha sido entregado al cliente ${order.customer_name}?`
        : `¿Cambiar pedido #${order.order_number} a ${STATUS_CONFIG[newStatus]?.label || newStatus}?`,
      icon: isDeliverAction ? 'success' : 'question',
      showCancelButton: true,
      confirmButtonText: isDeliverAction ? 'Sí, Entregado' : 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: isDeliverAction ? '#10b981' : '#f97316',
    });

    if (!result.isConfirmed) return;

    setUpdatingOrderId(order.id);

    try {
      let requestBody;
      let headers = {
        'Authorization': `Bearer ${auth.token}`,
      };

      if (isDeliverAction) {
        try {
          const photo = await Camera.getPhoto({
            quality: 70,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
          });

          if (photo.dataUrl) {
            requestBody = {
              status: newStatus,
              processed_by: auth.user?.id,
              delivery_photo: photo.dataUrl
            };
          }
        } catch (e) {
          console.log('User cancelled camera or error:', e);
        }
      }

      // Si requestBody no fue asignado por la foto, crear default
      if (!requestBody) {
        requestBody = { status: newStatus, processed_by: auth.user?.id };
      }

      const res = await apiRequest(
        apiUrl(auth.apiUrl, `catalog-orders/orders/${order.id}/update-status/`),
        {
          method: 'PATCH',
          body: JSON.stringify(requestBody),
        },
        auth.token
      );

      if (res.ok) {
        Toast.fire({ icon: 'success', title: isDeliverAction ? '¡Pedido marcado como Entregado!' : 'Estado actualizado' });
        fetchOrders();
        if (selectedOrder && selectedOrder.id === order.id) {
          setShowDetailModal(false);
        }
      } else {
        const err = await parseError(res);
        DarkSwal.fire('Error', err, 'error');
      }
    } catch (e) {
      console.error(e);
      DarkSwal.fire('Error', 'Error de conexión', 'error');
    } finally {
      setUpdatingOrderId(null);
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

    if (isDeliveryDriver) {
      if (currentStatus === 'READY') {
        actions.push({ status: 'DELIVERED', label: '✅ Marcar como Entregado', color: '#10b981' });
      }
      return actions;
    }

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

  const filterButtons = isDeliveryDriver
    ? [
        { id: 'READY', label: '🛵 Listos para Entrega' },
        { id: 'DELIVERED', label: '✅ Mis Entregas' },
        { id: 'ALL', label: 'Todos' },
      ]
    : [
        { id: 'ALL', label: 'Todos' },
        { id: 'PENDING', label: 'Pendientes' },
        { id: 'CONFIRMED', label: 'Confirmados' },
        { id: 'PREPARING', label: 'En Cocina' },
        { id: 'READY', label: 'Listos' },
        { id: 'DELIVERED', label: 'Entregados' },
      ];

  return (
    <div className="page-container fade-in-up">
      <TopBar 
        title={isDeliveryDriver ? "Ruta de Domicilios" : "Pedidos del Catálogo"} 
        subtitle={isDeliveryDriver ? "Despacho y entrega de pedidos" : "Gestiona pedidos web"}
        rightAction={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pendingCount > 0 && !isDeliveryDriver && (
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
                {pendingCount} nuevos
              </div>
            )}
            {isDeliveryDriver && (
              <button 
                onClick={onLogout}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '6px 12px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#f87171',
                  fontWeight: 'bold',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                <LogOut size={14} />
                Salir
              </button>
            )}
          </div>
        }
      />

      <div className="page-content" style={{ padding: '16px 16px 0', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 16px))' }}>
        
        {/* Banner Domiciliario */}
        {isDeliveryDriver && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 16,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, background: 'rgba(16, 185, 129, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
            }}>
              🛵
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399' }}>Modo Domiciliario Activo</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {gpsActive 
                  ? '📡 GPS activo — enviando ubicación en tiempo real' 
                  : 'Visualiza pedidos listos, navega por GPS y marca entregado.'}
              </div>
              {gpsActive && (
                <div style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
                  background: 'rgba(16, 185, 129, 0.15)', padding: '3px 10px', borderRadius: 20,
                  fontSize: 10, color: '#34d399', fontWeight: 700
                }}>
                  <span style={{ 
                    width: 8, height: 8, borderRadius: '50%', background: '#34d399',
                    animation: 'pulse 1.5s infinite'
                  }} />
                  RASTREO EN VIVO
                </div>
              )}
            </div>
          </div>
        )}

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
          {filterButtons.map(item => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: statusFilter === item.id 
                  ? (STATUS_CONFIG[item.id]?.color || '#f97316') 
                  : 'rgba(255,255,255,0.05)',
                color: statusFilter === item.id ? 'white' : '#94a3b8',
                transition: 'all 0.2s'
              }}
            >
              {item.label}
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ color: '#64748b', fontSize: 14 }}>Cargando pedidos...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <ShoppingBag size={48} color="#334155" style={{ marginBottom: 16 }} />
            <div style={{ color: '#64748b', fontSize: 14 }}>
              {isDeliveryDriver ? 'No hay entregas pendientes en esta sección' : 'No hay pedidos para mostrar'}
            </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
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
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>Mesa: {order.table_name}</span>
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

                  {/* Customer Address & GPS Navigation Button */}
                  {order.customer_address && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 10,
                      padding: '8px 10px',
                      marginBottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                        <MapPin size={14} color="#f87171" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {order.customer_address}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInMaps(order.customer_address);
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 8,
                          padding: '4px 8px',
                          color: '#f87171',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          flexShrink: 0
                        }}
                      >
                        <Navigation size={12} />
                        <span>GPS</span>
                      </button>
                    </div>
                  )}

                  {/* Order Footer & Quick Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
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

                  {/* 1-Tap Quick Delivery Button on Card for READY orders */}
                  {order.status === 'READY' && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(order, 'DELIVERED');
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: updatingOrderId === order.id 
                            ? 'rgba(16, 185, 129, 0.5)' 
                            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          color: 'white',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: updatingOrderId === order.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                          opacity: updatingOrderId === order.id ? 0.7 : 1
                        }}
                      >
                        <CheckCircle size={15} />
                        <span>{updatingOrderId === order.id ? 'Procesando...' : 'Marcar como Entregado'}</span>
                      </button>
                    </div>
                  )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} color="#64748b" />
                    <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>{selectedOrder.customer_name}</span>
                  </div>
                  {selectedOrder.customer_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Phone size={16} color="#10b981" />
                        <span style={{ fontSize: 14, color: '#e2e8f0' }}>{selectedOrder.customer_phone}</span>
                      </div>
                      <a
                        href={`tel:${selectedOrder.customer_phone}`}
                        style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#34d399',
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Phone size={12} />
                        <span>Llamar</span>
                      </a>
                    </div>
                  )}
                  {selectedOrder.customer_address && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 12,
                      padding: 12,
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <MapPin size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{selectedOrder.customer_address}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openInMaps(selectedOrder.customer_address)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          border: 'none',
                          color: 'white',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        <Navigation size={16} />
                        <span>Abrir en Google Maps / GPS</span>
                      </button>
                    </div>
                  )}
                  {selectedOrder.table_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={16} color="#38bdf8" />
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

              {/* Delivery Photo Evidence */}
              {selectedOrder.delivery_photo && (
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>📸 Evidencia de Entrega</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <img 
                      src={selectedOrder.delivery_photo} 
                      alt="Evidencia de entrega" 
                      style={{ 
                        width: '100%', 
                        maxHeight: 250, 
                        borderRadius: 12, 
                        border: '2px solid #10b981',
                        objectFit: 'contain',
                        background: 'white'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const win = window.open();
                        win.document.write(`<img src="${selectedOrder.delivery_photo}" style="max-width:100%;max-height:100vh;margin:auto;display:block;">`);
                        win.document.title = `Evidencia de Entrega - Pedido #${selectedOrder.order_number}`;
                      }}
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <ExternalLink size={16} />
                      <span>Abrir en nueva pestaña</span>
                    </button>
                  </div>
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
                        borderRadius: 10,
                        background: action.color,
                        border: 'none',
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                {!isDeliveryDriver && !selectedOrder.related_sale && selectedOrder.status !== 'CANCELLED' && (
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
