import React, { useState, useEffect, useRef } from 'react';
import { Save, Printer, Image as ImageIcon, ChevronRight, Check, RotateCcw } from 'lucide-react';
import { printTicket } from '../../lib/print';
import { isImageUrl, fileToDataUrl, localPathToDataUrl } from '../../lib/imageUtils';

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;

const TICKET_DEFAULTS = {
  fontTitle: 'HELVETICA_BOLD', fontContent: 'HELVETICA',
  showLogo: true, logoType: 'BUSINESS', customLogoUrl: '',
  showCustomSection: false, customSectionSize: 10, customSectionText: '',
  paperWidth: '80mm', contentWidth: '72mm', paperMarginTop: 0, paperMarginBottom: 0, paperMarginLeft: 0, paperMarginRight: 0, contentPaddingTop: 4, contentPaddingBottom: 4, contentPaddingLeft: 2, contentPaddingRight: 2,
  showBusinessData: true, businessDataSize: 10, bdName: true, bdId: true, bdAddress: true, bdEmail: true, bdPhone: true, bdPhoneLabel: 'Teléfono:',
  showTicketHeader: true, ticketHeaderLabel: 'Ticket:', ticketHeaderSize: 10,
  div1Show: true, div1Type: 'solid', div1Thickness: 0.5, div1Margin: 1,
  showTicketData: true, ticketDataSize: 10, tdDate: true, tdDateLabel: 'Fecha de emisión:', tdBox: true, tdBoxLabel: 'Caja:', tdCashier: true, tdCashierLabel: 'Cajero:', tdDocType: true, tdDocTypeLabel: 'DNI:', tdClientName: true, tdClientNameLabel: 'Nombre Cliente:', tdAddress: true, tdAddressLabel: 'Dirección:',
  saleHeaderSize: 10, saleDetailSize: 10, showDivAboveHeader: true, divHeaderType: 'solid', divHeaderThickness: 0.5, divHeaderMargin: 1, saleStyle: 'Style1', limitName: false, limitNameSize: 15, limitCode: false, limitCodeSize: 10,
  div2Show: true, div2Type: 'solid', div2Thickness: 0.5, div2Margin: 1,
  showTotals: true, totalsSize: 10, totSub: true, totSubLabel: 'Subtotal:', totTax: true, totTaxLabel: '(0.00%):', totTotal: true, totTotalLabel: 'Total:', totCurrency: true, totCurrencyLabel: 'Moneda:', totExchange: true, totExchangeLabel: 'Tipo de cambio:', totTotalAlt: true, totTotalAltLabel: 'Total en USD$:',
  div3Show: true, div3Type: 'solid', div3Thickness: 0.5, div3Margin: 1,
  showTotalLetters: true, totalLettersSize: 10,
  showPayments: true, paymentsSize: 10, payCash: true, payCashLabel: 'Efectivo: USD$', payCard: true, payCardLabel: 'Tarjeta: USD$', payTrans: true, payTransLabel: 'Transferencia: USD$', payCredit: true, payCreditLabel: 'Crédito: USD$', payOther: true, payOtherLabel: 'Mixto USD$', payChange: true, payChangeLabel: 'Vuelto: USD$',
  showObs: true, obsLabel: 'Obs:', obsSize: 10,
  div4Show: false, div4Type: 'solid', div4Thickness: 0.1, div4Margin: 0,
  footerText: '¡Muchas gracias por su compra!'
};

