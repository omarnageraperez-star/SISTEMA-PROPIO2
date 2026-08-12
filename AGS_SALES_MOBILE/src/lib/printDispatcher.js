import { Capacitor } from '@capacitor/core';
import { generateTicketHTML, generateCashCutHTML } from './print';

/**
 * Clean plain-text formatting helper for Sunmi inner printer.
 * Bypasses heavy HTML/PDF rendering to print in milliseconds.
 */
const printTextSunmi = async (printer, text, alignment = 0) => {
  return new Promise((resolve) => {
    printer.setAlignment(alignment, () => {
      printer.printString(text, () => {
        resolve(true);
      });
    });
  });
};

const printTicketSunmi = async (sale, settings) => {
  const printer = window.sunmiInnerPrinter;
  const symbol = settings?.currency_symbol || '$';
  
  const format = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  try {
    await new Promise((resolve) => printer.printerInit(resolve));
    
    // Header (Centered)
    await printTextSunmi(printer, `${settings?.business_name || 'AGS SALES'}\n`, 1);
    if (settings?.business_nit) await printTextSunmi(printer, `NIT: ${settings.business_nit}\n`, 1);
    if (settings?.business_phone) await printTextSunmi(printer, `Tel: ${settings.business_phone}\n`, 1);
    if (settings?.business_address) await printTextSunmi(printer, `Dir: ${settings.business_address}\n`, 1);
    await printTextSunmi(printer, `--------------------------------\n`, 1);
    
    // Meta (Left)
    await printTextSunmi(printer, `Factura: #${sale.invoice_number || String(sale.id).padStart(6, '0')}\n`, 0);
    const dateStr = sale.created_at ? new Date(sale.created_at).toLocaleString('es-CO') : new Date().toLocaleString('es-CO');
    await printTextSunmi(printer, `Fecha: ${dateStr}\n`, 0);
    await printTextSunmi(printer, `Cajero: ${sale.user_username || 'Sistema'}\n`, 0);
    await printTextSunmi(printer, `Cliente: ${sale.customer_name || 'Consumidor Final'}\n`, 0);
    await printTextSunmi(printer, `--------------------------------\n`, 1);
    
    // Items (Left)
    const items = sale.details || [];
    for (const item of items) {
      const name = (item.product_name || '').slice(0, 22);
      const qty = Math.round(parseFloat(item.quantity || 1));
      const price = parseFloat(item.unit_price || 0);
      const subtotal = price * qty;
      await printTextSunmi(printer, `${qty}x ${name}\n`, 0);
      await printTextSunmi(printer, `   P.U. ${format(price)} | Sub: ${format(subtotal)}\n`, 0);
    }
    await printTextSunmi(printer, `--------------------------------\n`, 1);
    
    // Totals (Right)
    if (parseFloat(sale.discount || 0) > 0) {
      await printTextSunmi(printer, `Subtotal: ${format(sale.subtotal)}\n`, 2);
      await printTextSunmi(printer, `Descuento: -${format(sale.discount)}\n`, 2);
    }
    if (parseFloat(sale.tax || 0) > 0) {
      await printTextSunmi(printer, `${sale.tax_name || 'IVA'}: ${format(sale.tax)}\n`, 2);
    }
    await printTextSunmi(printer, `TOTAL NETO: ${format(sale.total)}\n`, 2);
    
    // Payments
    if (sale.payments && sale.payments.length > 0) {
      await printTextSunmi(printer, `--------------------------------\n`, 1);
      await printTextSunmi(printer, `Metodo de Pago:\n`, 0);
      for (const pay of sale.payments) {
        const method = pay.payment_method_name || 'Efectivo';
        await printTextSunmi(printer, ` - ${method}: ${format(pay.amount)}\n`, 0);
      }
    }
    
    // Footer (Centered)
    await printTextSunmi(printer, `\n`, 1);
    const footerText = settings?.ticket_footer || 'Garantia de 30 dias con su factura.\nAGS SALES ERP - Documento Oficial';
    await printTextSunmi(printer, `${footerText}\n\n`, 1);
    
    // Advance paper so it can be torn off cleanly
    await new Promise((resolve) => printer.lineWrap(4, resolve));
    return true;
  } catch (e) {
    console.error("Error printing to Sunmi:", e);
    return false;
  }
};

