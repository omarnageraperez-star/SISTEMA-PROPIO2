import React, { useState, useEffect } from 'react';
import { Receipt, Search, X, ChevronDown, ChevronUp, Clock, Package, DollarSign, Filter, RefreshCw, MessageCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';
import { SkeletonCard } from '../components/SkeletonLoader';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { generateTicketHTML } from '../lib/print';

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

  const isAdminUser = ['SUPERADMIN', 'ADMIN', 'SUPERVISOR'].includes(auth.user?.role);
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
    <div className="page-container">
      <TopBar title="Historial de Ventas" subtitle={`${sales.length} registradas`} />

      <div className="page-content" style={{ padding: '12px 16px 0', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 16px))' }}>
        {/* Today summary card (Premium Dashboard style) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(20,24,36,0.95))',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 16,
          padding: '16px 18px',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(34,197,94,0.05)'
        }}>
          <div>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ingresos de Hoy</span>
            <p style={{ fontSize: 24, fontWeight: 950, color: '#22c55e', margin: '4px 0 0' }}>{fmt(todayTotal)}</p>
          </div>
          <div style={{ background: 'rgba(34,197,94,0.15)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={22} color="#22c55e" />
          </div>
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {/* Search bar */}
          <div className="search-bar" style={{ margin: 0 }}>
            <Search size={16} color="#64748b" />
            <input placeholder="Buscar por cliente, cajero o factura..." value={query} onChange={e => setQuery(e.target.value)} />
            {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} color="#64748b" /></button>}
          </div>

          {/* Cashier filter dropdown */}
          {!loading && ['SUPERADMIN', 'ADMIN'].includes(auth.user?.role) && cashiers.length > 0 && (
            <div style={{
              background: '#1e2435',
              border: '1px solid #252d42',
              borderRadius: 12,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Filter size={14} color="#64748b" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap' }}>Filtrar Cajero:</span>
              <select
                value={selectedCashier}
                onChange={e => setSelectedCashier(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: '#f1f5f9',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="" style={{ background: '#1e2435', color: '#f1f5f9' }}>👤 Todos los Cajeros</option>
                {cashiers.map(c => (
                  <option key={c} value={c} style={{ background: '#1e2435', color: '#f1f5f9' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                <Receipt size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p style={{ fontSize: 14, margin: 0 }}>No hay facturas registradas en esta selección</p>
              </div>
            )}

            {filtered.map(sale => {
              const status = STATUS_MAP[sale.status] || STATUS_MAP.PENDING;
              const isOpen = expanded === sale.id;
              const date   = new Date(sale.created_at);

              return (
                <div key={sale.id} style={{
                  background: '#1e2435',
                  border: isOpen ? '1px solid #f97316' : '1px solid #252d42',
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  transition: 'all 0.15s'
                }}>
                  {/* Header Row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : sale.id)}
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {/* Status Icon Indicator */}
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: status.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Receipt size={16} color={status.color} />
                    </div>

                    {/* Customer & ID */}
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sale.customer_name || 'Consumidor Final'}
                        </span>
                        {parseFloat(sale.discount || 0) > 0 && (
                          <span style={{ fontSize: 9, background: 'rgba(249,115,22,0.15)', color: '#f97316', padding: '1px 5px', borderRadius: 4, fontWeight: 900 }}>
                            🎲 {sale.promo_percent > 0 ? `-${sale.promo_percent}%` : 'Desc'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', fontWeight: 700 }}>#{sale.invoice_number || sale.id}</span>
                        <span style={{ color: '#252d42', fontSize: 10 }}>•</span>
                        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                          {date.toLocaleDateString('es-CO')} {date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Total & Status */}
                    <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 2 }}>
                      <p style={{ fontSize: 14, fontWeight: 900, color: '#22c55e', margin: 0 }}>{fmt(sale.total)}</p>
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: status.bg, color: status.color, fontWeight: 800, textTransform: 'uppercase', marginTop: 3, display: 'inline-block' }}>
                        {status.label}
                      </span>
                    </div>

                    {isOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                  </button>

                  {/* Expanded Detail Panel */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #252d42', padding: '14px', background: '#141824' }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px 0' }}>Detalle de Artículos</p>
                      
                      {/* Products List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {(sale.details || []).map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <Package size={12} color="#64748b" style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</span>
                              <span style={{ fontSize: 11, color: '#f97316', fontWeight: 800 }}>×{parseInt(item.quantity)}</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>
                              {fmt(item.unit_price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Financial breakdown */}
                      <div style={{ borderTop: '1px dashed #252d42', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                          <span>Subtotal</span>
                          <span>{fmt(sale.subtotal)}</span>
                        </div>
                        {parseFloat(sale.discount || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                            <span>Descuento Dados</span>
                            <span>-{fmt(sale.discount)}</span>
                          </div>
                        )}
                        {parseFloat(sale.tax || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
                            <span>Impuesto ({sale.tax_name || 'IVA'})</span>
                            <span>{fmt(sale.tax)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#22c55e', fontWeight: 900, marginTop: 4, borderTop: '1px solid #151b26', paddingTop: 4 }}>
                          <span>Total Neto</span>
                          <span>{fmt(sale.total)}</span>
                        </div>
                      </div>

                      {/* Cashier & Payment method */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, borderTop: '1px dashed #252d42', paddingTop: 8 }}>
                        {sale.user_username && (
                          <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            👤 Cajero: <strong style={{ color: '#94a3b8' }}>{sale.user_username}</strong>
                          </span>
                        )}
                        {sale.payments && sale.payments.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#64748b' }}>💳 Medio Pago:</span>
                            {sale.payments.map((p, pIdx) => (
                              <span key={pIdx} style={{ fontSize: 9, color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                {p.payment_method_name || 'Otro'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        {/* Send WhatsApp Button */}
                        <button
                          onClick={() => handleShareReceipt(sale)}
                          disabled={sharingId === sale.id}
                          style={{
                            flex: 1,
                            background: sharingId === sale.id ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.25)',
                            borderRadius: 10,
                            padding: '10px 12px',
                            color: '#22c55e',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: sharingId === sale.id ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            opacity: sharingId === sale.id ? 0.7 : 1,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          {sharingId === sale.id ? (
                            <>
                              <span style={{
                                width: 12, height: 12, border: '2px solid #22c55e',
                                borderTopColor: 'transparent', borderRadius: '50%',
                                display: 'inline-block',
                                animation: 'spin 0.7s linear infinite'
                              }} />
                              Generando...
                            </>
                          ) : (
                            <><MessageCircle size={14} /> Compartir Factura</>
                          )}
                        </button>

                        {/* Admin Void Invoice Action */}
                      {sale.status !== 'CANCELLED' && ['SUPERADMIN', 'ADMIN'].includes(auth.user?.role) && (
                        <button
                          onClick={() => handleVoidSale(sale)}
                          style={{
                            marginTop: 12,
                            width: '100%',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 10,
                            padding: '10px 12px',
                            color: '#ef4444',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          Anular
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
                style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12 }}
              >
                <RefreshCw size={14} /> Cargar más facturas
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
