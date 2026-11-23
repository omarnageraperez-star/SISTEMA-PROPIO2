import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Search, Plus, Trash2, Sliders, Sparkles, User, UserPlus,
  Calendar, Clock, DollarSign, Percent, AlertTriangle, ShieldAlert,
  Save, Send, Info, Check, X, Box, Tag, Layers, FileText
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import Swal from 'sweetalert2';
import QuotationItemExtrasModal from './QuotationItemExtrasModal';

export default function QuotationEditor({
  config,
  token,
  userProfile,
  systemSettings,
  quotationId = null,
  initialData = null,
  onClose,
  onSaved
}) {
  const baseUrl = config?.apiUrl?.replace(/\/$/, '') || '';
  const symbol = systemSettings?.currency_symbol || '$';
  const decimals = parseInt(systemSettings?.currency_decimals ?? '2', 10);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quotationConfig, setQuotationConfig] = useState(null);

  // Clientes y Bodegas
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  // Cliente
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSnapshot, setCustomerSnapshot] = useState({
    name: 'Cliente General',
    document: '',
    email: '',
    phone: '',
    address: ''
  });
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    first_name: '', last_name: '', document_number: '', phone: '', email: '', address: ''
  });

  // Metadatos de la cotización
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validityDays, setValidityDays] = useState(15);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [customFieldsValues, setCustomFieldsValues] = useState({});

  // Buscador de productos
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);

  // Líneas de la cotización
  const [items, setItems] = useState([]);

  // Descuentos y Cargos Globales
  const [globalDiscountType, setGlobalDiscountType] = useState('PERCENTAGE'); // PERCENTAGE, FIXED
  const [globalDiscountRate, setGlobalDiscountRate] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [additionalChargesNotes, setAdditionalChargesNotes] = useState('');

  // Modal de adicionales de línea
  const [editingItemIndex, setEditingItemIndex] = useState(null);

  // Permisos
  const canViewMargins = (
    userProfile?.role === 'SUPERADMIN' ||
    userProfile?.role === 'ADMIN' ||
    userProfile?.custom_permissions?.['quotations.view_margins'] ||
    userProfile?.custom_permissions?.['inventory.view_costs']
  );

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Obtener configuración del módulo
      const cfgRes = await apiRequest(`${baseUrl}/quotations/configuration/`, {}, token);
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setQuotationConfig(cfgData);
        setValidityDays(cfgData.default_validity_days || 15);
        setTerms(cfgData.default_terms || '');
        setNotes(cfgData.default_notes || '');
      }

      // 2. Obtener clientes
      const custRes = await apiRequest(`${baseUrl}/crm/customers/`, {}, token);
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(Array.isArray(custData) ? custData : (custData.results || []));
      }

      // 3. Obtener bodegas
      const whRes = await apiRequest(`${baseUrl}/inventory/warehouses/`, {}, token);
      if (whRes.ok) {
        const whData = await whRes.json();
        const whList = Array.isArray(whData) ? whData : (whData.results || []);
        setWarehouses(whList);
        if (whList.length > 0) setSelectedWarehouseId(whList[0].id);
      }

      // 4. Si es edición de cotización existente
      if (quotationId) {
        const qRes = await apiRequest(`${baseUrl}/quotations/quotations/${quotationId}/`, {}, token);
        if (qRes.ok) {
          const qData = await qRes.json();
          loadExistingQuotation(qData);
        }
      } else if (initialData) {
        loadExistingQuotation(initialData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingQuotation = (qData) => {
    setSelectedCustomerId(qData.customer || '');
    setCustomerSnapshot({
      name: qData.customer_name || '',
      document: qData.customer_document || '',
      email: qData.customer_email || '',
      phone: qData.customer_phone || '',
      address: qData.customer_address || ''
    });
    setCustomerSearch(qData.customer_name || '');
    if (qData.warehouse) setSelectedWarehouseId(qData.warehouse);
    if (qData.issue_date) setIssueDate(qData.issue_date);
    if (qData.validity_days) setValidityDays(qData.validity_days);
    if (qData.notes) setNotes(qData.notes);
    if (qData.terms_and_conditions) setTerms(qData.terms_and_conditions);
    if (qData.custom_fields) setCustomFieldsValues(qData.custom_fields);
    if (qData.discount_type) setGlobalDiscountType(qData.discount_type);
    if (qData.discount_rate) setGlobalDiscountRate(parseFloat(qData.discount_rate));
    if (qData.additional_charges) setAdditionalCharges(parseFloat(qData.additional_charges));
    if (qData.additional_charges_notes) setAdditionalChargesNotes(qData.additional_charges_notes);

    if (qData.items) {
      setItems(qData.items.map(it => ({
        id: it.id,
        product: it.product,
        product_id: it.product,
        is_manual: it.is_manual,
        name: it.name,
        sku: it.sku || '',
        measurement_unit: it.measurement_unit || 'Unidad',
        quantity: parseFloat(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
        unit_cost: parseFloat(it.unit_cost) || 0,
        discount_type: it.discount_type || 'PERCENTAGE',
        discount_rate: parseFloat(it.discount_rate) || 0,
        discount_amount: parseFloat(it.discount_amount) || 0,
        tax_percent: parseFloat(it.tax_percent) || 0,
        extras_amount: parseFloat(it.extras_amount) || 0,
        available_stock: it.available_stock !== undefined ? it.available_stock : null,
        extras: it.extras || [],
        customizations: it.customizations || []
      })));
    }
  };

  // Buscador de productos con debounce
  useEffect(() => {
    if (!productSearchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiRequest(`${baseUrl}/inventory/products/?search=${encodeURIComponent(productSearchTerm)}`, {}, token);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.results || []);
          setSearchResults(list);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [productSearchTerm]);

  // Selección de cliente
  const handleSelectCustomer = (cust) => {
    setSelectedCustomerId(cust.id);
    const fullName = `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Cliente';
    setCustomerSnapshot({
      name: fullName,
      document: cust.document_number || '',
      email: cust.email || '',
      phone: cust.phone || '',
      address: cust.address || ''
    });
    setCustomerSearch(fullName);
    setShowCustomerDropdown(false);
  };

  // Crear cliente rápido
  const handleQuickCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!quickCustomerForm.first_name.trim()) return;
    try {
      const res = await apiRequest(`${baseUrl}/crm/customers/`, {
        method: 'POST',
        body: JSON.stringify(quickCustomerForm)
      }, token);

      if (res.ok) {
        const created = await res.json();
        setCustomers([created, ...customers]);
        handleSelectCustomer(created);
        setShowQuickCustomerModal(false);
        setQuickCustomerForm({
          first_name: '', last_name: '', document_number: '', phone: '', email: '', address: ''
        });
      } else {
        const err = await res.json();
        Swal.fire('Error', JSON.stringify(err), 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'No se pudo crear el cliente.', 'error');
    }
  };

  // Agregar producto desde buscador
  const addProductToQuotation = async (prod) => {
    // Consultar stock disponible en tiempo real
    let availStock = prod.stock;
    try {
      const stockRes = await apiRequest(`${baseUrl}/quotations/quotations/check-stock/?product_id=${prod.id}&warehouse_id=${selectedWarehouseId}`, {}, token);
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        availStock = stockData.available_stock;
      }
    } catch (e) {}

    const newItem = {
      product: prod.id,
      product_id: prod.id,
      is_manual: false,
      name: prod.name,
      sku: prod.sku || prod.internal_code || '',
      measurement_unit: prod.measurement_unit || 'Unidad',
      quantity: 1,
      unit_price: parseFloat(prod.price_sell) || 0,
      unit_cost: parseFloat(prod.price_buy) || 0,
      discount_type: 'PERCENTAGE',
      discount_rate: 0,
      discount_amount: 0,
      tax_percent: parseFloat(prod.tax_percent) || 0,
      extras_amount: 0,
      available_stock: availStock,
      has_inventory_control: prod.has_inventory_control,
      extras: [],
      customizations: []
    };

    setItems([...items, newItem]);
    setProductSearchTerm('');
    setSearchResults([]);
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  // Agregar ítem libre / manual
  const addManualItem = () => {
    const newItem = {
      product: null,
      product_id: null,
      is_manual: true,
      name: 'Servicio / Mano de Obra / Flete',
      sku: 'SERV',
      measurement_unit: 'Servicio',
      quantity: 1,
      unit_price: 0,
      unit_cost: 0,
      discount_type: 'PERCENTAGE',
      discount_rate: 0,
      discount_amount: 0,
      tax_percent: 0,
      extras_amount: 0,
      available_stock: null,
      has_inventory_control: false,
      extras: [],
      customizations: []
    };
    setItems([...items, newItem]);
  };

  // Eliminar línea
  const removeItem = (index) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Actualizar campo de línea
  const updateItemField = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Callback de modal de adicionales
  const handleSaveExtras = (result) => {
    if (editingItemIndex === null) return;
    const updated = [...items];
    const targetItem = updated[editingItemIndex];

    let extrasSum = 0;
    (result.extras || []).forEach(ex => {
      extrasSum += parseFloat(ex.total_price) || 0;
    });

    targetItem.extras = result.extras || [];
    targetItem.customizations = result.customizations || [];
    targetItem.extras_amount = extrasSum;

    setItems(updated);
    setEditingItemIndex(null);
  };

  // Cálculos en tiempo real en frontend (fieles a services.py)
  const calculateTotals = () => {
    let grossSubtotal = 0;
    let accumTaxes = 0;
    let accumLineDiscounts = 0;

    items.forEach(it => {
      const qty = parseFloat(it.quantity) || 0;
      let price = parseFloat(it.unit_price) || 0;

      // Personalizaciones con impacto
      (it.customizations || []).forEach(c => {
        const val = parseFloat(c.impact_value) || 0;
        if (c.impact_type === 'ADD') price += val;
        if (c.impact_type === 'SUBTRACT') price = Math.max(0, price - val);
        if (c.impact_type === 'MULTIPLY' && val > 0) price = price * val;
      });

      const lineBase = qty * price;
      const extras = parseFloat(it.extras_amount) || 0;
      const lineGross = lineBase + extras;

      let lineDiscount = 0;
      const discRate = parseFloat(it.discount_rate) || 0;
      if (it.discount_type === 'PERCENTAGE') {
        lineDiscount = lineGross * (discRate / 100);
      } else {
        lineDiscount = parseFloat(it.discount_amount) || discRate;
      }
      lineDiscount = Math.min(lineGross, lineDiscount);

      const lineSubtotal = lineGross - lineDiscount;
      const taxRate = parseFloat(it.tax_percent) || 0;
      const lineTax = lineSubtotal * (taxRate / 100);

      grossSubtotal += lineSubtotal;
      accumTaxes += lineTax;
      accumLineDiscounts += lineDiscount;
    });

    // Descuento global
    let globalDiscount = 0;
    const gRate = parseFloat(globalDiscountRate) || 0;
    if (globalDiscountType === 'PERCENTAGE') {
      if (gRate > 0) globalDiscount = grossSubtotal * (gRate / 100);
    } else {
      globalDiscount = gRate;
    }
    globalDiscount = Math.min(grossSubtotal, globalDiscount);

    const subtotalAfterGlobalDiscount = grossSubtotal - globalDiscount;
    const addCharges = parseFloat(additionalCharges) || 0;
    const total = Math.max(0, subtotalAfterGlobalDiscount + accumTaxes + addCharges);

    return {
      grossSubtotal,
      globalDiscount,
      accumTaxes,
      additionalCharges: addCharges,
      total
    };
  };

  const totals = calculateTotals();

  // Guardar cotización
  const handleSubmit = async (targetStatus = 'DRAFT') => {
    if (items.length === 0) {
      Swal.fire('Atención', 'Agrega al menos un ítem a la cotización.', 'warning');
      return;
    }

    // Comprobar si hay stock insuficiente y si la configuración lo permite
    const outOfStockItems = items.filter(it => it.has_inventory_control && it.available_stock !== null && it.quantity > it.available_stock);
    if (outOfStockItems.length > 0 && quotationConfig && !quotationConfig.allow_zero_stock_quotation) {
      Swal.fire('Stock Insuficiente', `El ítem '${outOfStockItems[0].name}' supera el stock disponible y el sistema tiene configurado no permitir cotizar sin stock.`, 'error');
      return;
    }

    // Validar descuento máximo de cajero
    const maxDiscountAllowed = quotationConfig?.max_discount_cashier || 10.0;
    const isCashierOrUser = userProfile?.role !== 'SUPERADMIN' && userProfile?.role !== 'ADMIN';
    if (isCashierOrUser && globalDiscountType === 'PERCENTAGE' && globalDiscountRate > maxDiscountAllowed) {
      Swal.fire('Límite de Descuento Excedido', `El descuento global (${globalDiscountRate}%) excede tu límite permitido de ${maxDiscountAllowed}%. Solicita aprobación de un administrador.`, 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_id: selectedCustomerId || null,
        warehouse: selectedWarehouseId || null,
        customer_name: customerSnapshot.name || 'Cliente General',
        customer_document: customerSnapshot.document || '',
        customer_email: customerSnapshot.email || '',
        customer_phone: customerSnapshot.phone || '',
        customer_address: customerSnapshot.address || '',
        status: targetStatus,
        issue_date: issueDate,
        validity_days: parseInt(validityDays) || 15,
        discount_type: globalDiscountType,
        discount_rate: parseFloat(globalDiscountRate) || 0,
        discount_amount: totals.globalDiscount,
        additional_charges: parseFloat(additionalCharges) || 0,
        additional_charges_notes: additionalChargesNotes,
        custom_fields: customFieldsValues,
        notes: notes,
        terms_and_conditions: terms,
        items: items.map(it => ({
          product_id: it.product_id,
          is_manual: it.is_manual,
          name: it.name,
          sku: it.sku,
          measurement_unit: it.measurement_unit,
          quantity: parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          unit_cost: parseFloat(it.unit_cost) || 0,
          discount_type: it.discount_type,
          discount_rate: parseFloat(it.discount_rate) || 0,
          tax_percent: parseFloat(it.tax_percent) || 0,
          extras: it.extras || [],
          customizations: it.customizations || []
        }))
      };

      const url = quotationId
        ? `${baseUrl}/quotations/quotations/${quotationId}/`
        : `${baseUrl}/quotations/quotations/`;

      const method = quotationId ? 'PUT' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      }, token);

      if (res.ok) {
        const savedData = await res.json();
        Swal.fire({
          icon: 'success',
          title: quotationId ? 'Cotización Actualizada' : 'Cotización Creada',
          text: `Consecutivo: ${savedData.consecutive}`,
          timer: 2000,
          showConfirmButton: false
        });
        if (onSaved) onSaved(savedData);
        onClose();
      } else {
        const err = await res.json();
        Swal.fire('Error', JSON.stringify(err), 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'No se pudo guardar la cotización.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-150 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {quotationId ? 'Editar Cotización' : 'Nueva Cotización'}
            </h2>
            <p className="text-xs text-slate-400">
              Presupuesto flexible vinculado a inventario real, adicionales y personalizaciones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            disabled={submitting}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save size={15} /> Guardar Borrador
          </button>
          <button
            type="button"
            onClick={() => handleSubmit('SENT')}
            disabled={submitting}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Send size={15} /> Guardar y Enviar
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda & Centro: Datos y Detalle de Líneas (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Cliente y Datos Generales */}
          <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <User size={16} className="text-indigo-600" /> Información del Cliente
              </span>
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(true)}
                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <UserPlus size={14} /> + Cliente Rápido
              </button>
            </div>

            {/* Selector de Cliente con autocompletado */}
            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre, documento o teléfono..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerSnapshot({ ...customerSnapshot, name: e.target.value });
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              </div>

              {/* Dropdown sugerencias de clientes */}
              {showCustomerDropdown && customers.length > 0 && customerSearch.trim() && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {customers
                    .filter(c => {
                      const q = customerSearch.toLowerCase();
                      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
                      const doc = (c.document_number || '').toLowerCase();
                      const tel = (c.phone || '').toLowerCase();
                      return name.includes(q) || doc.includes(q) || tel.includes(q);
                    })
                    .slice(0, 6)
                    .map(cust => (
                      <div
                        key={cust.id}
                        onClick={() => handleSelectCustomer(cust)}
                        className="p-2.5 hover:bg-indigo-50/50 cursor-pointer text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{cust.first_name} {cust.last_name}</div>
                          <div className="text-[11px] text-slate-400">Doc: {cust.document_number || 'N/A'} • Tel: {cust.phone || 'N/A'}</div>
                        </div>
                        <span className="text-[10px] text-indigo-600 font-semibold">Seleccionar</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Datos específicos de cliente snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Documento / NIT</label>
                <input
                  type="text"
                  placeholder="Doc. identidad"
                  value={customerSnapshot.document}
                  onChange={(e) => setCustomerSnapshot({ ...customerSnapshot, document: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  placeholder="Teléfono"
                  value={customerSnapshot.phone}
                  onChange={(e) => setCustomerSnapshot({ ...customerSnapshot, phone: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="Email"
                  value={customerSnapshot.email}
                  onChange={(e) => setCustomerSnapshot({ ...customerSnapshot, email: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Fecha y Vigencia */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha Emisión</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Días de Vigencia</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value) || 15)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Bodega de Inventario</label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Buscador e Inserción de Productos */}
          <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <Box size={16} className="text-indigo-600" /> Agregar Ítems a Cotizar
              </span>
              <button
                type="button"
                onClick={addManualItem}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Plus size={14} /> + Ítem Libre / Servicio
              </button>
            </div>

            {/* Input Buscador con debounce */}
            <div className="relative">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar producto por nombre, SKU, código de barras o categoría..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                {searchLoading && (
                  <span className="absolute right-3 top-3 text-[11px] text-slate-400 font-medium">Buscando...</span>
                )}
              </div>

              {/* Resultados de búsqueda de productos */}
              {searchResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => addProductToQuotation(prod)}
                      className="p-3 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <span>{prod.name}</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-500 font-mono">
                            {prod.sku || prod.internal_code}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Unidad: {prod.measurement_unit} • IVA: {prod.tax_percent}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-indigo-600 text-sm">
                          {symbol}{parseFloat(prod.price_sell).toLocaleString()}
                        </div>
                        <div className={`text-[10px] font-semibold ${prod.stock > 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
                          Stock: {parseFloat(prod.stock).toLocaleString()} {prod.measurement_unit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TABLA DE LÍNEAS / ÍTEMS COTIZADOS */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2 px-2">Ítem / Producto</th>
                    <th className="py-2 px-2 w-20 text-center">Cant.</th>
                    <th className="py-2 px-2 w-28 text-right">Precio Unit.</th>
                    <th className="py-2 px-2 w-20 text-center">Desc %</th>
                    <th className="py-2 px-2 w-20 text-center">Extras</th>
                    {canViewMargins && <th className="py-2 px-2 w-20 text-center">Margen</th>}
                    <th className="py-2 px-2 w-28 text-right">Subtotal</th>
                    <th className="py-2 px-1 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {items.map((it, idx) => {
                    const isOutOfStock = it.has_inventory_control && it.available_stock !== null && it.quantity > it.available_stock;
                    const linePrice = parseFloat(it.unit_price) || 0;
                    const lineCost = parseFloat(it.unit_cost) || 0;
                    const marginEst = linePrice > 0 ? Math.round(((linePrice - lineCost) / linePrice) * 100) : 0;
                    const extrasTotal = parseFloat(it.extras_amount) || 0;
                    const lineTotal = (it.quantity * linePrice) + extrasTotal - ((it.quantity * linePrice + extrasTotal) * (it.discount_rate / 100));

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {/* Producto & Alerta Stock */}
                        <td className="py-3 px-2">
                          {it.is_manual ? (
                            <input
                              type="text"
                              value={it.name}
                              onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                              placeholder="Nombre del servicio o ítem libre"
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                            />
                          ) : (
                            <div>
                              <span className="font-bold text-slate-800 block">{it.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400 font-mono">{it.sku}</span>
                                {it.has_inventory_control && (
                                  <span className={`text-[10px] font-semibold flex items-center gap-1 ${isOutOfStock ? 'text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>
                                    {isOutOfStock && <AlertTriangle size={11} />}
                                    Disp: {it.available_stock !== null ? it.available_stock : 'N/A'}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Cantidad */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={it.quantity}
                            onChange={(e) => updateItemField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full text-center px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                          />
                        </td>

                        {/* Precio Unitario */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            step="any"
                            value={it.unit_price}
                            onChange={(e) => updateItemField(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full text-right px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                          />
                        </td>

                        {/* Descuento % */}
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={it.discount_rate}
                            onChange={(e) => updateItemField(idx, 'discount_rate', parseFloat(e.target.value) || 0)}
                            className="w-full text-center px-1 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </td>

                        {/* Adicionales Modal Trigger */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => setEditingItemIndex(idx)}
                            className={`p-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 mx-auto cursor-pointer transition-all ${
                              (it.extras?.length > 0 || it.customizations?.length > 0)
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                            }`}
                            title="Personalizaciones y Adicionales"
                          >
                            <Sliders size={13} />
                            {(it.extras?.length || 0) + (it.customizations?.length || 0) > 0 && (
                              <span>{(it.extras?.length || 0) + (it.customizations?.length || 0)}</span>
                            )}
                          </button>
                        </td>

                        {/* Margen */}
                        {canViewMargins && (
                          <td className="py-3 px-2 text-center">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${marginEst >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {marginEst}%
                            </span>
                          </td>
                        )}

                        {/* Subtotal */}
                        <td className="py-3 px-2 text-right font-bold text-slate-800">
                          {symbol}{Math.round(lineTotal).toLocaleString()}
                        </td>

                        {/* Borrar */}
                        <td className="py-3 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={canViewMargins ? 8 : 7} className="py-8 text-center text-slate-400 text-xs">
                        No hay ítems agregados. Usa el buscador arriba o haz clic en "+ Ítem Libre / Servicio".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Totales, Descuento Global, Cargos, Notas y Términos (1 col) */}
        <div className="space-y-6">
          {/* Card Resumen de Totales */}
          <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Resumen Financiero
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Bruto:</span>
                <span className="font-semibold text-slate-800">{symbol}{Math.round(totals.grossSubtotal).toLocaleString()}</span>
              </div>

              {/* Descuento Global */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-600 font-medium">Descuento Global:</span>
                  <div className="flex items-center gap-1 w-28">
                    <input
                      type="number"
                      min="0"
                      value={globalDiscountRate}
                      onChange={(e) => setGlobalDiscountRate(parseFloat(e.target.value) || 0)}
                      className="w-full text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setGlobalDiscountType(globalDiscountType === 'PERCENTAGE' ? 'FIXED' : 'PERCENTAGE')}
                      className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                    >
                      {globalDiscountType === 'PERCENTAGE' ? '%' : '$'}
                    </button>
                  </div>
                </div>
                {totals.globalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Monto descontado:</span>
                    <span>-{symbol}{Math.round(totals.globalDiscount).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Cargos Adicionales (Flete, Envío, Propina) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-600 font-medium">Cargos Adicionales:</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={additionalCharges}
                    onChange={(e) => setAdditionalCharges(parseFloat(e.target.value) || 0)}
                    className="w-28 text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Concepto (ej. Envío nacional, Flete)"
                  value={additionalChargesNotes}
                  onChange={(e) => setAdditionalChargesNotes(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px]"
                />
              </div>

              {/* Impuestos */}
              <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                <span>Impuestos Totales:</span>
                <span className="font-semibold text-slate-800">{symbol}{Math.round(totals.accumTaxes).toLocaleString()}</span>
              </div>

              {/* TOTAL GENERAL */}
              <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-800">Total Cotización:</span>
                <span className="text-xl font-black text-indigo-600">
                  {symbol}{Math.round(totals.total).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Card Campos Personalizados del Negocio (si existen en el esquema) */}
          {quotationConfig?.custom_fields_schema && quotationConfig.custom_fields_schema.length > 0 && (
            <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Datos Personalizados del Rubro
              </h3>
              <div className="space-y-2.5">
                {quotationConfig.custom_fields_schema.map((fld, idx) => (
                  <div key={idx}>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">{fld.label}</label>
                    <input
                      type={fld.type || 'text'}
                      value={customFieldsValues[fld.name] || ''}
                      onChange={(e) => setCustomFieldsValues({ ...customFieldsValues, [fld.name]: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card Notas y Términos */}
          <div className="bg-white p-5 rounded-3xl border border-slate-150 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Observaciones & Términos
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Observaciones / Notas Internas</label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas para el cliente o de seguimiento interno..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Términos y Condiciones</label>
              <textarea
                rows="3"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Adicionales y Personalizaciones */}
      {editingItemIndex !== null && items[editingItemIndex] && (
        <QuotationItemExtrasModal
          item={items[editingItemIndex]}
          symbol={symbol}
          onClose={() => setEditingItemIndex(null)}
          onSave={handleSaveExtras}
        />
      )}

      {/* Modal Rápido de Cliente */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <UserPlus size={16} className="text-indigo-600" /> Crear Cliente Rápido
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickCustomerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={quickCustomerForm.first_name}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, first_name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Apellido</label>
                  <input
                    type="text"
                    value={quickCustomerForm.last_name}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, last_name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Cédula / NIT / Documento</label>
                <input
                  type="text"
                  value={quickCustomerForm.document_number}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, document_number: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={quickCustomerForm.phone}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Correo</label>
                  <input
                    type="email"
                    value={quickCustomerForm.email}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Dirección</label>
                <input
                  type="text"
                  value={quickCustomerForm.address}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, address: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickCustomerModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