const printCashCutSunmi = async (shift, totals, settings) => {
  const printer = window.sunmiInnerPrinter;
  const symbol = settings?.currency_symbol || '$';
  
  const format = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  try {
    await new Promise((resolve) => printer.printerInit(resolve));
    
    // Header (Centered)
    await printTextSunmi(printer, `*** ARQUEO DE CAJA ***\n`, 1);
    await printTextSunmi(printer, `${settings?.business_name || 'AGS SALES'}\n`, 1);
    await printTextSunmi(printer, `--------------------------------\n`, 1);
    
    // Meta (Left)
    await printTextSunmi(printer, `Caja: ${shift.cash_register_name || 'Principal'}\n`, 0);
    await printTextSunmi(printer, `Usuario: ${shift.username || 'Sistema'}\n`, 0);
    const dateOpen = shift.opened_at ? new Date(shift.opened_at).toLocaleString('es-CO') : '';
    const dateClose = shift.closed_at ? new Date(shift.closed_at).toLocaleString('es-CO') : new Date().toLocaleString('es-CO');
    await printTextSunmi(printer, `Apertura: ${dateOpen}\n`, 0);
    await printTextSunmi(printer, `Cierre: ${dateClose}\n`, 0);
    await printTextSunmi(printer, `--------------------------------\n`, 1);
    
    // Breakdown (Right)
    await printTextSunmi(printer, `Saldo Inicial: ${format(shift.initial_balance)}\n`, 2);
    await printTextSunmi(printer, `Ventas Efectivo: ${format(totals.cash_sales || 0)}\n`, 2);
    await printTextSunmi(printer, `Ventas Tarjeta: ${format(totals.card_sales || 0)}\n`, 2);
    await printTextSunmi(printer, `Ventas Transferencia: ${format(totals.transfer_sales || 0)}\n`, 2);
    await printTextSunmi(printer, `Abonos Recibidos: ${format(totals.credit_pay_amount || 0)}\n`, 2);
    await printTextSunmi(printer, `Total Esperado: ${format(totals.expected_cash || 0)}\n`, 2);
    await printTextSunmi(printer, `Total Entregado: ${format(shift.final_balance || 0)}\n`, 2);
    
    // Discrepancy
    const discrepancy = parseFloat(shift.final_balance || 0) - parseFloat(totals.expected_cash || 0);
    if (Math.abs(discrepancy) > 1) {
      const label = discrepancy > 0 ? "Sobrante" : "Faltante";
      await printTextSunmi(printer, `${label}: ${format(discrepancy)}\n`, 2);
    } else {
      await printTextSunmi(printer, `Caja Cuadrada: Sí\n`, 2);
    }
    
    // Footer (Centered)
    await printTextSunmi(printer, `--------------------------------\n`, 1);
    await printTextSunmi(printer, `Firma Responsable:\n\n\n_______________________\n`, 1);
    await printTextSunmi(printer, `AGS SALES ERP\n\n`, 1);
    
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
  if (Capacitor.getPlatform() === 'android' && window.sunmiInnerPrinter) {
    return await printTicketSunmi(sale, settings);
  }
  
  // Standard fallback
  const htmlContent = generateTicketHTML(sale, settings, ticketLogo, options);
  printWeb(htmlContent);
  return true;
};

export const printCashCut = async (shift, totals, settings, ticketLogo, options = {}) => {
  if (Capacitor.getPlatform() === 'android' && window.sunmiInnerPrinter) {
    return await printCashCutSunmi(shift, totals, settings);
  }
  
  // Standard fallback
  const htmlContent = generateCashCutHTML(shift, totals, settings, ticketLogo, options);
  printWeb(htmlContent);
  return true;
};
