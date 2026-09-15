import { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Clock, CheckCircle, XCircle, AlertCircle, User, MapPin, Phone, CreditCard, RefreshCw, Filter, Bell, Volume2, VolumeX, Settings, Play } from 'lucide-react';
import Swal from 'sweetalert2';
import { apiRequest } from '../../lib/api';

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

export default function CatalogOrdersModule({ config, token, systemSettings }) {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState({
    sound: true,
    popup: true,
    autoRefresh: true,
    refreshInterval: 30
  });
  const [showSettings, setShowSettings] = useState(false);
  const audioRef = useRef(null);

  const symbol = systemSettings?.currency_symbol || '$';
  const decimals = parseInt(systemSettings?.currency_decimals ?? '2', 10);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount).replace('COP', symbol);
  };

  useEffect(() => {
    fetchOrders();
    startPolling();
    
    // Cargar configuración de notificaciones
    loadNotificationSettings();
    
    return () => {
      if (window.pollingInterval) {
        clearInterval(window.pollingInterval);
      }
    };
  }, []);

  const loadNotificationSettings = () => {
    const savedSettings = localStorage.getItem('catalogNotificationSettings');
    if (savedSettings) {
      setNotificationSettings(JSON.parse(savedSettings));
      setSoundEnabled(JSON.parse(savedSettings).sound);
    }
  };

  const saveNotificationSettings = (newSettings) => {
    setNotificationSettings(newSettings);
    setSoundEnabled(newSettings.sound);
    localStorage.setItem('catalogNotificationSettings', JSON.stringify(newSettings));
  };

  const playNotificationSound = () => {
    if (!soundEnabled || !notificationSettings.sound) return;
    
    try {
      // Crear un sonido de notificación usando Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      
      // Segundo tono
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        oscillator2.frequency.value = 1000;
        oscillator2.type = 'sine';
        gainNode2.gain.value = 0.3;
        oscillator2.start();
        oscillator2.stop(audioContext.currentTime + 0.2);
      }, 250);
    } catch (e) {
      console.error('Error playing notification sound:', e);
    }
  };

  const startPolling = () => {
    // Usar el intervalo configurado por el usuario
    const interval = notificationSettings.refreshInterval * 1000;
    window.pollingInterval = setInterval(checkNewOrders, interval);
  };

  useEffect(() => {
    // Reiniciar el polling cuando cambian las configuraciones
    if (window.pollingInterval) {
      clearInterval(window.pollingInterval);
    }
    if (notificationSettings.autoRefresh) {
      startPolling();
    }
  }, [notificationSettings]);

  const checkNewOrders = async () => {
    try {
      const res = await apiRequest(`${config.apiUrl}/catalog-orders/orders/check-new-orders/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.pending_count);
        
        if (data.has_new && data.order) {
          // Reproducir sonido de notificación
          playNotificationSound();
          
          // Mostrar notificación si está habilitado
          if (notificationSettings.popup) {
            Swal.fire({
              icon: 'success',
              title: '🔔 ¡Nuevo Pedido del Catálogo!',
              html: `
                <div class="text-left">
                  <p class="text-lg font-bold mb-2">Pedido #${data.order.order_number}</p>
                  <p class="text-sm text-gray-600 mb-1">👤 ${data.order.customer_name}</p>
                  <p class="text-sm text-gray-600 mb-1">📱 ${data.order.customer_phone || 'Sin teléfono'}</p>
                  ${data.order.table_name ? `<p class="text-sm text-gray-600 mb-1">🍽️ Mesa: ${data.order.table_name}</p>` : ''}
                  <p class="text-lg font-bold text-indigo-600 mt-2">${formatCurrency(data.order.total)}</p>
                </div>
              `,
              timer: 8000,
              showConfirmButton: true,
              confirmButtonText: 'Ver Pedido',
              confirmButtonColor: '#4f46e5',
              backdrop: `
                rgba(0,0,123,0.4)
                url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20zM20 0h20v20H20V0zM0 0h20v20H0V0z'/%3E%3C/g%3E%3C/svg%3E")
              `
            }).then((result) => {
              if (result.isConfirmed) {
                setSelectedOrder(data.order);
                setShowDetailModal(true);
              }
            });
          }
          
          // Actualizar lista de pedidos
          fetchOrders();
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
      const res = await apiRequest(`${config.apiUrl}/catalog-orders/orders/active/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : data.results || []);
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
      Swal.fire('Error', 'No se pudieron cargar los pedidos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    const result = await Swal.fire({
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
        `${config.apiUrl}/catalog-orders/orders/${order.id}/update-status/`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        },
        token
      );

      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Estado actualizado', timer: 1500, showConfirmButton: false });
        fetchOrders();
      } else {
        const error = await res.json();
        Swal.fire('Error', error.error || 'Error al actualizar estado', 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'Error de conexión', 'error');
    }
  };

  const handleConvertToSale = async (order) => {
    const result = await Swal.fire({
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
        `${config.apiUrl}/catalog-orders/orders/${order.id}/convert-to-sale/`,
        { method: 'POST' },
        token
      );

      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'Pedido convertido a venta', timer: 1500, showConfirmButton: false });
        fetchOrders();
      } else {
        const error = await res.json();
        Swal.fire('Error', error.error || 'Error al convertir', 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'Error de conexión', 'error');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Pedidos del Catálogo</h2>
          <p className="text-slate-500">Gestiona pedidos web en tiempo real</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg animate-pulse">
              <Bell size={16} />
              {pendingCount} pendientes
            </div>
          )}
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}
            title={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors"
            title="Configuración de notificaciones"
          >
            <Settings size={20} className="text-slate-600" />
          </button>
          <button 
            onClick={fetchOrders}
            className="bg-slate-100 hover:bg-slate-200 p-2 rounded-lg transition-colors"
            title="Actualizar pedidos"
          >
            <RefreshCw size={20} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-slate-500" />
          {['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                statusFilter === status 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'Todos' : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <div className="text-slate-500 mt-2">Cargando pedidos...</div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
          <ShoppingBag size={64} className="text-slate-300 mx-auto mb-4" />
          <div className="text-lg font-semibold text-slate-600 mb-2">No hay pedidos para mostrar</div>
          <div className="text-sm text-slate-500">Los nuevos pedidos aparecerán aquí automáticamente</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map(order => {
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG['PENDING'];
            const StatusIcon = statusConfig.icon;
            const orderTypeConfig = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG['DINE_IN'];
            const isUrgent = order.status === 'PENDING' && 
              (new Date() - new Date(order.created_at)) > 15 * 60 * 1000; // 15 minutos

            return (
              <div
                key={order.id}
                onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}
                className={`bg-white rounded-xl border-2 p-4 cursor-pointer hover:shadow-lg transition-all ${
                  isUrgent ? 'border-orange-400 bg-orange-50' : 'border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-slate-800">
                        #{order.order_number}
                      </span>
                      <span className="text-xs text-slate-500">
                        {orderTypeConfig.label}
                      </span>
                      {isUrgent && (
                        <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full font-bold">
                          ⚡ Urgente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User size={14} />
                      <span className="font-medium">{order.customer_name}</span>
                    </div>
                    {order.table_name && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <MapPin size={14} />
                        <span>{order.table_name}</span>
                      </div>
                    )}
                    {order.customer_phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Phone size={14} />
                        <span>{order.customer_phone}</span>
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                    isUrgent ? 'bg-orange-100' : 'bg-slate-100'
                  }`}>
                    <StatusIcon size={14} style={{ color: statusConfig.color }} />
                    <span className="text-xs font-bold" style={{ color: statusConfig.color }}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    {formatDateTime(order.created_at)} • {order.items?.length || 0} items
                  </div>
                  <div className="text-lg font-bold text-indigo-600">
                    {formatCurrency(order.total)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  Pedido #{selectedOrder.order_number}
                </h3>
                <p className="text-sm text-slate-500">
                  {formatDateTime(selectedOrder.created_at)}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Customer Info */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Información del Cliente</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User size={16} className="text-slate-400" />
                    <span className="text-slate-700">{selectedOrder.customer_name}</span>
                  </div>
                  {selectedOrder.customer_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={16} className="text-slate-400" />
                      <span className="text-slate-700">{selectedOrder.customer_phone}</span>
                    </div>
                  )}
                  {selectedOrder.customer_address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={16} className="text-slate-400" />
                      <span className="text-slate-700">{selectedOrder.customer_address}</span>
                    </div>
                  )}
                  {selectedOrder.table_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={16} className="text-slate-400" />
                      <span className="text-slate-700">Mesa: {selectedOrder.table_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Items del Pedido</h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, index) => (
                    <div
                      key={index}
                      className="bg-slate-50 rounded-lg p-3 flex justify-between items-center"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-700">
                          {item.product_name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Cantidad: {item.quantity} × {formatCurrency(item.unit_price)}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-indigo-600">
                        {formatCurrency(item.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-slate-800 mb-2">Notas</h4>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}

              {/* Totals */}
              <div className="mb-6 bg-slate-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Subtotal</span>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-slate-600">Impuestos</span>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(selectedOrder.tax)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-base font-bold text-slate-800">Total</span>
                  <span className="text-xl font-bold text-indigo-600">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {getStatusActions(selectedOrder).map(action => (
                    <button
                      key={action.status}
                      onClick={() => handleStatusChange(selectedOrder, action.status)}
                      className="flex-1 min-w-[120px] px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors"
                      style={{ backgroundColor: action.color }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                {!selectedOrder.related_sale && selectedOrder.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleConvertToSale(selectedOrder)}
                    className="w-full px-4 py-3 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 transition-colors flex items-center justify-center gap-2"
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

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Configuración de Notificaciones</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Sonido de notificación</div>
                  <div className="text-sm text-slate-500">Reproducir sonido cuando lleguen nuevos pedidos</div>
                </div>
                <button
                  onClick={() => saveNotificationSettings({ ...notificationSettings, sound: !notificationSettings.sound })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    notificationSettings.sound ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    notificationSettings.sound ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Alertas emergentes</div>
                  <div className="text-sm text-slate-500">Mostrar popup cuando lleguen nuevos pedidos</div>
                </div>
                <button
                  onClick={() => saveNotificationSettings({ ...notificationSettings, popup: !notificationSettings.popup })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    notificationSettings.popup ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    notificationSettings.popup ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Auto-actualización</div>
                  <div className="text-sm text-slate-500">Actualizar pedidos automáticamente</div>
                </div>
                <button
                  onClick={() => saveNotificationSettings({ ...notificationSettings, autoRefresh: !notificationSettings.autoRefresh })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    notificationSettings.autoRefresh ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    notificationSettings.autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div>
                <div className="font-semibold text-slate-800 mb-2">Intervalo de actualización</div>
                <div className="text-sm text-slate-500 mb-3">Frecuencia de verificación de nuevos pedidos</div>
                <select
                  value={notificationSettings.refreshInterval}
                  onChange={(e) => saveNotificationSettings({ ...notificationSettings, refreshInterval: parseInt(e.target.value) })}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="15">15 segundos</option>
                  <option value="30">30 segundos</option>
                  <option value="60">1 minuto</option>
                  <option value="120">2 minutos</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    playNotificationSound();
                    Swal.fire({
                      icon: 'success',
                      title: '¡Sonido de prueba!',
                      text: 'Este es el sonido que escucharás cuando lleguen nuevos pedidos',
                      timer: 2000,
                      showConfirmButton: false
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Play size={16} />
                  Probar sonido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
