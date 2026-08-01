import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Save, ShoppingCart, UserCheck, Eye, FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';

export default function PurchasesModule({ config, token, systemSettings }) {
  const symbol = systemSettings?.currency_symbol || '$';
  const decimals = parseInt(systemSettings?.currency_decimals ?? '2', 10);

  const formatPrice = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'providers'
  const [providers, setProviders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);

  // Loading States
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Search States
  const [providerSearch, setProviderSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');

  // Modals / Form States
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(null);

  // New Provider Form
  const [providerForm, setProviderForm] = useState({
    name: '', contact_name: '', email: '', phone: '', address: '', tax_id: ''
  });

  // New Order Form
  const [orderForm, setOrderForm] = useState({
    provider: '',
    status: 'DRAFT', // 'DRAFT', 'SENT', 'RECEIVED'
    notes: '',
    items: [] // array of { product_id, name, quantity, unit_price }
  });

  // Temp item selection
  const [tempItem, setTempItem] = useState({ product_id: '', quantity: 1, unit_price: 0 });

  useEffect(() => {
    fetchProviders();
    fetchOrders();
    fetchProducts();
  }, []);

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${config.apiUrl}purchases/providers/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.results || data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}purchases/orders/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.results || data || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`${config.apiUrl}inventory/products/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.results || data || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingProducts(false);
  };

  const handleCreateProvider = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${config.apiUrl}purchases/providers/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(providerForm)
      });
      if (res.ok) {
        Swal.fire({ title: 'Éxito', text: 'Proveedor creado correctamente.', icon: 'success', customClass: { popup: 'premium-swal', confirmButton: 'premium-swal-confirm' }, buttonsStyling: false });
        setShowAddProvider(false);
        setProviderForm({ name: '', contact_name: '', email: '', phone: '', address: '', tax_id: '' });
        fetchProviders();
      } else {
        Swal.fire('Error', 'No se pudo guardar el proveedor.', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Error de red.', 'error');
    }
  };

  const handleAddItemToOrder = () => {
    if (!tempItem.product_id) return;
    const selectedProd = products.find(p => p.id === parseInt(tempItem.product_id));
    if (!selectedProd) return;

    const existingIdx = orderForm.items.findIndex(item => item.product_id === selectedProd.id);
    if (existingIdx > -1) {
      const updated = [...orderForm.items];
      updated[existingIdx].quantity += parseFloat(tempItem.quantity);
      setOrderForm(prev => ({ ...prev, items: updated }));
    } else {
      setOrderForm(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            product_id: selectedProd.id,
            name: selectedProd.name,
            quantity: parseFloat(tempItem.quantity),
            unit_price: parseFloat(tempItem.unit_price || selectedProd.price_cost || 0)
          }
        ]
      }));
    }
    setTempItem({ product_id: '', quantity: 1, unit_price: 0 });
  };

  const handleRemoveItemFromOrder = (idx) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.provider) {
      Swal.fire('Atención', 'Selecciona un proveedor.', 'warning');
      return;
    }
    if (orderForm.items.length === 0) {
      Swal.fire('Atención', 'Agrega al menos un producto al detalle de compra.', 'warning');
      return;
    }

    try {
      // Create Purchase Order
      const res = await fetch(`${config.apiUrl}purchases/orders/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: orderForm.provider,
          status: orderForm.status,
          notes: orderForm.notes,
          total_amount: orderForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
        })
      });

      if (res.ok) {
        const orderData = await res.json();
        
        // Post details
        for (const item of orderForm.items) {
          await fetch(`${config.apiUrl}purchases/order-details/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              order: orderData.id,
              product: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.quantity * item.unit_price
            })
          });
        }

        // Trigger reload (If received, stock updates automatically in django)
        Swal.fire({ title: 'Compra Registrada', text: 'La orden de compra ha sido creada con éxito.', icon: 'success', customClass: { popup: 'premium-swal', confirmButton: 'premium-swal-confirm' }, buttonsStyling: false });
        setShowAddOrder(false);
        setOrderForm({ provider: '', status: 'DRAFT', notes: '', items: [] });
        fetchOrders();
      } else {
        Swal.fire('Error', 'No se pudo crear la orden de compra.', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Error de red.', 'error');
    }
  };

  const handleFetchOrderDetails = async (orderId) => {
    try {
      const res = await fetch(`${config.apiUrl}purchases/orders/${orderId}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShowOrderDetails(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filters
  const filteredProviders = providers.filter(p => 
    p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
    (p.tax_id && p.tax_id.toLowerCase().includes(providerSearch.toLowerCase()))
  );

  const filteredOrders = orders.filter(o => 
    o.provider_name?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    String(o.id).includes(orderSearch)
  );

  return (
    <div className="h-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300 min-h-0">
      
      {/* Dynamic Header */}
      <header className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-2xl shadow-sm border border-white/60 bg-white/40">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Módulo de Compras</h1>
          <p className="text-slate-550 text-xs font-semibold mt-0.5">Control de proveedores e ingresos de mercadería para stock.</p>
        </div>
        
        {/* Buttons */}
        <div className="flex gap-2.5">
          <button 
            onClick={() => {
              if (activeTab === 'orders') {
                setShowAddOrder(true);
              } else {
                setShowAddProvider(true);
              }
            }}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2.5 px-4.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} /> 
            {activeTab === 'orders' ? 'Registrar Compra' : 'Nuevo Proveedor'}
          </button>
        </div>
      </header>

      {/* Tabs Menu */}
      <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200 w-fit self-start">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          Órdenes de Compra
        </button>
        <button 
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'providers' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          Proveedores
        </button>
      </div>

      {/* Tab: Orders */}
      {activeTab === 'orders' && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="glass-panel px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl shadow-sm border border-white/60 bg-white/40">
            <div className="relative w-full md:w-96">
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por ID de orden o proveedor..." 
                className="glass-input !pl-10 !py-2.5 text-xs w-full font-semibold border-slate-250 focus:border-indigo-500"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 glass-panel p-0 overflow-hidden rounded-2xl shadow-sm border border-white/60 bg-white/40 flex flex-col">
            <div className="flex-1 overflow-auto px-6 py-4">
              {loading ? (
                <div className="p-16 flex justify-center">
                  <span className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16 text-slate-450 font-bold text-xs">
                  No hay órdenes de compra registradas.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-450 text-[10px] font-extrabold uppercase tracking-wider sticky top-0 bg-white/80 backdrop-blur-md z-10">
                      <th className="py-3 px-3">ID Compra</th>
                      <th className="py-3 px-3">Proveedor</th>
                      <th className="py-3 px-3">Fecha de Orden</th>
                      <th className="py-3 px-3 text-right">Monto Total</th>
                      <th className="py-3 px-3 text-center">Estado</th>
                      <th className="py-3 px-3 text-center w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 text-xs font-medium">
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all duration-150">
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-500">PO-{o.id}</td>
                        <td className="py-3.5 px-3 font-semibold text-slate-800">{o.provider_name || o.provider}</td>
                        <td className="py-3.5 px-3">{o.order_date}</td>
                        <td className="py-3.5 px-3 text-right font-bold text-slate-800 font-mono">{formatPrice(o.total_amount)}</td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            o.status === 'RECEIVED' 
                              ? 'bg-green-50 text-green-700 border border-green-200' 
                              : o.status === 'SENT' 
                                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {o.status === 'RECEIVED' ? 'Recibida' : o.status === 'SENT' ? 'Enviada' : 'Borrador'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 flex justify-center">
                          <button 
                            onClick={() => handleFetchOrderDetails(o.id)}
                            className="p-1.5 text-slate-550 hover:text-indigo-650 hover:bg-indigo-50 border border-slate-150 rounded-xl transition-all shadow-sm bg-white"
                          >
                            <Eye size={13} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Providers */}
      {activeTab === 'providers' && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="glass-panel px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl shadow-sm border border-white/60 bg-white/40">
            <div className="relative w-full md:w-96">
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar proveedor por nombre o NIT..." 
                className="glass-input !pl-10 !py-2.5 text-xs w-full font-semibold border-slate-250 focus:border-indigo-500"
                value={providerSearch}
                onChange={e => setProviderSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 glass-panel p-0 overflow-hidden rounded-2xl shadow-sm border border-white/60 bg-white/40 flex flex-col">
            <div className="flex-1 overflow-auto px-6 py-4">
              {filteredProviders.length === 0 ? (
                <div className="text-center py-16 text-slate-450 font-bold text-xs">
                  No se encontraron proveedores.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-450 text-[10px] font-extrabold uppercase tracking-wider sticky top-0 bg-white/80 backdrop-blur-md z-10">
                      <th className="py-3 px-3">NIT / RUC / ID</th>
                      <th className="py-3 px-3">Nombre Proveedor</th>
                      <th className="py-3 px-3">Contacto</th>
                      <th className="py-3 px-3">Celular</th>
                      <th className="py-3 px-3">Email</th>
                      <th className="py-3 px-3">Dirección</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 text-xs font-medium">
                    {filteredProviders.map(p => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all duration-150">
                        <td className="py-3.5 px-3 font-mono text-slate-500 font-bold">{p.tax_id || 'S/N'}</td>
                        <td className="py-3.5 px-3 font-semibold text-slate-800">{p.name}</td>
                        <td className="py-3.5 px-3 text-slate-600">{p.contact_name || '-'}</td>
                        <td className="py-3.5 px-3 font-mono">{p.phone || '-'}</td>
                        <td className="py-3.5 px-3 font-mono">{p.email || '-'}</td>
                        <td className="py-3.5 px-3 text-slate-500">{p.address || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Provider Modal */}
      {showAddProvider && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col text-slate-800">
            <div className="p-4.5 border-b flex justify-between items-center bg-slate-50/50">
              <h2 className="font-extrabold text-sm flex items-center gap-2"><UserCheck size={16} className="text-indigo-600" /> Registrar Nuevo Proveedor</h2>
              <button onClick={() => setShowAddProvider(false)} className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 p-1.5 rounded-xl cursor-pointer">×</button>
            </div>
            <form onSubmit={handleCreateProvider} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-550 mb-1">Nombre Comercial [*]</label>
                <input required type="text" className="glass-input text-xs" value={providerForm.name} onChange={e => setProviderForm({...providerForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-550 mb-1">Identificación Fiscal / NIT [*]</label>
                  <input required type="text" className="glass-input text-xs font-mono" value={providerForm.tax_id} onChange={e => setProviderForm({...providerForm, tax_id: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-550 mb-1">Persona de Contacto</label>
                  <input type="text" className="glass-input text-xs" value={providerForm.contact_name} onChange={e => setProviderForm({...providerForm, contact_name: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-550 mb-1">Celular / Teléfono</label>
                  <input type="text" className="glass-input text-xs font-mono" value={providerForm.phone} onChange={e => setProviderForm({...providerForm, phone: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-550 mb-1">Email</label>
                  <input type="email" className="glass-input text-xs font-mono" value={providerForm.email} onChange={e => setProviderForm({...providerForm, email: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-550 mb-1">Dirección de Oficina</label>
                <textarea rows="2" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-xs transition-all resize-none" value={providerForm.address} onChange={e => setProviderForm({...providerForm, address: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-3 btn-premium flex justify-center items-center gap-2">
                <Save size={16} /> Guardar Proveedor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Purchase Order Modal */}
      {showAddOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col text-slate-800 max-h-[92vh]">
            <div className="p-4.5 border-b flex justify-between items-center bg-slate-50/50">
              <h2 className="font-extrabold text-sm flex items-center gap-2"><ShoppingCart size={16} className="text-indigo-600" /> Registrar Ingreso de Mercancía (Compra)</h2>
              <button onClick={() => setShowAddOrder(false)} className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 p-1.5 rounded-xl cursor-pointer">×</button>
            </div>
            
            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-6 space-y-5 flex flex-col">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-550 mb-1">Proveedor [*]</label>
                  <select required className="glass-input text-xs" value={orderForm.provider} onChange={e => setOrderForm({...orderForm, provider: e.target.value})}>
                    <option value="" disabled>-- Selecciona un proveedor --</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name} (NIT: {p.tax_id})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-550 mb-1">Estado de Recepción [*]</label>
                  <select required className="glass-input text-xs font-bold text-slate-700" value={orderForm.status} onChange={e => setOrderForm({...orderForm, status: e.target.value})}>
                    <option value="DRAFT">Borrador</option>
                    <option value="SENT">Enviada / Pendiente</option>
                    <option value="RECEIVED" className="text-green-600">Recibida (Ingresa a stock)</option>
                  </select>
                </div>
              </div>

              {/* Add item interface */}
              <fieldset className="border border-slate-200 rounded-xl p-4 bg-slate-50/30">
                <legend className="px-2.5 text-[10px] font-extrabold uppercase text-slate-500 bg-white border border-slate-200 rounded-full tracking-wider">Agregar Producto al Detalle</legend>
                
                <div className="grid grid-cols-12 gap-3 mt-1.5 items-end">
                  <div className="col-span-6">
                    <label className="block text-[10px] font-bold text-slate-450 mb-1">Producto</label>
                    <select 
                      className="glass-input text-xs" 
                      value={tempItem.product_id}
                      onChange={e => {
                        const selectedProd = products.find(p => p.id === parseInt(e.target.value));
                        setTempItem(prev => ({ 
                          ...prev, 
                          product_id: e.target.value,
                          unit_price: selectedProd ? parseFloat(selectedProd.price_cost || 0) : 0 
                        }));
                      }}
                    >
                      <option value="" disabled>-- Selecciona un producto --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} (Costo: {formatPrice(p.price_cost)})</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-450 mb-1">Cantidad</label>
                    <input type="number" min="0.01" step="any" className="glass-input text-xs font-mono" value={tempItem.quantity} onChange={e => setTempItem({...tempItem, quantity: e.target.value})} />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-slate-450 mb-1">Costo Unitario ({symbol})</label>
                    <input type="number" step="any" className="glass-input text-xs font-mono" value={tempItem.unit_price} onChange={e => setTempItem({...tempItem, unit_price: e.target.value})} />
                  </div>
                  <div className="col-span-1">
                    <button 
                      type="button" 
                      onClick={handleAddItemToOrder}
                      className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 p-2.5 rounded-xl border border-indigo-200 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </fieldset>

              {/* Items List Table */}
              <div className="flex-1 border border-slate-150 rounded-xl overflow-hidden min-h-36 max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-150">
                    <tr className="text-slate-450 text-[9px] font-extrabold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3 text-right">Cantidad</th>
                      <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                      <th className="py-2.5 px-3 text-right">Importe</th>
                      <th className="py-2.5 px-3 text-center w-16">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 text-xs">
                    {orderForm.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/30">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.name}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatPrice(item.unit_price)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{formatPrice(item.quantity * item.unit_price)}</td>
                        <td className="py-2.5 px-3 flex justify-center">
                          <button 
                            type="button" 
                            onClick={() => handleRemoveItemFromOrder(idx)}
                            className="p-1 hover:bg-red-50 text-red-500 rounded hover:scale-105 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {orderForm.items.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-10 text-slate-400 font-bold text-xs">Detalle de compra vacío.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total and Notes */}
              <div className="flex justify-between items-end gap-6 pt-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-550 mb-1">Notas / Observaciones de Compra</label>
                  <input type="text" placeholder="Ej: Factura Compra #399201" className="glass-input text-xs" value={orderForm.notes} onChange={e => setOrderForm({...orderForm, notes: e.target.value})} />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Monto Total de Compra</span>
                  <span className="text-xl font-extrabold text-slate-800 font-mono">
                    {formatPrice(orderForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0))}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button type="button" onClick={() => setShowAddOrder(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="btn-premium px-5 py-2 flex items-center gap-2">
                  <Save size={16} /> Guardar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Show Details Modal */}
      {showOrderDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col text-slate-800">
            <div className="p-4.5 border-b flex justify-between items-center bg-slate-50/50">
              <h2 className="font-extrabold text-sm flex items-center gap-2"><FileText size={16} className="text-indigo-600" /> Detalles de Orden de Compra PO-{showOrderDetails.id}</h2>
              <button onClick={() => setShowOrderDetails(null)} className="text-slate-400 hover:text-slate-650 hover:bg-slate-100 p-1.5 rounded-xl cursor-pointer">×</button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold">Proveedor</span>
                  <span className="text-slate-800 font-bold text-sm">{showOrderDetails.provider_name}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold">Fecha</span>
                  <span className="text-slate-800">{showOrderDetails.order_date}</span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold">Estado</span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold w-fit block mt-1 ${
                    showOrderDetails.status === 'RECEIVED' 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {showOrderDetails.status === 'RECEIVED' ? 'Recibida / Procesada' : 'Borrador'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold">Monto Total</span>
                  <span className="text-slate-800 font-bold font-mono text-sm">{formatPrice(showOrderDetails.total_amount)}</span>
                </div>
              </div>

              {showOrderDetails.notes && (
                <div className="bg-slate-50 p-3 rounded-lg text-xs border border-slate-100">
                  <span className="block text-slate-400 text-[9px] uppercase font-bold mb-1">Notas</span>
                  <p className="text-slate-700 font-medium">{showOrderDetails.notes}</p>
                </div>
              )}

              {/* Items Detail */}
              <div>
                <span className="block text-slate-400 text-[10px] uppercase font-bold mb-2">Detalle de Artículos</span>
                <div className="border border-slate-150 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-150">
                      <tr className="text-slate-450 text-[9px] font-bold uppercase tracking-wider">
                        <th className="py-2 px-3">Producto</th>
                        <th className="py-2 px-3 text-right">Cantidad</th>
                        <th className="py-2 px-3 text-right">Costo Unit.</th>
                        <th className="py-2 px-3 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 text-xs">
                      {showOrderDetails.details?.map((detail, idx) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 px-3 font-semibold">{detail.product_name || `Producto ID: ${detail.product}`}</td>
                          <td className="py-2 px-3 text-right font-mono">{detail.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatPrice(detail.unit_price)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{formatPrice(detail.total_price || (detail.quantity * detail.unit_price))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setShowOrderDetails(null)} 
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer text-center"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
