import React, { useState, useEffect } from 'react';
import { Receipt, Search, X, ChevronDown, ChevronUp, Clock, Package, DollarSign, Filter, RefreshCw, MessageCircle, Trash2, Calendar, User, Tag } from 'lucide-react';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';
import { SkeletonCard } from '../components/SkeletonLoader';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { generateTicketHTML } from '../lib/print';
import { hasPermission } from '../lib/permissionsConfig';

const formatWithSettings = (n, settings) => {
  const num = parseFloat(n) || 0;
  const symbol = settings?.currency_symbol || '$';
  const decimals = parseInt(settings?.currency_decimals || '0', 10);
  return `${symbol} ${num.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

const STATUS_MAP = {
  COMPLETED: { label: 'Completada', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  PENDING:   { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  CANCELLED: { label: 'Cancelada',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
};

export default function Sales({ auth }) {
  const fmt = (n) => formatWithSettings(n, auth.settings);
  const [sales, setSales]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');
  const [expanded, setExpanded] = useState(null);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(false);
  const [selectedCashier, setSelectedCashier] = useState('');
  const [sharingId, setSharingId] = useState(null);

  useEffect(() => { fetchSales(1); }, []);

  async function fetchSales(p) {
    if (p === 1) setLoading(true);
    try {
      const res = await apiRequest(
        apiUrl(auth.apiUrl, `sales/sales/?page=${p}&page_size=30`),
        {}, auth.token
      );
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.results || []);
        setSales(prev => p === 1 ? items : [...prev, ...items]);
        setHasMore(!!(data.next));
        setPage(p);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVoidSale(sale) {
    const confirmRes = await DarkSwal.fire({
      title: '¿Anular Factura?',
      html: `¿Estás seguro de que deseas <b>ANULAR</b> la Factura <b>${sale.invoice_number || sale.id}</b>?<br/><br/><span style="color:#ef4444;font-size:12px;">Esta acción es irreversible, registrará un egreso por devolución y retornará el stock al inventario.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular venta',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const res = await apiRequest(
        apiUrl(auth.apiUrl, `sales/sales/${sale.id}/`),
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'CANCELLED' })
        },
        auth.token
      );
      if (res.ok) {
        Toast.fire({ icon: 'success', title: 'Factura anulada con éxito' });
        fetchSales(1);
      } else {
        DarkSwal.fire('Error', 'No se pudo anular la factura.', 'error');
      }
    } catch {
      DarkSwal.fire('Error', 'Error de red. Intenta de nuevo.', 'error');
    }
  }

  const handleShareReceipt = async (sale) => {
    if (sharingId === sale.id) return; // Prevent double-tap
    setSharingId(sale.id);
    Toast.fire({ icon: 'info', title: '📄 Generando factura...', timer: 5000, timerProgressBar: true });
    try {
      const receiptHTML = generateTicketHTML(sale, auth.settings, auth.settings?.ticket_logo, { apiUrl: auth.apiUrl });

      // Create a hidden iframe to render the ticket HTML in isolation
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.width = '320px'; // ~80mm at 96dpi
      iframe.style.height = '2000px';
      iframe.style.left = '-9999px';
      iframe.style.top = '0px';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(receiptHTML);
      iframeDoc.close();

      // Wait for content to fully render
      await new Promise(res => {
        iframe.onload = res;
        setTimeout(res, 700);
      });

      // Capture the full iframe body with html2canvas
      const rawCanvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      });

      // Cleanup iframe
      document.body.removeChild(iframe);

      // === PIXEL-LEVEL CROP: remove white rows from the bottom ===
      const ctx = rawCanvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
      const pixels = imageData.data;
      
      let lastContentRow = 0;
      for (let y = rawCanvas.height - 1; y >= 0; y--) {
        let rowHasContent = false;
        for (let x = 0; x < rawCanvas.width; x++) {
          const idx = (y * rawCanvas.width + x) * 4;
          const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
          // Any pixel darker than near-white = content
          if (r < 245 || g < 245 || b < 245) {
            rowHasContent = true;
            break;
          }
        }
        if (rowHasContent) {
          lastContentRow = y;
          break;
        }
      }

      // Add a small bottom padding (20px) and create cropped canvas
      const croppedHeight = Math.min(lastContentRow + 30, rawCanvas.height);
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = rawCanvas.width;
      croppedCanvas.height = croppedHeight;
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.fillStyle = '#ffffff';
      croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
      croppedCtx.drawImage(rawCanvas, 0, 0);

      const imgData = croppedCanvas.toDataURL('image/jpeg', 0.92);

      // Build PDF sized exactly to cropped content
      const pdfWidth = 80; // 80mm thermal paper
      const pdfHeight = (croppedCanvas.height * pdfWidth) / croppedCanvas.width;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const dataUri = doc.output('datauristring');
      const pdfBase64 = dataUri.split(',')[1];
      const fileName = `factura_${sale.invoice_number || sale.id}.pdf`;

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });

      await Share.share({
        title: 'Factura AGS SALES',
        text: `Adjuntamos la factura #${sale.invoice_number || sale.id}`,
        url: savedFile.uri,
        dialogTitle: 'Compartir Factura'
      });

    } catch (e) {
      console.error(e);
      Toast.fire({ icon: 'error', title: 'Error generando PDF' });
    } finally {
      setSharingId(null);
    }
  };

  const isAdminUser = hasPermission(auth.user, 'settings.user_management') || ['SUPERADMIN', 'ADMIN'].includes(auth.user?.role);
  const cashiers = [...new Set(sales.map(s => s.user_username).filter(Boolean))];

  const filtered = sales.filter(s => {
    const isOwner = !isAdminUser ? (s.user_username === auth.user?.username || !s.user_username) : true;
    const matchesQuery = (
      (s.customer_name || '').toLowerCase().includes(query.toLowerCase()) ||
      (s.invoice_number || '').toLowerCase().includes(query.toLowerCase()) ||
      (s.user_username || '').toLowerCase().includes(query.toLowerCase())
    );
    const matchesCashier = !selectedCashier || s.user_username === selectedCashier;

    return isOwner && matchesQuery && matchesCashier;
  });

  const todayTotal = filtered
    .filter(s => {
      const d = new Date(s.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString() && s.status === 'COMPLETED';
    })
    .reduce((sum, s) => sum + parseFloat(s.total || 0), 0);

  return (
    <div className="page-container" style={{ background: '#0f172a', minHeight: '100vh' }}>
      <TopBar title="Historial de Ventas" subtitle={`${sales.length} registradas`} />

      <div className="page-content" style={{ padding: '16px 16px 0', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 16px))' }}>
        {/* Today summary card (Premium Dashboard style) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: 20,
          padding: '20px 22px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 32px rgba(34, 197, 94, 0.08)'
        }}>
          <div>
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ingresos de Hoy</span>
            <p style={{ fontSize: 26, fontWeight: 950, color: '#22c55e', margin: '4px 0 0', letterSpacing: '-0.02em' }}>{fmt(todayTotal)}</p>
          </div>
          <div style={{ 
            background: 'linear-gradient(135deg, #22c55e, #15803d)', 
            width: 48, 
            height: 48, 
            borderRadius: 14, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
          }}>
            <Receipt size={22} color="#ffffff" />
          </div>
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {/* Search bar */}
          <div className="search-bar" style={{ 
            margin: 0, 
            background: 'rgba(30, 41, 59, 0.7)', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '12px 14px'
          }}>
            <Search size={18} color="#94a3b8" />
            <input 
              placeholder="Buscar por cliente, cajero o factura..." 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              style={{ color: '#f8fafc', fontWeight: 600, fontSize: 13 }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={16} color="#94a3b8" />
              </button>
            )}
          </div>

          {/* Cashier filter dropdown */}
          {!loading && ['SUPERADMIN', 'ADMIN'].includes(auth.user?.role) && cashiers.length > 0 && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <Filter size={16} color="#94a3b8" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', whiteSpace: 'nowrap' }}>Filtrar Cajero:</span>
              <select
                value={selectedCashier}
                onChange={e => setSelectedCashier(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: '#f8fafc',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer',
                  paddingLeft: 6
                }}
              >
                <option value="" style={{ background: '#0f172a', color: '#f8fafc' }}>👤 Todos los Cajeros</option>
                {cashiers.map(c => (
                  <option key={c} value={c} style={{ background: '#0f172a', color: '#f8fafc' }}>
                    👤 {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Sales List */}
        {loading ? (
          <SkeletonCard count={5} height={90} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 0', color: '#64748b' }}>
                <Receipt size={48} style={{ marginBottom: 16, opacity: 0.2, color: '#94a3b8' }} />
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#94a3b8' }}>No hay facturas registradas</p>
                <p style={{ fontSize: 12, margin: '4px 0 0', color: '#64748b' }}>Intenta cambiando los filtros de búsqueda</p>
              </div>
            )}

            {filtered.map(sale => {
              const status = STATUS_MAP[sale.status] || STATUS_MAP.PENDING;
              const isOpen = expanded === sale.id;
              const date   = new Date(sale.created_at);

              return (
                <div key={sale.id} style={{
                  background: 'rgba(30, 41, 59, 0.55)',
                  backdropFilter: 'blur(8px)',
                  border: isOpen ? '1px solid #f97316' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 18,
                  overflow: 'hidden',
                  boxShadow: isOpen ? '0 8px 24px rgba(249, 115, 22, 0.08)' : '0 4px 16px rgba(0,0,0,0.15)',
                  transition: 'all 0.25s ease'
                }}>
                  {/* Header Row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : sale.id)}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {/* Status Icon Indicator */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: status.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Receipt size={18} color={status.color} />
                    </div>

                    {/* Customer & ID */}
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sale.customer_name || 'Consumidor Final'}
                        </span>
                        {parseFloat(sale.discount || 0) > 0 && (
                          <span style={{ fontSize: 9, background: 'rgba(249,115,22,0.15)', color: '#f97316', padding: '2px 6px', borderRadius: 6, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            <Tag size={8} style={{ display: 'inline', marginRight: 2 }} /> {sale.promo_percent > 0 ? `-${sale.promo_percent}%` : 'Desc'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', fontWeight: 800 }}>#{sale.invoice_number || String(sale.id).padStart(6, '0')}</span>
                        <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: 10 }}>|</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} color="#64748b" /> {date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Total & Status */}
                    <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 4 }}>
                      <p style={{ fontSize: 15, fontWeight: 950, color: '#22c55e', margin: 0, letterSpacing: '-0.01em' }}>{fmt(sale.total)}</p>
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 8, background: status.bg, color: status.color, fontWeight: 800, textTransform: 'uppercase', marginTop: 4, display: 'inline-block', letterSpacing: '0.02em' }}>
                        {status.label}
                      </span>
                    </div>

                    {isOpen ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                  </button>

                  {/* Expanded Detail Panel */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px', background: 'rgba(15, 23, 42, 0.45)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                        <Package size={12} color="#64748b" />
                        <p style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Artículos Vendidos</p>
                      </div>
                      
                      {/* Products List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                        {(sale.details || []).map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <div style={{
                                width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.04)',
                                display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center'
                              }}>
                                <span style={{ fontSize: 10, color: '#f97316', fontWeight: 900 }}>{parseInt(item.quantity)}</span>
                              </div>
                              <span style={{ fontSize: 13, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                {item.product_name}
                              </span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                              {fmt(item.unit_price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Financial breakdown */}
                      <div style={{ 
                        borderTop: '1px dashed rgba(255,255,255,0.08)', 
                        paddingTop: 12, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 6 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                          <span>Subtotal</span>
                          <span>{fmt(sale.subtotal)}</span>
                        </div>
                        {parseFloat(sale.discount || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ef4444', fontWeight: 800 }}>
                            <span>Descuento Aplicado</span>
                            <span>-{fmt(sale.discount)}</span>
                          </div>
                        )}
                        {parseFloat(sale.tax || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                            <span>Impuesto ({sale.tax_name || 'IVA'})</span>
                            <span>{fmt(sale.tax)}</span>
                          </div>
                        )}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          fontSize: 14, 
                          color: '#22c55e', 
                          fontWeight: 950, 
                          marginTop: 6, 
                          borderTop: '1px solid rgba(255,255,255,0.08)', 
                          paddingTop: 8 
                        }}>
                          <span>Total Neto</span>
                          <span>{fmt(sale.total)}</span>
                        </div>
                      </div>

                      {/* Cashier & Date Detail */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginTop: 14, 
                        borderTop: '1px dashed rgba(255,255,255,0.08)', 
                        paddingTop: 10 
                      }}>
                        {sale.user_username && (
                          <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                            <User size={12} color="#64748b" /> {sale.user_username}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                          <Calendar size={12} color="#64748b" /> {date.toLocaleDateString('es-CO')}
                        </span>
                      </div>

                      {/* Payment method badge lists */}
                      {sale.payments && sale.payments.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Método de Pago:</span>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {sale.payments.map((p, pIdx) => (
                              <span key={pIdx} style={{ 
                                fontSize: 9, 
                                color: '#f97316', 
                                background: 'rgba(249,115,22,0.12)', 
                                border: '1px solid rgba(249,115,22,0.2)', 
                                padding: '2px 8px', 
                                borderRadius: 6, 
                                fontWeight: 800,
                                textTransform: 'uppercase'
                              }}>
                                {p.payment_method_name || 'Otro'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        {/* Send WhatsApp / Share Receipt Button */}
                        <button
                          onClick={() => handleShareReceipt(sale)}
                          disabled={sharingId === sale.id}
                          style={{
                            flex: 2,
                            background: sharingId === sale.id ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            borderRadius: 12,
                            padding: '12px 14px',
                            color: '#22c55e',
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: sharingId === sale.id ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            opacity: sharingId === sale.id ? 0.7 : 1,
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.05)'
                          }}
                        >
                          {sharingId === sale.id ? (
                            <>
                              <span style={{
                                width: 14, height: 14, border: '2px solid #22c55e',
                                borderTopColor: 'transparent', borderRadius: '50%',
                                display: 'inline-block',
                                animation: 'spin 0.7s linear infinite'
                              }} />
                              Generando...
                            </>
                          ) : (
                            <><MessageCircle size={16} /> Compartir Factura</>
                          )}
                        </button>

                        {/* Admin Void Invoice Action */}
                        {sale.status !== 'CANCELLED' && ['SUPERADMIN', 'ADMIN'].includes(auth.user?.role) && (
                          <button
                            onClick={() => handleVoidSale(sale)}
                            style={{
                              flex: 1,
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: 12,
                              padding: '12px 14px',
                              color: '#ef4444',
                              fontSize: 13,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.05)'
                            }}
                          >
                            <Trash2 size={16} /> Anular
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load More Button (Fixed padding safety) */}
            {hasMore && (
              <button
                className="btn-secondary"
                onClick={() => fetchSales(page + 1)}
                style={{ 
                  marginTop: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 8, 
                  height: 48, 
                  borderRadius: 14,
                  fontWeight: 800,
                  fontSize: 13
                }}
              >
                <RefreshCw size={16} className="animate-spin-slow" /> Cargar más facturas
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
