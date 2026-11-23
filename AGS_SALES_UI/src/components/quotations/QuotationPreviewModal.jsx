import React, { useState } from 'react';
import {
  X, Printer, Download, Share2, CheckCircle2, XCircle, ShoppingCart,
  FileText, Clock, AlertTriangle, Building, Phone, Mail, MapPin, Check
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

export default function QuotationPreviewModal({
  quotation,
  systemSettings,
  userProfile,
  config,
  token,
  onClose,
  onStatusChange,
  onConvertToSale
}) {
  const baseUrl = config?.apiUrl?.replace(/\/$/, '') || '';
  const symbol = quotation.currency_symbol || systemSettings?.currency_symbol || '$';
  const [submittingAction, setSubmittingAction] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);

  // Datos de la empresa desde systemSettings
  const companyName = systemSettings?.company_name || 'AGS SALES';
  const companyNit = systemSettings?.company_nit || '';
  const companyPhone = systemSettings?.company_phone || '';
  const companyAddress = systemSettings?.company_address || '';
  const companyCity = systemSettings?.company_city || '';
  const companyEmail = systemSettings?.company_email || '';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Borrador</span>;
      case 'SENT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Enviada</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Aprobada</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">Rechazada</span>;
      case 'EXPIRED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Vencida</span>;
      case 'CONVERTED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">Convertida en Venta</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">Cancelada</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  // Generar y descargar PDF profesional usando jsPDF
  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

      // Encabezado Empresa
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(companyName, 15, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      y += 5;
      if (companyNit) { doc.text(`NIT: ${companyNit}`, 15, y); y += 4; }
      if (companyAddress) { doc.text(`${companyAddress} - ${companyCity}`, 15, y); y += 4; }
      if (companyPhone) { doc.text(`Tel: ${companyPhone} | Email: ${companyEmail}`, 15, y); y += 4; }

      // Datos Cotización (derecha)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229); // Indigo
      doc.text(`COTIZACIÓN`, pageWidth - 15, 15, { align: 'right' });
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`${quotation.consecutive} (v${quotation.version})`, pageWidth - 15, 21, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Fecha: ${quotation.issue_date}`, pageWidth - 15, 27, { align: 'right' });
      doc.text(`Válida hasta: ${quotation.valid_until}`, pageWidth - 15, 32, { align: 'right' });
      doc.text(`Estado: ${quotation.status}`, pageWidth - 15, 37, { align: 'right' });

      y = Math.max(y, 45);

      // Separador
      doc.setDrawColor(226, 232, 240);
      doc.line(15, y, pageWidth - 15, y);
      y += 6;

      // Datos Cliente
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, y, pageWidth - 30, 22, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("DATOS DEL CLIENTE", 18, y + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(`Cliente: ${quotation.customer_name}`, 18, y + 11);
      if (quotation.customer_document) doc.text(`Documento: ${quotation.customer_document}`, 18, y + 16);
      if (quotation.customer_phone) doc.text(`Teléfono: ${quotation.customer_phone}`, 110, y + 11);
      if (quotation.customer_email) doc.text(`Email: ${quotation.customer_email}`, 110, y + 16);

      y += 28;

      // Tabla de Ítems
      doc.setFillColor(79, 70, 229); // Header fondo
      doc.rect(15, y, pageWidth - 30, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("ÍTEM / DESCRIPCIÓN", 18, y + 4.8);
      doc.text("CANT.", 115, y + 4.8, { align: 'center' });
      doc.text("PRECIO UNIT.", 145, y + 4.8, { align: 'right' });
      doc.text("SUBTOTAL", pageWidth - 18, y + 4.8, { align: 'right' });

      y += 7;
      doc.setTextColor(30, 41, 59);

      (quotation.items || []).forEach((it, idx) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(it.name, 18, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${it.quantity} ${it.measurement_unit || ''}`, 115, y + 4.5, { align: 'center' });
        doc.text(`${symbol}${parseFloat(it.unit_price).toLocaleString()}`, 145, y + 4.5, { align: 'right' });
        doc.text(`${symbol}${parseFloat(it.subtotal).toLocaleString()}`, pageWidth - 18, y + 4.5, { align: 'right' });

        y += 6;

        // Desglose de adicionales en PDF
        if (it.extras && it.extras.length > 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          it.extras.forEach(ex => {
            doc.text(`+ ${ex.name}: ${symbol}${parseFloat(ex.total_price).toLocaleString()}`, 22, y + 3.5);
            y += 4;
          });
          doc.setTextColor(30, 41, 59);
        }

        // Desglose de personalizaciones en PDF
        if (it.customizations && it.customizations.length > 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          const custText = it.customizations.map(c => `${c.name}: ${c.value}`).join(' | ');
          doc.text(`[ ${custText} ]`, 22, y + 3.5);
          y += 4;
          doc.setTextColor(30, 41, 59);
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(15, y + 1, pageWidth - 15, y + 1);
        y += 2;
      });

      y += 4;

      // Resumen Financiero
      const totalsX = 130;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text("Subtotal:", totalsX, y);
      doc.text(`${symbol}${parseFloat(quotation.subtotal).toLocaleString()}`, pageWidth - 18, y, { align: 'right' });
      y += 4.5;

      if (parseFloat(quotation.discount_amount) > 0) {
        doc.text(`Descuento (-${quotation.discount_rate}%):`, totalsX, y);
        doc.text(`-${symbol}${parseFloat(quotation.discount_amount).toLocaleString()}`, pageWidth - 18, y, { align: 'right' });
        y += 4.5;
      }

      if (parseFloat(quotation.additional_charges) > 0) {
        doc.text(`Cargos Adicionales:`, totalsX, y);
        doc.text(`+${symbol}${parseFloat(quotation.additional_charges).toLocaleString()}`, pageWidth - 18, y, { align: 'right' });
        y += 4.5;
      }

      doc.text("Impuestos:", totalsX, y);
      doc.text(`${symbol}${parseFloat(quotation.tax_amount).toLocaleString()}`, pageWidth - 18, y, { align: 'right' });
      y += 5.5;

      // Total General
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text("TOTAL:", totalsX, y);
      doc.text(`${symbol}${parseFloat(quotation.total).toLocaleString()}`, pageWidth - 18, y, { align: 'right' });

      y += 12;
      doc.setTextColor(30, 41, 59);

      // Términos y Condiciones
      if (quotation.terms_and_conditions) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text("TÉRMINOS Y CONDICIONES:", 15, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const splitTerms = doc.splitTextToSize(quotation.terms_and_conditions, pageWidth - 30);
        doc.text(splitTerms, 15, y);
        y += (splitTerms.length * 3.5) + 4;
      }

      // Firma de Aceptación
      if (y > 240) { doc.addPage(); y = 30; }
      y += 10;
      doc.setDrawColor(148, 163, 184);
      doc.line(15, y, 75, y);
      doc.line(pageWidth - 75, y, pageWidth - 15, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Firma de Aceptación del Cliente", 15, y);
      doc.text("Por la Empresa / Asesor Comercial", pageWidth - 75, y);

      doc.save(`Cotizacion_${quotation.consecutive}.pdf`);
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo generar el PDF.', 'error');
    }
  };

  // Imprimir ventana limpia
  const handlePrint = () => {
    window.print();
  };

  // Compartir por WhatsApp
  const handleShareWhatsApp = () => {
    const phone = quotation.customer_phone?.replace(/[^\d]/g, '') || '';
    const message = `Hola *${quotation.customer_name}*, te compartimos tu cotización *${quotation.consecutive}* por un valor total de *${symbol}${Math.round(quotation.total).toLocaleString()}* con vigencia hasta el *${quotation.valid_until}*. Quedamos atentos para procesar tu orden. ¡Gracias!`;
    const encoded = encodeURIComponent(message);
    const url = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Acciones de ciclo de vida
  const handleApprove = async () => {
    setSubmittingAction(true);
    try {
      const res = await apiRequest(`${baseUrl}/quotations/quotations/${quotation.id}/approve/`, {
        method: 'POST'
      }, token);
      if (res.ok) {
        const updated = await res.json();
        Swal.fire('Aprobada', 'La cotización ha sido aprobada.', 'success');
        if (onStatusChange) onStatusChange(updated);
        onClose();
      }
    } catch (e) {
      Swal.fire('Error', 'No se pudo aprobar la cotización.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async () => {
    const { value: reason } = await Swal.fire({
      title: 'Rechazar Cotización',
      input: 'textarea',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Indica el motivo por el cual se rechaza la cotización...',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Rechazar'
    });

    if (reason !== undefined) {
      setSubmittingAction(true);
      try {
        const res = await apiRequest(`${baseUrl}/quotations/quotations/${quotation.id}/reject/`, {
          method: 'POST',
          body: JSON.stringify({ reason })
        }, token);
        if (res.ok) {
          const updated = await res.json();
          Swal.fire('Rechazada', 'La cotización ha sido marcada como rechazada.', 'info');
          if (onStatusChange) onStatusChange(updated);
          onClose();
        }
      } catch (e) {
        Swal.fire('Error', 'No se pudo rechazar la cotización.', 'error');
      } finally {
        setSubmittingAction(false);
      }
    }
  };

  // Convertir a Venta POS
  const openConvertModal = async () => {
    setLoadingPaymentMethods(true);
    try {
      // Validar primero si hay diferencias de precios o stock
      const valRes = await apiRequest(`${baseUrl}/quotations/quotations/${quotation.id}/validate-conversion/`, {}, token);
      if (valRes.ok) {
        const valData = await valRes.json();
        if (valData.warnings && valData.warnings.length > 0) {
          const msgs = valData.warnings.map(w => w.message).join('\n');
          const confirm = await Swal.fire({
            title: 'Advertencia de Stock',
            text: `${msgs}\n¿Deseas continuar con la conversión?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Continuar de todos modos',
            cancelButtonText: 'Cancelar'
          });
          if (!confirm.isConfirmed) return;
        }
      }

      // Cargar métodos de pago
      const pmRes = await apiRequest(`${baseUrl}/sales/payment-methods/`, {}, token);
      if (pmRes.ok) {
        const pmData = await pmRes.json();
        const pms = Array.isArray(pmData) ? pmData : (pmData.results || []);
        setPaymentMethods(pms);
        if (pms.length > 0) setSelectedPaymentMethodId(pms[0].id);
      }
      setShowConvertModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const handleConfirmConvert = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      const res = await apiRequest(`${baseUrl}/quotations/quotations/${quotation.id}/convert-to-sale/`, {
        method: 'POST',
        body: JSON.stringify({
          payment_method_id: selectedPaymentMethodId || null,
          amount_received: amountReceived ? parseFloat(amountReceived) : null
        })
      }, token);

      if (res.ok) {
        const data = await res.json();
        Swal.fire({
          icon: 'success',
          title: '¡Venta Generada Exitosamente!',
          text: `Factura: ${data.invoice_number} por ${symbol}${data.total.toLocaleString()}`,
          confirmButtonColor: '#4f46e5'
        });
        if (onConvertToSale) onConvertToSale(data);
        if (onStatusChange) onStatusChange(data.quotation);
        onClose();
      } else {
        const err = await res.json();
        Swal.fire('Error al Convertir', err.error || JSON.stringify(err), 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'No se pudo convertir la cotización a venta.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col print:max-h-full print:shadow-none print:border-none print:rounded-none">
        {/* Header / Barra de Acciones */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">Cotización {quotation.consecutive}</h3>
                <span className="text-xs text-slate-400 font-mono">v{quotation.version}</span>
                {getStatusBadge(quotation.status)}
              </div>
              <p className="text-xs text-slate-400">Emisión: {quotation.issue_date} • Vigencia: {quotation.valid_until}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              title="Imprimir"
            >
              <Printer size={18} />
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Descargar PDF"
            >
              <Download size={14} /> PDF
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Compartir por WhatsApp"
            >
              <Share2 size={14} /> WhatsApp
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Document Body (Vista Previa Formato Oficial) */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 print:p-0">
          {/* Encabezado Empresa y Documento */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 pb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{companyName}</h1>
              {companyNit && <p className="text-xs text-slate-500 font-mono">NIT: {companyNit}</p>}
              <div className="text-xs text-slate-400 space-y-0.5 mt-1.5">
                {companyAddress && <p className="flex items-center gap-1.5"><MapPin size={12} /> {companyAddress} {companyCity && `- ${companyCity}`}</p>}
                {companyPhone && <p className="flex items-center gap-1.5"><Phone size={12} /> {companyPhone}</p>}
                {companyEmail && <p className="flex items-center gap-1.5"><Mail size={12} /> {companyEmail}</p>}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 inline-block mb-1">
                Cotización Formal
              </span>
              <h2 className="text-xl font-black text-slate-800">{quotation.consecutive}</h2>
              <p className="text-xs text-slate-400 font-medium">Revisión: v{quotation.version}</p>
              <p className="text-xs text-slate-500 mt-1">Fecha Emisión: <span className="font-semibold text-slate-700">{quotation.issue_date}</span></p>
              <p className="text-xs text-slate-500">Válida Hasta: <span className="font-semibold text-indigo-600">{quotation.valid_until}</span></p>
            </div>
          </div>

          {/* Tarjeta Datos del Cliente */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Cliente</span>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{quotation.customer_name}</p>
              {quotation.customer_document && <p className="text-slate-500 font-mono">Doc: {quotation.customer_document}</p>}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Contacto & Entrega</span>
              {quotation.customer_phone && <p className="text-slate-600 font-medium">Tel: {quotation.customer_phone}</p>}
              {quotation.customer_email && <p className="text-slate-600 font-medium">Email: {quotation.customer_email}</p>}
              {quotation.customer_address && <p className="text-slate-600 font-medium">Dir: {quotation.customer_address}</p>}
            </div>
          </div>

          {/* Tabla de Productos / Ítems */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-500 text-[11px] font-bold uppercase tracking-wider rounded-xl">
                  <th className="py-2.5 px-3 rounded-l-xl">Descripción</th>
                  <th className="py-2.5 px-3 text-center w-20">Cant.</th>
                  <th className="py-2.5 px-3 text-right w-28">Precio Unit.</th>
                  <th className="py-2.5 px-3 text-center w-20">Desc.</th>
                  <th className="py-2.5 px-3 text-right w-28 rounded-r-xl">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {(quotation.items || []).map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{it.name}</div>
                      {it.sku && <span className="text-[10px] text-slate-400 font-mono">{it.sku}</span>}

                      {/* Desglose de adicionales en UI */}
                      {it.extras && it.extras.length > 0 && (
                        <div className="mt-1 pl-2 border-l-2 border-indigo-200 space-y-0.5">
                          {it.extras.map((ex, i) => (
                            <div key={i} className="text-[11px] text-slate-600 flex items-center justify-between">
                              <span>+ {ex.name}</span>
                              <span className="font-semibold text-emerald-600">+{symbol}{parseFloat(ex.total_price).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Desglose de personalizaciones en UI */}
                      {it.customizations && it.customizations.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.customizations.map((c, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              {c.name}: {c.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {it.quantity} {it.measurement_unit || ''}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-600">
                      {symbol}{parseFloat(it.unit_price).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500">
                      {parseFloat(it.discount_rate) > 0 ? `${it.discount_rate}%` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {symbol}{parseFloat(it.subtotal).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumen Financiero */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-72 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{symbol}{parseFloat(quotation.subtotal).toLocaleString()}</span>
              </div>
              {parseFloat(quotation.discount_amount) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Descuento ({quotation.discount_rate}%):</span>
                  <span className="font-semibold">-{symbol}{parseFloat(quotation.discount_amount).toLocaleString()}</span>
                </div>
              )}
              {parseFloat(quotation.additional_charges) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Cargos Adicionales ({quotation.additional_charges_notes || 'Envío/Otros'}):</span>
                  <span className="font-semibold">+{symbol}{parseFloat(quotation.additional_charges).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Impuestos:</span>
                <span className="font-semibold">{symbol}{parseFloat(quotation.tax_amount).toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t-2 border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-800">Total:</span>
                <span className="text-xl font-black text-indigo-600">
                  {symbol}{parseFloat(quotation.total).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Términos y Notas */}
          {(quotation.terms_and_conditions || quotation.notes) && (
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2">
              {quotation.notes && (
                <div>
                  <span className="font-bold text-slate-700 block">Notas:</span>
                  <p>{quotation.notes}</p>
                </div>
              )}
              {quotation.terms_and_conditions && (
                <div>
                  <span className="font-bold text-slate-700 block">Términos y Condiciones:</span>
                  <p className="whitespace-pre-line text-slate-500">{quotation.terms_and_conditions}</p>
                </div>
              )}
            </div>
          )}

          {/* Firmas de aceptación */}
          <div className="pt-10 pb-4 grid grid-cols-2 gap-12 text-center text-xs text-slate-400">
            <div>
              <div className="border-t border-slate-300 w-48 mx-auto mb-1"></div>
              <p className="font-medium">Firma de Aceptación del Cliente</p>
            </div>
            <div>
              <div className="border-t border-slate-300 w-48 mx-auto mb-1"></div>
              <p className="font-medium">Por {companyName}</p>
            </div>
          </div>
        </div>

        {/* Footer con Acciones de Ciclo de Vida */}
        <div className="px-6 py-4 border-t border-slate-150 flex items-center justify-between bg-slate-50/80 print:hidden">
          <div className="text-xs text-slate-500">
            {quotation.sale ? (
              <span className="font-bold text-purple-700">Enlazada a Factura #{quotation.sale_invoice_number || quotation.sale}</span>
            ) : quotation.has_stock_reservation ? (
              <span className="font-bold text-emerald-700">Stock actualmente reservado</span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {quotation.status !== 'APPROVED' && quotation.status !== 'CONVERTED' && quotation.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={submittingAction}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={16} /> Aprobar Cotización
              </button>
            )}

            {quotation.status !== 'REJECTED' && quotation.status !== 'CONVERTED' && quotation.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={handleReject}
                disabled={submittingAction}
                className="px-3 py-2 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle size={15} /> Rechazar
              </button>
            )}

            {quotation.status !== 'CONVERTED' && quotation.status !== 'CANCELLED' && (
              <button
                type="button"
                onClick={openConvertModal}
                disabled={submittingAction}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <ShoppingCart size={16} /> Convertir a Venta POS
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Confirmación de Conversión a Venta */}
      {showConvertModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart size={16} className="text-indigo-600" /> Convertir a Venta POS
              </h3>
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
              <p>Esta acción generará la venta formal en el POS, descontará el inventario en Kardex y enlazará ambos comprobantes.</p>
              <p className="font-bold text-sm text-indigo-700">Total a Cobrar: {symbol}{Math.round(quotation.total).toLocaleString()}</p>
            </div>

            <form onSubmit={handleConfirmConvert} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Método de Pago</label>
                <select
                  value={selectedPaymentMethodId}
                  onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">Monto Recibido</label>
                <input
                  type="number"
                  step="any"
                  placeholder={`Ej. ${quotation.total}`}
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingAction ? 'Procesando Venta...' : 'Confirmar y Facturar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
