import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, Search, Plus, Minus, X, ShoppingCart, ChevronRight, Check, CheckCircle2, Trash2, Package, Tag, CreditCard, ScanLine, Printer } from 'lucide-react';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl, parseError, formatCurrency } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';
import { sendNativeNotification, triggerHaptic, playSuccessSound } from '../lib/notifications';
import { SkeletonGrid } from '../components/SkeletonLoader';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import WebScannerModal from '../components/WebScannerModal';
import { saveSaleOffline, getOfflineSales, syncOfflineSales } from '../lib/offlineQueue';
import { printTicket } from '../lib/printDispatcher';

const formatWithSettings = (n, settings) => {
  const symbol = settings?.currency_symbol || '$';
  const decimals = parseInt(settings?.currency_decimals || '0', 10);
  return formatCurrency(n, symbol, decimals);
};

export default function POS({ auth }) {
  const fmt = (n) => formatWithSettings(n, auth.settings);

  function buildImgUrl(path) {
    if (!path) return null;
    if (path.startsWith('data:')) return path;
    if (path.startsWith('http')) return path;
    const base = auth.apiUrl.replace('/api/', '').replace(/\/$/, '');
    return `${base}/${path.startsWith('/') ? path.slice(1) : path}`;
  }

  const [products, setProducts]   = useState([]);
  const [methods, setMethods]     = useState([]);
  const [cart, setCart]           = useState(() => {
    try {
      const saved = localStorage.getItem('pos_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [query, setQuery]         = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading]     = useState(true);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [errMsg, setErrMsg]       = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [interestPercent, setInterestPercent] = useState('');
  
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerDoc, setCustomerDoc] = useState('');

  // Dice promo states
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState(0);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [diceResult, setDiceResult] = useState(null);

  const [offlinePending, setOfflinePending] = useState(0);

  useEffect(() => { 
    fetchData(); 
    setOfflinePending(getOfflineSales().length);
    const syncInt = setInterval(async () => {
      const pending = getOfflineSales().length;
      setOfflinePending(pending);
      if (pending > 0 && navigator.onLine) {
        const synced = await syncOfflineSales(auth, apiRequest, apiUrl);
        if (synced > 0) {
          setOfflinePending(getOfflineSales().length);
          Toast.fire({ icon: 'success', title: `Se sincronizaron ${synced} ventas pendientes.` });
        }
      }
    }, 10000);
    return () => clearInterval(syncInt);
  }, []);

  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  const [showWebScanner, setShowWebScanner] = useState(false);

  const processScannedCode = (code) => {
    const found = products.find(p => p.barcode === code || p.internal_code === code || p.sku === code);
    if (found) {
      if (found.has_inventory_control !== false && parseFloat(found.stock || 0) <= 0) {
        triggerHaptic('error');
        Toast.fire({ icon: 'error', title: `Agotado: ${found.name}` });
      } else {
        addToCart(found);
        triggerHaptic('success');
        playSuccessSound();
        Toast.fire({ icon: 'success', title: `Agregado: ${found.name}` });
      }
    } else {
      triggerHaptic('error');
      Toast.fire({ icon: 'error', title: `No registrado: ${code}` });
    }
  };

  const handleScan = async () => {
    if (!Capacitor.isNativePlatform()) {
      setShowWebScanner(true);
      return;
    }

    try {
      let check = await BarcodeScanner.checkPermissions();
      let granted = check.camera === 'granted';
      if (!granted) {
        const req = await BarcodeScanner.requestPermissions();
        granted = req.camera === 'granted' || req.camera === 'limited';
      }
      if (!granted) {
        DarkSwal.fire({ icon: 'warning', title: 'Permiso Denegado', text: 'Se requiere acceso a la cámara para escanear.' });
        return;
      }

      try {
        const isAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!isAvailable.available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      } catch (err) {}
      
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes && barcodes.length > 0) {
        const code = barcodes[0].rawValue || barcodes[0].displayValue;
        processScannedCode(code);
      }
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e);
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('user canceled')) {
        DarkSwal.fire({ icon: 'error', title: 'Error al escanear', text: 'Ocurrió un error abriendo la cámara.' });
      }
    }
  };

  async function fetchData() {
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        apiRequest(apiUrl(auth.apiUrl, 'inventory/products/?page_size=10000'), {}, auth.token),
        apiRequest(apiUrl(auth.apiUrl, 'sales/payment-methods/'), {}, auth.token),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setProducts(Array.isArray(d) ? d : d.results || []); }
      if (mRes.ok) {
        const d = await mRes.json();
        const methodsList = Array.isArray(d) ? d : d.results || [];
        const uniqueMethods = [];
        const seenNames = new Set();
        for (const m of methodsList) {
          const norm = m.name ? m.name.toLowerCase().trim() : '';
          if (norm && !seenNames.has(norm)) {
            seenNames.add(norm);
            uniqueMethods.push(m);
          }
        }
        setMethods(uniqueMethods);
        if (uniqueMethods.length > 0) {
          setSelectedMethod(uniqueMethods[0].id); // Auto-select first method (usually Cash/Efectivo)
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const addToCart = (p) => {
    if (p.has_inventory_control !== false && parseFloat(p.stock || 0) <= 0) {
      DarkSwal.fire({ icon: 'error', title: 'Producto Agotado', text: 'No hay unidades disponibles en el inventario.', confirmButtonText: 'Entendido' });
      triggerHaptic('error');
      return;
    }
    triggerHaptic('light');
    setCart(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) {
        if (p.has_inventory_control !== false && existing.quantity + 1 > parseFloat(p.stock || 0)) {
          DarkSwal.fire({ icon: 'warning', title: 'Stock Máximo', text: `Solo quedan ${p.stock} unidades de este producto.`, confirmButtonText: 'Entendido' });
          triggerHaptic('error');
          return prev;
        }
        Toast.fire({ icon: 'info', title: `+1 ${p.name}` });
        return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      const pr = parseFloat(p.price_sell || p.price || 0);
      Toast.fire({ icon: 'success', title: `Agregado: ${p.name}` });
      return [...prev, { product_id: p.id, product_name: p.name, price: pr, quantity: 1, stock: p.stock, has_inventory_control: p.has_inventory_control }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      const item = prev.find(i => i.product_id === id);
      if (!item) return prev;
      
      if (delta > 0 && item.has_inventory_control !== false && item.quantity + delta > parseFloat(item.stock || 0)) {
        DarkSwal.fire({ icon: 'warning', title: 'Stock Máximo', text: `Solo quedan ${item.stock} unidades disponibles.`, confirmButtonText: 'Entendido' });
        triggerHaptic('error');
        return prev;
      }
      
      return prev
        .map(i => i.product_id === id ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0);
    });
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = globalDiscountPercent > 0 ? Math.round(subtotal * (globalDiscountPercent / 100)) : 0;
  const total = subtotal - discount;
  const itemCount  = cart.reduce((s, i) => s + i.quantity, 0);

  // Dynamic unique categories from products
  const categories = [];
  const categoryIds = new Set();
  products.forEach(p => {
    if (p.category && !categoryIds.has(p.category)) {
      categoryIds.add(p.category);
      categories.push({ id: p.category, name: p.category_name || 'Sin Categoría' });
    }
  });

  const filtered = products.filter(p => {
    const matchesQuery = p.name?.toLowerCase().includes(query.toLowerCase()) || p.sku?.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = selectedCategory === '' || String(p.category) === String(selectedCategory);
    return matchesQuery && matchesCategory;
  });

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
        DarkSwal.fire({
          title: '¡Promoción de Dados! 🎲',
          html: `¡Sacaste un <b>${finalResult}</b>!<br/><br/>Se ha aplicado un <b>${finalResult}%</b> de descuento a toda la compra.`,
          icon: 'success',
          confirmButtonText: '¡Genial!'
        });
      }
    }, 100);
  };

  async function confirmCheckout() {
    if (!selectedMethod) { setErrMsg('Selecciona un método de pago.'); return; }
    
    // Check if it is a credit sale
    const selMethodObj = methods.find(m => m.id === selectedMethod);
    const selMethodName = (selMethodObj?.name || '').toLowerCase();
    const isCredit = selMethodName.includes('crédit') || selMethodName.includes('credit') || selMethodName.includes('fiar');
    
    if (isCredit) {
      if (!customerName.trim() || (!customerEmail.trim() && !customerDoc.trim())) {
        setErrMsg('Para ventas a crédito, se requiere ingresar el Nombre y (Correo o Documento) del cliente.');
        DarkSwal.fire({
          icon: 'warning',
          title: 'Cliente Requerido',
          text: 'Las ventas a crédito (financiadas) deben asociarse obligatoriamente a un cliente. Rellena los datos de cliente al final del formulario.',
          confirmButtonText: 'Entendido'
        });
        return;
      }
    }

    const result = await DarkSwal.fire({
      title: '¿Imprimir Recibo?',
      text: '¿Deseas que la computadora principal imprima el recibo de esta venta?',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Sí, Imprimir',
      denyButtonText: 'No imprimir',
      cancelButtonText: 'Cancelar Venta',
      confirmButtonColor: '#22c55e',
      denyButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
      await processCheckout(true);
    } else if (result.isDenied) {
      await processCheckout(false);
    }
  }

  async function processCheckout(printOnPC) {
    setSaving(true);
    setErrMsg('');
    try {
      const selectedMethodObj = methods.find(m => m.id === selectedMethod) || { name: '' };
      let referenceText = selectedMethodObj.name !== 'Efectivo' ? `Pago con ${selectedMethodObj.name}` : '';
      if (!printOnPC) {
        referenceText = referenceText ? `${referenceText} [NO_PRINT]` : '[NO_PRINT]';
      }

      const isCredit = selectedMethodObj.name.toLowerCase().includes('credit') || selectedMethodObj.name.toLowerCase().includes('crédit') || selectedMethodObj.name.toLowerCase().includes('fiar');
      const received = parseFloat(cashReceived) || 0;
      const pct = isCredit ? (parseFloat(interestPercent) || 0) : 0;
      const interestAmt = total * (pct / 100);
      const finalTotal = total + interestAmt;
      
      let paymentsPayload = [];
      if (isCredit) {
        const creditAmount = finalTotal - received;
        if (received > 0) {
          const cashMethod = methods.find(m => m.name.toLowerCase().includes('efectivo')) || { id: selectedMethod };
          paymentsPayload.push({
            payment_method: cashMethod.id,
            amount: received,
            reference: 'Abono inicial en efectivo'
          });
        }
        if (creditAmount > 0) {
          paymentsPayload.push({
            payment_method: selectedMethod,
            amount: creditAmount,
            reference: referenceText
          });
        }
        if (paymentsPayload.length === 0) {
          paymentsPayload.push({
            payment_method: selectedMethod,
            amount: 0,
            reference: referenceText
          });
        }
      } else {
        paymentsPayload.push({
          payment_method: selectedMethod,
          amount: total,
          reference: referenceText
        });
      }

      const saleBody = {
        status: 'COMPLETED',
        promo_percent: globalDiscountPercent || 0,
        customer_name_input: customerName,
        customer_email_input: customerEmail,
        customer_doc_input: customerDoc,
        interest_percent: pct,
        interest_amount: interestAmt,
        details: cart.map(i => {
          let extraDiscount = 0;
          if (globalDiscountPercent > 0) {
            extraDiscount = (i.price * i.quantity) * (globalDiscountPercent / 100);
          }
          return {
            product: i.product_id,
            quantity: i.quantity,
            unit_price: i.price,
            discount: Math.round(extraDiscount * 100) / 100
          };
        }),
        payments: paymentsPayload,
      };
      const res = await apiRequest(apiUrl(auth.apiUrl, 'sales/sales/'), {
        method: 'POST',
        body: JSON.stringify(saleBody),
      }, auth.token);

      if (res.ok) {
        const resData = await res.json().catch(() => ({}));
        triggerHaptic('success');
        playSuccessSound(); 
        
        setCart([]);
        setGlobalDiscountPercent(0);
        setDiceResult(null);
        setCashReceived('');
        setCustomerName('');
        setCustomerEmail('');
        setCustomerDoc('');
        setShowCartModal(false);
        if (methods.length > 0) {
          setSelectedMethod(methods[0].id);
        }

        // Fetch latest inventory to avoid stale stock issues
        fetchData();

        sendNativeNotification({
          title: '🎉 Venta Registrada',
          body: `Factura ${resData?.invoice_number || 'procesada'} por ${fmt(total)}.`
        });
        // Auto-print immediately if running on Sunmi (instant & silent)
        if (Capacitor.getPlatform() === 'android' && window.sunmiInnerPrinter) {
          printTicket(resData, auth.settings, auth.settings?.ticket_logo, { apiUrl: auth.apiUrl });
        }

        DarkSwal.fire({
          icon: 'success',
          title: '¡Venta Exitosa!',
          text: `Factura ${resData?.invoice_number || 'procesada'} por ${fmt(total)}`,
          showCancelButton: true,
          confirmButtonText: '🖨️ Imprimir Ticket',
          cancelButtonText: 'Cerrar'
        }).then((result) => {
          if (result.isConfirmed) {
            printTicket(resData, auth.settings, auth.settings?.ticket_logo, { apiUrl: auth.apiUrl });
          }
        });
      } else {
        const errorText = await parseError(res);
        setErrMsg(errorText);
        DarkSwal.fire({
          icon: 'error',
          title: 'Error al registrar la venta',
          text: errorText || 'Por favor intente nuevamente.',
          confirmButtonText: 'Aceptar'
        });
      }
    } catch (err) {
      if (!navigator.onLine || err.message.includes('network') || err.message.includes('fetch')) {
        const saved = saveSaleOffline(saleBody, total);
        if (saved) {
          setOfflinePending(getOfflineSales().length);
          triggerHaptic('success');
          setSuccess(true);
          
          // Deduct stock locally so we don't oversell while offline
          setProducts(prev => prev.map(p => {
            const cartItem = cart.find(c => c.product_id === p.id);
            if (cartItem) return { ...p, stock: parseFloat(p.stock) - cartItem.quantity };
            return p;
          }));

          setCart([]);
          setGlobalDiscountPercent(0);
          setDiceResult(null);
          setCashReceived('');
          setCustomerName('');
          setCustomerEmail('');
          setCustomerDoc('');
          setShowCartModal(false);
          if (methods.length > 0) setSelectedMethod(methods[0].id);
          
          setTimeout(() => {
            setSuccess(false);
            DarkSwal.fire({
              icon: 'info',
              title: 'Guardado Offline',
              text: 'No tienes conexión a internet. La venta se guardó localmente y se sincronizará automáticamente.',
              confirmButtonText: 'Entendido'
            });
          }, 1500);
        } else {
          setErrMsg('Error al guardar venta offline.');
        }
      } else {
        setErrMsg('Error de red. Intenta de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-container fade-in-up">
      <TopBar
        title="Punto de Venta"
        subtitle={
          offlinePending > 0 
            ? <span style={{ color: '#ef4444', fontWeight: 800 }}>{offlinePending} venta(s) pendiente(s)</span> 
            : (itemCount > 0 ? `${itemCount} producto${itemCount > 1 ? 's' : ''} listo${itemCount > 1 ? 's' : ''}` : 'Registra tus ventas')
        }
        rightAction={
          cart.length > 0 && (
            <button
              onClick={() => { setShowCartModal(true); setErrMsg(''); }}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
            >
              <ShoppingCart size={22} color="#f97316" />
              <span style={{
                position: 'absolute', top: -2, right: -2,
                background: '#ef4444', color: 'white',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: 9, fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 5px rgba(239,68,68,0.3)'
              }}>
                {itemCount}
              </span>
            </button>
          )
        }
      />

      <div className="page-content" style={{ padding: '12px 16px 0' }}>
        {/* Search */}
        <div className="search-bar" style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
          <Search size={16} color="#64748b" />
          <input placeholder="Buscar producto, SKU o código..." value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', color: '#f1f5f9', outline: 'none' }} />
          {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={14} color="#64748b" /></button>}
          <button onClick={handleScan} style={{ background: '#f97316', border: 'none', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 4 }}>
            <ScanLine size={16} color="white" />
          </button>
        </div>

        {/* Dynamic Category Tabs (iOS 18 Liquid Segmented Pills) */}
        {products.length > 0 && (
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 8px', marginBottom: 14,
            scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
            background: 'rgba(16, 20, 32, 0.65)', borderRadius: 99,
            border: '1px solid rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(16px)'
          }}>
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              style={{
                padding: '7px 16px',
                borderRadius: 99,
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: selectedCategory === '' ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'transparent',
                color: selectedCategory === '' ? '#ffffff' : '#94a3b8',
                border: 'none',
                boxShadow: selectedCategory === '' ? '0 4px 14px rgba(249,115,22,0.4)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              🏷️ Todos
            </button>
            {categories.map(cat => {
              const isSel = String(selectedCategory) === String(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 99,
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: isSel ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'transparent',
                    color: isSel ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    boxShadow: isSel ? '0 4px 14px rgba(249,115,22,0.4)' : 'none',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  📦 {cat.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <SkeletonGrid count={6} height={140} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 32, color: '#64748b' }}>
                <Package size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                <p style={{ fontSize: 14 }}>Sin productos en esta categoría</p>
              </div>
            )}
            {filtered.map(p => {
              const inCart = cart.find(i => i.product_id === p.id);
              const stockNum = Math.round(parseFloat(p.stock ?? 0));
              const isLowStock = stockNum <= 5 && stockNum > 0;
              const isOut = stockNum <= 0;
              const imgUrl = p.image ? (p.image.startsWith('http') ? p.image : `${auth.apiUrl.replace('/api/', '').replace(/\/$/, '')}/${p.image.startsWith('/') ? p.image.slice(1) : p.image}`) : null;
              
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  style={{
                    background: inCart ? 'rgba(249, 115, 22, 0.15)' : 'linear-gradient(145deg, rgba(20, 24, 36, 0.85) 0%, rgba(30, 36, 53, 0.6) 100%)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: inCart ? '1.5px solid #f97316' : (isOut ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'),
                    borderRadius: 20,
                    padding: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 125,
                    position: 'relative',
                    boxShadow: inCart ? '0 8px 24px rgba(249, 115, 22, 0.3)' : '0 6px 20px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255,255,255,0.08)',
                    transform: inCart ? 'scale(1.02)' : 'none',
                    overflow: 'hidden'
                  }}
                >
                  {/* Image Thumb if present */}
                  {imgUrl && (
                    <div style={{
                      width: '100%',
                      height: 60,
                      borderRadius: 12,
                      overflow: 'hidden',
                      marginBottom: 8,
                      background: '#12151c',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <img src={imgUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}

                  {/* Floating quantity counter badge */}
                  {inCart && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f97316, #ea580c)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 10px rgba(249, 115, 22, 0.6)',
                      zIndex: 10
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: 'white' }}>{inCart.quantity}</span>
                    </div>
                  )}

                  <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', lineHeight: 1.3, paddingRight: inCart ? 24 : 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.name}
                  </span>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', marginTop: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 15, fontWeight: 950, color: '#22c55e' }}>
                        {fmt(p.price_sell || p.price || 0)}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 10, fontWeight: 800,
                        color: isOut ? '#ef4444' : (isLowStock ? '#f59e0b' : '#64748b'), marginTop: 2
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: isOut ? '#ef4444' : (isLowStock ? '#f59e0b' : '#22c55e'),
                          boxShadow: `0 0 8px ${isOut ? '#ef4444' : (isLowStock ? '#f59e0b' : '#22c55e')}`
                        }} />
                        Stock: {stockNum}
                      </span>
                    </div>
                    
                    <div style={{ 
                      width: 26, height: 26, borderRadius: 10, 
                      background: inCart ? '#f97316' : 'rgba(255,255,255,0.06)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${inCart ? '#f97316' : 'rgba(255,255,255,0.1)'}`
                    }}>
                      <Plus size={14} color={inCart ? '#ffffff' : '#94a3b8'} />
                    </div>
                  </div>
                </button>
              );
            })}
            
            {filtered.length > 20 && (
              <div style={{
                gridColumn: '1/-1',
                textAlign: 'center',
                padding: '16px 12px',
                background: '#141824',
                borderRadius: 14,
                border: '1px dashed #252d42',
                color: '#64748b',
                fontSize: 11,
                fontWeight: 700,
                marginTop: 10
              }}>
                Mostrando los primeros 20 resultados de {filtered.length}. Usa el buscador para encontrar otros productos.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Cart Bar (Teleported to document.body for fixed viewport anchoring) */}
      {cart.length > 0 && !showCartModal && createPortal(
        <div style={{
          position: 'fixed',
          bottom: 'calc(74px + env(safe-area-inset-bottom, 10px))',
          left: 16,
          right: 16,
          zIndex: 150, // Floating cleanly above bottom navigation bar
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
          borderRadius: 18,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 10px 32px rgba(249,115,22,0.5), 0 4px 12px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          cursor: 'pointer',
        }} onClick={() => { setShowCartModal(true); setErrMsg(''); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.2)', width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={18} color="white" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: 'white' }}>Ver Compra</p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>{itemCount} artículo{itemCount > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 950, color: 'white', marginRight: 4 }}>{fmt(total)}</span>
            <ChevronRight size={18} color="white" />
          </div>
        </div>,
        document.body
      )}

      {/* Slide-Up Cart Bottom Sheet (iOS 26 Liquid Glass) */}
      {showCartModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 200, background: 'rgba(3, 5, 10, 0.75)', backdropFilter: 'blur(20px)' }} onClick={e => e.target === e.currentTarget && setShowCartModal(false)}>
          <div className="modal-sheet" style={{
            height: '90vh',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: '12px 18px 0',
            overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.98) 0%, rgba(10, 14, 24, 0.99) 100%)',
            backdropFilter: 'blur(35px) saturate(190%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderTop: '2px solid rgba(249, 115, 22, 0.4)',
            boxShadow: '0 -16px 50px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.15)'
          }}>
            {/* Liquid Glass Top Handle */}
            <div style={{
              width: 38,
              height: 5,
              borderRadius: 99,
              background: 'rgba(255, 255, 255, 0.25)',
              margin: '0 auto 10px',
              flexShrink: 0
            }} />

            {/* Pinned Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0, paddingBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>Detalle de Compra</h2>
                <p style={{ fontSize: 11, color: '#f97316', margin: '2px 0 0', fontWeight: 700 }}>{itemCount} artículo{itemCount > 1 ? 's' : ''} en el carrito</p>
              </div>
              <button 
                onClick={() => setShowCartModal(false)} 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.08)', 
                  border: '1px solid rgba(255, 255, 255, 0.12)', 
                  borderRadius: '50%', 
                  width: 36, 
                  height: 36, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                <X size={18} color="#ffffff" />
              </button>
            </div>

            {/* Scrollable Entire Body (Cart items + Totals + Payment Methods + QR + Checkout Button) */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2, paddingBottom: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Cart products list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cart.map(item => (
                  <div key={item.product_id} style={{
                    background: 'linear-gradient(135deg, rgba(26, 32, 48, 0.7) 0%, rgba(16, 20, 32, 0.8) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 18,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.product_name}
                      </p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0', fontWeight: 600 }}>{fmt(item.price)} c/u</p>
                    </div>
                    
                    {/* Quantity adjusters */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      flexShrink: 0,
                      background: 'rgba(8, 11, 20, 0.7)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      padding: 3
                    }}>
                      <button 
                        onClick={() => updateQty(item.product_id, -1)} 
                        style={{ 
                          width: 28, height: 28, borderRadius: 8, 
                          background: 'rgba(255,255,255,0.08)', 
                          border: 'none', cursor: 'pointer', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center' 
                        }}
                      >
                        <Minus size={13} color="#ffffff" />
                      </button>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                      <button 
                        onClick={() => updateQty(item.product_id, 1)} 
                        style={{ 
                          width: 28, height: 28, borderRadius: 8, 
                          background: '#f97316', 
                          border: 'none', cursor: 'pointer', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(249,115,22,0.4)'
                        }}
                      >
                        <Plus size={13} color="#ffffff" />
                      </button>
                    </div>

                    <span style={{ fontSize: 14, fontWeight: 950, color: '#22c55e', minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
                      {fmt(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Clear Cart Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => { setCart([]); setShowCartModal(false); }} 
                  style={{ 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                    borderRadius: 99,
                    padding: '6px 14px',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    color: '#ef4444', 
                    fontSize: 11, 
                    fontWeight: 800, 
                    cursor: 'pointer' 
                  }}
                >
                  <Trash2 size={12} color="#ef4444" /> Vaciar Carrito
                </button>
              </div>

              {/* Gamified Dice Game Throw Button */}
              {auth.settings?.dice_promo_enabled === 'true' && globalDiscountPercent === 0 && (
                <button
                  type="button"
                  onClick={handleRollDice}
                  disabled={isRollingDice}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontWeight: 950,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {isRollingDice ? (
                    <span className="spinner" style={{ width: 16, height: 16, border: '2px solid #ffffff', borderTopColor: 'transparent', margin: 0 }} />
                  ) : (
                    <span style={{ fontSize: 16 }}>🎲</span>
                  )}
                  {isRollingDice ? `Lanzando... ${diceResult || ''}` : 'Lanzar Dados de Promoción'}
                </button>
              )}

              {/* Totals Block - Liquid Glass Hero Total Banner */}
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(16, 20, 32, 0.9) 0%, rgba(8, 11, 20, 0.95) 100%)', 
                borderRadius: 20, 
                padding: '16px 18px', 
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 8px 28px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)'
              }}>
                {globalDiscountPercent > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>Subtotal</span>
                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>{fmt(subtotal)}</span>
                  </div>
                )}
                {globalDiscountPercent > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 800 }}>Descuento Dados ({globalDiscountPercent}%)</span>
                    <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 900 }}>-{fmt(discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#64748b', fontWeight: 900, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>TOTAL A COBRAR</span>
                    <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 600, marginTop: 2 }}>Impuestos incluidos</span>
                  </div>
                  <span style={{ color: '#22c55e', fontWeight: 950, fontSize: 24, letterSpacing: '-0.03em' }}>{fmt(total)}</span>
                </div>
              </div>

              {/* Payment Method Selector Grid (iOS 26 Liquid Segmented Tabs) */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 900, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 2px' }}>MÉTODO DE PAGO</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {methods.map(m => {
                    const isSel = selectedMethod === m.id;
                    const isTransfer = m.name.toLowerCase().includes('transfer') || m.name.toLowerCase().includes('nequi');
                    const isCash = m.name.toLowerCase().includes('efectivo');

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.id)}
                        style={{
                          background: isSel 
                            ? (isTransfer ? 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.1))' : isCash ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.1))' : 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(139,92,246,0.1))') 
                            : 'rgba(16, 20, 32, 0.7)',
                          border: `2px solid ${isSel ? (isTransfer ? '#f97316' : isCash ? '#22c55e' : '#8b5cf6') : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 16,
                          padding: '12px 6px',
                          color: isSel ? '#ffffff' : '#94a3b8',
                          fontWeight: 800,
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: isSel ? '0 6px 20px rgba(0,0,0,0.4)' : 'none',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        <span style={{ fontSize: 20 }}>
                          {isCash ? '💵' : isTransfer ? '📲' : '💳'}
                        </span>
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calculator: Cash received & Change OR Credit Abono */}
              {(() => {
                const selMethodObj = methods.find(m => m.id === selectedMethod);
                const isCash = (selMethodObj?.name || '').toLowerCase().includes('efectivo');
                const isCredit = (selMethodObj?.name || '').toLowerCase().includes('credit') || (selMethodObj?.name || '').toLowerCase().includes('crédit') || (selMethodObj?.name || '').toLowerCase().includes('fiar');
                
                if (!isCash && !isCredit) return null;

                const received = parseFloat(cashReceived) || 0;
                
                if (isCredit) {
                  const pct = parseFloat(interestPercent) || 0;
                  const surcharge = total * (pct / 100);
                  const finalTotal = total + surcharge;
                  const pending = finalTotal - received;
                  
                  return (
                    <div style={{
                      background: 'rgba(20, 26, 40, 0.7)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: 18,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                    }}>
                      {/* Surcharge input */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 900, color: '#c084fc', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          📈 Recargo por Financiación (%)
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            className="input-field"
                            type="number"
                            placeholder="Ej: 10 (O vacío si es 0%)"
                            value={interestPercent}
                            onChange={e => setInterestPercent(e.target.value)}
                            style={{ fontSize: 15, fontWeight: 800, background: '#090c14', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', boxSizing: 'border-box', width: '100%', padding: '10px 14px' }}
                          />
                        </div>
                      </div>

                      {surcharge > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(139, 92, 246, 0.1)', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#c084fc' }}>INTERÉS ADICIONAL:</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: '#c084fc' }}>+{fmt(surcharge)} ({pct}%)</span>
                        </div>
                      )}

                      {/* Abono input */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 900, color: '#a855f7', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          💵 Abono Inicial (Monto Recibido)
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 18, fontWeight: 900 }}>$</span>
                          <input
                            className="input-field"
                            type="text"
                            inputMode="numeric"
                            placeholder="Ej: 10.000 (O vacío si es 0)"
                            value={cashReceived ? formatCurrency(cashReceived, '', 0).trim() : ''}
                            onChange={e => {
                              const raw = e.target.value.replace(/\D/g, '');
                              setCashReceived(raw);
                            }}
                            style={{ paddingLeft: 32, fontSize: 17, fontWeight: 800, background: '#090c14', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090c14', padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>TOTAL FINANCIADO:</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>{fmt(finalTotal)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090c14', padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8' }}>DEUDA RESTANTE:</span>
                        <span style={{ fontSize: 18, fontWeight: 950, color: pending >= 0 ? '#f97316' : '#ef4444' }}>
                          {pending >= 0 ? fmt(pending) : 'El abono excede el total'}
                        </span>
                      </div>
                    </div>
                  );
                }

                const change = received - total;
                return (
                  <div style={{
                    background: 'rgba(20, 26, 40, 0.7)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 18,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                  }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 900, color: '#22c55e', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        💵 Monto Recibido (Efectivo)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 18, fontWeight: 900 }}>$</span>
                        <input
                          className="input-field"
                          type="text"
                          inputMode="numeric"
                          placeholder="Ej: 50.000"
                          value={cashReceived ? formatCurrency(cashReceived, '', 0).trim() : ''}
                          onChange={e => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setCashReceived(raw);
                          }}
                          style={{ paddingLeft: 32, fontSize: 17, fontWeight: 800, background: '#090c14', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </div>
                    </div>

                    {cashReceived !== '' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#090c14', padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>CAMBIO A ENTREGAR:</span>
                        <span style={{ fontSize: 18, fontWeight: 950, color: change >= 0 ? '#22c55e' : '#ef4444' }}>
                          {change >= 0 ? fmt(change) : 'Falta dinero'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Holographic QR Code Portal for Transfer Payments */}
              {(() => {
                const selMethodName = (methods.find(m => m.id === selectedMethod)?.name || '').toLowerCase();
                const isTransfer = (selMethodName.includes('transfer') || selMethodName.includes('nequi') || selMethodName.includes('daviplata') || selMethodName.includes('qr') || selMethodName.includes('banco')) && !selMethodName.includes('credit') && !selMethodName.includes('crédit') && !selMethodName.includes('fiar');
                if (!isTransfer) return null;

                return (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(18, 24, 38, 0.8) 100%)',
                    border: '2px solid rgba(249,115,22,0.4)',
                    borderRadius: 22,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 12px 32px rgba(249,115,22,0.15)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(249,115,22,0.15)', padding: '6px 14px', borderRadius: 99, border: '1px solid rgba(249,115,22,0.3)' }}>
                      <span style={{ fontSize: 16 }}>📱</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        ESCANEA PARA PAGAR POR TRANSFERENCIA
                      </span>
                    </div>

                    {auth.settings?.transfer_qr ? (
                      <div style={{
                        width: 210,
                        height: 210,
                        borderRadius: 20,
                        background: '#ffffff',
                        padding: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                        border: '4px solid #f97316'
                      }}>
                        <img
                          src={buildImgUrl(auth.settings.transfer_qr)}
                          alt="QR Transferencia"
                          style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 10 }}
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, color: '#64748b', fontSize: 12 }}>
                        (No se ha cargado la imagen del QR en Ajustes del Sistema)
                      </div>
                    )}

                    {auth.settings?.transfer_info && (
                      <p style={{ 
                        fontSize: 13, 
                        color: '#ffffff', 
                        margin: 0, 
                        textAlign: 'center', 
                        fontWeight: 800, 
                        background: 'rgba(8, 11, 20, 0.9)', 
                        padding: '10px 16px', 
                        borderRadius: 14, 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        width: '100%',
                        letterSpacing: '0.02em'
                      }}>
                        {auth.settings.transfer_info}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Informational Panel for Credit Payments */}
              {(() => {
                const selMethodName = (methods.find(m => m.id === selectedMethod)?.name || '').toLowerCase();
                const isCredit = selMethodName.includes('crédit') || selMethodName.includes('credit') || selMethodName.includes('fiar');
                if (!isCredit) return null;

                return (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(18, 24, 38, 0.85) 100%)',
                    border: '2px solid rgba(139,92,246,0.4)',
                    borderRadius: 22,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    boxShadow: '0 12px 32px rgba(139,92,246,0.15)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(139,92,246,0.2)', padding: '6px 14px', borderRadius: 99, border: '1px solid rgba(139,92,246,0.3)', width: 'fit-content' }}>
                      <span style={{ fontSize: 16 }}>💳</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Venta a Crédito Interno
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.45 }}>
                      Esta venta se guardará como saldo pendiente (deuda) para el cliente ingresado. Asegúrate de rellenar los <b>Datos del Cliente</b> abajo.
                    </p>
                  </div>
                );
              })()}

              {/* Customer Details Block */}
              <div style={{
                background: 'rgba(20, 26, 40, 0.7)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 18,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
              }}>
                <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Datos del Cliente (Opcional)</p>
                
                <input
                  type="text"
                  placeholder="Nombre del Cliente"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 13, background: '#090c14', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box' }}
                />
                <input
                  type="email"
                  placeholder="Correo Electrónico (Para recibo)"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 13, background: '#090c14', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  placeholder="Documento / NIT"
                  value={customerDoc}
                  onChange={e => setCustomerDoc(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', fontSize: 13, background: '#090c14', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box' }}
                />
              </div>

              {/* Error display */}
              {errMsg && (
                <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14, padding: '10px 14px', fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                  {errMsg}
                </div>
              )}

              {/* Prominently Positioned Giant Liquid Glass Checkout Action Button */}
              <button
                className="btn-primary"
                onClick={confirmCheckout}
                disabled={saving || !selectedMethod}
                style={{
                  height: 54,
                  borderRadius: 18,
                  fontSize: 16,
                  fontWeight: 950,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  marginTop: 8,
                  marginBottom: 16,
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  boxShadow: '0 12px 32px rgba(249, 115, 22, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  letterSpacing: '-0.01em'
                }}
              >
                {saving ? (
                  <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Procesando Venta...</>
                ) : (() => {
                  const selMethodObj = methods.find(m => m.id === selectedMethod);
                  const isCredit = selMethodObj ? (selMethodObj.name.toLowerCase().includes('credit') || selMethodObj.name.toLowerCase().includes('crédit') || selMethodObj.name.toLowerCase().includes('fiar')) : false;
                  const pct = isCredit ? (parseFloat(interestPercent) || 0) : 0;
                  const finalTotal = total + (total * (pct / 100));
                  return (
                    <><Check size={20} /> Finalizar Venta ({fmt(finalTotal)})</>
                  );
                })()}
              </button>

            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Web Scanner Modal (Safari on iOS & Web Browsers) */}
      <WebScannerModal
        isOpen={showWebScanner}
        onClose={() => setShowWebScanner(false)}
        onScanSuccess={(code) => {
          processScannedCode(code);
        }}
      />
    </div>
  );
}
