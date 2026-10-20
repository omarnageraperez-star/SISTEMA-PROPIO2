const getFontFamily = (fontName) => {
  switch(fontName) {
    case 'HELVETICA': return 'Helvetica, Arial, sans-serif';
    case 'HELVETICA_BOLD': return 'Helvetica, Arial, sans-serif';
    case 'COURIER_BOLD': return '"Courier New", Courier, monospace';
    default: return '"Courier New", Courier, monospace';
  }
};

const getFontWeight = (fontName) => {
  if (!fontName) return '600';
  return fontName.includes('BOLD') ? 'bold' : '600';
};

export const generateTicketHTML = (sale, settings, ticketLogo, options = {}) => {
  const symbol = settings?.currency_symbol || '$';
  const format = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  let config = {
    fontTitle: 'HELVETICA_BOLD', fontContent: 'HELVETICA',
    showLogo: true, logoType: 'BUSINESS',
    showCustomSection: false, customSectionSize: 10, customSectionText: '',
    paperWidth: '80mm', contentWidth: '72mm', paperMarginTop: 0, paperMarginBottom: 0, paperMarginLeft: 0, paperMarginRight: 0, contentPaddingTop: 4, contentPaddingBottom: 4, contentPaddingLeft: 2, contentPaddingRight: 2,
    showBusinessData: true, businessDataSize: 10, bdName: true, bdId: true, bdAddress: true, bdEmail: true, bdPhone: true, bdPhoneLabel: 'Teléfono:',
    showTicketHeader: true, ticketHeaderLabel: 'Ticket:', ticketHeaderSize: 10,
    div1Show: true, div1Type: 'solid', div1Thickness: 0.5, div1Margin: 1,
    showTicketData: true, ticketDataSize: 10, tdDate: true, tdDateLabel: 'Fecha de emisión:', tdBox: true, tdBoxLabel: 'Caja:', tdCashier: true, tdCashierLabel: 'Cajero:', tdDocType: true, tdDocTypeLabel: 'DNI:', tdClientName: true, tdClientNameLabel: 'Nombre Cliente:', tdAddress: true, tdAddressLabel: 'Dirección:',
    saleHeaderSize: 10, saleDetailSize: 10, showDivAboveHeader: true, divHeaderType: 'solid', divHeaderThickness: 0.5, divHeaderMargin: 1, limitName: false, limitNameSize: 15,
    div2Show: true, div2Type: 'solid', div2Thickness: 0.5, div2Margin: 1,
    showTotals: true, totalsSize: 10, totSub: true, totSubLabel: 'Subtotal', totTax: true, totTaxLabel: 'Impuesto', totTotal: true, totTotalLabel: 'TOTAL', totCurrency: false, totCurrencyLabel: 'Moneda', totExchange: false, totExchangeLabel: 'T/C', totTotalAlt: false, totTotalAltLabel: 'Total Alt',
    div3Show: true, div3Type: 'solid', div3Thickness: 0.5, div3Margin: 1,
    showTotalLetters: false, totalLettersSize: 10,
    showPayments: true, paymentsSize: 10, payCash: true, payCashLabel: 'Efectivo', payChange: true, payChangeLabel: 'Cambio',
    showObs: true, obsSize: 10, obsLabel: 'Obs:',
    div4Show: true, div4Type: 'solid', div4Thickness: 0.5, div4Margin: 1,
    footerText: settings?.ticket_footer || 'Garantía de 30 días con su factura.\nAGS SALES ERP - Documento Oficial'
  };

  if (settings?.ticket_config_json) {
    try {
      config = { ...config, ...JSON.parse(settings.ticket_config_json) };
    } catch(e) {}
  } else if (settings?.ticket_config) {
    config = settings.ticket_config;
  }

  const genDivider = (show, type, thickness, margin) => {
    if (!show) return '';
    const m = margin * 4; // px
    return `<div style="border-top: ${thickness}px ${type} #000; margin: ${m}px 0;"></div>`;
  };

  const resolveImageUrl = (url, opts) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:image')) return url;
    if (url.startsWith('/')) {
      const api = opts?.apiUrl || 'http://127.0.0.1:8000';
      const base = api.endsWith('/') ? api.slice(0, -1) : api;
      return base + url;
    }
    // Don't convert local paths to file:// as it causes CORS issues
    return '';
  };

  let actualLogo = ticketLogo;
  if (config.logoType === 'BUSINESS') {
    actualLogo = settings?.app_logo || settings?.logo_path || ticketLogo;
  } else {
    actualLogo = ticketLogo || settings?.ticket_logo;
  }

  const logoHtml = (config.showLogo && actualLogo) ? `
    <div style="text-align: center; margin-bottom: 8px;">
      <img src="${resolveImageUrl(actualLogo, options)}" style="max-height: 55px; object-fit: contain;" />
    </div>
  ` : '';

  const cashier = sale.user_username || 'Sistema';
  
  let changeDue = 0;
  if (sale.payments && sale.payments.length > 0) {
    const totalPayments = sale.payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
    if (totalPayments > sale.total) {
      changeDue = totalPayments - sale.total;
    }
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket ${sale.invoice_number || ''}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            margin: ${config.paperMarginTop ?? 0}mm ${config.paperMarginRight ?? 0}mm ${config.paperMarginBottom ?? 0}mm ${config.paperMarginLeft ?? 0}mm;
          }
          body {
            font-family: ${getFontFamily(config.fontContent)};
            font-weight: ${getFontWeight(config.fontContent)};
            width: 100%;
            max-width: ${config.paperWidth || '80mm'};
            box-sizing: border-box;
            margin: 0;
            padding: ${config.contentPaddingTop ?? 4}mm ${config.contentPaddingRight ?? 4}mm ${config.contentPaddingBottom ?? 4}mm ${config.contentPaddingLeft ?? 2}mm;
            font-size: 11px;
            color: #000 !important;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            print-color-adjust: exact;
          }
          .center { text-align: center; }
          .bold { font-weight: 900 !important; }
          table { width: 100%; border-collapse: collapse; margin: 0; table-layout: fixed; }
          th { padding-bottom: 2px; }
          .text-right { text-align: right; }
          .flex-between { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        ${logoHtml}
        
        ${config.showCustomSection && config.customSectionText ? `
          <div class="center" style="font-size: ${config.customSectionSize}px; white-space: pre-wrap; margin-bottom: 8px;">${config.customSectionText}</div>
        ` : ''}

        ${config.showBusinessData ? `
          <div class="center" style="font-size: ${config.businessDataSize}px; margin-bottom: 8px;">
            ${config.bdName ? `<div class="bold" style="font-family: ${getFontFamily(config.fontTitle)};">${settings.business_name || 'AGS SALES'}</div>` : ''}
            ${config.bdId ? `<div>NIT: ${settings.business_nit || ''}</div>` : ''}
            ${config.bdAddress ? `<div>${settings.business_address || ''}</div>` : ''}
            ${config.bdEmail ? `<div>${settings.smtp_user || ''}</div>` : ''}
            ${config.bdPhone ? `<div>${config.bdPhoneLabel} ${settings.business_phone || ''}</div>` : ''}
          </div>
        ` : ''}

        <div class="center bold" style="font-size: ${config.ticketHeaderSize}px; font-family: ${getFontFamily(config.fontTitle)}; font-weight: ${getFontWeight(config.fontTitle)}; margin-top: 8px; margin-bottom: 8px;">
          <div>${settings.ticket_header || 'SISTEMA POS'}</div>
          ${config.showTicketHeader ? `<div>${config.ticketHeaderLabel} ${sale.invoice_number || 'Borrador'}</div>` : ''}
        </div>

        ${genDivider(config.div1Show, config.div1Type, config.div1Thickness, config.div1Margin)}

        ${config.showTicketData ? `
          <div style="font-size: ${config.ticketDataSize}px; margin-bottom: 8px;">
            ${config.tdDate ? `<div><strong>${config.tdDateLabel}</strong> ${new Date(sale.created_at).toLocaleString()}</div>` : ''}
            ${config.tdBox ? `<div><strong>${config.tdBoxLabel}</strong> Caja 1 &nbsp; ${config.tdCashier ? `<strong>${config.tdCashierLabel}</strong> ${cashier}` : ''}</div>` : ''}
            ${config.tdDocType ? `<div><strong>${config.tdDocTypeLabel}</strong> ${sale.customer_document || '999999999'}</div>` : ''}
            ${config.tdClientName ? `<div><strong>${config.tdClientNameLabel}</strong> ${sale.customer_name || 'Consumidor Final'}</div>` : ''}
            ${config.tdAddress ? `<div><strong>${config.tdAddressLabel}</strong> ${sale.customer_address || ''}</div>` : ''}
          </div>
        ` : ''}

        <table style="font-size: ${config.saleHeaderSize}px; font-weight: bold; margin-bottom: 4px;">
          <thead>
            <tr>
              <th style="width: 15%; text-align: left;">Cant</th>
              <th style="width: 45%; text-align: left; word-wrap: break-word;">Desc</th>
              <th style="width: 20%; text-align: right;">P.Unit</th>
              <th style="width: 20%; text-align: right;">Total</th>
            </tr>
          </thead>
        </table>

        ${genDivider(config.showDivAboveHeader, config.divHeaderType, config.divHeaderThickness, config.divHeaderMargin)}

        <table style="font-size: ${config.saleDetailSize}px; margin-bottom: 8px;">
          <tbody>
            ${(sale.details || []).map(item => `
              <tr>
                <td style="width: 15%; vertical-align: top; padding-top: 2px;">${Math.round(parseFloat(item.quantity))}</td>
                <td style="width: 45%; vertical-align: top; padding-top: 2px; line-height: 1.1; word-wrap: break-word;">
                  ${config.limitName ? (item.product_name || 'Producto').substring(0, config.limitNameSize) : (item.product_name || 'Producto')}
                </td>
                <td style="width: 20%; text-align: right; vertical-align: top; padding-top: 2px;">${format(item.unit_price || (item.subtotal/item.quantity))}</td>
                <td style="width: 20%; text-align: right; vertical-align: top; padding-top: 2px;">${format(item.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${genDivider(config.div2Show, config.div2Type, config.div2Thickness, config.div2Margin)}

        ${config.showTotals ? `
          <div style="font-size: ${config.totalsSize}px; margin-bottom: 8px; display: flex; flex-direction: column; align-items: flex-end;">
            ${config.totSub ? `<div style="display: flex; justify-content: space-between; width: 48mm;"><span>${config.totSubLabel}</span><span>${format(sale.subtotal)}</span></div>` : ''}
            ${sale.discount > 0 ? `<div style="display: flex; justify-content: space-between; width: 48mm;"><span>Descuento${sale.promo_percent > 0 ? ` (${sale.promo_percent}%)` : ''}</span><span>-${format(sale.discount)}</span></div>` : ''}
            ${config.totTax ? `<div style="display: flex; justify-content: space-between; width: 48mm;"><span>${config.totTaxLabel}</span><span>${format(sale.tax)}</span></div>` : ''}
            ${config.totTotal ? `<div class="bold" style="display: flex; justify-content: space-between; width: 48mm;"><span>${config.totTotalLabel}</span><span>${format(sale.total)}</span></div>` : ''}
            ${config.totCurrency ? `<div style="display: flex; justify-content: space-between; width: 48mm;"><span>${config.totCurrencyLabel}</span><span>${settings.currency_code || 'USD'}</span></div>` : ''}
            ${config.totExchange ? `<div style="display: flex; justify-content: space-between; width: 48mm;"><span>${config.totExchangeLabel}</span><span>1.0000</span></div>` : ''}
            ${config.totTotalAlt ? `<div style="display: flex; justify-content: space-between; width: 48mm;"><span>${config.totTotalAltLabel}</span><span>${format(sale.total)}</span></div>` : ''}
          </div>
        ` : ''}

        ${genDivider(config.div3Show, config.div3Type, config.div3Thickness, config.div3Margin)}

        ${config.showTotalLetters ? `
          <div style="font-size: ${config.totalLettersSize}px; margin-bottom: 8px; text-transform: uppercase;">
            TOTAL CON LETRAS (NO IMPLEMENTADO)
          </div>
        ` : ''}

        ${config.showPayments ? `
          <div class="bold" style="font-size: ${config.paymentsSize}px; margin-bottom: 8px; display: flex; flex-direction: column; align-items: flex-end;">
            ${(sale.payments || []).map(p => `
              <div style="display: flex; justify-content: space-between; width: 48mm;">
                <span>${config.payCashLabel} (${p.payment_method_name || 'Efectivo'}):</span>
                <span>${format(p.amount)}</span>
              </div>
            `).join('')}
            ${config.payChange && changeDue > 0 ? `
              <div style="display: flex; justify-content: space-between; width: 48mm; margin-top: 2px;">
                <span>${config.payChangeLabel}</span>
                <span>${format(changeDue)}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${config.showObs && sale.observations ? `<div style="font-size: ${config.obsSize}px; margin-top: 4px;">${config.obsLabel} ${sale.observations}</div>` : ''}

        ${genDivider(config.div4Show, config.div4Type, config.div4Thickness, config.div4Margin)}

        <div class="center" style="margin-top: 4px; white-space: pre-wrap;">${config.footerText}</div>
      </body>
    </html>
  `;
};

export const printTicket = (sale, settings, ticketLogo, options = {}) => {
  const htmlContent = generateTicketHTML(sale, settings, ticketLogo, options);

  if (options.silent && options.printerName && window.require) {
    const ipcRenderer = window.require('electron').ipcRenderer;
    ipcRenderer.invoke('print-silent', htmlContent, options.printerName);
    return;
  }

  const printWindow = window.open('', '_blank', 'width=400,height=700');
  if (!printWindow) {
    alert("Por favor habilite las ventanas emergentes para poder imprimir el ticket.");
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  if (options.preview) {
    const div = printWindow.document.createElement('div');
    div.innerHTML = `
      <div style="position:fixed;bottom:0;left:0;right:0;background:#f8fafc;padding:12px;display:flex;justify-content:center;gap:12px;box-shadow:0 -4px 15px rgba(0,0,0,0.1); border-top: 1px solid #e2e8f0; font-family: sans-serif;">
        <button id="btn-cancel" style="padding:10px 24px;background:#fff;color:#475569;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">Cancelar</button>
        <button id="btn-print" style="padding:10px 24px;background:#0f172a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 4px rgba(15,23,42,0.2);">Imprimir Ticket</button>
      </div>
    `;
    printWindow.document.body.appendChild(div);
    printWindow.document.body.style.paddingBottom = '80px';
    
    printWindow.document.getElementById('btn-cancel').onclick = () => {
      printWindow.close();
    };
    printWindow.document.getElementById('btn-print').onclick = () => {
      div.style.display = 'none';
      printWindow.document.body.style.paddingBottom = '';
      
      if (options.printerName && window.require) {
        const ipcRenderer = window.require('electron').ipcRenderer;
        ipcRenderer.invoke('print-silent', printWindow.document.documentElement.outerHTML, options.printerName)
          .then(() => printWindow.close());
      } else {
        printWindow.print();
        printWindow.close();
      }
    };
  } else {
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
};

export const generateCashCutHTML = (shift, totals, settings, ticketLogo, options = {}) => {
  const symbol = settings?.currency_symbol || '$';
  const format = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  let config = {
    fontTitle: 'HELVETICA_BOLD', fontContent: 'HELVETICA',
    paperWidth: '80mm', contentWidth: '72mm', paperMarginTop: 0, paperMarginBottom: 0, paperMarginLeft: 0, paperMarginRight: 0, contentPaddingTop: 4, contentPaddingBottom: 4, contentPaddingLeft: 2, contentPaddingRight: 2,
  };

  if (settings?.ticket_config_json) {
    try {
      config = { ...config, ...JSON.parse(settings.ticket_config_json) };
    } catch(e) {}
  } else if (settings?.ticket_config) {
    config = settings.ticket_config;
  }

  const resolveImageUrl = (url, opts) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:image')) return url;
    if (url.startsWith('/')) {
      const api = opts?.apiUrl || 'http://127.0.0.1:8000';
      const base = api.endsWith('/') ? api.slice(0, -1) : api;
      return base + url;
    }
    // Don't convert local paths to file:// as it causes CORS issues
    return '';
  };

  let actualLogo = ticketLogo;
  if (config.logoType === 'BUSINESS') {
    actualLogo = settings?.app_logo || settings?.logo_path || ticketLogo;
  } else {
    actualLogo = ticketLogo || settings?.ticket_logo;
  }

  const logoHtml = (config.showLogo !== false && actualLogo) ? `
    <div style="text-align: center; margin-bottom: 8px;">
      <img src="${resolveImageUrl(actualLogo, options)}" style="max-height: 55px; object-fit: contain;" />
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Corte de Caja</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: ${config.paperWidth || '80mm'} auto;
            margin: ${config.paperMarginTop ?? 0}mm ${config.paperMarginRight ?? 0}mm ${config.paperMarginBottom ?? 0}mm ${config.paperMarginLeft ?? 0}mm;
          }
          body {
            font-family: ${getFontFamily(config.fontContent)};
            font-weight: ${getFontWeight(config.fontContent)};
            width: 100%;
            max-width: ${config.paperWidth || '80mm'};
            box-sizing: border-box;
            margin: 0;
            padding: ${config.contentPaddingTop ?? 4}mm ${config.contentPaddingRight ?? 4}mm ${config.contentPaddingBottom ?? 4}mm ${config.contentPaddingLeft ?? 2}mm;
            font-size: 12px;
            color: #000 !important;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
            print-color-adjust: exact;
          }
          .center { text-align: center; }
          .bold { font-weight: 900 !important; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .flex-between { display: flex; justify-content: space-between; margin-bottom: 2px; }
        </style>
      </head>
      <body>
        ${logoHtml}
        <div class="center bold" style="font-size: 14px;">${settings?.business_name || 'AGS SALES'}</div>
        <div class="center" style="font-size: 12px; margin-bottom: 5px;">CORTE DE CAJA (ARQUEO)</div>
        <div class="divider"></div>
        <div class="flex-between"><span>Caja:</span> <span>${shift?.register_name || ''}</span></div>
        <div class="flex-between"><span>Cajero:</span> <span>${shift?.username || ''}</span></div>
        <div class="flex-between"><span>Apertura:</span> <span>${new Date(shift?.opened_at).toLocaleString()}</span></div>
        <div class="flex-between"><span>Corte:</span> <span>${new Date().toLocaleString()}</span></div>
        <div class="divider"></div>
        <div class="flex-between"><span>Saldo Inicial:</span> <span>${format(totals.initialBalance || 0)}</span></div>
        <div class="flex-between"><span>Ventas Efectivo:</span> <span>${format(totals.totalCash || 0)}</span></div>
        <div class="flex-between"><span>Ventas Tarjeta:</span> <span>${format(totals.totalCards || 0)}</span></div>
        <div class="flex-between"><span>Ventas Transf:</span> <span>${format(totals.totalTransfers || 0)}</span></div>
        <div class="divider"></div>
        <div class="flex-between"><span>Total Vendido:</span> <span>${format(totals.totalSales || 0)}</span></div>
        <div class="flex-between"><span>N° Ventas:</span> <span>${totals.totalSalesCount || 0}</span></div>
        <div class="divider"></div>
        <div class="flex-between"><span>Entradas Adic:</span> <span>${format(totals.movementsIn || 0)}</span></div>
        <div class="flex-between"><span>Salidas/Gastos:</span> <span>${format(totals.movementsOut || 0)}</span></div>
        <div class="divider"></div>
        <div class="flex-between bold" style="font-size: 13px;"><span>TOTAL ESPERADO:</span> <span>${format(totals.expectedBalance || 0)}</span></div>
        <div class="flex-between bold" style="font-size: 13px;"><span>EFECTIVO REAL:</span> <span>${format(totals.finalBalance || 0)}</span></div>
        <div class="flex-between bold" style="font-size: 12px; margin-top: 4px;">
          <span>${totals.difference === 0 ? 'CUADRE EXACTO' : totals.difference > 0 ? 'SOBRANTE:' : 'FALTANTE:'}</span>
          <span>${format(Math.abs(totals.difference || 0))}</span>
        </div>
        ${totals.notes ? `<div class="divider"></div><div style="font-size: 11px;"><b>Obs:</b> ${totals.notes}</div>` : ''}
        <div class="divider" style="margin-top: 30px;"></div>
        <div class="center" style="font-size: 11px;">Firma Cajero</div>
      </body>
    </html>
  `;
};

export const printCashCut = (shift, totals, settings, ticketLogo, options = {}) => {
  const htmlContent = generateCashCutHTML(shift, totals, settings, ticketLogo, options);
  
  if (options.silent && options.printerName && window.require) {
    const ipcRenderer = window.require('electron').ipcRenderer;
    ipcRenderer.invoke('print-silent', htmlContent, options.printerName)
      .catch((e) => {
        console.error("Error al imprimir silenciosamente el corte:", e);
      });
    return;
  }

  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (!printWindow) {
    alert("Por favor habilite las ventanas emergentes para poder imprimir.");
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);
};
