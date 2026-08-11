import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Package, X, Camera as CameraIcon, Edit2, Trash2, AlertTriangle, Layers, DollarSign, BarChart2, Tag, Info, ScanLine, Globe, Share2, LayoutGrid, List, ChevronDown, ChevronUp, QrCode } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl, parseError } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';
import { SkeletonCard } from '../components/SkeletonLoader';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import WebScannerModal from '../components/WebScannerModal';
import { sileo } from 'sileo';
import { hasPermission } from '../lib/permissionsConfig';

const BASE_FIELDS = { name: '', sku: '', internal_code: '', price: '', cost: '', stock: '', category: '', description: '' };

const compressImage = (file, maxWidth = 800, maxHeight = 800) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name || 'photo.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.75);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const uploadFileToImgBB = async (file) => {
  try {
    const compressed = await compressImage(file);
    const body = new FormData();
    body.append('image', compressed);
    const res = await fetch('https://api.imgbb.com/1/upload?key=e15b92a922e0938b38eeea0b567cea75', {
      method: 'POST',
      body: body
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error en ImgBB: ${res.statusText} - ${errorText}`);
    }
    const json = await res.json();
    return json.data.url;
  } catch (error) {
    console.error("Error al subir archivo a ImgBB:", error);
    throw error;
  }
};

export default function Inventory({ auth }) {
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery]         = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null); // null = new
  const [form, setForm]           = useState(BASE_FIELDS);
  const [saving, setSaving]       = useState(false);
  const [errMsg, setErrMsg]       = useState('');
  const [imgPreview, setImgPreview] = useState(null);
  const [imgFile, setImgFile]     = useState(null);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);
  const [catErrMsg, setCatErrMsg] = useState('');
  const [showCatalogQR, setShowCatalogQR] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const isAdmin = hasPermission(auth.user, 'settings.user_management');
  const canEdit = hasPermission(auth.user, 'inventory.manage_products');

  useEffect(() => { fetchAll(); }, []);

  const [showWebScanner, setShowWebScanner] = useState(false);
  const [scanTargetField, setScanTargetField] = useState(null);

  const ensureCameraPermission = async () => {
    try {
      const check = await BarcodeScanner.checkPermissions();
      if (check.camera === 'granted') return true;
      const req = await BarcodeScanner.requestPermissions();
      return req.camera === 'granted' || req.camera === 'limited';
    } catch (e) {
      console.warn("Permission check error:", e);
      return false;
    }
  };

  const handleScan = async () => {
    if (!Capacitor.isNativePlatform()) {
      setScanTargetField('search');
      setShowWebScanner(true);
      return;
    }

    try {
      const hasPermission = await ensureCameraPermission();
      if (!hasPermission) {
        DarkSwal.fire({ icon: 'warning', title: 'Permiso Denegado', text: 'Se requiere acceso a la cámara para escanear.' });
        return;
      }

      try {
        const isAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!isAvailable.available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      } catch (err) {}

      const res = await BarcodeScanner.scan();
      if (res && res.barcodes && res.barcodes.length > 0) {
        const code = res.barcodes[0].rawValue || res.barcodes[0].displayValue;
        if (code) setQuery(code);
      }
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e);
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('user canceled')) {
        DarkSwal.fire({ icon: 'error', title: 'Error al escanear', text: 'Ocurrió un error abriendo la cámara. Verifica los permisos de la aplicación.' });
      }
    }
  };

  const handleScanForm = async (field) => {
    if (!Capacitor.isNativePlatform()) {
      setScanTargetField(field);
      setShowWebScanner(true);
      return;
    }

    try {
      const hasPermission = await ensureCameraPermission();
      if (!hasPermission) {
        DarkSwal.fire({ icon: 'warning', title: 'Permiso Denegado', text: 'Se requiere acceso a la cámara para escanear.' });
        return;
      }

      try {
        const isAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!isAvailable.available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      } catch (err) {}

      const res = await BarcodeScanner.scan();
      if (res && res.barcodes && res.barcodes.length > 0) {
        const code = res.barcodes[0].rawValue || res.barcodes[0].displayValue;
        if (code) setForm(prev => ({ ...prev, [field]: code }));
      }
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e);
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('user canceled')) {
        DarkSwal.fire({ icon: 'error', title: 'Error al escanear', text: 'Ocurrió un error abriendo la cámara. Verifica los permisos de la aplicación.' });
      }
    }
  };

  async function fetchAll() {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        apiRequest(apiUrl(auth.apiUrl, 'inventory/products/?page_size=10000'), {}, auth.token),
        apiRequest(apiUrl(auth.apiUrl, 'inventory/categories/'), {}, auth.token),
      ]);
      if (pRes.ok) {
        const d = await pRes.json();
        setProducts(Array.isArray(d) ? d : d.results || []);
      }
      if (cRes.ok) {
        const d = await cRes.json();
        setCategories(Array.isArray(d) ? d : d.results || []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCategory() {
    if (!newCatName.trim()) {
      setCatErrMsg('El nombre de la categoría es obligatorio.');
      return;
    }
    setSavingCat(true);
    setCatErrMsg('');
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'inventory/categories/'), {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim() }),
      }, auth.token);

      if (res.ok) {
        setNewCatName('');
        setShowCategoryModal(false);
        fetchAll();
      } else {
        const parsed = await parseError(res);
        setCatErrMsg(parsed || `Error ${res.status}: No se pudo guardar la categoría.`);
      }
    } catch (e) {
      setCatErrMsg(e?.message || 'Error de red al guardar categoría.');
    } finally {
      setSavingCat(false);
    }
  }

  const fmt = (n) => {
    const num = parseFloat(n) || 0;
    const symbol = auth.settings?.currency_symbol || '$';
    const decimals = parseInt(auth.settings?.currency_decimals || '0', 10);
    return `${symbol} ${num.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  function openNew() {
    setEditing(null);
    setForm(BASE_FIELDS);
    setImgPreview(null);
    setImgFile(null);
    setErrMsg('');
    setShowModal(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name || '',
      sku: p.sku || '',
      internal_code: p.internal_code || '',
      price: p.price_sell || p.price || '',
      cost: p.price_buy || p.cost || '',
      stock: p.stock ?? '',
      category: p.category || '',
      description: p.description || '',
    });
    setImgPreview(p.image ? buildImgUrl(p.image) : null);
    setImgFile(null);
    setErrMsg('');
    setShowModal(true);
  }

  function buildImgUrl(path) {
    if (!path) return null;
    if (path.startsWith('data:')) return path;
    if (path.startsWith('http')) return path;
    const base = auth.apiUrl.replace('/api/', '').replace(/\/$/, '');
    return `${base}/${path.startsWith('/') ? path.slice(1) : path}`;
  }

  const handleSelectImage = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        webUseInput: true // Enables browser-native image picker fallback (works in Safari, Brave, Chrome etc. over HTTP)
      });
      if (image.webPath) {
        setImgPreview(image.webPath);
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], `product_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setImgFile(file);
      }
    } catch (e) {
      console.warn("User cancelled or camera failed:", e);
    }
  };

  async function handleSave() {
    if (!form.name || !form.price) {
      setErrMsg('Nombre y precio de venta son obligatorios.');
      return;
    }
    setSaving(true);
    setErrMsg('');
    try {
      let imageUrl = editing ? editing.image : '';
      if (imgFile) {
        try {
          imageUrl = await uploadFileToImgBB(imgFile);
        } catch (uploadError) {
          setErrMsg('Error al subir la imagen del producto. Intenta de nuevo.');
          setSaving(false);
          return;
        }
      }

      const finalInternalCode = form.internal_code || 'PRD-' + Math.floor(100000 + Math.random() * 900000);
      const payload = {
        name: form.name,
        sku: form.sku || null,
        internal_code: finalInternalCode,
        price_sell: parseFloat(form.price || 0),
        price_buy: form.cost ? parseFloat(form.cost) : 0,
        stock: form.stock !== '' ? parseFloat(form.stock) : 0,
        category: form.category ? parseInt(form.category) : null,
        description: form.description || null,
        image: imageUrl || null,
      };

      const url = editing
        ? apiUrl(auth.apiUrl, `inventory/products/${editing.id}/`)
        : apiUrl(auth.apiUrl, 'inventory/products/');
      const method = editing ? 'PATCH' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload),
      }, auth.token);

      if (res.ok) {
        setShowModal(false);
        fetchAll();
      } else {
        setErrMsg(await parseError(res));
      }
    } catch {
      setErrMsg('Error de red. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p) {
    const confirmRes = await DarkSwal.fire({
      title: '¿Eliminar Producto?',
      html: `¿Estás seguro de eliminar <b>"${p.name}"</b> del inventario?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    });
    if (!confirmRes.isConfirmed) return;
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, `inventory/products/${p.id}/`), { method: 'DELETE' }, auth.token);
      if (res.ok) {
        sileo.success({ title: '¡Eliminado!', description: `El producto "${p.name}" fue eliminado.` });
        Toast.fire({ icon: 'success', title: 'Producto eliminado del inventario' });
        fetchAll();
      } else {
        const errorMsg = await parseError(res);
        sileo.error(errorMsg || 'No se pudo eliminar el producto.');
        DarkSwal.fire({
          icon: 'error',
          title: 'No se pudo eliminar',
          text: errorMsg || 'Este producto tiene ventas asociadas o no dispones de permisos suficientes para eliminarlo.'
        });
      }
    } catch (e) {
      console.error(e);
      sileo.error('Error de conexión al eliminar producto.');
      DarkSwal.fire('Error', 'Error de conexión con el servidor.', 'error');
    }
  }

  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'OUT' | 'LOW'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

  const filtered = products.filter(p => {
    const q = query.toLowerCase();
    const nameMatch = p.name ? p.name.toLowerCase().includes(q) : false;
    const skuMatch = p.sku ? p.sku.toLowerCase().includes(q) : false;
    const codeMatch = p.internal_code ? p.internal_code.toLowerCase().includes(q) : false;
    const matchesQuery = nameMatch || skuMatch || codeMatch;
    const matchesCategory = selectedCategory === '' || String(p.category) === String(selectedCategory);
    
    const stockNum = p.stock ?? 0;
    let matchesStock = true;
    if (stockFilter === 'OUT') matchesStock = stockNum <= 0;
    if (stockFilter === 'LOW') matchesStock = stockNum > 0 && stockNum <= 5;

    return matchesQuery && matchesCategory && matchesStock;
  });

  // Inventory Quick Metrics
  const totalProductsCount = products.length;
  const outOfStockCount = products.filter(p => (p.stock ?? 0) <= 0).length;
  const lowStockCount = products.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length;

  return (
    <div className="page-container">
      
      {/* 🌟 IOS PRODUCTOS TOP HEADER */}
      <div className="safe-top" style={{
        padding: '16px 20px 8px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(8, 10, 15, 0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
            Productos
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* iOS Segmented View Control */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#12151c',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 99,
              padding: 3,
            }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 99,
                  background: viewMode === 'list' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                  border: 'none',
                  color: viewMode === 'list' ? 'white' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s',
                  boxShadow: viewMode === 'list' ? '0 2px 8px rgba(37,99,235,0.4)' : 'none'
                }}
              >
                <List size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 99,
                  background: viewMode === 'grid' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                  border: 'none',
                  color: viewMode === 'grid' ? 'white' : '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s',
                  boxShadow: viewMode === 'grid' ? '0 2px 8px rgba(37,99,235,0.4)' : 'none'
                }}
              >
                <LayoutGrid size={15} />
              </button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#12151c',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 99,
              padding: '4px 6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              <button
                onClick={handleScan}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <ScanLine size={20} color="#3b82f6" />
              </button>
              <button
                onClick={() => setShowCatalogQR(true)}
                title="Catálogo Digital QR"
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <QrCode size={20} color="#f97316" />
              </button>
              {canEdit && (
                <button
                  onClick={openNew}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'transparent', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={22} color="#3b82f6" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search Bar Capsule */}
        <div style={{
          background: '#12151c',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 99,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}>
          <Search size={18} color="#8a94a6" />
          <input
            placeholder="Buscar productos..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#ffffff', outline: 'none', fontSize: 15, fontWeight: 500 }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <X size={16} color="#8a94a6" />
            </button>
          )}
        </div>
      </div>

      <div className="page-content" style={{ padding: '0 16px' }}>
        
        {/* Accordion / Foldable Filters header */}
        <div style={{
          background: 'rgba(20, 24, 38, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 18,
          marginBottom: 14,
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
        }}>
          <button
            type="button"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.02)',
              border: 'none',
              borderBottom: showFiltersPanel ? '1px solid rgba(255,255,255,0.06)' : 'none',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={16} color="#fbbf24" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
                Filtros & Categorías
              </span>
              <span style={{
                fontSize: 10,
                color: '#8a94a6',
                background: 'rgba(255,255,255,0.06)',
                padding: '2px 8px',
                borderRadius: 99,
                fontWeight: 700,
                marginLeft: 4
              }}>
                {selectedCategory ? (categories.find(c=>String(c.id)===String(selectedCategory))?.name || 'Categoría') : 'Todas'}
              </span>
            </div>
            {showFiltersPanel ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </button>

          {showFiltersPanel && (
            <div style={{ padding: 12 }}>
              {/* Quick Metrics Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                {/* Card 1: Total */}
                <div 
                  onClick={() => setStockFilter('ALL')}
                  style={{
                    background: stockFilter === 'ALL' ? '#1c212d' : '#12151c',
                    border: `1px solid ${stockFilter === 'ALL' ? '#3b82f6' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 12,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={12} color="#3b82f6" />
                    <span style={{ fontSize: 9, color: stockFilter === 'ALL' ? '#60a5fa' : '#8a94a6', fontWeight: 800 }}>TOTAL</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 950, color: '#ffffff' }}>{totalProductsCount}</span>
                </div>

                {/* Card 2: Out of Stock */}
                <div 
                  onClick={() => setStockFilter(stockFilter === 'OUT' ? 'ALL' : 'OUT')}
                  style={{
                    background: stockFilter === 'OUT' ? 'rgba(239, 68, 68, 0.15)' : '#12151c',
                    border: `1px solid ${stockFilter === 'OUT' ? '#ef4444' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 12,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={12} color="#ef4444" />
                    <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 800 }}>SIN STOCK</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 950, color: '#ef4444' }}>{outOfStockCount}</span>
                </div>

                {/* Card 3: Low Stock */}
                <div 
                  onClick={() => setStockFilter(stockFilter === 'LOW' ? 'ALL' : 'LOW')}
                  style={{
                    background: stockFilter === 'LOW' ? 'rgba(245, 158, 11, 0.15)' : '#12151c',
                    border: `1px solid ${stockFilter === 'LOW' ? '#f59e0b' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 12,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BarChart2 size={12} color="#f59e0b" />
                    <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 800 }}>BAJO STOCK</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 950, color: '#f59e0b' }}>{lowStockCount}</span>
                </div>
              </div>

              {/* Categories horizontal filter pills */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', alignItems: 'center' }}>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(true)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontWeight: 800,
                      fontSize: 10,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#60a5fa',
                      border: '1px dashed rgba(59, 130, 246, 0.4)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Plus size={10} /> Categoría
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontWeight: 700,
                    fontSize: 10,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: selectedCategory === '' ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#1e2435',
                    color: selectedCategory === '' ? 'white' : '#94a3b8',
                    border: `1px solid ${selectedCategory === '' ? 'transparent' : '#252d42'}`,
                    transition: 'all 0.2s'
                  }}
                >
                  🏷️ Todos ({products.length})
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontWeight: 700,
                      fontSize: 10,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      background: String(selectedCategory) === String(cat.id) ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#1e2435',
                      color: String(selectedCategory) === String(cat.id) ? 'white' : '#94a3b8',
                      border: `1px solid ${String(selectedCategory) === String(cat.id) ? 'transparent' : '#252d42'}`,
                      transition: 'all 0.2s'
                    }}
                  >
                    📦 {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Low Stock Warning Alert banner */}
        {lowStockCount > 0 && !query && !selectedCategory && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ background: '#ef4444', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={14} color="white" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fca5a5' }}>Atención con tu stock</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Tienes {lowStockCount + outOfStockCount} productos agotados o a punto de terminarse.</span>
            </div>
          </div>
        )}

        {/* Products List & Grid View */}
        {loading ? (
          <SkeletonCard count={5} height={84} />
        ) : (
          <div>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8a94a6' }}>
                <div style={{
                  width: 90, height: 90, borderRadius: 28, background: '#12151c',
                  border: '1px solid rgba(255,255,255,0.06)', margin: '0 auto 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Package size={48} color="#475569" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', margin: '0 0 8px' }}>
                  Sin productos
                </h3>
                <p style={{ fontSize: 13, color: '#8a94a6', margin: '0 auto 24px', maxWidth: 260, lineHeight: 1.4 }}>
                  Agrega tu primer producto para comenzar a gestionar tu inventario.
                </p>
                {canEdit && (
                  <button
                    onClick={openNew}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 99,
                      padding: '12px 24px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)'
                    }}
                  >
                    <Plus size={18} color="white" />
                    Agregar Producto
                  </button>
                )}
              </div>
            )}

            {/* 📱 VISTA DE LISTA ORGANIZADA ESTILO IOS */}
            {viewMode === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map(p => {
                  const stockNum = p.stock ?? 0;
                  const isLow = stockNum > 0 && stockNum <= 5;
                  const isOut = stockNum <= 0;
                  const imgUrl = buildImgUrl(p.image);
                  const catObj = categories.find(c => String(c.id) === String(p.category));

                  return (
                    <div 
                      key={p.id}
                      style={{
                        background: 'rgba(20, 24, 36, 0.75)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: isOut ? '1px solid rgba(239, 68, 68, 0.4)' : isLow ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 20,
                        padding: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Left Accent Bar */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        background: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e'
                      }} />

                      {/* Image Thumbnail */}
                      <div style={{
                        width: 58,
                        height: 58,
                        borderRadius: 16,
                        background: 'linear-gradient(145deg, #141824, #1e2435)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        flexShrink: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                      }}>
                        {imgUrl ? (
                          <img src={imgUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Package size={24} color="#475569" />
                        )}
                      </div>

                      {/* Product Main Details */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {catObj && (
                            <span style={{ fontSize: 9, fontWeight: 900, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase' }}>
                              {catObj.name}
                            </span>
                          )}
                        </div>

                        <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                          {p.name}
                        </span>

                        {/* Codes & SKU */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {p.internal_code && (
                            <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#f97316', background: 'rgba(249, 115, 22, 0.1)', padding: '2px 6px', borderRadius: 6 }}>
                              COD: {p.internal_code}
                            </span>
                          )}
                          {p.sku && (
                            <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#94a3b8', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: 6 }}>
                              SKU: {p.sku}
                            </span>
                          )}
                        </div>

                        {/* Price Display */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 16, fontWeight: 950, color: '#22c55e', letterSpacing: '-0.02em' }}>
                            {fmt(p.price_sell || p.price || 0)}
                          </span>
                          {p.price_buy > 0 && (
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                              (Costo: {fmt(p.price_buy)})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock Pill & Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                        {/* LED Stock Dot Badge */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 99,
                          background: isOut ? 'rgba(239, 68, 68, 0.15)' : isLow ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          border: `1px solid ${isOut ? 'rgba(239,68,68,0.3)' : isLow ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e',
                            boxShadow: `0 0 8px ${isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e'}`
                          }} />
                          <span style={{ fontSize: 11, fontWeight: 900, color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e' }}>
                            {isOut ? 'Agotado' : `${stockNum} un.`}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        {canEdit && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => openEdit(p)}
                              style={{
                                width: 32, height: 32, borderRadius: 10,
                                background: 'rgba(249, 115, 22, 0.12)',
                                border: '1px solid rgba(249, 115, 22, 0.25)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <Edit2 size={14} color="#f97316" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(p)}
                                style={{
                                  width: 32, height: 32, borderRadius: 10,
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <Trash2 size={14} color="#ef4444" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 🎴 VISTA DE TARJETAS EN CUADRÍCULA ESTILO IOS */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {filtered.map(p => {
                  const stockNum = p.stock ?? 0;
                  const isLow = stockNum > 0 && stockNum <= 5;
                  const isOut = stockNum <= 0;
                  const imgUrl = buildImgUrl(p.image);

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: 'rgba(20, 24, 36, 0.75)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: isOut ? '1px solid rgba(239, 68, 68, 0.4)' : isLow ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 22,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Top Product Image */}
                      <div style={{
                        width: '100%',
                        height: 110,
                        borderRadius: 16,
                        background: '#12151c',
                        overflow: 'hidden',
                        position: 'relative',
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        {imgUrl ? (
                          <img src={imgUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Package size={36} color="#475569" />
                        )}

                        {/* Stock Badge on top left of image */}
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: 'rgba(10, 12, 20, 0.85)',
                          backdropFilter: 'blur(8px)',
                          padding: '3px 8px',
                          borderRadius: 99,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e'
                          }} />
                          <span style={{ fontSize: 10, fontWeight: 900, color: isOut ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e' }}>
                            {stockNum}
                          </span>
                        </div>

                        {/* Quick Edit & Delete Actions Top Right */}
                        {canEdit && (
                          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => openEdit(p)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: 'rgba(10, 12, 20, 0.85)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(249, 115, 22, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit2 size={12} color="#f97316" />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: 'rgba(10, 12, 20, 0.85)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={12} color="#ef4444" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Product Title */}
                      <span style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: '#ffffff',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginBottom: 8
                      }}>
                        {p.name}
                      </span>

                      {/* Price Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <span style={{ fontSize: 16, fontWeight: 950, color: '#22c55e' }}>
                          {fmt(p.price_sell || p.price || 0)}
                        </span>
                        
                        {p.internal_code && (
                          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#f97316', fontWeight: 700 }}>
                            {p.internal_code}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal - Rendered via React Portal to display on top of bottom navigation */}
      {showModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-sheet" style={{
            height: '90vh',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            background: '#080a0f',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '16px 16px 0',
            overflowY: 'hidden'
          }}>
            {/* Modal Navigation Top Header Bar (Cancelar | Title | Guardar) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 16,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: 16
            }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#3b82f6',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 99,
                  padding: '8px 18px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>

              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {editing ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? '#1d4ed8' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 99,
                  padding: '8px 20px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {saving ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Guardando</> : 'Guardar'}
              </button>
            </div>

            {/* Scrollable Form Body (Grouped iOS Sections) */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(40px + env(safe-area-inset-bottom, 16px))' }}>
              
              {errMsg && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 14,
                  padding: '10px 14px',
                  marginBottom: 16,
                  fontSize: 13,
                  color: '#ef4444',
                  fontWeight: 600
                }}>
                  ⚠️ {errMsg}
                </div>
              )}

              {/* 📷 SECTION 1: FOTO & INFORMACIÓN BÁSICA */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a94a6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginLeft: 4 }}>
                  INFORMACIÓN GENERAL
                </div>
                <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  
                  {/* Photo picker */}
                  <div
                    onClick={handleSelectImage}
                    style={{
                      height: 100,
                      borderRadius: 16,
                      background: '#090b10',
                      border: '2px dashed rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {imgPreview ? (
                      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <img src={imgPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CameraIcon size={20} color="white" />
                          <span style={{ fontSize: 12, color: 'white', fontWeight: 700, marginLeft: 6 }}>Cambiar Foto</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#8a94a6' }}>
                        <CameraIcon size={24} color="#3b82f6" style={{ marginBottom: 4 }} />
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Toca para agregar foto del producto</div>
                      </div>
                    )}
                  </div>

                  {/* Nombre */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#8a94a6', fontWeight: 600 }}>Nombre del producto *</span>
                    <input
                      placeholder="Ej. Bebida Energetica 500ml"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      style={{
                        background: '#090b10',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 14,
                        padding: '12px 14px',
                        color: '#ffffff',
                        fontSize: 15,
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* SKU / Barcode */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#8a94a6', fontWeight: 600 }}>Código de barras / SKU</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        placeholder="Escanea o ingresa SKU"
                        value={form.sku}
                        onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                        style={{
                          flex: 1,
                          background: '#090b10',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 14,
                          padding: '12px 14px',
                          color: '#ffffff',
                          fontSize: 15,
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => handleScanForm('sku')}
                        style={{
                          background: '#2563eb',
                          border: 'none',
                          borderRadius: 14,
                          padding: '0 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <ScanLine size={18} color="white" />
                      </button>
                    </div>
                  </div>

                  {/* Categoría */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 12, color: '#8a94a6', fontWeight: 600 }}>Categoría</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={form.category}
                        onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                        style={{
                          flex: 1,
                          background: '#090b10',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 14,
                          padding: '12px 14px',
                          color: form.category ? '#ffffff' : '#8a94a6',
                          fontSize: 15,
                          outline: 'none',
                        }}
                      >
                        <option value="">Sin Categoría</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setShowCategoryModal(true)}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            background: '#1e2435',
                            border: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={18} color="#3b82f6" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 💲 SECTION 2: PRECIOS */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a94a6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginLeft: 4 }}>
                  PRECIOS
                </div>
                <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 22, padding: '4px 16px' }}>
                  
                  {/* Row Costo */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Costo</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8a94a6', fontSize: 14 }}>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0.00"
                        value={form.cost ? Number(form.cost).toLocaleString('es-CO') : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setForm(p => ({ ...p, cost: raw }));
                        }}
                        style={{
                          width: 110,
                          background: '#090b10',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 12,
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: 15,
                          fontWeight: 700,
                          textAlign: 'right',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Row Precio de venta */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Precio de venta *</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#8a94a6', fontSize: 14 }}>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0.00"
                        value={form.price ? Number(form.price).toLocaleString('es-CO') : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setForm(p => ({ ...p, price: raw }));
                        }}
                        style={{
                          width: 110,
                          background: '#090b10',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 12,
                          padding: '8px 12px',
                          color: '#ffffff',
                          fontSize: 15,
                          fontWeight: 700,
                          textAlign: 'right',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                </div>
              </div>

              {/* 📦 SECTION 3: INVENTARIO */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a94a6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginLeft: 4 }}>
                  INVENTARIO
                </div>
                <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 22, padding: '4px 16px' }}>
                  
                  {/* Row Manejar inventario Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Manejar inventario</span>
                    {/* iOS Switch */}
                    <div style={{
                      width: 50, height: 30, borderRadius: 99, background: '#3b82f6',
                      display: 'flex', alignItems: 'center', padding: 3, cursor: 'pointer'
                    }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffffff', transform: 'translateX(20px)', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                    </div>
                  </div>

                  {/* Row Stock actual */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Stock actual</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={form.stock ? Number(form.stock).toLocaleString('es-CO') : '0'}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setForm(p => ({ ...p, stock: raw }));
                      }}
                      style={{
                        width: 90,
                        background: '#090b10',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 12,
                        padding: '8px 12px',
                        color: '#ffffff',
                        fontSize: 15,
                        fontWeight: 700,
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Row Stock mínimo */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Stock mínimo</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      defaultValue="5"
                      style={{
                        width: 90,
                        background: '#090b10',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 12,
                        padding: '8px 12px',
                        color: '#ffffff',
                        fontSize: 15,
                        fontWeight: 700,
                        textAlign: 'right',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Warning Pill Banner */}
                  {(Number(form.stock || 0) <= 5) && (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 14,
                      padding: '10px 14px',
                      margin: '6px 0 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: '#fbbf24',
                      fontSize: 13,
                      fontWeight: 700,
                    }}>
                      <AlertTriangle size={16} color="#fbbf24" />
                      El stock está bajo el mínimo
                    </div>
                  )}

                </div>
              </div>

              {/* 🟢 SECTION 4: PRODUCTO ACTIVO */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a94a6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginLeft: 4 }}>
                  PRODUCTO ACTIVO
                </div>
                <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 22, padding: '4px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>Producto activo</span>
                    {/* iOS Switch */}
                    <div style={{
                      width: 50, height: 30, borderRadius: 99, background: '#3b82f6',
                      display: 'flex', alignItems: 'center', padding: 3, cursor: 'pointer'
                    }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ffffff', transform: 'translateX(20px)', transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 📝 SECTION 5: NOTAS / DESCRIPCIÓN */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8a94a6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginLeft: 4 }}>
                  NOTAS
                </div>
                <div style={{ background: '#12151c', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 22, padding: 16 }}>
                  <textarea
                    placeholder="Detalles sobre el producto, proveedor o ubicación..."
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    style={{
                      width: '100%',
                      background: '#090b10',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 14,
                      padding: '12px 14px',
                      color: '#ffffff',
                      fontSize: 14,
                      outline: 'none',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal - Nueva Categoría */}
      {showCategoryModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 220 }} onClick={e => e.target === e.currentTarget && setShowCategoryModal(false)}>
          <div className="modal-sheet" style={{
            padding: 20,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>🏷️ Nueva Categoría</h3>
                <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Crea una categoría para organizar tus productos</p>
              </div>
              <button onClick={() => setShowCategoryModal(false)} style={{ background: '#1e2435', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="#64748b" />
              </button>
            </div>

            <div>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Nombre de la Categoría *</span>
              <input
                className="input-field"
                placeholder="Ej. Bebidas, Embutidos, Mecatos..."
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                style={{ marginTop: 6 }}
                autoFocus
              />
            </div>

            {catErrMsg && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#ef4444' }}>
                {catErrMsg}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
              <button className="btn-secondary" style={{ height: 44, borderRadius: 12 }} onClick={() => setShowCategoryModal(false)} disabled={savingCat}>Cancelar</button>
              <button className="btn-primary" style={{ height: 44, borderRadius: 12 }} onClick={handleSaveCategory} disabled={savingCat}>
                {savingCat ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Guardando</> : 'Crear Categoría'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal QR Catálogo */}
      {showCatalogQR && createPortal(
        <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && setShowCatalogQR(false)}>
          <div className="modal-sheet" style={{
            padding: 24,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCatalogQR(false)} style={{ background: '#1e2435', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="#64748b" />
              </button>
            </div>
            
            <Globe size={48} color="#f97316" style={{ marginBottom: -8 }} />
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: 0, textAlign: 'center' }}>Catálogo Digital</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, textAlign: 'center' }}>Muestra este código a tus clientes</p>

            <div style={{ background: 'white', padding: 12, borderRadius: 16, border: '4px solid #ea580c', display: 'inline-block', margin: '10px 0' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent((auth.apiUrl || '').replace(/\/api\/?$/, '') + '/catalogo/')}`} 
                alt="QR Code" 
                style={{ width: 180, height: 180 }} 
              />
            </div>

            <button
              onClick={async () => {
                const url = (auth.apiUrl || '').replace(/\/api\/?$/, '') + '/catalogo/';
                try {
                  await Share.share({
                    title: 'Nuestro Catálogo',
                    text: '¡Mira nuestros productos y precios en vivo!',
                    url: url,
                    dialogTitle: 'Compartir Catálogo con Clientes'
                  });
                } catch (e) {
                  console.log('Error sharing', e);
                }
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: 'white',
                border: 'none',
                borderRadius: 14,
                padding: '14px',
                fontSize: 15,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 10
              }}
            >
              <Share2 size={20} /> Compartir por WhatsApp
            </button>
          </div>
        </div>,
        document.body
      )}
      {/* Web Scanner Modal (Safari on iOS & Web Browsers) */}
      <WebScannerModal
        isOpen={showWebScanner}
        onClose={() => setShowWebScanner(false)}
        onScanSuccess={(code) => {
          if (scanTargetField === 'search') setQuery(code);
          if (scanTargetField === 'sku') setForm(p => ({ ...p, sku: code }));
          if (scanTargetField && scanTargetField !== 'search' && scanTargetField !== 'sku') {
            setForm(p => ({ ...p, [scanTargetField]: code }));
          }
        }}
      />
    </div>
  );
}
