import { useState, useEffect } from 'react';
import { 
  ShoppingBag, Clock, CheckCircle, XCircle, AlertCircle, User, MapPin, Phone, 
  CreditCard, RefreshCw, Filter, Bell, ArrowRight, DollarSign, PackageCheck, 
  Zap, Truck, FileText, Check, ExternalLink, Calendar, MessageSquare, Search,
  Navigation
} from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { apiRequest } from '../../lib/api';
import { printTicket } from '../../lib/print';
// import { ipcRenderer } from 'electron'; // Removed to avoid context isolation issues
import { playOrderDineIn, playOrderTakeout, playOrderDelivery, playUrgentAlert } from '../../lib/sound';

const STATUS_CONFIG = {
  'PENDING': { 
    color: '#f59e0b', 
    bgColor: 'bg-amber-50 text-amber-700 border-amber-200', 
    badgeColor: 'bg-amber-500',
    label: 'Pendiente', 
    icon: Clock 
  },
  'CONFIRMED': { 
    color: '#3b82f6', 
    bgColor: 'bg-blue-50 text-blue-700 border-blue-200', 
    badgeColor: 'bg-blue-500',
    label: 'Confirmado', 
    icon: CheckCircle 
  },
  'PREPARING': { 
    color: '#8b5cf6', 
    bgColor: 'bg-purple-50 text-purple-700 border-purple-200', 
    badgeColor: 'bg-purple-500',
    label: 'Procesando', 
    icon: Zap 
  },
  'READY': { 
    color: '#10b981', 
    bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', 
    badgeColor: 'bg-emerald-500',
    label: 'Listo para Entrega', 
    icon: PackageCheck 
  },
  'DELIVERED': { 
    color: '#64748b', 
    bgColor: 'bg-slate-100 text-slate-700 border-slate-200', 
    badgeColor: 'bg-slate-500',
    label: 'Entregado', 
    icon: Truck 
  },
  'CANCELLED': { 
    color: '#ef4444', 
    bgColor: 'bg-rose-50 text-rose-700 border-rose-200', 
    badgeColor: 'bg-rose-500',
    label: 'Cancelado', 
    icon: XCircle 
  },
};

