import { useState, useEffect } from 'react';
import { 
  ShoppingBag, Clock, CheckCircle, XCircle, AlertCircle, User, MapPin, Phone, 
  CreditCard, RefreshCw, Filter, Bell, ArrowRight, DollarSign, PackageCheck, 
  ChefHat, Truck, FileText, Check, ExternalLink, Calendar, MessageSquare, Search
} from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { apiRequest } from '../../lib/api';
// import { ipcRenderer } from 'electron'; // Removed to avoid context isolation issues
import { playNewOrderSound } from '../../lib/sound';

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
    label: 'En Preparación', 
    icon: ChefHat 
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
    const interval = setInterval(checkNewOrders, 3000); // Polling every 3s
    return () => clearInterval(interval);
  }, []);

  const checkNewOrders = async () => {
    try {
      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
      const res = await apiRequest(`${cleanBaseUrl}catalog-orders/orders/check-new-orders/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setPendingCount(data.pending_count || 0);
        
        if (data.has_new && data.order) {
          // Play sound
            playNewOrderSound();

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
              popup: 'premium-swal',
              title: 'text-amber-600 font-bold',
            }
          });
          
          fetchOrders();
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

  const fetchOrders = async () => {
    setIsRefreshing(true);
    setLoading(true);
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
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    const targetStatus = STATUS_CONFIG[newStatus];
    const result = await Swal.fire({
      title: 'Cambiar Estado',
      html: `¿Deseas cambiar el pedido <b>#${order.order_number}</b> a estado <b style="color:${targetStatus.color}">${targetStatus.label}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'premium-swal',
        title: 'premium-swal-title',
        confirmButton: 'premium-swal-confirm bg-indigo-600 hover:bg-indigo-700',
        cancelButton: 'premium-swal-cancel'
      }
    });

    if (!result.isConfirmed) return;

    try {
      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
      const res = await apiRequest(
        `${cleanBaseUrl}catalog-orders/orders/${order.id}/update-status/`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        },
        token
      );

      if (res.ok) {
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
        const error = await res.json();
        Swal.fire('Error', error.error || 'No se pudo cambiar el estado', 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'Error de conexión con el servidor', 'error');
    }
  };

  const handleConvertToSale = async (order) => {
    const result = await Swal.fire({
      title: 'Facturar en POS',
      html: `¿Convertir el pedido <b>#${order.order_number}</b> en una venta oficial del POS?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, facturar venta',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'premium-swal',
        title: 'premium-swal-title',
        confirmButton: 'premium-swal-confirm bg-emerald-600 hover:bg-emerald-700',
        cancelButton: 'premium-swal-cancel'
      }
    });

    if (!result.isConfirmed) return;

    try {
      const cleanBaseUrl = config.apiUrl.endsWith('/') ? config.apiUrl : config.apiUrl + '/';
      const res = await apiRequest(
        `${cleanBaseUrl}catalog-orders/orders/${order.id}/convert-to-sale/`,
        { method: 'POST' },
        token
      );

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: '¡Venta Registrada!',
          text: `Pedido #${order.order_number} convertido en venta con éxito.`,
          timer: 2000,
          showConfirmButton: false,
          customClass: { popup: 'premium-swal' }
        });
        setShowDetailModal(false);
        fetchOrders();
      } else {
        const error = await res.json();
        Swal.fire('Error', error.error || 'No se pudo convertir a venta', 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'Error de conexión', 'error');
    }
  };

  const getStatusActions = (order) => {
    const actions = [];
    const currentStatus = order.status;

    if (currentStatus === 'PENDING') {
      actions.push({ status: 'CONFIRMED', label: 'Aceptar Pedido', color: 'bg-blue-600 hover:bg-blue-700' });
      actions.push({ status: 'CANCELLED', label: 'Cancelar', color: 'bg-rose-600 hover:bg-rose-700' });
    } else if (currentStatus === 'CONFIRMED') {
      actions.push({ status: 'PREPARING', label: 'Iniciar Preparación 👨‍🍳', color: 'bg-purple-600 hover:bg-purple-700' });
      actions.push({ status: 'CANCELLED', label: 'Cancelar', color: 'bg-rose-600 hover:bg-rose-700' });
    } else if (currentStatus === 'PREPARING') {
      actions.push({ status: 'READY', label: 'Marcar Listo ✨', color: 'bg-emerald-600 hover:bg-emerald-700' });
    } else if (currentStatus === 'READY') {
      actions.push({ status: 'DELIVERED', label: 'Entregar / Finalizar 🚀', color: 'bg-slate-700 hover:bg-slate-800' });
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
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER & TOP CONTROL CENTER */}
      <div className="glass-panel p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
              <ShoppingBag size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Centro de Pedidos Web</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>En vivo • Última sincronización: {lastSyncTime.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchOrders}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all shadow-sm active:scale-95 text-sm"
          >
            <RefreshCw size={16} className={`${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isRefreshing ? 'Actualizando...' : 'Sincronizar'}</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: TOTAL */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-150 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pedidos</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalOrdersCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ShoppingBag size={22} />
          </div>
        </div>

        {/* KPI 2: PENDIENTES */}
        <div className={`glass-panel p-5 rounded-3xl border transition-all flex items-center justify-between shadow-sm ${pendingOrdersCount > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-150'}`}>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendientes por Atender</p>
            <div className="flex items-center gap-2 mt-1">
              <h3 className="text-2xl font-black text-amber-600">{pendingOrdersCount}</h3>
              {pendingOrdersCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white font-extrabold text-[10px] rounded-full animate-bounce">
                  ¡Nuevos!
                </span>
              )}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${pendingOrdersCount > 0 ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 animate-pulse' : 'bg-amber-50 text-amber-600'}`}>
            <Bell size={22} />
          </div>
        </div>

        {/* KPI 3: EN PREPARACIÓN */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-150 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">En Preparación</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1">{preparingOrdersCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ChefHat size={22} />
          </div>
        </div>

        {/* KPI 4: MONTO TOTAL */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-150 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ventas Activas Catálogo</p>
            <h3 className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(totalSalesAmount)}</h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign size={22} />
          </div>
        </div>

      </div>

      {/* FILTER TABS SLIDER */}
      <div className="glass-panel p-3 rounded-2xl border border-slate-150 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'ALL', label: 'Todos', count: orders.length },
            { id: 'PENDING', label: '⏳ Pendientes', count: orders.filter(o => o.status === 'PENDING').length },
            { id: 'CONFIRMED', label: '✅ Confirmados', count: orders.filter(o => o.status === 'CONFIRMED').length },
            { id: 'PREPARING', label: '👨‍🍳 En Preparación', count: orders.filter(o => o.status === 'PREPARING').length },
            { id: 'READY', label: '✨ Listos', count: orders.filter(o => o.status === 'READY').length },
            { id: 'DELIVERED', label: '🚀 Entregados', count: orders.filter(o => o.status === 'DELIVERED').length },
            { id: 'CANCELLED', label: '❌ Cancelados', count: orders.filter(o => o.status === 'CANCELLED').length },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                statusFilter === filter.id 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{filter.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${statusFilter === filter.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="glass-panel p-3 rounded-2xl border border-slate-150 shadow-sm flex items-center gap-3">
        <div className="bg-slate-100 p-2 rounded-xl text-slate-400">
          <Search size={18} />
        </div>
        <input 
          type="text" 
          placeholder="Buscar por cliente, teléfono o # de pedido..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-slate-700 placeholder-slate-400"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
            <XCircle size={18} />
          </button>
        )}
      </div>

      {/* ORDERS GRID LIST */}
      {loading ? (
        <div className="glass-panel p-16 rounded-3xl text-center border border-slate-150">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold">Cargando pedidos en tiempo real...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-panel p-16 rounded-3xl text-center border border-slate-150">
          <ShoppingBag size={56} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700 mb-1">No hay pedidos disponibles</h3>
          <p className="text-xs text-slate-400">Los nuevos pedidos realizados por tus clientes en el catálogo web aparecerán aquí al instante.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {filteredOrders.map(order => {
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG['PENDING'];
            const StatusIcon = statusConfig.icon;
            const orderTypeConfig = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG['DINE_IN'];
            const actions = getStatusActions(order);

            return (
              <div
                key={order.id}
                className="glass-panel rounded-3xl border border-slate-200/80 p-5 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group bg-white hover:-translate-y-1"
              >
                <div>
                  {/* CARD HEADER */}
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
                        #{order.order_number}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${orderTypeConfig.color}`}>
                        {orderTypeConfig.icon} {orderTypeConfig.label}
                      </span>
                    </div>

                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-black ${statusConfig.bgColor}`}>
                      <StatusIcon size={14} />
                      <span>{statusConfig.label}</span>
                    </div>
                  </div>

                  {/* CUSTOMER INFO */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <User size={16} className="text-indigo-500 shrink-0" />
                      <span className="truncate">{order.customer_name}</span>
                    </div>

                    {order.customer_phone && (
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-slate-400 shrink-0" />
                          <span>{order.customer_phone}</span>
                        </div>
                        <a 
                          href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <MessageSquare size={12} /> WhatsApp
                        </a>
                      </div>
                    )}

                    {order.table_name && (
                      <div className="flex items-center gap-2 text-xs text-slate-600 bg-sky-50/60 p-2 rounded-xl border border-sky-100">
                        <MapPin size={14} className="text-sky-500 shrink-0" />
                        <span className="font-semibold">{order.table_name}</span>
                      </div>
                    )}

                    {order.customer_address && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{order.customer_address}</span>
                      </div>
                    )}
                  </div>

                  {/* ITEMS PREVIEW */}
                  <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 mb-4 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      <span>Items ({order.items?.length || 0})</span>
                      <span>Cant. × Subtotal</span>
                    </div>
                    {order.items?.slice(0, 3).map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-slate-700">
                        <span className="truncate font-medium max-w-[160px]">{it.product_name}</span>
                        <span className="font-bold text-slate-900">{it.quantity}× {formatCurrency(it.unit_price)}</span>
                      </div>
                    ))}
                    {(order.items?.length || 0) > 3 && (
                      <p className="text-[11px] font-bold text-indigo-600 pt-1">
                        + {(order.items?.length || 0) - 3} productos más...
                      </p>
                    )}
                  </div>
                </div>

                {/* CARD FOOTER & ACTIONS */}
                <div>
                  <div className="flex justify-between items-center pt-2 mb-3 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-400">Total a Pagar</span>
                    <span className="text-xl font-black text-emerald-600">{formatCurrency(order.total)}</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <FileText size={14} /> Detalle
                      </button>

                      {!order.related_sale && order.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleConvertToSale(order)}
                          className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                        >
                          <CreditCard size={14} /> Facturar POS
                        </button>
                      )}
                    </div>

                    {actions.length > 0 && (
                      <div className="flex gap-1.5">
                        {actions.map(act => (
                          <button
                            key={act.status}
                            onClick={() => handleStatusChange(order, act.status)}
                            className={`flex-1 py-2 px-3 text-white font-extrabold text-xs rounded-xl transition-all ${act.color} flex items-center justify-center gap-1 shadow-sm`}
                          >
                            <span>{act.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* RICH ORDER DETAIL MODAL */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="glass-panel bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">
            
            {/* MODAL HEADER */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black tracking-tight">Pedido #{selectedOrder.order_number}</h3>
                  <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${STATUS_CONFIG[selectedOrder.status]?.bgColor}`}>
                    {STATUS_CONFIG[selectedOrder.status]?.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Registrado el {formatDateTime(selectedOrder.created_at)}</p>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-white transition-all"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* CUSTOMER DETAILS CARD */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Datos del Cliente y Entrega</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <User size={16} className="text-indigo-600" />
                    <span>{selectedOrder.customer_name}</span>
                  </div>

                  {selectedOrder.customer_phone && (
                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                      <Phone size={16} className="text-emerald-600" />
                      <span>{selectedOrder.customer_phone}</span>
                    </div>
                  )}

                  {selectedOrder.customer_address && (
                    <div className="flex items-center gap-2 text-slate-700 md:col-span-2">
                      <MapPin size={16} className="text-rose-500 shrink-0" />
                      <span>{selectedOrder.customer_address}</span>
                    </div>
                  )}

                  {selectedOrder.table_name && (
                    <div className="flex items-center gap-2 text-sky-700 font-bold bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
                      <MapPin size={16} className="text-sky-600" />
                      <span>Ubicación / Mesa: {selectedOrder.table_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ITEMS BREAKDOWN TABLE */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">Productos Solicitados ({selectedOrder.items?.length || 0})</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-150">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="p-3.5 bg-white hover:bg-slate-50 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.product_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.quantity} unidades × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-indigo-600">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* NOTES */}
              {selectedOrder.notes && (
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
                  <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Notas del Cliente</h4>
                  <p className="text-xs text-amber-900 font-medium">{selectedOrder.notes}</p>
                </div>
              )}

              {/* FINANCIAL SUMMARY */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-200">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {Number(selectedOrder.tax || 0) > 0 && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Impuestos</span>
                    <span className="font-semibold text-slate-200">{formatCurrency(selectedOrder.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black pt-2 border-t border-slate-800">
                  <span>Total Pedido</span>
                  <span className="text-emerald-400 text-xl">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              {/* STATUS ACTION BUTTONS */}
              <div className="space-y-3 pt-2">
                <div className="flex gap-2 flex-wrap">
                  {getStatusActions(selectedOrder).map(act => (
                    <button
                      key={act.status}
                      onClick={() => handleStatusChange(selectedOrder, act.status)}
                      className={`flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold text-white transition-all ${act.color} shadow-md`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>

                {!selectedOrder.related_sale && selectedOrder.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleConvertToSale(selectedOrder)}
                    className="w-full py-3.5 px-4 rounded-2xl text-sm font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <CreditCard size={18} />
                    Facturar y Convertir a Venta POS
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
