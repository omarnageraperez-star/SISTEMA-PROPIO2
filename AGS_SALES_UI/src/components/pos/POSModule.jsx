import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, Minus, UserPlus, CreditCard, CheckCircle, Printer, Dices } from 'lucide-react';
import Swal from 'sweetalert2';
import { apiRequest } from '../../lib/api';
import { printTicket, generateTicketHTML } from '../../lib/print';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  customClass: {
    popup: 'premium-swal-toast',
    title: 'text-sm font-bold text-slate-800',
    htmlContainer: 'text-xs text-slate-500'
  }
});

export default function POSModule({ config, token, currentBillingMode, warehouseId, systemSettings, appState }) {
  const decimals = parseInt(systemSettings?.currency_decimals ?? '2', 10);
  const symbol = systemSettings?.currency_symbol || '$';

  const formatPrice = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState(() => {
    try { const saved = localStorage.getItem('ags_pos_cart'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [parkedSales, setParkedSales] = useState(() => {
    try { const saved = localStorage.getItem('ags_pos_parked'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    return localStorage.getItem('ags_pos_customer') || '';
  });
  
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    first_name: '', last_name: '', document_number: '', email: '', phone: ''
  });
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editCustomerForm, setEditCustomerForm] = useState({
    id: null, first_name: '', last_name: '', document_number: '', email: '', phone: ''
  });
  const [warehouse, setWarehouse] = useState(null);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const searchInputRef = useRef(null);

  // Completed Sale State
  const [completedSale, setCompletedSale] = useState(null);

  // Dice Promo State
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState(0);
  const [diceResult, setDiceResult] = useState(null);

  // Payment Selection States
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');
  const [changeDue, setChangeDue] = useState(0);
  const [interestPercent, setInterestPercent] = useState('');

  // Calculations (moved to prevent Temporal Dead Zone ReferenceError)
  const calcTotals = () => {
    let subtotal = 0;
    let tax = 0;
    
    cart.forEach(item => {
      const itemSub = (item.quantity * item.unit_price) - item.discount;
      const taxRate = parseFloat(item.product.tax_percent || 0);
      const itemTax = (itemSub * taxRate) / 100;
      
      subtotal += itemSub;
      tax += itemTax;
    });
    
    let total = subtotal + tax;
    let globalDiscount = 0;
    
    if (globalDiscountPercent > 0) {
      globalDiscount = total * (globalDiscountPercent / 100);
      total -= globalDiscount;
    }
    
    return { subtotal, tax, globalDiscount, total };
  };

  const totals = calcTotals();

  useEffect(() => {
    // Initial focus on search input
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    
    // Auto-sync offline sales on mount
    syncOfflineSales();
    
    // Auto-sync offline sales when browser goes online
    const handleOnline = () => {
      syncOfflineSales();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (appState === 'DASHBOARD') {
      fetchProducts();
      fetchCategories();
      fetchCustomers();
      fetchWarehouse();
      fetchPaymentMethods();
    }
  }, [appState]);

  // Adjust amountReceived depending on whether the method is Credit
  useEffect(() => {
    const activePaymentMethods = paymentMethods.length > 0 ? paymentMethods : [
      {id: 1, name: 'Efectivo'},
      {id: 2, name: 'Tarjeta'},
      {id: 3, name: 'Transferencia'}
    ];
    const selectedMethodObj = activePaymentMethods.find(m => String(m.id) === String(selectedPaymentMethod));
    if (selectedMethodObj) {
      const isCredit = selectedMethodObj.name.toLowerCase().includes('credit') || selectedMethodObj.name.toLowerCase().includes('crédit') || selectedMethodObj.name.toLowerCase().includes('fiar');
      if (isCredit) {
        setAmountReceived('0');
      } else {
        const roundedTotal = Math.round(totals.total);
        setAmountReceived(roundedTotal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
      }
    }
  }, [selectedPaymentMethod, totals.total, paymentMethods]);

  // Auto-Save Cart and Parked Sales to LocalStorage
  useEffect(() => {
    if (cart.length === 0) {
      setGlobalDiscountPercent(0);
      setDiceResult(null);
    }
    localStorage.setItem('ags_pos_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('ags_pos_parked', JSON.stringify(parkedSales));
  }, [parkedSales]);

  useEffect(() => {
    localStorage.setItem('ags_pos_customer', selectedCustomer || '');
  }, [selectedCustomer]);

  const fetchPaymentMethods = async () => {
    try {
      const res = await apiRequest(`${config.apiUrl}sales/payment-methods/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data || [];
        setPaymentMethods(list);
        if (list.length > 0) {
          const defaultMethod = list.find(m => m.name.toLowerCase().includes('efectivo')) || list[0];
          setSelectedPaymentMethod(defaultMethod.id);
        }
      } else {
        // Fallback offline payment methods
        const fallback = [
          { id: 1, name: 'Efectivo' },
          { id: 2, name: 'Tarjeta' },
          { id: 3, name: 'Transferencia' }
        ];
        setPaymentMethods(fallback);
        setSelectedPaymentMethod(fallback[0].id);
      }
    } catch (e) {
      const fallback = [
        { id: 1, name: 'Efectivo' },
        { id: 2, name: 'Tarjeta' },
        { id: 3, name: 'Transferencia' }
      ];
      setPaymentMethods(fallback);
      setSelectedPaymentMethod(fallback[0].id);
    }
  };

  const syncOfflineSales = async () => {
    const offlineSales = JSON.parse(localStorage.getItem('ags_offline_sales') || '[]');
    if (offlineSales.length === 0) return;

    const remainingSales = [];
    let syncedCount = 0;

    for (const sale of offlineSales) {
      try {
        // Clean temporary metadata before sending to server
        const { offline_timestamp, offline_id, ...cleanSale } = sale;
        const res = await apiRequest(`${config.apiUrl}sales/sales/`, {
          method: 'POST',
          body: JSON.stringify(cleanSale)
        }, token);
        if (res.ok) {
          syncedCount++;
        } else {
          remainingSales.push(sale);
        }
      } catch (e) {
        remainingSales.push(sale);
      }
    }

    localStorage.setItem('ags_offline_sales', JSON.stringify(remainingSales));
    if (syncedCount > 0) {
      Toast.fire({ 
        icon: 'success', 
        title: `Sincronización exitosa`, 
        text: `Se subieron ${syncedCount} ventas locales al servidor.` 
      });
      fetchProducts(); // Refresh stock
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiRequest(`${config.apiUrl}inventory/categories/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.results || data || []);
      }
    } catch (e) {
      console.error("Error fetching categories:", e);
    }
  };

  const fetchWarehouse = async () => {
    try {
      const res = await apiRequest(`${config.apiUrl}inventory/warehouses/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        const list = data.results || data || [];
        if (list.length > 0) {
          setWarehouse(list[0]);
        }
      }
    } catch (e) {
      console.error("Error fetching warehouse:", e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await apiRequest(`${config.apiUrl}inventory/products/?page_size=10000`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await apiRequest(`${config.apiUrl}crm/customers/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest(`${config.apiUrl}crm/customers/`, {
        method: 'POST',
        body: JSON.stringify(newCustomerForm)
      }, token);
      if (res.ok) {
        const newC = await res.json();
        setCustomers(prev => [...prev, newC]);
        setSelectedCustomer(newC.id);
        setShowAddCustomer(false);
        setNewCustomerForm({ first_name: '', last_name: '', document_number: '', email: '', phone: '' });
        setSuccessMsg('Cliente creado con éxito');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        let msg = 'Error al crear cliente';
        if (errData) {
          if (typeof errData === 'string') msg = errData;
          else if (errData.detail) msg = errData.detail;
          else {
            const firstKey = Object.keys(errData)[0];
            if (firstKey) {
              const val = errData[firstKey];
              msg = `${firstKey}: ${Array.isArray(val) ? val.join(', ') : val}`;
            }
          }
        }
        setErrorMsg(msg);
        setTimeout(() => setErrorMsg(''), 5000);
      }
    } catch (e) {
      setErrorMsg('Error de red');
    }
    setLoading(false);
  };

  const handleOpenEditCustomer = () => {
    const c = customers.find(c => String(c.id) === String(selectedCustomer));
    if (!c) return;
    const isGeneric = (c.first_name && c.first_name.toLowerCase().includes('consumidor') && c.last_name && c.last_name.toLowerCase().includes('final')) ||
                      c.document_number === '222222222222' ||
                      (c.first_name && c.first_name.toLowerCase() === 'consumidor final') ||
                      (c.first_name && c.first_name.toLowerCase() === 'consumidor' && c.last_name && c.last_name.toLowerCase() === 'final');
    if (isGeneric) {
      Toast.fire({ icon: 'warning', title: 'El Consumidor Final principal no se puede editar' });
      return;
    }
    setEditCustomerForm({
      id: c.id,
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      document_number: c.document_number || '',
      email: c.email || '',
      phone: c.phone || ''
    });
    setShowEditCustomer(true);
  };

  const handleEditCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest(`${config.apiUrl}crm/customers/${editCustomerForm.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(editCustomerForm)
      }, token);
      if (res.ok) {
        const updated = await res.json();
        setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
        setShowEditCustomer(false);
        Toast.fire({ icon: 'success', title: 'Cliente actualizado correctamente' });
      } else {
        Toast.fire({ icon: 'error', title: 'Error al actualizar cliente' });
      }
    } catch (e) {
      Toast.fire({ icon: 'error', title: 'Error de red' });
    }
    setLoading(false);
  };

  const handleDeleteCustomer = async () => {
    const c = customers.find(c => String(c.id) === String(selectedCustomer));
    if (!c) return;
    const isGeneric = (c.first_name && c.first_name.toLowerCase().includes('consumidor') && c.last_name && c.last_name.toLowerCase().includes('final')) ||
                      c.document_number === '222222222222' ||
                      (c.first_name && c.first_name.toLowerCase() === 'consumidor final') ||
                      (c.first_name && c.first_name.toLowerCase() === 'consumidor' && c.last_name && c.last_name.toLowerCase() === 'final');
    if (isGeneric) {
      Toast.fire({ icon: 'warning', title: 'El Consumidor Final principal no se puede eliminar' });
      return;
    }
    const confirm = await Swal.fire({
      title: `¿Eliminar a ${c.first_name} ${c.last_name}?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: { confirmButton: 'bg-red-600 text-white px-4 py-2 rounded-lg font-bold' },
      buttonsStyling: false
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await apiRequest(`${config.apiUrl}crm/customers/${c.id}/`, {
        method: 'DELETE'
      }, token);
      if (res.ok || res.status === 204) {
        setCustomers(prev => prev.filter(cu => cu.id !== c.id));
        setSelectedCustomer('');
        Toast.fire({ icon: 'success', title: 'Cliente eliminado' });
      } else {
        Toast.fire({ icon: 'error', title: 'Error al eliminar cliente' });
      }
    } catch (e) {
      Toast.fire({ icon: 'error', title: 'Error de red' });
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim() !== '') {
      // Barcode Scanner Mode: Exact match for barcode or internal_code
      const term = searchTerm.trim().toLowerCase();
      const match = products.find(p => 
        (p.barcode && p.barcode.toLowerCase() === term) || 
        (p.internal_code && p.internal_code.toLowerCase() === term)
      );
      
      if (match) {
        addToCart(match);
        setSearchTerm('');
      } else {
        // Just leave the search term for manual grid filtering
      }
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        // Cannot add more than stock if we want strict control
        if (product.has_inventory_control && parseFloat(existing.quantity) + 1 > parseFloat(product.stock)) {
          Toast.fire({ icon: 'warning', title: 'No hay suficiente stock disponible' });
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      if (product.has_inventory_control && parseFloat(product.stock) < 1) {
        Toast.fire({ icon: 'error', title: 'Producto sin existencias' });
        return prev;
      }

      return [...prev, {
        product: product,
        quantity: 1,
        unit_price: parseFloat(product.price_sell || 0),
        discount: 0
      }];
    });
  };

  const updateQuantity = (index, delta) => {
    setCart(prev => {
      const newCart = [...prev];
      const item = newCart[index];
      const newQty = item.quantity + delta;
      
      if (newQty < 1) return prev; // Cannot go below 1
      if (item.product.has_inventory_control && newQty > parseFloat(item.product.stock)) {
        Toast.fire({ icon: 'warning', title: 'Supera el stock disponible' });
        return prev;
      }
      
      item.quantity = newQty;
      return newCart;
    });
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };



  const handleRollDice = () => {
    setIsRollingDice(true);
    let counter = 0;
    
    const interval = setInterval(() => {
      setDiceResult(Math.floor(Math.random() * 6) + 1);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        const finalResult = Math.floor(Math.random() * 6) + 1;
        setDiceResult(finalResult);
        setIsRollingDice(false);
        setGlobalDiscountPercent(finalResult);
        Swal.fire({
          title: `¡Sacaste un ${finalResult}! 🎲`,
          text: `Se aplicará un ${finalResult}% de descuento a toda la compra.`,
          icon: 'success',
          confirmButtonText: '¡Genial!',
          customClass: {
            popup: 'premium-swal',
            confirmButton: 'premium-swal-confirm bg-yellow-500 hover:bg-yellow-600 text-white border-0'
          }
        });
      }
    }, 100);
  };

  // Park & Restore Sales
  const parkSale = () => {
    if (cart.length === 0) return;
    const parked = {
      id: Date.now(),
      cart: [...cart],
      selectedCustomer,
      timestamp: new Date()
    };
    setParkedSales(prev => [...prev, parked]);
    setCart([]);
    setSelectedCustomer('');
    Toast.fire({ icon: 'info', title: 'Venta puesta en espera' });
  };

  const restoreSale = (parkedId) => {
    const parked = parkedSales.find(p => p.id === parkedId);
    if (!parked) return;
    
    // If current cart has items, park them first
    if (cart.length > 0) {
      parkSale();
    }
    
    setCart(parked.cart);
    setSelectedCustomer(parked.selectedCustomer);
    setParkedSales(prev => prev.filter(p => p.id !== parkedId));
    Toast.fire({ icon: 'success', title: 'Venta recuperada' });
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F4 or F12: Checkout
      if (e.key === 'F12' || e.key === 'F4') {
        e.preventDefault();
        handleCheckout();
      }
      // F8: Clear Cart
      if (e.key === 'F8') {
        e.preventDefault();
        setCart([]);
        setSelectedCustomer('');
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowPaymentModal(false);
        setShowAddCustomer(false);
        setCompletedSale(null);
      }
      // F2 or Ctrl+F: Focus search input
      if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F'))) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCustomer, currentBillingMode, warehouse, totals, paymentMethods, selectedPaymentMethod]);

  const handleCheckout = () => {
    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    if (currentBillingMode === 'ELECTRONIC' && !selectedCustomer) {
      setErrorMsg('Debe seleccionar un cliente para Factura Electrónica');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const roundedTotal = Math.round(totals.total);
    setAmountReceived(roundedTotal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."));
    setChangeDue(0);
    setShowPaymentModal(true);
  };

  const handleAmountReceivedChange = (e) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, '');
    if (digits === '') {
      setAmountReceived('');
    } else {
      const num = parseInt(digits, 10);
      const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      setAmountReceived(formatted);
    }
  };

  useEffect(() => {
    const cleanReceived = parseFloat(String(amountReceived || '').replace(/\./g, '') || 0);
    const difference = cleanReceived - Math.round(totals.total);
    setChangeDue(difference > 0 ? difference : 0);
  }, [amountReceived, totals.total]);

  const submitSale = async () => {
    setLoading(true);
    setErrorMsg('');
    
    const detailsData = cart.map(item => {
      const itemSub = (item.quantity * item.unit_price) - item.discount;
      let extraDiscount = 0;
      if (globalDiscountPercent > 0) {
        extraDiscount = itemSub * (globalDiscountPercent / 100);
      }
      return {
        product: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: Math.round((item.discount + extraDiscount) * 100) / 100
      };
    });

    const activePaymentMethods = paymentMethods.length > 0 ? paymentMethods : [
      {id: 1, name: 'Efectivo'},
      {id: 2, name: 'Tarjeta'},
      {id: 3, name: 'Transferencia'}
    ];
    const selectedMethodObj = activePaymentMethods.find(m => String(m.id) === String(selectedPaymentMethod)) || { name: 'Efectivo', id: selectedPaymentMethod };

    const isCredit = selectedMethodObj.name.toLowerCase().includes('credit') || selectedMethodObj.name.toLowerCase().includes('crédit') || selectedMethodObj.name.toLowerCase().includes('fiar');
    const cleanReceived = parseFloat(String(amountReceived || '').replace(/\./g, '') || 0);
    const pct = isCredit ? (parseFloat(interestPercent) || 0) : 0;
    const interestAmt = totals.total * (pct / 100);
    const finalTotal = totals.total + interestAmt;

    let paymentsPayload = [];
    if (isCredit) {
      const creditAmount = finalTotal - cleanReceived;
      if (cleanReceived > 0) {
        const cashMethod = activePaymentMethods.find(m => m.name.toLowerCase().includes('efectivo')) || { id: selectedPaymentMethod };
        paymentsPayload.push({
          payment_method: cashMethod.id,
          amount: cleanReceived,
          reference: 'Abono inicial en efectivo'
        });
      }
      if (creditAmount > 0) {
        paymentsPayload.push({
          payment_method: selectedPaymentMethod,
          amount: creditAmount,
          reference: selectedMethodObj.name !== 'Efectivo' ? `Pago con ${selectedMethodObj.name}` : ''
        });
      }
      if (paymentsPayload.length === 0) {
        paymentsPayload.push({
          payment_method: selectedPaymentMethod,
          amount: 0,
          reference: selectedMethodObj.name !== 'Efectivo' ? `Pago con ${selectedMethodObj.name}` : ''
        });
      }
    } else {
      paymentsPayload.push({
        payment_method: selectedPaymentMethod,
        amount: totals.total,
        reference: selectedMethodObj.name !== 'Efectivo' ? `Pago con ${selectedMethodObj.name}` : ''
      });
    }

    const payload = {
      customer: selectedCustomer || null,
      warehouse: warehouse ? warehouse.id : null,
      invoice_type: currentBillingMode,
      status: 'COMPLETED',
      dian_status: currentBillingMode === 'ELECTRONIC' ? 'PENDING' : 'NONE',
      promo_percent: globalDiscountPercent || 0,
      interest_percent: pct,
      interest_amount: interestAmt,
      details: detailsData,
      payments: paymentsPayload
    };

    try {
      const res = await apiRequest(`${config.apiUrl}sales/sales/`, {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);

      if (res.ok) {
        const createdSale = await res.json();
        window.lastLocalSaleId = createdSale.id; // Mark as local to avoid auto-print duplicate
        Toast.fire({ icon: 'success', title: 'Venta procesada exitosamente' });
        
        setCart([]);
        setGlobalDiscountPercent(0);
        setDiceResult(null);
        setAmountReceived('');
        setInterestPercent('');
        setShowPaymentModal(false);
        fetchProducts(); // Refresh stock
        
        // Mostrar modal personalizado con la tirilla
        setCompletedSale(createdSale);
      } else {
        const errData = await res.json();
        setErrorMsg('Error al procesar la venta: ' + JSON.stringify(errData));
      }
    } catch (e) {
      console.warn("Falla de red, guardando venta en local", e);
      // Offline queue saving
      const offlineQueue = JSON.parse(localStorage.getItem('ags_offline_sales') || '[]');
      const offlineSale = {
        ...payload,
        offline_timestamp: new Date().toISOString(),
        offline_id: 'OFFLINE-' + Math.floor(Math.random() * 1000000)
      };
      offlineQueue.push(offlineSale);
      localStorage.setItem('ags_offline_sales', JSON.stringify(offlineQueue));

      Toast.fire({ 
        icon: 'warning', 
        title: 'Venta guardada localmente (Sin conexión)',
        text: 'Se sincronizará automáticamente cuando se restablezca la red.'
      });

      setCart([]);
      setSelectedCustomer('');
      setShowPaymentModal(false);
      
      // Deduct locally to reflect in UI instantly
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(item => item.product.id === p.id);
        if (cartItem) {
          return { ...p, stock: String(parseFloat(p.stock) - cartItem.quantity) };
        }
        return p;
      }));
    }
    setLoading(false);
  };

  const normalizeText = (text) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  const filteredProducts = products.filter(p => {
    if (!p.is_active) return false;
    const normalizedSearch = normalizeText(searchTerm);
    const matchesSearch = normalizedSearch === '' || 
      normalizeText(p.name).includes(normalizedSearch) || 
      (p.barcode && normalizeText(p.barcode).includes(normalizedSearch));
    
    const matchesCategory = selectedCategory === '' || String(p.category) === String(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  const selectedCustomerObj = Array.isArray(customers) ? customers.find(c => String(c.id) === String(selectedCustomer)) : null;
  const isGenericConsumerSelected = selectedCustomerObj && (
    (selectedCustomerObj.first_name && selectedCustomerObj.first_name.toLowerCase().includes('consumidor') && selectedCustomerObj.last_name && selectedCustomerObj.last_name.toLowerCase().includes('final')) ||
    selectedCustomerObj.document_number === '222222222222' ||
    (selectedCustomerObj.first_name && selectedCustomerObj.first_name.toLowerCase() === 'consumidor final') ||
    (selectedCustomerObj.first_name && selectedCustomerObj.first_name.toLowerCase() === 'consumidor' && selectedCustomerObj.last_name && selectedCustomerObj.last_name.toLowerCase() === 'final')
  );

  return (
    <div className="flex flex-1 h-full gap-4 relative overflow-hidden animate-in fade-in duration-300">
      
      {/* Messages */}
      {(successMsg || errorMsg) && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50 mt-4 flex flex-col gap-2">
          {successMsg && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
              <CheckCircle size={18}/> {typeof successMsg === 'object' ? (successMsg.message || JSON.stringify(successMsg)) : String(successMsg)}
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
              {typeof errorMsg === 'object' ? (errorMsg.message || errorMsg.error || JSON.stringify(errorMsg)) : String(errorMsg)}
            </div>
          )}
        </div>
      )}

      {/* LEFT PANE: Catalog */}
      <div className="flex-[2] flex flex-col gap-4 h-full overflow-hidden">
        {/* Search & Categories */}
        <div className="glass-panel p-4 rounded-2xl shadow-sm flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Buscar producto por nombre o escanear código de barras (Enter para agregar)..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          {/* Categories Tab Row */}
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                selectedCategory === '' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
                  String(selectedCategory) === String(cat.id)
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* Grid */}
        <div className="flex-1 glass-panel rounded-2xl shadow-sm p-4 overflow-y-auto">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProducts.map(p => (
              <div 
                key={p.id} 
                onClick={() => addToCart(p)}
                className="bg-white/70 border border-gray-100 rounded-xl p-3 cursor-pointer hover:shadow-xl transition-all transform hover:scale-105 hover:-translate-y-1 flex flex-col backdrop-blur-sm"
              >
                <div className="h-24 bg-gray-50 rounded-lg mb-2 flex items-center justify-center text-gray-300 overflow-hidden relative">
                    {p.image ? (
                      <img 
                        src={p.image.startsWith('http') 
                          ? p.image 
                          : `${config.apiUrl.replace('/api/', '')}${p.image.startsWith('/') ? '' : '/'}${p.image.startsWith('media/') ? p.image : p.image.startsWith('products/') ? 'media/' + p.image : 'media/products/' + p.image}`} 
                        alt={p.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <ShoppingCart size={32} />
                    )}
                   {p.has_inventory_control && parseFloat(p.stock) < 1 && (
                     <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                       <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">Agotado</span>
                     </div>
                   )}
                </div>
                <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 leading-tight flex-1">{p.name}</h3>
                <div className="mt-2 flex justify-between items-end">
                  <span className="text-gray-500 text-xs">{p.stock} unid.</span>
                  <span className="font-bold text-blue-600">{formatPrice(p.price_sell)}</span>
                </div>
              </div>
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
              <ShoppingCart size={40} className="text-gray-300" />
              <span>No se encontraron productos.</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Cart & Checkout */}
      <div className="flex-1 min-w-[350px] max-w-[450px] flex flex-col gap-4 h-full overflow-hidden">
        
        {/* Customer Selection */}
        <div className="glass-panel p-4 rounded-2xl shadow-sm flex items-center gap-2">
          <select 
            className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          >
            <option value="">Consumidor Final</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.document_number ? `(${c.document_number})` : ''}</option>
            ))}
          </select>
          <button 
            onClick={() => { setShowAddCustomer(true); }}
            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
            title="Nuevo Cliente"
          >
            <UserPlus size={20} />
          </button>
          {selectedCustomer && !isGenericConsumerSelected && (
            <>
              <button
                onClick={handleOpenEditCustomer}
                className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                title="Editar Cliente"
              >
                ✏️
              </button>
              <button
                onClick={handleDeleteCustomer}
                className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                title="Eliminar Cliente"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 glass-panel rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-gray-100 flex justify-between items-center relative">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <ShoppingCart size={18} /> Carrito 
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">{cart.length}</span>
            </h2>
            
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <>
                  <button 
                    onClick={() => {
                      Swal.fire({
                        title: '¿Vaciar Carrito?',
                        text: 'Se eliminarán todos los productos agregados al carrito actual.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Sí, Vaciar',
                        cancelButtonText: 'Cancelar',
                        customClass: {
                          popup: 'premium-swal',
                          title: 'premium-swal-title',
                          confirmButton: 'premium-swal-confirm bg-red-600 hover:bg-red-700',
                          cancelButton: 'premium-swal-cancel'
                        },
                        buttonsStyling: false
                      }).then((result) => {
                        if (result.isConfirmed) {
                          setCart([]);
                        }
                      });
                    }}
                    className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-200 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Vaciar
                  </button>
                  <button 
                    onClick={parkSale}
                    className="text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors border border-amber-200"
                  >
                    Pausar Venta
                  </button>
                </>
              )}
              {parkedSales.length > 0 && (
                <div className="relative group">
                  <button className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 flex items-center gap-1">
                    Recuperar <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{parkedSales.length}</span>
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 hidden group-hover:block z-50 overflow-hidden">
                    <div className="bg-slate-50 text-xs font-bold text-slate-500 px-3 py-2 border-b border-slate-200">Ventas en espera</div>
                    <div className="max-h-48 overflow-y-auto">
                      {parkedSales.map(ps => (
                        <div key={ps.id} className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => restoreSale(ps.id)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-700 text-sm">{ps.cart.length} items</span>
                            <span className="text-xs text-slate-400">{new Date(ps.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-xs text-blue-600 font-bold">
                            Total: {formatPrice(ps.cart.reduce((sum, item) => sum + (item.quantity * item.unit_price) - item.discount, 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                <ShoppingCart size={48} className="mb-2" />
                <p>El carrito está vacío</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="bg-white/70 p-3 rounded-xl mb-2 border border-gray-100 shadow-sm flex items-center gap-3 transition-colors duration-150 hover:bg-white/90">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 text-sm leading-tight">{item.product.name}</h4>
                    <p className="text-gray-500 text-xs">{formatPrice(item.unit_price)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-gray-200">
                    <button onClick={() => updateQuantity(idx, -1)} className="p-1 hover:bg-white rounded text-gray-600"><Minus size={14}/></button>
                    <span className="font-medium text-sm w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(idx, 1)} className="p-1 hover:bg-white rounded text-gray-600"><Plus size={14}/></button>
                  </div>
                  <div className="font-bold text-gray-800">
                    {formatPrice(item.quantity * item.unit_price)}
                  </div>
                  <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Totals & Checkout */}
        <div className="glass-panel p-5 rounded-2xl shadow-sm bg-white totals-checkout-panel">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-gray-500 text-sm">
              <span>Subtotal</span>
              <span>{formatPrice(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-sm">
              <span>Impuestos (Variable)</span>
              <span>{formatPrice(totals.tax)}</span>
            </div>
            {totals.globalDiscount > 0 && (
              <div className="flex justify-between text-emerald-500 font-bold text-sm">
                <span>Descuento Dados ({globalDiscountPercent}%)</span>
                <span>-{formatPrice(totals.globalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-800 font-bold text-xl pt-2 border-t border-gray-200 mt-2">
              <span>Total</span>
              <span className={currentBillingMode === 'ELECTRONIC' ? 'text-green-600' : 'text-blue-600'}>
                {formatPrice(totals.total)}
              </span>
            </div>
          </div>
          
          {systemSettings?.dice_promo_enabled === 'true' && cart.length > 0 && globalDiscountPercent === 0 && (
            <button
              onClick={handleRollDice}
              disabled={isRollingDice}
              className="w-full py-3 mb-3 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-black flex items-center justify-center gap-2 transition-transform hover:scale-105 shadow-md border-2 border-yellow-500"
            >
              {isRollingDice ? (
                <span className="w-5 h-5 border-2 border-yellow-900 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span className="text-xl">🎲</span>
              )}
              {isRollingDice ? 'Lanzando Dados...' : 'Lanzar Dados de Promoción'}
            </button>
          )}

          <button 
            id="btn-checkout-pos"
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md ${
              currentBillingMode === 'ELECTRONIC' 
                ? 'bg-emerald-600 hover:bg-emerald-700' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            } ${(loading || cart.length === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-1 hover:shadow-lg'}`}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <CreditCard size={24} />
            )}
            Cobrar {currentBillingMode === 'ELECTRONIC' ? 'Factura E.' : 'POS'} <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-md">F4</span>
          </button>
        </div>

      </div>

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-4 border-b flex justify-between items-center bg-white/70 backdrop-blur-md border-b shrink-0">
              <h2 className="font-bold text-gray-800">Nuevo Cliente</h2>
              <button onClick={() => setShowAddCustomer(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                  <input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500" value={newCustomerForm.first_name} onChange={e => setNewCustomerForm({...newCustomerForm, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apellido</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500" value={newCustomerForm.last_name} onChange={e => setNewCustomerForm({...newCustomerForm, last_name: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cédula / NIT</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500" value={newCustomerForm.document_number} onChange={e => setNewCustomerForm({...newCustomerForm, document_number: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email (para enviar factura)</label>
                <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500" value={newCustomerForm.email} onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500" value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})} />
              </div>
              <button disabled={loading} type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center">
                {loading ? 'Guardando...' : 'Crear Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-4 border-b flex justify-between items-center bg-amber-50 shrink-0">
              <h2 className="font-bold text-amber-800">✏️ Editar Cliente</h2>
              <button onClick={() => setShowEditCustomer(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <form onSubmit={handleEditCustomer} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                  <input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500" value={editCustomerForm.first_name} onChange={e => setEditCustomerForm({...editCustomerForm, first_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apellido</label>
                  <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500" value={editCustomerForm.last_name} onChange={e => setEditCustomerForm({...editCustomerForm, last_name: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cédula / NIT</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500" value={editCustomerForm.document_number} onChange={e => setEditCustomerForm({...editCustomerForm, document_number: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email (para enviar factura)</label>
                <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500" value={editCustomerForm.email} onChange={e => setEditCustomerForm({...editCustomerForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500" value={editCustomerForm.phone} onChange={e => setEditCustomerForm({...editCustomerForm, phone: e.target.value})} />
              </div>
              <button disabled={loading} type="submit" className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors flex justify-center">
                {loading ? 'Guardando...' : '✏️ Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payment Selection Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 flex justify-between items-center border-b border-gray-100 shrink-0">
              <h2 className="font-bold text-black text-xl flex items-center gap-3">
                <CreditCard className="text-black" size={24} /> Procesar Cobro
              </h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-black text-2xl font-light transition-colors">×</button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                {/* Large Total display */}
                <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-100 text-center flex flex-col items-center">
                  {totals.globalDiscount > 0 && (
                    <div className="mb-3 w-full flex flex-col items-center gap-1 border-b border-gray-200 pb-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Valor Original</span>
                      <span className="text-lg font-bold text-gray-400 line-through">{formatPrice(totals.subtotal + totals.tax)}</span>
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest mt-2">Descuento Dados ({globalDiscountPercent}%)</span>
                      <span className="text-lg font-bold text-emerald-500">-{formatPrice(totals.globalDiscount)}</span>
                    </div>
                  )}
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total a Pagar</span>
                  <div className="text-4xl font-black text-black mt-2">{formatPrice(totals.total)}</div>
                </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-sm font-bold text-black mb-3">Método de Pago</label>
                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const defaultMethods = [
                      {id: 1, name: 'Efectivo'},
                      {id: 2, name: 'Tarjeta'},
                      {id: 3, name: 'Transferencia'}
                    ];
                    const activePaymentMethods = paymentMethods.length > 0 ? paymentMethods : defaultMethods;
                    return activePaymentMethods.map(method => {
                      const isSelected = String(selectedPaymentMethod) === String(method.id);
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSelectedPaymentMethod(method.id)}
                          className={`py-4 px-2 rounded-xl text-sm font-bold transition-all border flex flex-col items-center gap-2 ${
                            isSelected 
                              ? 'bg-black border-black text-white shadow-md transform scale-[1.02]'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-black hover:text-black'
                          }`}
                        >
                          {method.name}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Cash OR Credit Calculation */}
              {(() => {
                const defaultMethods = [
                  {id: 1, name: 'Efectivo'},
                  {id: 2, name: 'Tarjeta'},
                  {id: 3, name: 'Transferencia'}
                ];
                const activePaymentMethods = paymentMethods.length > 0 ? paymentMethods : defaultMethods;
                const methodObj = activePaymentMethods.find(m => String(m.id) === String(selectedPaymentMethod));
                
                const isCash = methodObj ? methodObj.name.toLowerCase().includes('efectivo') : true;
                const isCredit = methodObj ? (methodObj.name.toLowerCase().includes('credit') || methodObj.name.toLowerCase().includes('crédit') || methodObj.name.toLowerCase().includes('fiar')) : false;

                if (!isCash && !isCredit) return null;

                if (isCredit) {
                  const pct = parseFloat(interestPercent) || 0;
                  const surcharge = totals.total * (pct / 100);
                  const finalTotal = totals.total + surcharge;
                  const cleanReceived = parseFloat(String(amountReceived || '').replace(/\./g, '') || 0);
                  const pending = finalTotal - cleanReceived;
                  
                  return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Surcharge percentage */}
                      <div>
                        <label className="block text-sm font-bold text-black mb-2">Recargo por Financiación (%)</label>
                        <input
                          type="number"
                          placeholder="Ej: 10 (O vacío si es 0%)"
                          className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-black focus:ring-1 focus:ring-black font-sans text-md font-semibold text-black transition-all"
                          value={interestPercent}
                          onChange={e => setInterestPercent(e.target.value)}
                        />
                      </div>

                      {surcharge > 0 && (
                        <div className="flex justify-between items-center p-3 bg-purple-55/10 rounded-xl border border-purple-200 text-purple-700">
                          <span className="text-xs font-bold uppercase tracking-wider">Interés Adicional:</span>
                          <span className="font-bold text-sm">+{formatPrice(surcharge)} ({pct}%)</span>
                        </div>
                      )}

                      {/* Abono input */}
                      <div>
                        <label className="block text-sm font-bold text-black mb-2">Abono Inicial (Monto Recibido)</label>
                        <div className="relative mt-1">
                          <span className="absolute left-4 top-3.5 text-gray-400 font-mono font-bold text-lg">{symbol}</span>
                          <input
                            type="text"
                            placeholder="Ej: 10000"
                            className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-3.5 outline-none focus:border-black focus:ring-1 focus:ring-black font-mono text-lg font-bold text-black transition-all"
                            value={amountReceived}
                            onChange={handleAmountReceivedChange}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <span className="text-sm font-bold text-gray-500">Total Financiado:</span>
                        <span className="font-mono font-bold text-black text-md">{formatPrice(finalTotal)}</span>
                      </div>

                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <span className="text-sm font-bold text-gray-650">Deuda Restante:</span>
                        <span className="font-mono font-black text-orange-600 text-xl">{formatPrice(pending >= 0 ? pending : 0)}</span>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div>
                      <label className="block text-sm font-bold text-black mb-2">Monto Recibido</label>
                      <div className="relative mt-1">
                        <span className="absolute left-4 top-3.5 text-gray-400 font-mono font-bold text-lg">{symbol}</span>
                        <input
                          type="text"
                          required
                          className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-3.5 outline-none focus:border-black focus:ring-1 focus:ring-black font-mono text-lg font-bold text-black transition-all"
                          value={amountReceived}
                          onChange={handleAmountReceivedChange}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-sm font-bold text-gray-650">Cambio (Vueltos):</span>
                      <span className="font-mono font-black text-black text-xl">{formatPrice(changeDue)}</span>
                    </div>
                  </div>
                );
              })()}

              {errorMsg && (
                <div className="text-sm font-semibold text-white bg-red-600 p-4 rounded-xl shadow-sm text-center">
                  {typeof errorMsg === 'object' ? (errorMsg.message || errorMsg.error || JSON.stringify(errorMsg)) : String(errorMsg)}
                </div>
              )}

              <button
                disabled={loading}
                onClick={submitSale}
                className="w-full py-4 mt-2 bg-black hover:bg-gray-900 text-white rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-[1.01] flex items-center justify-center gap-3"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <CheckCircle size={22} />
                )}
                Confirmar y Registrar Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale Modal */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-8 flex flex-col items-center bg-white border-b border-gray-100">
              <div className="w-20 h-20 bg-black text-white rounded-full flex items-center justify-center mb-5 shadow-lg">
                <CheckCircle size={40} />
              </div>
              <h2 className="text-3xl font-black text-black">¡Venta Registrada!</h2>
              <p className="text-gray-500 font-bold mt-2 tracking-wide uppercase text-sm">Factura: {completedSale.invoice_number || `TEMP-${completedSale.id}`}</p>
            </div>
            
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1 flex justify-center custom-scrollbar">
              <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden" style={{ width: '80mm', minHeight: '300px' }}>
                <iframe 
                  srcDoc={generateTicketHTML(completedSale, systemSettings, systemSettings?.ticket_logo, {})}
                  className="w-full h-full border-none"
                  style={{ minHeight: '350px' }}
                  title="Ticket Preview"
                />
              </div>
            </div>
            
            <div className="p-6 bg-white flex gap-4">
              <button 
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-4 px-4 bg-white border-2 border-black hover:bg-gray-50 text-black rounded-xl font-bold transition-all text-lg"
              >
                Nueva Venta
              </button>
              <button 
                onClick={() => {
                  printTicket(completedSale, systemSettings, systemSettings?.ticket_logo || config?.ticket_logo, { silent: true, printerName: config?.default_printer, apiUrl: config?.apiUrl });
                  setCompletedSale(null);
                }}
                className="flex-1 py-4 px-4 bg-black hover:bg-gray-900 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3 text-lg shadow-lg transform hover:scale-[1.02]"
              >
                <Printer size={22} /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