export default function TicketEditorModule({ config: globalConfig, systemSettings, setSystemSettings, handleSaveSettings }) {
  const [config, setConfig] = useState(TICKET_DEFAULTS);

  useEffect(() => {
    if (systemSettings?.ticket_config_json) {
      try {
        const parsed = JSON.parse(systemSettings.ticket_config_json);
        setConfig({ ...TICKET_DEFAULTS, ...parsed });
      } catch (e) {
        console.error("Error parsing ticket config", e);
      }
    }
  }, [systemSettings]);

  const fileInputRef = useRef(null);

  const handleSelectTicketLogo = async () => {
    try {
      if (ipcRenderer) {
        const path = await ipcRenderer.invoke('select-image');
        if (path) {
          const url = await localPathToDataUrl(path);
          setSystemSettings(prev => ({ ...prev, ticket_logo: url }));
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (e) {
      console.error(e);
      alert("Error al procesar la imagen del ticket: " + (e.message || e));
    }
  };

  const handleFileInputChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await fileToDataUrl(file);
        setSystemSettings(prev => ({ ...prev, ticket_logo: url }));
      } catch (err) {
        alert("Error al cargar la imagen: " + (err.message || err));
      }
    }
  };

  const update = (key, value) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    setSystemSettings(prev => ({
      ...prev,
      ticket_config_json: JSON.stringify(updated)
    }));
  };

  const Divider = ({ show, type, thickness, margin }) => {
    if (!show) return null;
    const style = {
      borderBottomStyle: type,
      borderBottomWidth: `${thickness}px`,
      borderBottomColor: '#000',
      marginTop: `${margin * 4}px`,
      marginBottom: `${margin * 4}px`
    };
    return <div style={style}></div>;
  };

  const getFontFamily = (font) => font.includes('HELVETICA') ? 'Arial, Helvetica, sans-serif' : 'Courier New, Courier, monospace';

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-2 bg-slate-50/50 rounded-2xl" style={{ height: 'calc(100vh - 120px)' }}>
      
      {/* LEFT: Live Preview */}
      <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col bg-slate-200/50 rounded-2xl border border-slate-300 p-6 shadow-inner h-full overflow-y-auto custom-scrollbar">
        <h3 className="text-sm font-bold text-slate-600 mb-6 uppercase tracking-wider flex items-center justify-center gap-2">
          <Printer size={16}/> Vista Previa
        </h3>
        <div className="flex-1 flex justify-center pb-8 overflow-x-auto">
          {/* Thermal Paper Simulation */}
          <div 
            className="bg-white shadow-xl text-black" 
            style={{ 
              width: config.paperWidth || '80mm',
              minHeight: '600px',
              padding: `${config.paperMarginTop ?? 0}mm ${config.paperMarginRight ?? 0}mm ${config.paperMarginBottom ?? 0}mm ${config.paperMarginLeft ?? 0}mm`
            }}
          >
            <div 
              style={{
                width: config.contentWidth || '72mm',
                margin: '0 auto',
                padding: `${config.contentPaddingTop ?? 4}mm ${config.contentPaddingRight ?? 2}mm ${config.contentPaddingBottom ?? 4}mm ${config.contentPaddingLeft ?? 2}mm`,
                fontFamily: getFontFamily(config.fontContent), 
                fontSize: '11px', 
                lineHeight: '1.4' 
              }}
            >
            
            {/* Logo */}
            {config.showLogo && (
              <div className="flex justify-center mb-4">
                {config.logoType === 'BUSINESS' ? (
                  <div className="w-24 h-24 bg-slate-100 flex items-center justify-center border border-slate-300 overflow-hidden">
                    {isImageUrl(systemSettings?.app_logo || globalConfig?.app_logo) ? (
                      <img src={systemSettings?.app_logo || globalConfig?.app_logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <ImageIcon className="text-slate-400" size={32} />
                    )}
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-slate-100 flex items-center justify-center border border-slate-300 overflow-hidden">
                    {isImageUrl(systemSettings?.ticket_logo || globalConfig?.ticket_logo) ? (
                      <img src={systemSettings?.ticket_logo || globalConfig?.ticket_logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-xs text-slate-400">Custom Image</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Custom Section */}
            {config.showCustomSection && config.customSectionText && (
              <div className="text-center mb-2 whitespace-pre-wrap" style={{ fontSize: `${config.customSectionSize}px` }}>
                {config.customSectionText}
              </div>
            )}

            {/* Business Data */}
            {config.showBusinessData && (
              <div className="text-center mb-2" style={{ fontSize: `${config.businessDataSize}px` }}>
                {config.bdName && <div className="font-bold">{systemSettings.business_name || 'Nombre Empresa S.A.'}</div>}
                {config.bdId && <div>{systemSettings.business_nit || 'NIT: 123456789-0'}</div>}
                {config.bdAddress && <div>{systemSettings.business_address || 'Av. Principal 123'}</div>}
                {config.bdEmail && <div>{systemSettings.smtp_user || 'contacto@empresa.com'}</div>}
                {config.bdPhone && <div>{config.bdPhoneLabel} {systemSettings.business_phone || '555-0123'}</div>}
              </div>
            )}

            {/* Ticket Header */}
            <div className="text-center font-bold mb-2 mt-4" style={{ fontSize: `${config.ticketHeaderSize}px`, fontFamily: getFontFamily(config.fontTitle) }}>
              <div>{systemSettings.ticket_header || 'SISTEMA POS'}</div>
              {config.showTicketHeader && <div>{config.ticketHeaderLabel} T001-000015</div>}
            </div>

            <Divider show={config.div1Show} type={config.div1Type} thickness={config.div1Thickness} margin={config.div1Margin} />

            {/* Ticket Data */}
            {config.showTicketData && (
              <div className="mb-2" style={{ fontSize: `${config.ticketDataSize}px` }}>
                {config.tdDate && <div><strong>{config.tdDateLabel}</strong> {new Date().toLocaleString('es-CO')}</div>}
                {config.tdBox && <div><strong>{config.tdBoxLabel}</strong> Caja Principal &nbsp; {config.tdCashier && <strong>{config.tdCashierLabel}</strong>} {config.tdCashier && 'VP'}</div>}
                {config.tdDocType && <div><strong>{config.tdDocTypeLabel}</strong> 999999999</div>}
                {config.tdClientName && <div><strong>{config.tdClientNameLabel}</strong> Consumidor Final</div>}
                {config.tdAddress && <div><strong>{config.tdAddressLabel}</strong> Av. De prueba 123</div>}
              </div>
            )}

            {/* Sale Header */}
            <table className="w-full text-left mb-1" style={{ fontSize: `${config.saleHeaderSize}px`, fontWeight: 'bold' }}>
              <thead>
                <tr>
                  <th className="pb-1 w-12">Cant</th>
                  <th className="pb-1">Desc</th>
                  <th className="pb-1 text-right w-16">P.Unit</th>
                  <th className="pb-1 text-right w-16">Total</th>
                </tr>
              </thead>
            </table>
            
            <Divider show={config.showDivAboveHeader} type={config.divHeaderType} thickness={config.divHeaderThickness} margin={config.divHeaderMargin} />

            {/* Sale Detail */}
            <table className="w-full text-left mb-2" style={{ fontSize: `${config.saleDetailSize}px` }}>
              <tbody>
                <tr>
                  <td className="align-top w-12 pt-1">1.00</td>
                  <td className="align-top pt-1 leading-tight">
                    [PROD-1] {config.limitName ? 'Producto de prueba...'.substring(0, config.limitNameSize) : 'Producto de prueba con descripción larga'}
                  </td>
                  <td className="align-top text-right w-16 pt-1">10.00</td>
                  <td className="align-top text-right w-16 pt-1">10.00</td>
                </tr>
                <tr>
                  <td className="align-top w-12 pt-1">2.00</td>
                  <td className="align-top pt-1 leading-tight">
                    [PROD-2] Agua Mineral 500ml
                  </td>
                  <td className="align-top text-right w-16 pt-1">1.50</td>
                  <td className="align-top text-right w-16 pt-1">3.00</td>
                </tr>
              </tbody>
            </table>

            <Divider show={config.div2Show} type={config.div2Type} thickness={config.div2Thickness} margin={config.div2Margin} />

            {/* Totals */}
            {config.showTotals && (
              <div className="flex flex-col items-end mb-2" style={{ fontSize: `${config.totalsSize}px` }}>
                {config.totSub && <div className="flex justify-between w-48"><span>{config.totSubLabel}</span><span>13.00</span></div>}
                {config.totTax && <div className="flex justify-between w-48"><span>{config.totTaxLabel}</span><span>0.00</span></div>}
                {config.totTotal && <div className="flex justify-between w-48 font-bold"><span>{config.totTotalLabel}</span><span>13.00</span></div>}
                {config.totCurrency && <div className="flex justify-between w-48"><span>{config.totCurrencyLabel}</span><span>Dólares / USD</span></div>}
                {config.totExchange && <div className="flex justify-between w-48"><span>{config.totExchangeLabel}</span><span>1.0000</span></div>}
                {config.totTotalAlt && <div className="flex justify-between w-48"><span>{config.totTotalAltLabel}</span><span>13.00</span></div>}
              </div>
            )}

            <Divider show={config.div3Show} type={config.div3Type} thickness={config.div3Thickness} margin={config.div3Margin} />

            {/* Total Letters */}
            {config.showTotalLetters && (
              <div className="mb-2 uppercase" style={{ fontSize: `${config.totalLettersSize}px` }}>
                Son: TRECE CON 00/100 {systemSettings.currency_code || 'USD'}
              </div>
            )}

            {/* Payments */}
            {config.showPayments && (
              <div className="flex flex-col items-end mb-2 font-bold" style={{ fontSize: `${config.paymentsSize}px` }}>
                {config.payCash && <div className="flex justify-between w-48"><span>{config.payCashLabel}</span><span>15.00</span></div>}
                {config.payChange && <div className="flex justify-between w-48"><span>{config.payChangeLabel}</span><span>2.00</span></div>}
              </div>
            )}

            {/* Obs */}
            {config.showObs && (
              <div className="mb-2" style={{ fontSize: `${config.obsSize}px` }}>
                {config.obsLabel} Esto es una observación de ejemplo para la venta.
              </div>
            )}

            <Divider show={config.div4Show} type={config.div4Type} thickness={config.div4Thickness} margin={config.div4Margin} />

            <div className="text-center mt-4">
              {config.footerText}
            </div>

            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Settings Panel */}
      <div className="flex-1 flex flex-col glass-panel rounded-2xl shadow-sm border border-slate-200 bg-white h-full overflow-hidden">
        
        {/* Header Actions */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Diseño del Recibo</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Configura los parámetros del ticket térmico (80mm)</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                setConfig(TICKET_DEFAULTS);
                setSystemSettings(prev => ({
                  ...prev,
                  ticket_config_json: JSON.stringify(TICKET_DEFAULTS)
                }));
              }}
              className="bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <RotateCcw size={16}/> Restaurar
            </button>
            <button 
              onClick={() => {
                const mockSale = {
                  invoice_number: "TEST-0001",
                  created_at: new Date().toISOString(),
                  user_username: "Cajero Demo",
                  customer_name: "Consumidor Final",
                  details: [
                    { product_name: "Producto de Prueba 1", quantity: 2, subtotal: 15000 },
                    { product_name: "Producto de Prueba 2", quantity: 1, subtotal: 8000 }
                  ],
                  subtotal: 23000,
                  tax: 0,
                  total: 23000,
                  payments: [{ method: "Efectivo", amount: 25000 }],
                  observations: "Impresión de prueba"
                };
                printTicket(mockSale, systemSettings, systemSettings.ticket_logo || globalConfig?.ticket_logo, { preview: true, printerName: globalConfig?.default_printer });
              }}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <Printer size={16}/> Testear Impresión
            </button>
            <button onClick={handleSaveSettings} className="btn-premium px-6 py-2.5 !rounded-xl text-sm font-bold flex items-center gap-2 shadow-md">
              <Save size={18}/> Guardar Formato
            </button>
          </div>
        </div>

        {/* Config Form */}
        <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar flex-1 pb-16">
          
          {/* 1. Dimensiones y Papel */}
          <Section title="Dimensiones, Márgenes y Papel">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Select label="Ancho del Papel" value={config.paperWidth} onChange={v => update('paperWidth', v)} options={['80mm', '58mm']} />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Ancho Contenido (mm)</span>
                  <input type="text" className="glass-input !py-1 !px-2 text-xs font-mono w-20" value={config.contentWidth?.replace('mm','') || '72'} onChange={e => update('contentWidth', `${e.target.value}mm`)} />
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-xs font-bold text-slate-600 block mb-2">Márgenes de Impresión (mm)</span>
                <div className="flex flex-wrap gap-3">
                  <NumberInput label="Arriba" value={config.paperMarginTop} onChange={v => update('paperMarginTop', v)} />
                  <NumberInput label="Abajo" value={config.paperMarginBottom} onChange={v => update('paperMarginBottom', v)} />
                  <NumberInput label="Izq." value={config.paperMarginLeft} onChange={v => update('paperMarginLeft', v)} />
                  <NumberInput label="Der." value={config.paperMarginRight} onChange={v => update('paperMarginRight', v)} />
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-xs font-bold text-slate-600 block mb-2">Paddings / Relleno Interno (mm)</span>
                <div className="flex flex-wrap gap-3">
                  <NumberInput label="Arriba" value={config.contentPaddingTop} onChange={v => update('contentPaddingTop', v)} />
                  <NumberInput label="Abajo" value={config.contentPaddingBottom} onChange={v => update('contentPaddingBottom', v)} />
                  <NumberInput label="Izq." value={config.contentPaddingLeft} onChange={v => update('contentPaddingLeft', v)} />
                  <NumberInput label="Der." value={config.contentPaddingRight} onChange={v => update('contentPaddingRight', v)} />
                </div>
              </div>
            </div>
          </Section>

          {/* 1. Fuente y Tamaño */}
          <Section title="Fuente de ticket a editar">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Fuente títulos" value={config.fontTitle} onChange={v => update('fontTitle', v)} options={['HELVETICA_BOLD', 'HELVETICA', 'COURIER_BOLD']} />
              <Select label="Fuente contenido" value={config.fontContent} onChange={v => update('fontContent', v)} options={['HELVETICA', 'COURIER']} />
            </div>
          </Section>

          {/* 2. Imprimir Logo */}
          <Section title="Imprimir logo" checked={config.showLogo} onCheck={v => update('showLogo', v)}>
            <div className="flex flex-col gap-3">
              <Radio name="logoType" label="Logo de empresa o negocio" checked={config.logoType === 'BUSINESS'} onChange={() => update('logoType', 'BUSINESS')} />
              
              {config.logoType === 'BUSINESS' && (
                <div className="pl-6 pb-1">
                  <span className="text-xs text-slate-500 italic">Se usará el logo principal de tu empresa.</span>
                </div>
              )}

              <Radio name="logoType" label="Usar otra imagen" checked={config.logoType === 'CUSTOM'} onChange={() => update('logoType', 'CUSTOM')} />

              {config.logoType === 'CUSTOM' && (
                <div className="pl-6 pb-1">
                  <label className="text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <ImageIcon size={10}/> Ruta de imagen local
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileInputChange} 
                      accept="image/png,image/jpeg,image/webp,image/jpg" 
                      className="hidden" 
                    />
                    <input type="text" readOnly placeholder="No se ha seleccionado ninguna imagen..." className="glass-input flex-1 !py-1.5 !px-2 text-xs" value={systemSettings?.ticket_logo || ''} />
                    <button type="button" className="bg-indigo-50 border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all hover:bg-indigo-100 flex items-center gap-1 text-xs font-bold" onClick={handleSelectTicketLogo}>
                      Examinar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 3. Apartado Personalizado */}
          <Section title="Incluir apartado personalizado" checked={config.showCustomSection} onCheck={v => update('showCustomSection', v)} extra={<NumberInput label="Tamaño de fuente" value={config.customSectionSize} onChange={v => update('customSectionSize', v)} />}>
            <textarea 
              className="glass-input w-full min-h-24 resize-y text-sm" 
              placeholder="Ingrese contenido Personalizado (Aparecerá debajo del logo)"
              value={config.customSectionText}
              onChange={e => update('customSectionText', e.target.value)}
            />
          </Section>

          {/* 4. Datos de Negocio */}
          <Section title="Incluir datos de negocio" checked={config.showBusinessData} onCheck={v => update('showBusinessData', v)} extra={<NumberInput label="Tamaño de fuente" value={config.businessDataSize} onChange={v => update('businessDataSize', v)} />}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-56 shrink-0"><Checkbox label="Nombre de empresa" checked={config.bdName} onChange={v => update('bdName', v)} /></div>
                <input type="text" className="glass-input flex-1 !py-1.5 text-xs" placeholder="Ej: Mi Empresa S.A." value={systemSettings.business_name || ''} onChange={e => setSystemSettings(prev => ({...prev, business_name: e.target.value}))} disabled={!config.bdName} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-56 shrink-0"><Checkbox label="Identificación fiscal (NIT/RUT)" checked={config.bdId} onChange={v => update('bdId', v)} /></div>
                <input type="text" className="glass-input flex-1 !py-1.5 text-xs" placeholder="Ej: NIT: 123456789" value={systemSettings.business_nit || ''} onChange={e => setSystemSettings(prev => ({...prev, business_nit: e.target.value}))} disabled={!config.bdId} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-56 shrink-0"><Checkbox label="Dirección" checked={config.bdAddress} onChange={v => update('bdAddress', v)} /></div>
                <input type="text" className="glass-input flex-1 !py-1.5 text-xs" placeholder="Ej: Av Principal 123" value={systemSettings.business_address || ''} onChange={e => setSystemSettings(prev => ({...prev, business_address: e.target.value}))} disabled={!config.bdAddress} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-56 shrink-0"><Checkbox label="Email" checked={config.bdEmail} onChange={v => update('bdEmail', v)} /></div>
                <input type="text" className="glass-input flex-1 !py-1.5 text-xs" placeholder="Ej: info@empresa.com" value={systemSettings.smtp_user || ''} onChange={e => setSystemSettings(prev => ({...prev, smtp_user: e.target.value}))} disabled={!config.bdEmail} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-56 shrink-0"><Checkbox label="Teléfono" checked={config.bdPhone} onChange={v => update('bdPhone', v)} /></div>
                <input type="text" className="glass-input w-24 !py-1.5 text-xs font-bold" placeholder="Etiqueta" value={config.bdPhoneLabel} onChange={e => update('bdPhoneLabel', e.target.value)} disabled={!config.bdPhone} />
                <input type="text" className="glass-input flex-1 !py-1.5 text-xs" placeholder="Ej: 555-0123" value={systemSettings.business_phone || ''} onChange={e => setSystemSettings(prev => ({...prev, business_phone: e.target.value}))} disabled={!config.bdPhone} />
              </div>
            </div>
          </Section>

          {/* 4.5 Encabezado Principal */}
          <Section title="Título principal del ticket">
            <input type="text" className="glass-input w-full !py-1.5 text-sm font-bold" placeholder="Ej: SISTEMA POS" value={systemSettings.ticket_header || ''} onChange={e => setSystemSettings(prev => ({...prev, ticket_header: e.target.value}))} />
          </Section>

          {/* 5. Ticket Serie Numero */}
          <Section title="Ticket (Serie - Número)" checked={config.showTicketHeader} onCheck={v => update('showTicketHeader', v)} extra={<NumberInput label="Tamaño de fuente" value={config.ticketHeaderSize} onChange={v => update('ticketHeaderSize', v)} />}>
            <div className="flex items-center gap-3">
              <input type="text" className="glass-input !py-1 !px-2 text-xs w-32" value={config.ticketHeaderLabel} onChange={e => update('ticketHeaderLabel', e.target.value)} />
              <span className="text-xs text-slate-500 font-medium">$Serie - $Numero</span>
            </div>
          </Section>

          {/* 6. Primer Divisor */}
          <Section title="Incluir primer divisor" checked={config.div1Show} onCheck={v => update('div1Show', v)}>
            <DividerConfig prefix="div1" config={config} update={update} />
          </Section>

          {/* 7. Datos del Ticket */}
          <Section title="Datos del ticket" checked={config.showTicketData} onCheck={v => update('showTicketData', v)} extra={<NumberInput label="Tamaño de fuente" value={config.ticketDataSize} onChange={v => update('ticketDataSize', v)} />}>
            <div className="flex flex-col gap-3">
              <ConfigRow checked={config.tdDate} onCheck={v=>update('tdDate', v)} labelValue={config.tdDateLabel} onLabelChange={e=>update('tdDateLabel', e.target.value)} hint="$Fecha" />
              <div className="flex items-center gap-6">
                <ConfigRow checked={config.tdBox} onCheck={v=>update('tdBox', v)} labelValue={config.tdBoxLabel} onLabelChange={e=>update('tdBoxLabel', e.target.value)} hint="$Nombre de Caja" />
                <ConfigRow checked={config.tdCashier} onCheck={v=>update('tdCashier', v)} labelValue={config.tdCashierLabel} onLabelChange={e=>update('tdCashierLabel', e.target.value)} hint="$Nombre de usuario" />
              </div>
              <ConfigRow checked={config.tdDocType} onCheck={v=>update('tdDocType', v)} labelValue={config.tdDocTypeLabel} onLabelChange={e=>update('tdDocTypeLabel', e.target.value)} hint="$Numero de documento (Solo si aplica)" />
              <ConfigRow checked={config.tdClientName} onCheck={v=>update('tdClientName', v)} labelValue={config.tdClientNameLabel} onLabelChange={e=>update('tdClientNameLabel', e.target.value)} hint="$Nombre de cliente" />
              <ConfigRow checked={config.tdAddress} onCheck={v=>update('tdAddress', v)} labelValue={config.tdAddressLabel} onLabelChange={e=>update('tdAddressLabel', e.target.value)} hint="$Direccion (Solo si aplica)" />
            </div>
          </Section>

          {/* 8. Detalle de venta */}
          <Section title="Detalle de venta" extra={<div className="flex gap-4"><NumberInput label="Cabecera" value={config.saleHeaderSize} onChange={v => update('saleHeaderSize', v)} /><NumberInput label="Detalle" value={config.saleDetailSize} onChange={v => update('saleDetailSize', v)} /></div>}>
            <div className="flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" checked={config.showDivAboveHeader} onChange={e => update('showDivAboveHeader', e.target.checked)} />
                  <span className="text-sm font-bold text-slate-700">Incluir divisores sobre la cabecera</span>
                </div>
                <DividerConfig prefix="divHeader" config={config} update={update} />
              </div>
              <Select label="Seleccione un estilo del detalle de venta" value={config.saleStyle} onChange={v => update('saleStyle', v)} options={['Estilo 1', 'Estilo 2', 'Estilo 3']} />
              <div className="flex items-center gap-3">
                <Checkbox label="Limitar tamaño de Nombre" checked={config.limitName} onChange={v => update('limitName', v)} />
                <NumberInput value={config.limitNameSize} onChange={v => update('limitNameSize', v)} />
              </div>
              <div className="flex items-center gap-3">
                <Checkbox label="Limitar tamaño de código" checked={config.limitCode} onChange={v => update('limitCode', v)} />
                <NumberInput value={config.limitCodeSize} onChange={v => update('limitCodeSize', v)} />
              </div>
            </div>
          </Section>

          {/* 9. Segundo Divisor */}
          <Section title="Incluir segundo divisor" checked={config.div2Show} onCheck={v => update('div2Show', v)}>
            <DividerConfig prefix="div2" config={config} update={update} />
          </Section>

          {/* 10. Subtotal | Impuesto | Total */}
          <Section title="Subtotal | Impuesto | Total" checked={config.showTotals} onCheck={v => update('showTotals', v)} extra={<NumberInput label="Tamaño de fuente" value={config.totalsSize} onChange={v => update('totalsSize', v)} />}>
            <div className="flex flex-col gap-3">
              <ConfigRow checked={config.totSub} onCheck={v=>update('totSub', v)} labelValue={config.totSubLabel} onLabelChange={e=>update('totSubLabel', e.target.value)} hint="$Simbolo de moneda | $ Valor" />
              <ConfigRow checked={config.totTax} onCheck={v=>update('totTax', v)} labelValue={config.totTaxLabel} onLabelChange={e=>update('totTaxLabel', e.target.value)} hint="$Tipo de impuesto | % de impuesto | $ Valor" />
              <ConfigRow checked={config.totTotal} onCheck={v=>update('totTotal', v)} labelValue={config.totTotalLabel} onLabelChange={e=>update('totTotalLabel', e.target.value)} hint="$Simbolo de moneda | $ Valor" />
              <ConfigRow checked={config.totCurrency} onCheck={v=>update('totCurrency', v)} labelValue={config.totCurrencyLabel} onLabelChange={e=>update('totCurrencyLabel', e.target.value)} hint="$Moneda en letras | $ Valor (Si aplica)" />
              <ConfigRow checked={config.totExchange} onCheck={v=>update('totExchange', v)} labelValue={config.totExchangeLabel} onLabelChange={e=>update('totExchangeLabel', e.target.value)} hint="$ Valor (Si aplica)" />
              <ConfigRow checked={config.totTotalAlt} onCheck={v=>update('totTotalAlt', v)} labelValue={config.totTotalAltLabel} onLabelChange={e=>update('totTotalAltLabel', e.target.value)} hint="$Simbolo de la otra moneda : (Si aplica)" />
            </div>
          </Section>

          {/* 11. Tercer Divisor */}
          <Section title="Incluir tercer divisor" checked={config.div3Show} onCheck={v => update('div3Show', v)}>
            <DividerConfig prefix="div3" config={config} update={update} />
          </Section>

          {/* 12. Total letras */}
          <Section title="Incluir el total en letras" checked={config.showTotalLetters} onCheck={v => update('showTotalLetters', v)} extra={<NumberInput label="Tamaño de fuente" value={config.totalLettersSize} onChange={v => update('totalLettersSize', v)} />} />

          {/* 13. Formas de pago */}
          <Section title="Formas de pago que apliquen y vuelto" checked={config.showPayments} onCheck={v => update('showPayments', v)} extra={<NumberInput label="Tamaño de fuente" value={config.paymentsSize} onChange={v => update('paymentsSize', v)} />}>
            <div className="flex flex-col gap-3">
              <ConfigRow checked={config.payCash} onCheck={v=>update('payCash', v)} labelValue={config.payCashLabel} onLabelChange={e=>update('payCashLabel', e.target.value)} hint="$Simbolo de moneda | $ Valor" />
              <ConfigRow checked={config.payCard} onCheck={v=>update('payCard', v)} labelValue={config.payCardLabel} onLabelChange={e=>update('payCardLabel', e.target.value)} hint="$Simbolo de moneda | $ Valor" />
              <ConfigRow checked={config.payTrans} onCheck={v=>update('payTrans', v)} labelValue={config.payTransLabel} onLabelChange={e=>update('payTransLabel', e.target.value)} hint="$Simbolo de moneda | $ Valor" />
              <ConfigRow checked={config.payCredit} onCheck={v=>update('payCredit', v)} labelValue={config.payCreditLabel} onLabelChange={e=>update('payCreditLabel', e.target.value)} hint="$Simbolo de moneda | $ Valor" />
              <ConfigRow checked={config.payOther} onCheck={v=>update('payOther', v)} labelValue={config.payOtherLabel} onLabelChange={e=>update('payOtherLabel', e.target.value)} hint="$Simbolo de moneda | $ Valor" />
              <ConfigRow checked={config.payChange} onCheck={v=>update('payChange', v)} labelValue={config.payChangeLabel} onLabelChange={e=>update('payChangeLabel', e.target.value)} hint="$Simbolo de moneda | $ Valor" />
            </div>
          </Section>

          {/* 14. Obs */}
          <Section title="Observaciones (Obs)" checked={config.showObs} onCheck={v => update('showObs', v)} extra={<NumberInput label="Tamaño de fuente" value={config.obsSize} onChange={v => update('obsSize', v)} />}>
            <div className="flex items-center gap-3">
              <input type="text" className="glass-input !py-1 !px-2 text-xs w-32" value={config.obsLabel} onChange={e => update('obsLabel', e.target.value)} />
              <span className="text-xs text-slate-500 font-medium">$Texto de observación</span>
            </div>
          </Section>
          
          {/* 15. Cuarto Divisor */}
          <Section title="Incluir cuarto divisor" checked={config.div4Show} onCheck={v => update('div4Show', v)}>
            <DividerConfig prefix="div4" config={config} update={update} />
          </Section>

          {/* 16. Footer Text */}
          <Section title="Pie de página del ticket">
            <textarea 
              className="glass-input w-full resize-y text-sm" 
              value={config.footerText}
              onChange={e => update('footerText', e.target.value)}
            />
          </Section>

        </div>
      </div>
    </div>
  );
}

// Subcomponents for cleaner code
function Section({ title, checked, onCheck, extra, children }) {
  const hasCheckbox = typeof checked !== 'undefined';
  return (
    <div className="bg-white border border-indigo-100 rounded-xl overflow-hidden shadow-sm hover:border-indigo-300 transition-colors shrink-0">
      <div className="bg-indigo-50/50 px-4 py-3 flex items-center justify-between border-b border-indigo-50">
        <div className="flex items-center gap-3">
          {hasCheckbox && (
            <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer" checked={checked} onChange={e => onCheck(e.target.checked)} />
          )}
          <h4 className={`text-sm font-bold ${hasCheckbox && !checked ? 'text-slate-400' : 'text-indigo-900'}`}>{title}</h4>
        </div>
        {extra && <div className={hasCheckbox && !checked ? 'opacity-40 pointer-events-none' : ''}>{extra}</div>}
      </div>
      {children && (
        <div className={`p-4 ${hasCheckbox && !checked ? 'opacity-40 pointer-events-none' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      {label && <label className="block text-xs font-bold text-slate-600 mb-1">{label}</label>}
      <select className="glass-input !py-1.5 text-xs w-full font-semibold" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Radio({ name, label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input type="radio" name={name} className="text-indigo-600 focus:ring-indigo-500 h-4 w-4" checked={checked} onChange={onChange} />
      <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">{label}</span>
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">{label}</span>
    </label>
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
      {label && <span className="text-xs font-bold text-slate-500">{label}</span>}
      <input type="number" step="0.1" className="w-16 text-xs font-mono font-bold text-slate-700 focus:outline-none text-right" value={value !== undefined ? value : ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function DividerConfig({ prefix, config, update }) {
  return (
    <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-600">Tipo</span>
        <select className="glass-input !py-1 !px-2 text-xs font-semibold w-28" value={config[`${prefix}Type`]} onChange={e => update(`${prefix}Type`, e.target.value)}>
          <option value="solid">Solid Line</option>
          <option value="dashed">Dashed Line</option>
          <option value="dotted">Dotted Line</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-600">Grosor</span>
        <input type="number" step="0.1" className="glass-input !py-1 !px-2 text-xs font-mono w-16" value={config[`${prefix}Thickness`] !== undefined ? config[`${prefix}Thickness`] : ''} onChange={e => update(`${prefix}Thickness`, e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-600">Margen SUP/INF</span>
        <input type="number" step="0.1" className="glass-input !py-1 !px-2 text-xs font-mono w-16" value={config[`${prefix}Margin`] !== undefined ? config[`${prefix}Margin`] : ''} onChange={e => update(`${prefix}Margin`, e.target.value)} />
      </div>
    </div>
  );
}

function ConfigRow({ checked, onCheck, labelValue, onLabelChange, hint }) {
  return (
    <div className="flex items-center gap-3">
      <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 shrink-0" checked={checked} onChange={e => onCheck(e.target.checked)} />
      <input type="text" className="glass-input !py-1 !px-2 text-xs w-36 shrink-0" value={labelValue} onChange={onLabelChange} disabled={!checked} />
      <span className={`text-xs font-medium truncate ${checked ? 'text-slate-500' : 'text-slate-300'}`}>{hint}</span>
    </div>
  );
}