const ORDER_TYPE_CONFIG = {
  'DINE_IN': { label: 'Mesa', icon: '🍽️', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  'TAKEOUT': { label: 'Para Llevar', icon: '🥡', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'DELIVERY': { label: 'Domicilio', icon: '🚗', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'PICKUP': { label: 'Recoger', icon: '🛍️', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function CatalogOrdersModule({ config, token, systemSettings }) {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [availableDrivers, setAvailableDrivers] = useState([]);

  const symbol = systemSettings?.currency_symbol || '$';
  const decimals = parseInt(systemSettings?.currency_decimals ?? '2', 10);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount || 0).replace('COP', symbol);
  };

    useEffect(() => {
    // Request notification permission on first load
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    fetchOrders();
    const interval = setInterval(() => {
      checkNewOrders();
      fetchOrders(true);
    }, 2000); // Polling silent every 2s
    return () => clearInterval(interval);
  }, []);

  // Check for urgent pending orders every minute and play alert
  useEffect(() => {
    const urgencyInterval = setInterval(() => {
      if (orders.length > 0) {
        const now = new Date();
        const hasUrgent = orders.some(o => {
          if (o.status !== 'PENDING') return false;
          const createdTime = new Date(o.created_at);
          const diffMins = Math.floor((now - createdTime) / 60000);
          return diffMins >= 5;
        });

        if (hasUrgent) {
          playUrgentAlert();
          
          // Optional visual toast for urgency
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'warning',
            title: '¡PEDIDOS URGENTES!',
            text: 'Hay pedidos sin atender desde hace más de 5 minutos.',
            showConfirmButton: false,
            timer: 5000,
            customClass: {
              popup: 'border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)] bg-red-50 text-red-700',
              title: 'text-red-700 font-black',
            }
          });
        }
      }
    }, 60000); // 1 minute

    return () => clearInterval(urgencyInterval);
  }, [orders]);

  const checkNewOrders = async () => {
    try {
      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
      const res = await apiRequest(`${cleanBaseUrl}catalog-orders/orders/check-new-orders/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.pending_count || 0);
        
        if (data.has_new && data.order) {
          // Play differentiated sound based on order type
          if (data.order.order_type === 'DELIVERY') {
            playOrderDelivery();
          } else if (data.order.order_type === 'TAKEOUT' || data.order.order_type === 'PICKUP') {
            playOrderTakeout();
          } else {
            playOrderDineIn();
          }

            // Try Web Notification first
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('🔔 Nuevo Pedido del Catálogo', {
                body: `Pedido #${data.order.order_number} - ${data.order.customer_name} - Total ${formatCurrency(data.order.total)}`,
              });
            } else {
              // Fallback to native Electron dialog via ipcRenderer if available
              const ipc = window.require ? window.require('electron').ipcRenderer : null;
              if (ipc) {
                ipc.invoke('show-alert', {
                  type: 'info',
                  title: 'Nuevo Pedido del Catálogo',
                  message: `Pedido #${data.order.order_number}\nCliente: ${data.order.customer_name}\nTotal: ${formatCurrency(data.order.total)}`,
                });
              }
            }

          // Show native desktop notification if permitted
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('🔔 Nuevo Pedido del Catálogo', {
              body: `Pedido #${data.order.order_number} - ${data.order.customer_name} - Total ${formatCurrency(data.order.total)}`,
            });
          }
          
          const formattedTotal = formatCurrency(data.order.total);
          
          // Toast Notification (Floating, Non-intrusive)
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: `🔔 NUEVO PEDIDO: #${data.order.order_number}`,
            text: `${data.order.customer_name} - ${formattedTotal}`,
            showConfirmButton: false,
            timer: 8000,
            timerProgressBar: true,
            customClass: {
              popup: 'premium-swal border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]',
              title: 'text-amber-600 font-black text-2xl',
            }
          });
          
          fetchOrders(true);
        }
      }
    } catch (e) {
      console.error('Error checking new orders:', e);
    }
  };

  useEffect(() => {
    let filtered = orders;
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        (order.order_number && String(order.order_number).toLowerCase().includes(term)) ||
        (order.customer_name && order.customer_name.toLowerCase().includes(term)) ||
        (order.customer_phone && order.customer_phone.toLowerCase().includes(term))
      );
    }
    setFilteredOrders(filtered);
  }, [statusFilter, orders, searchTerm]);

  const fetchOrders = async (isBackground = false) => {
    if (!isBackground) {
      setIsRefreshing(true);
      setLoading(true);
    }
    try {
      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
      const res = await apiRequest(`${cleanBaseUrl}catalog-orders/orders/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        const ordersList = Array.isArray(data) ? data : data.results || [];
        setOrders(ordersList);
        
        const pending = ordersList.filter(o => o.status === 'PENDING').length;
        setPendingCount(pending);
        setLastSyncTime(new Date());
      }
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      if (!isBackground) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  const fetchAvailableDrivers = async () => {
    try {
      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
      const res = await apiRequest(`${cleanBaseUrl}catalog-orders/orders/available-drivers/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        const drivers = Array.isArray(data) ? data : [];
        setAvailableDrivers(drivers);
        
        if (drivers.length === 0) {
          Swal.fire({
            icon: 'warning',
            title: 'No hay domiciliarios disponibles',
            text: 'No hay usuarios con rol DELIVERY activos. Por favor crea domiciliarios en la sección de usuarios.',
            confirmButtonText: 'Entendido'
          });
        }
      } else {
        throw new Error('Error al obtener domiciliarios');
      }
    } catch (e) {
      console.error('Error fetching drivers:', e);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la lista de domiciliarios',
        confirmButtonText: 'OK'
      });
    }
  };

  const assignDriver = async (orderId, driverId) => {
    try {
      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
      const res = await apiRequest(`${cleanBaseUrl}catalog-orders/orders/${orderId}/assign-driver/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId })
      }, token);
      
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Domiciliario Asignado',
          text: 'El domiciliario ha sido asignado correctamente',
          timer: 2000,
          showConfirmButton: false
        });
        fetchOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, assigned_driver: availableDrivers.find(d => d.id === driverId) });
        }
      } else {
        throw new Error('Error al asignar domiciliario');
      }
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo asignar el domiciliario'
      });
    }
  };

  const handleStatusChange = async (order, action) => {
    // Manejar asignación de domiciliario
    if (action.type === 'assign_driver') {
      await fetchAvailableDrivers();
      
      if (availableDrivers.length === 0) {
        return;
      }
      
      const { value: driverId } = await Swal.fire({
        title: 'Asignar Domiciliario',
        input: 'select',
        inputOptions: availableDrivers.reduce((acc, driver) => {
          const displayName = (driver.first_name || driver.last_name) 
            ? `${driver.first_name} ${driver.last_name} (${driver.username})`
            : driver.username;
          acc[driver.id] = displayName;
          return acc;
        }, {}),
        inputPlaceholder: 'Selecciona un domiciliario',
        showCancelButton: true,
        confirmButtonText: 'Asignar',
        cancelButtonText: 'Cancelar'
      });
      if (driverId) {
        await assignDriver(order.id, parseInt(driverId));
      }
      return;
    }

    // Manejar cambio de estado normal
    const newStatus = action.status;
    const targetStatus = STATUS_CONFIG[newStatus];
    
    let cancelReason = '';
    
    if (newStatus === 'CANCELLED') {
      const { value: text } = await Swal.fire({
        title: 'Cancelar Pedido',
        input: 'textarea',
        inputLabel: 'Motivo de la cancelación (Obligatorio para auditoría)',
        inputPlaceholder: 'Ej: Cliente no responde, falta de inventario, duplicado...',
        showCancelButton: true,
        confirmButtonText: 'Confirmar Cancelación',
        cancelButtonText: 'Volver',
        icon: 'warning',
        inputValidator: (value) => {
          if (!value || value.trim().length === 0) {
            return '¡Necesitas escribir un motivo justificado para cancelar!';
          }
        },
        customClass: {
          popup: 'premium-swal',
          title: 'premium-swal-title text-rose-600',
          confirmButton: 'premium-swal-confirm bg-rose-600 hover:bg-rose-700',
          cancelButton: 'premium-swal-cancel',
          input: 'w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800'
        }
      });
      if (!text) return;
      cancelReason = text;
    }

    try {
      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
      const res = await apiRequest(
        `${cleanBaseUrl}catalog-orders/orders/${order.id}/update-status/`,
        {
          method: 'PATCH',
          body: JSON.stringify({ 
            status: newStatus,
            cancel_reason: cancelReason 
          }),
        },
        token
      );

      if (res.ok) {
        const updatedOrder = await res.json();

        // Auto-print ticket when order is confirmed (sale is created)
        if (newStatus === 'CONFIRMED' && updatedOrder.related_sale) {
          try {
            const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
            const saleRes = await apiRequest(`${cleanBaseUrl}sales/sales/${updatedOrder.related_sale}/`, {}, token);
            if (saleRes.ok) {
              const saleData = await saleRes.json();
              printTicket(saleData, systemSettings, systemSettings?.ticket_logo, { silent: true, printerName: config?.default_printer, apiUrl: config?.apiUrl });
            }
          } catch (printErr) {
            console.error('Error al imprimir ticket del pedido:', printErr);
          }
        }

        Swal.fire({
          icon: 'success',
          title: 'Estado Actualizado',
          text: `El pedido #${order.order_number} ahora está en ${targetStatus.label}`,
          timer: 1800,
          showConfirmButton: false,
          customClass: { popup: 'premium-swal' }
        });
        fetchOrders();
        if (selectedOrder && selectedOrder.id === order.id) {
          setSelectedOrder({ ...selectedOrder, status: newStatus });
        }
      } else {
        let errorMsg = 'No se pudo cambiar el estado';
        try {
          const error = await res.json();
          errorMsg = error.error || error.detail || JSON.stringify(error);
        } catch(e) {
          errorMsg = `HTTP Error ${res.status}`;
        }
        Swal.fire('Error', errorMsg, 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'Error de conexión con el servidor', 'error');
    }
  };



  const getStatusActions = (order) => {
    const actions = [];
    const currentStatus = order.status;

    if (currentStatus === 'PENDING') {
      actions.push({ status: 'CONFIRMED', label: 'Aceptar Pedido', color: 'bg-blue-600 hover:bg-blue-700' });
      actions.push({ status: 'CANCELLED', label: 'Cancelar', color: 'bg-rose-600 hover:bg-rose-700' });
    } else if (currentStatus === 'CONFIRMED') {
      actions.push({ status: 'PREPARING', label: 'Iniciar Procesamiento ⚡', color: 'bg-purple-600 hover:bg-purple-700' });
      actions.push({ status: 'CANCELLED', label: 'Cancelar', color: 'bg-rose-600 hover:bg-rose-700' });
    } else if (currentStatus === 'PREPARING') {
      actions.push({ status: 'READY', label: 'Marcar Listo ✨', color: 'bg-emerald-600 hover:bg-emerald-700' });
    } else if (currentStatus === 'READY') {
      actions.push({ status: 'DELIVERED', label: order.order_type === 'PICKUP' ? 'Marcar Recogido 🛍️' : 'Entregar / Finalizar 🚀', color: 'bg-slate-700 hover:bg-slate-800' });
      
      // Agregar botón de asignar domiciliario para pedidos DELIVERY
      if (order.order_type === 'DELIVERY' && !order.assigned_driver) {
        actions.push({ 
          type: 'assign_driver', 
          label: 'Asignar Domiciliario 🛵', 
          color: 'bg-purple-600 hover:bg-purple-700' 
        });
      }
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
      month: 'short',
      year: 'numeric'
    });
  };

  // KPIs Calculations
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;
  const preparingOrdersCount = orders.filter(o => o.status === 'PREPARING').length;
  const totalSalesAmount = orders.filter(o => o.status !== 'CANCELLED').reduce((acc, o) => acc + Number(o.total || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
      
      {/* HEADER & TOP CONTROL CENTER */}
      <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-100 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl sm:rounded-2xl text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <ShoppingBag size={20} sm:size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-800 tracking-tight truncate">Centro de Pedidos Web</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="truncate">En vivo • {lastSyncTime.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* SEARCH BAR IN HEADER */}
          <div className="glass-panel p-2 sm:p-2.5 rounded-xl sm:rounded-xl border border-slate-150 flex items-center gap-2 shrink-0">
            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-indigo-600 shrink-0">
              <Search size={14} sm:size={16} />
            </div>
            <input 
              type="text" 
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-32 sm:w-48 bg-transparent border-none outline-none text-xs sm:text-sm font-semibold text-slate-700 placeholder-slate-400 min-w-0"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-500 transition-colors bg-slate-100 rounded-lg hover:bg-rose-100 shrink-0">
                <XCircle size={12} sm:size={14} />
              </button>
            )}
          </div>

          <button 
            onClick={fetchOrders}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl sm:rounded-2xl transition-all shadow-sm active:scale-95 text-xs sm:text-sm"
          >
            <RefreshCw size={14} sm:size={16} className={`${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Actualizando...' : 'Sincronizar'}</span>
            <span className="sm:hidden">{isRefreshing ? '...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 shrink-0">
        
        {/* KPI 1: TOTAL */}
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-150 flex items-center justify-between shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer group">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total</p>
            <h3 className="text-xl sm:text-3xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{totalOrdersCount}</h3>
          </div>
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all shrink-0">
            <ShoppingBag size={16} sm:size={24} />
          </div>
        </div>

        {/* KPI 2: PENDIENTES */}
        <div className={`glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-between shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer group ${pendingOrdersCount > 0 ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50' : 'border-slate-150'}`}>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pendientes</p>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h3 className="text-xl sm:text-3xl font-black text-amber-600 group-hover:text-amber-500 transition-colors">{pendingOrdersCount}</h3>
            </div>
          </div>
          <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold shadow-lg transition-all shrink-0 ${pendingOrdersCount > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-500/30 animate-pulse' : 'bg-amber-100 text-amber-600'}`}>
            <Bell size={16} sm:size={24} />
          </div>
        </div>

        {/* KPI 3: PROCESANDO */}
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-150 flex items-center justify-between shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer group">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Procesando</p>
            <h3 className="text-xl sm:text-3xl font-black text-purple-600 group-hover:text-purple-500 transition-colors">{preparingOrdersCount}</h3>
          </div>
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center font-bold shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-all shrink-0">
            <Zap size={16} sm:size={24} />
          </div>
        </div>

        {/* KPI 4: MONTO TOTAL */}
        <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-150 flex items-center justify-between shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer group">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Ventas</p>
            <h3 className="text-lg sm:text-2xl font-black text-emerald-600 group-hover:text-emerald-500 transition-colors truncate">{formatCurrency(totalSalesAmount)}</h3>
          </div>
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-all shrink-0">
            <DollarSign size={16} sm:size={24} />
          </div>
        </div>

      </div>

      {/* FILTER TABS SLIDER */}
      <div className="glass-panel p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-150 shadow-lg shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'ALL', label: 'Todos', count: orders.length },
            { id: 'PENDING', label: '⏳ Pendientes', count: orders.filter(o => o.status === 'PENDING').length },
            { id: 'CONFIRMED', label: '✅ Confirmados', count: orders.filter(o => o.status === 'CONFIRMED').length },
            { id: 'PREPARING', label: '⚡ Procesando', count: orders.filter(o => o.status === 'PREPARING').length },
            { id: 'READY', label: '✨ Listos', count: orders.filter(o => o.status === 'READY').length },
            { id: 'DELIVERED', label: '🚀 Entregados', count: orders.filter(o => o.status === 'DELIVERED').length },
            { id: 'CANCELLED', label: '❌ Cancelados', count: orders.filter(o => o.status === 'CANCELLED').length },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all shrink-0 ${
                statusFilter === filter.id 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 scale-105' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:scale-102'
              }`}
            >
              <span>{filter.label}</span>
              <span className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black ${statusFilter === filter.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ORDERS GRID LIST */}
      {loading ? (
        <div className="glass-panel p-8 sm:p-16 rounded-2xl sm:rounded-3xl text-center border border-slate-150 flex-1 flex items-center justify-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-slate-600 font-bold">Cargando pedidos...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-panel p-8 sm:p-16 rounded-2xl sm:rounded-3xl text-center border border-slate-150 flex-1 flex items-center justify-center">
          <ShoppingBag size={40} sm:size={56} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-bold text-slate-700 mb-1">No hay pedidos</h3>
          <p className="text-xs sm:text-sm text-slate-400">Los pedidos aparecerán aquí</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
            {filteredOrders.map(order => {
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG['PENDING'];
              const StatusIcon = statusConfig.icon;
              const orderTypeConfig = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG['DINE_IN'];
              const actions = getStatusActions(order);
              
              // Calculate urgency (Pending > 5 mins)
              const createdTime = new Date(order.created_at);
              const diffMins = Math.floor((new Date() - createdTime) / 60000);
              const isUrgent = order.status === 'PENDING' && diffMins >= 5;

              return (
                <div
                  key={order.id}
                  className={`relative overflow-hidden rounded-xl border bg-white flex flex-col transition-all duration-200 group hover:-translate-y-0.5 hover:shadow-lg ${
                    isUrgent
                      ? 'border-red-400 shadow-[0_0_0_2px_rgba(239,68,68,0.15)] animate-pulse'
                      : 'border-slate-200 shadow-sm'
                  }`}
                >
                  {/* Status accent bar */}
                  <div className={`h-1 w-full ${statusConfig.badgeColor}`} />

                  <div className="p-3 flex flex-col gap-2.5 flex-1">
                    {/* HEADER ROW */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-slate-800 tracking-tight">
                            #{order.order_number}
                          </span>
                          {isUrgent ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase tracking-wide border border-red-200">
                              <AlertCircle size={8} /> {diffMins}m
                            </span>
                          ) : (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${orderTypeConfig.color}`}>
                              {orderTypeConfig.icon} {orderTypeConfig.label}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(order.created_at)}</p>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold shrink-0 ${isUrgent ? 'bg-red-50 text-red-600 border-red-200' : statusConfig.bgColor}`}>
                        <StatusIcon size={10} />
                        <span>{statusConfig.label}</span>
                      </div>
                    </div>

                    {/* DIVIDER */}
                    <div className="border-t border-slate-100" />

                    {/* CUSTOMER INFO */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-indigo-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-700 truncate">{order.customer_name}</span>
                      </div>

                      {order.customer_phone && (
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-500 truncate">{order.customer_phone}</span>
                          </div>
                          <a
                            href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors shrink-0"
                          >
                            <MessageSquare size={9} /> WA
                          </a>
                        </div>
                      )}

                      {order.table_name && (
                        <div className="flex items-center gap-2">
                          <MapPin size={12} className="text-sky-400 shrink-0" />
                          <span className="text-xs text-sky-600 font-medium truncate">Mesa: {order.table_name}</span>
                        </div>
                      )}

                      {order.customer_address && (
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin size={12} className="text-rose-400 shrink-0" />
                            <span className="text-[11px] text-slate-500 truncate">{order.customer_address}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`, '_blank');
                            }}
                            className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md text-[10px] font-bold border border-rose-200 shrink-0 transition-colors"
                          >
                            <Navigation size={9} /> GPS
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ITEMS */}
                    <div className="bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100 space-y-1">
                      <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-1">
                        <span>{order.items?.length || 0} ítems</span>
                        <span>Cant × Precio</span>
                      </div>
                      {order.items?.slice(0, 3).map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[55%]">{it.product_name}</span>
                          <span className="text-[11px] font-bold text-slate-800">{it.quantity}× {formatCurrency(it.unit_price)}</span>
                        </div>
                      ))}
                      {(order.items?.length || 0) > 3 && (
                        <p className="text-[10px] text-indigo-500 font-bold pt-0.5">+{(order.items?.length || 0) - 3} más...</p>
                      )}
                    </div>

                    {/* FOOTER */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-auto">
                      <span className="text-base font-black text-emerald-600">{formatCurrency(order.total)}</span>
                      <button
                        onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                      >
                        <FileText size={11} /> Detalle
                      </button>
                    </div>

                    {/* ACTIONS */}
                    {actions.length > 0 && (
                      <div className="flex gap-1.5">
                        {actions.map((act, idx) => (
                          <button
                            key={act.status || `assign-${idx}`}
                            onClick={() => handleStatusChange(order, act)}
                            className={`flex-1 py-1.5 px-2 text-white font-bold text-[11px] rounded-lg transition-all ${act.color} flex items-center justify-center shadow-sm hover:shadow active:scale-95`}
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RICH ORDER DETAIL MODAL */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-200">
            
            {/* MODAL HEADER */}
            <div className="px-6 py-5 bg-white border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ShoppingBag size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Pedido #{selectedOrder.order_number}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${STATUS_CONFIG[selectedOrder.status]?.badgeColor} text-white`}>
                      {STATUS_CONFIG[selectedOrder.status]?.label}
                    </span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${ORDER_TYPE_CONFIG[selectedOrder.order_type]?.color}`}>
                      {ORDER_TYPE_CONFIG[selectedOrder.order_type]?.icon} {ORDER_TYPE_CONFIG[selectedOrder.order_type]?.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{formatDateTime(selectedOrder.created_at)}</span>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle size={22} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LEFT COLUMN - CUSTOMER INFO */}
                <div className="lg:col-span-2 space-y-6">
                  {/* CUSTOMER DETAILS CARD */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <User size={18} className="text-blue-600" />
                      Cliente
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-20">Nombre</span>
                        <span className="text-sm font-medium text-gray-900">{selectedOrder.customer_name}</span>
                      </div>

                      {selectedOrder.customer_phone && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-20">Teléfono</span>
                          <span className="text-sm font-medium text-gray-900">{selectedOrder.customer_phone}</span>
                        </div>
                      )}

                      {selectedOrder.customer_address && (
                        <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3 flex-1">
                            <MapPin size={16} className="text-red-500" />
                            <span className="text-sm font-medium text-gray-900">{selectedOrder.customer_address}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrder.customer_address)}`, '_blank');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <Navigation size={14} />
                            Maps
                          </button>
                        </div>
                      )}

                      {selectedOrder.table_name && (
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <MapPin size={16} className="text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Mesa: {selectedOrder.table_name}</span>
                        </div>
                      )}
                    </div>

                    {/* DRIVER ASSIGNMENT (Solo para DELIVERY) */}
                    {selectedOrder && selectedOrder.order_type === 'DELIVERY' && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Truck size={18} className="text-purple-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {selectedOrder.assigned_driver_info 
                                ? selectedOrder.assigned_driver_info.full_name || selectedOrder.assigned_driver_info.username
                                : 'Sin asignar'
                              }
                            </span>
                          </div>
                          {!selectedOrder.assigned_driver && (
                            <button
                              onClick={async () => {
                                await fetchAvailableDrivers();
                                const { value: driverId } = await Swal.fire({
                                  title: 'Asignar Domiciliario',
                                  input: 'select',
                                  inputOptions: availableDrivers.reduce((acc, driver) => {
                                    acc[driver.id] = `${driver.first_name} ${driver.last_name} (${driver.username})`;
                                    return acc;
                                  }, {}),
                                  inputPlaceholder: 'Selecciona un domiciliario',
                                  showCancelButton: true
                                });
                                if (driverId) {
                                  await assignDriver(selectedOrder.id, parseInt(driverId));
                                }
                              }}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              Asignar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ITEMS TABLE */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <PackageCheck size={18} className="text-green-600" />
                        Productos ({selectedOrder.items?.length || 0})
                      </h4>
                    </div>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Producto</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Cantidad</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Precio</th>
                          <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedOrder.items?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-5 py-3 text-sm font-medium text-gray-900">{item.product_name}</td>
                            <td className="px-5 py-3 text-sm text-gray-600 text-right">{item.quantity}</td>
                            <td className="px-5 py-3 text-sm text-gray-600 text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* NOTES */}
                  {selectedOrder.notes && (
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                      <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                        <MessageSquare size={16} className="text-amber-600" />
                        Notas
                      </h4>
                      <p className="text-sm text-amber-900">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>

                  {/* DELIVERY PHOTO */}
                  {selectedOrder.delivery_photo && (
                    <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                      <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-600" />
                        Evidencia de Entrega
                      </h4>
                      <img 
                        src={selectedOrder.delivery_photo} 
                        alt="Evidencia de entrega" 
                        className="w-full rounded-lg border border-green-300 object-contain bg-white"
                      />
                    </div>
                  )}

                {/* RIGHT COLUMN - SUMMARY & ACTIONS */}
                <div className="space-y-6">
                  {/* FINANCIAL SUMMARY */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <DollarSign size={18} className="text-green-600" />
                      Resumen
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium text-gray-900">{formatCurrency(selectedOrder.subtotal)}</span>
                      </div>
                      {selectedOrder.order_type === 'DELIVERY' && (
                        <div className="flex justify-between text-sm items-center">
                          <span className="text-gray-600">Valor Domicilio</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{formatCurrency(selectedOrder.delivery_fee || 0)}</span>
                            <button
                              onClick={async () => {
                                const { value: fee } = await Swal.fire({
                                  title: 'Valor del Domicilio',
                                  input: 'text',
                                  inputLabel: 'Ingresa el valor del domicilio (ej: 5000)',
                                  inputValue: selectedOrder.delivery_fee ? parseFloat(selectedOrder.delivery_fee) : '',
                                  inputAttributes: { min: 0, step: 'any' },
                                  showCancelButton: true,
                                  confirmButtonText: 'Guardar',
                                  cancelButtonText: 'Cancelar',
                                });
                                
                                if (fee !== undefined && fee !== '') {
                                  // Limpiar comas o puntos si el usuario los escribió por error
                                  const cleanFee = fee.replace(/[^\d.]/g, '');
                                  const parsedFee = parseFloat(cleanFee);
                                  
                                  if (!isNaN(parsedFee)) {
                                    try {
                                      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
                                      const res = await apiRequest(
                                        `${cleanBaseUrl}catalog-orders/orders/${selectedOrder.id}/update-delivery-fee/`,
                                        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delivery_fee: parsedFee }) },
                                        token
                                      );
                                      if (res.ok) {
                                        fetchOrders();
                                        setShowDetailModal(false);
                                      } else {
                                        const err = await res.json();
                                        Swal.fire('Error', err.error || 'No se pudo actualizar', 'error');
                                      }
                                    } catch (e) {
                                      Swal.fire('Error', 'Error de conexión', 'error');
                                    }
                                  } else {
                                    Swal.fire('Error', 'Por favor ingresa solo números', 'error');
                                  }
                                }
                              }}
                              className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg px-2 py-1 transition-colors"
                            >
                              ✏️ Editar
                            </button>
                          </div>
                        </div>
                      )}

                      {Number(selectedOrder.tax || 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Impuestos</span>
                          <span className="font-medium text-gray-900">{formatCurrency(selectedOrder.tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold pt-3 border-t border-gray-200">
                        <span className="text-gray-900">Total</span>
                        <span className="text-green-600">{formatCurrency(selectedOrder.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* STATUS ACTIONS */}
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <RefreshCw size={18} className="text-blue-600" />
                      Cambiar Estado
                    </h4>
                    <div className="space-y-2">
                      {getStatusActions(selectedOrder).map((act, idx) => (
                        <button
                          key={act.status || `assign-modal-${idx}`}
                          onClick={() => handleStatusChange(selectedOrder, act)}
                          className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors ${act.color}`}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
