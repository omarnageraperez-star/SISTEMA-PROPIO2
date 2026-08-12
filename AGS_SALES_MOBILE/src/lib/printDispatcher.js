import { Capacitor } from '@capacitor/core';
import { generateTicketHTML, generateCashCutHTML } from './print';

/**
 * Bulk text printing helper for Sunmi inner printer.
 * Minimizes Webview IPC overhead by configuring properties and pushing text in single batches.
 */
const printBlockSunmi = async (printer, text, alignment, fontSize = 24) => {
  return new Promise((resolve) => {
    printer.setFontSize(fontSize, () => {
      printer.setAlignment(alignment, () => {
        printer.printOriginalText(text, () => {
          resolve(true);
        });
      });
    });
  });
};

const printTicketSunmi = async (sale, settings) => {
  const printer = window.navigator.sunmiInnerPrinter;
  const symbol = settings?.currency_symbol || '$';
  
  const format = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  try {
    await new Promise((resolve) => printer.printerInit(resolve));
    
    // Header (Centered, Font Size 30 for name, 24 for NIT & address)
    await printBlockSunmi(printer, `${settings?.business_name || 'AGS SALES'}\n`, 1, 30);
    
    let headerText = '';
    if (settings?.business_nit) headerText += `NIT: ${settings.business_nit}\n`;
    if (settings?.business_phone) headerText += `Tel: ${settings.business_phone}\n`;
    if (settings?.business_address) headerText += `Dir: ${settings.business_address}\n`;
    headerText += `--------------------------------\n`;
    await printBlockSunmi(printer, headerText, 1, 24);
    
    // Meta & Items (Left-aligned, Font Size 24)
    let bodyText = '';
    bodyText += `Factura: #${sale.invoice_number || String(sale.id).padStart(6, '0')}\n`;
    const dateStr = sale.created_at ? new Date(sale.created_at).toLocaleString('es-CO') : new Date().toLocaleString('es-CO');
    bodyText += `Fecha: ${dateStr}\n`;
    bodyText += `Cajero: ${sale.user_username || 'Sistema'}\n`;
    bodyText += `Cliente: ${sale.customer_name || 'Consumidor Final'}\n`;
    bodyText += `--------------------------------\n`;
    
    const items = sale.details || [];
    for (const item of items) {
      const name = (item.product_name || '').slice(0, 22);
      const qty = Math.round(parseFloat(item.quantity || 1));
      const price = parseFloat(item.unit_price || 0);
      const subtotal = price * qty;
      bodyText += `${qty}x ${name}\n`;
      bodyText += `   P.U. ${format(price)} | Sub: ${format(subtotal)}\n`;
    }
    bodyText += `--------------------------------\n`;
    await printBlockSunmi(printer, bodyText, 0, 24);
    
    // Totals (Right-aligned, Font Size 26)
    let totalsText = '';
    if (parseFloat(sale.discount || 0) > 0) {
      totalsText += `Subtotal: ${format(sale.subtotal)}\n`;
      totalsText += `Descuento: -${format(sale.discount)}\n`;
    }
    if (parseFloat(sale.tax || 0) > 0) {
      totalsText += `${sale.tax_name || 'IVA'}: ${format(sale.tax)}\n`;
    }
    totalsText += `TOTAL NETO: ${format(sale.total)}\n`;
    await printBlockSunmi(printer, totalsText, 2, 26);
    
    // Payments & Footer (Centered, Font Size 24)
    let footerText = '';
    if (sale.payments && sale.payments.length > 0) {
      footerText += `--------------------------------\n`;
      footerText += `Metodos de Pago:\n`;
      for (const pay of sale.payments) {
        const method = pay.payment_method_name || 'Efectivo';
        footerText += ` - ${method}: ${format(pay.amount)}\n`;
      }
    }
    footerText += `--------------------------------\n\n`;
    const footerMsg = settings?.ticket_footer || 'Garantia de 30 dias con su factura.\nAGS SALES ERP - Documento Oficial';
    footerText += `${footerMsg}\n\n`;
    await printBlockSunmi(printer, footerText, 1, 24);
    
    // Advance paper so it can be torn off cleanly
    await new Promise((resolve) => printer.lineWrap(4, resolve));
    return true;
  } catch (e) {
    console.error("Error printing to Sunmi:", e);
    return false;
  }
};

