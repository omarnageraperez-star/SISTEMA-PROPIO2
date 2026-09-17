import React, { useState, useEffect } from 'react';
import { X, Coins, TrendingUp, ArrowDownRight, ArrowUpRight, Scale, AlertCircle, Save, Printer } from 'lucide-react';
import Swal from 'sweetalert2';
import { printCashCut } from '../../lib/print';

export default function CashCutModal({ isOpen, onClose, config, token, systemSettings, onShiftClosed }) {
  if (!isOpen) return null;

  const symbol = systemSettings?.currency_symbol || '$';
  const decimals = parseInt(systemSettings?.currency_decimals ?? '2', 10);

  const formatPrice = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shift, setShift] = useState(null);
  
  // Totals calculated
  const [initialBalance, setInitialBalance] = useState(0);
  const [salesTotal, setSalesTotal] = useState(0);
  const [movementsIn, setMovementsIn] = useState(0);
  const [movementsOut, setMovementsOut] = useState(0);
  const [movementsList, setMovementsList] = useState([]);
  const [expectedBalance, setExpectedBalance] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [totalTransfers, setTotalTransfers] = useState(0);
  
  // Inputs
  const [finalBalance, setFinalBalance] = useState('');
  const [notes, setNotes] = useState('');

  const handleFinalBalanceChange = (e) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, '');
    if (digits === '') {
      setFinalBalance('');
    } else {
      const num = parseInt(digits, 10);
      const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      setFinalBalance(formatted);
    }
  };

  useEffect(() => {
    fetchActiveShift();
  }, []);

  const fetchActiveShift = async () => {
    setLoading(true);
    try {
      // 1. Get active shift
      const shiftRes = await fetch(`${config.apiUrl}accounting/cash-shifts/?is_open=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (shiftRes.ok) {
        const shifts = await shiftRes.json();
        const activeShift = (shifts.results || shifts || [])[0];
        if (activeShift) {
          setShift(activeShift);
          const initBal = parseFloat(activeShift.initial_balance || 0);
          setInitialBalance(initBal);

          // 2. Fetch sales from this shift (created_at >= opened_at)
          const salesRes = await fetch(`${config.apiUrl}sales/sales/?status=COMPLETED&page_size=10000`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          let salesSum = 0;
          let salesCount = 0;
          let cardSum = 0;
          let transferSum = 0;
          if (salesRes.ok) {
            const salesData = await salesRes.json();
            const salesList = salesData.results || salesData || [];
            
            // Filter sales after opened_at
            const openTime = new Date(activeShift.opened_at).getTime();
            salesList.forEach(sale => {
              const saleTime = new Date(sale.created_at).getTime();
              if (saleTime >= openTime) {
                const amt = parseFloat(sale.total || 0);
                salesSum += amt;
                salesCount++;
                // Check payment methods from payments array
                if (sale.payments && sale.payments.length > 0) {
                  sale.payments.forEach(payment => {
                    const pmName = payment.payment_method_name?.toLowerCase() || '';
                    if (pmName.includes('tarjeta') || pmName.includes('card')) {
                      cardSum += parseFloat(payment.amount || 0);
                    } else if (pmName.includes('transferencia') || pmName.includes('transfer')) {
                      transferSum += parseFloat(payment.amount || 0);
                    }
                  });
                }
              }
            });
            setSalesTotal(salesSum);
            setTotalSalesCount(salesCount);
            setTotalCards(cardSum);
            setTotalTransfers(transferSum);
          }

          // 3. Fetch cash movements for this shift
          const movsRes = await fetch(`${config.apiUrl}accounting/cash-movements/?shift=${activeShift.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          let inSum = 0;
          let outSum = 0;
          if (movsRes.ok) {
            const movsData = await movsRes.json();
            const movsList = movsData.results || movsData || [];
            movsList.forEach(m => {
              const amt = parseFloat(m.amount || 0);
              if (m.type === 'IN') {
                inSum += amt;
              } else if (m.type === 'OUT') {
                outSum += amt;
              }
            });
            setMovementsIn(inSum);
            setMovementsOut(outSum);
            setMovementsList(movsList);
          }

          // Calculate expected: Initial + Sales + IN - OUT
          setExpectedBalance(initBal + salesSum + inSum - outSum);
        } else {
          Swal.fire('Error', 'No se encontró un turno de caja activo para cerrar.', 'error');
          onClose();
        }
      } else {
        Swal.fire('Error', 'No se pudieron recuperar los turnos de caja.', 'error');
        onClose();
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Error de red al consultar el corte de caja.', 'error');
      onClose();
    }
    setLoading(false);
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (finalBalance === '') {
      Swal.fire('Atención', 'Por favor ingresa el saldo final real medido en caja.', 'warning');
      return;
    }

    setSubmitting(true);
    const finalVal = parseFloat(String(finalBalance || '').replace(/\./g, '') || 0);
    const difference = finalVal - Math.round(expectedBalance);

    const confirmMsg = `¿Está seguro de cerrar la caja con un saldo final de ${formatPrice(finalVal)}? ${
      difference === 0 
        ? 'La caja está cuadrada.' 
        : difference > 0 
          ? `Hay un SOBRANTE de ${formatPrice(difference)}.` 
          : `Hay un FALTANTE de ${formatPrice(Math.abs(difference))}.`
    }`;

    const confirm = await Swal.fire({
      title: 'Confirmar Corte de Caja',
      text: confirmMsg,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Cerrar Caja',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'premium-swal',
        title: 'premium-swal-title',
        confirmButton: 'premium-swal-confirm',
        cancelButton: 'premium-swal-cancel'
      },
      buttonsStyling: false
    });

    if (!confirm.isConfirmed) {
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${config.apiUrl}accounting/cash-shifts/${shift.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_open: false,
          final_balance: finalVal,
          closed_at: new Date().toISOString()
        })
      });

      if (res.ok) {
        // Imprimir arqueo automáticamente
        const currentFinalVal = parseFloat(String(finalBalance || '').replace(/\./g, '') || 0);
        const diff = currentFinalVal - Math.round(expectedBalance);
         printCashCut(shift, {
          initialBalance, 
          salesTotal, 
          movementsIn, 
          movementsOut, 
          expectedBalance, 
          finalBalance: currentFinalVal, 
          difference: diff, 
          notes,
          totalCash: salesTotal - totalCards - totalTransfers,
          totalCards,
          totalTransfers,
          totalSales: salesTotal,
          totalSalesCount
        }, systemSettings, config?.ticket_logo, { 
          apiUrl: config?.apiUrl,
          silent: true,
          printerName: config?.default_printer
        });

        // Log transaction or movements details in observes if necessary
        await Swal.fire({
          title: 'Corte Exitoso',
          text: 'La caja se ha cerrado correctamente y el turno ha finalizado.',
          icon: 'success',
          customClass: {
            popup: 'premium-swal',
            title: 'premium-swal-title',
            confirmButton: 'premium-swal-confirm'
          },
          buttonsStyling: false
        });
        onShiftClosed();
      } else {
        const errData = await res.json();
        Swal.fire('Error', 'No se pudo cerrar la caja: ' + JSON.stringify(errData), 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Error de red al cerrar el turno.', 'error');
    }
    setSubmitting(false);
  };

  const currentFinalVal = parseFloat(String(finalBalance || '').replace(/\./g, '') || 0);
  const difference = finalBalance !== '' ? currentFinalVal - Math.round(expectedBalance) : 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl shadow-lg overflow-hidden border border-gray-200 flex flex-col text-gray-900">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg">
              <Coins size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-base text-gray-900">Corte de Caja</h2>
              <p className="text-xs text-gray-500 font-medium">Cierre y arqueo del turno activo</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4">
            <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            <span className="text-sm font-medium text-gray-500">Calculando saldos y arqueo de caja...</span>
          </div>
        ) : (
          <form onSubmit={handleCloseShift} className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
            
            {/* Cash register info banner */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col gap-2 text-xs font-medium text-gray-600">
              <div className="flex justify-between">
                <span>Caja Registradora:</span>
                <span className="text-gray-900 font-semibold">{shift?.register_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Cajero / Administrador:</span>
                <span className="text-gray-900 font-semibold">{shift?.username}</span>
              </div>
              <div className="flex justify-between">
                <span>Apertura de Turno:</span>
                <span className="text-gray-900 font-mono">{new Date(shift?.opened_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Calculations Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col justify-between">
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Saldo Inicial</span>
                <span className="text-base font-semibold text-gray-900 font-mono mt-1">{formatPrice(initialBalance)}</span>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col justify-between">
                <span className="text-xs text-blue-600 font-medium uppercase tracking-wide flex items-center gap-1">
                  <TrendingUp size={12} /> Ventas del Turno
                </span>
                <span className="text-base font-semibold text-blue-700 font-mono mt-1">{formatPrice(salesTotal)}</span>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col justify-between">
                <span className="text-xs text-green-600 font-medium uppercase tracking-wide flex items-center gap-1">
                  <ArrowUpRight size={12} /> Entradas de Caja
                </span>
                <span className="text-base font-semibold text-green-700 font-mono mt-1">{formatPrice(movementsIn)}</span>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col justify-between">
                <span className="text-xs text-red-600 font-medium uppercase tracking-wide flex items-center gap-1">
                  <ArrowDownRight size={12} /> Salidas de Caja
                </span>
                <span className="text-base font-semibold text-red-700 font-mono mt-1">{formatPrice(movementsOut)}</span>
              </div>
            </div>

            {/* List of Movements */}
            {movementsList.length > 0 && (
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <ArrowDownRight size={14} className="text-indigo-500" /> Detalle de Movimientos Adicionales
                </h4>
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[150px] custom-scrollbar pr-2">
                  {movementsList.map((m, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-white border border-slate-100 shadow-sm text-xs">
                      <div className="flex items-center gap-2">
                        {m.type === 'IN' ? <ArrowUpRight size={14} className="text-emerald-500"/> : <ArrowDownRight size={14} className="text-rose-500"/>}
                        <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={m.description}>{m.description || 'Sin motivo especificado'}</span>
                      </div>
                      <span className={`font-mono font-bold ${m.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {m.type === 'IN' ? '+' : '-'}{formatPrice(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expected balance section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <span className="text-xs text-blue-700 font-semibold uppercase tracking-wide flex items-center justify-center gap-1">
                <Scale size={14} /> Saldo Esperado en Caja (Libro)
              </span>
              <h3 className="text-2xl font-semibold text-blue-900 font-mono mt-1">{formatPrice(expectedBalance)}</h3>
            </div>

            {/* Input final balance */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Monto de Efectivo Real en Caja [*]</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500 font-mono font-medium text-sm">
                  {symbol}
                </span>
                <input 
                  type="text" 
                  required
                  placeholder="Introduce el total de efectivo físico" 
                  className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-medium text-gray-900 transition-colors font-mono"
                  value={finalBalance}
                  onChange={handleFinalBalanceChange}
                />
              </div>
            </div>

            {/* Observations */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Observaciones / Comentarios</label>
              <textarea 
                placeholder="Ej. Sobrante de $2.00 por cambio no retirado, etc." 
                rows="2"
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs font-medium text-gray-900 transition-colors resize-none"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Discrepancy indicator */}
            {finalBalance !== '' && (
              <div className={`p-4 rounded-xl flex items-center gap-3 border animate-in fade-in duration-200 ${
                difference === 0 
                  ? 'bg-slate-50 border-slate-200/60 text-slate-700' 
                  : difference > 0 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                <AlertCircle size={20} className={difference === 0 ? 'text-slate-500' : difference > 0 ? 'text-emerald-600' : 'text-red-500'} />
                <div className="text-xs font-bold flex-1">
                  {difference === 0 ? (
                    <span>La caja cuadra perfectamente. No hay diferencias.</span>
                  ) : difference > 0 ? (
                    <span>Sobrante en caja de <span className="font-mono text-sm">{formatPrice(difference)}</span>.</span>
                  ) : (
                    <span>Faltante en caja de <span className="font-mono text-sm">{formatPrice(Math.abs(difference))}</span>.</span>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Save size={16} />
              )}
              Registrar Corte y Cerrar Turno
            </button>

          </form>
        )}
      </div>
    </div>
  );
}