const printCashCutSunmi = async (shift, totals, settings) => {
  const printer = window.navigator.sunmiInnerPrinter;
  const symbol = settings?.currency_symbol || '$';
  
  const format = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const line = (label, value) => {
    const l = String(label);
    const v = String(value);
    const space = 32 - l.length - v.length;
    return l + ' '.repeat(Math.max(1, space)) + v + '\n';
  };

  try {
    await new Promise((resolve) => printer.printerInit(resolve));
    
    // Header (Centered, Font Size 30)
    await printBlockSunmi(printer, `*** ARQUEO DE CAJA ***\n`, 1, 30);
    await printBlockSunmi(printer, `${settings?.business_name || 'AGS SALES'}\n--------------------------------\n`, 1, 24);
    
    // Meta & Breakdown (Left-aligned, Font Size 24)
    let bodyText = '';
    bodyText += line('Caja:', shift.cash_register_name || 'Principal');
    bodyText += line('Usuario:', shift.username || 'Sistema');
    const dateOpen = shift.opened_at ? new Date(shift.opened_at).toLocaleString('es-CO') : '';
    const dateClose = shift.closed_at ? new Date(shift.closed_at).toLocaleString('es-CO') : new Date().toLocaleString('es-CO');
    bodyText += `Apertura: ${dateOpen}\n`;
    bodyText += `Cierre: ${dateClose}\n`;
    bodyText += `--------------------------------\n`;
    
    bodyText += line('Saldo Inicial:', format(shift.initial_balance));
    bodyText += line('Ventas Efectivo:', format(totals.cash_sales || 0));
    bodyText += line('Ventas Tarjeta:', format(totals.card_sales || 0));
    bodyText += line('Ventas Transferencia:', format(totals.transfer_sales || 0));
    bodyText += line('Abonos Recibidos:', format(totals.credit_pay_amount || 0));
    bodyText += line('Total Esperado:', format(totals.expected_cash || 0));
    bodyText += line('Total Entregado:', format(shift.final_balance || 0));
    
    // Discrepancy
    const discrepancy = parseFloat(shift.final_balance || 0) - parseFloat(totals.expected_cash || 0);
    if (Math.abs(discrepancy) > 1) {
      const label = discrepancy > 0 ? "Sobrante:" : "Faltante:";
      bodyText += line(label, format(discrepancy));
    } else {
      bodyText += line('Caja Cuadrada:', 'Si');
    }
    
    bodyText += `--------------------------------\n`;
    await printBlockSunmi(printer, bodyText, 0, 24);
    
    // Footer (Centered)
    let footerText = `Firma Responsable:\n\n\n_______________________\n`;
    footerText += `AGS SALES ERP\n\n`;
    await printBlockSunmi(printer, footerText, 1, 24);
    
    await new Promise((resolve) => printer.lineWrap(4, resolve));
    return true;
  } catch (e) {
    console.error("Error printing cash cut to Sunmi:", e);
    return false;
  }
};

/**
 * Standard Web print fallback for normal smartphones or PC browsers.
 */
const printWeb = (htmlContent) => {
  const printWindow = window.open('', '_blank', 'width=400,height=700');
  if (!printWindow) {
    alert("Por favor habilite las ventanas emergentes para poder imprimir el ticket.");
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};

export const printTicket = async (sale, settings, ticketLogo, options = {}) => {
  if (Capacitor.getPlatform() === 'android' && window.navigator.sunmiInnerPrinter) {
    return await printTicketSunmi(sale, settings);
  }
  
  // Standard fallback
  const htmlContent = generateTicketHTML(sale, settings, ticketLogo, options);
  printWeb(htmlContent);
  return true;
};

export const printCashCut = async (shift, totals, settings, ticketLogo, options = {}) => {
  if (Capacitor.getPlatform() === 'android' && window.navigator.sunmiInnerPrinter) {
    return await printCashCutSunmi(shift, totals, settings);
  }
  
  // Standard fallback
  const htmlContent = generateCashCutHTML(shift, totals, settings, ticketLogo, options);
  printWeb(htmlContent);
  return true;
};
