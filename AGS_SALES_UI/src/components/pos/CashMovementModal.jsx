import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, DollarSign, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

export default function CashMovementModal({ isOpen, onClose, config, token, systemSettings, onViewHistory }) {
  if (!isOpen) return null;

  const symbol = systemSettings?.currency_symbol || '$';
  const decimals = parseInt(systemSettings?.currency_decimals ?? '2', 10);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shiftId, setShiftId] = useState(null);
  
  const [form, setForm] = useState({
    type: 'OUT',
    amount: '',
    description: ''
  });

  const handleAmountChange = (e) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, '');
    if (digits === '') {
      setForm(prev => ({ ...prev, amount: '' }));
    } else {
      const num = parseInt(digits, 10);
      const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      setForm(prev => ({ ...prev, amount: formatted }));
    }
  };

  useEffect(() => {
    fetchActiveShift();
  }, []);

  const fetchActiveShift = async () => {
    setLoading(true);
    try {
      const shiftRes = await fetch(`${config.apiUrl}accounting/cash-shifts/?is_open=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (shiftRes.ok) {
        const shifts = await shiftRes.json();
        const activeShift = (shifts.results || shifts || [])[0];
        if (activeShift) {
          setShiftId(activeShift.id);
        } else {
          Swal.fire('Error', 'No se encontró un turno abierto.', 'error');
          onClose();
        }
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Error al obtener turno.', 'error');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shiftId) return;
    if (!form.amount || form.amount === '0') {
      Swal.fire('Error', 'Ingrese un monto válido.', 'error');
      return;
    }
    if (!form.description.trim()) {
      Swal.fire('Error', 'Debe ingresar una descripción.', 'error');
      return;
    }

    setSubmitting(true);
    
    // Parse amount string to raw number
    const finalAmount = parseFloat(String(form.amount || '').replace(/\./g, '') || 0);

    try {
      const res = await fetch(`${config.apiUrl}accounting/cash-movements/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shift: shiftId,
          type: form.type,
          amount: finalAmount,
          description: form.description
        })
      });

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Movimiento Registrado',
          text: 'El movimiento ha sido registrado exitosamente en la caja.',
          timer: 2000,
          showConfirmButton: false
        });
        setForm({ type: 'OUT', amount: '', description: '' });
        onClose();
      } else {
        const errData = await res.json();
        Swal.fire('Error', 'No se pudo registrar: ' + JSON.stringify(errData), 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Error de red.', 'error');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-lg overflow-hidden border border-gray-200 flex flex-col text-gray-900">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg text-white ${form.type === 'OUT' ? 'bg-red-600' : 'bg-green-600'}`}>
              {form.type === 'OUT' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
            </div>
            <div>
              <h2 className="font-semibold text-base text-gray-900">Movimiento de Caja</h2>
              <p className="text-xs text-gray-500 font-medium">Registrar Ingreso o Egreso</p>
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
            <span className="text-sm font-medium text-gray-500">Cargando turno...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setForm({...form, type: 'OUT'})}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${form.type === 'OUT' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                <ArrowDownRight size={16} /> Egreso (Salida)
              </button>
              <button
                type="button"
                onClick={() => setForm({...form, type: 'IN'})}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${form.type === 'IN' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
              >
                <ArrowUpRight size={16} /> Ingreso (Entrada)
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Monto del {form.type === 'OUT' ? 'Egreso' : 'Ingreso'} [*]</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-500 font-mono font-medium text-sm">
                  {symbol}
                </span>
                <input 
                  type="text" 
                  required
                  placeholder="0"
                  className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-medium text-gray-900 transition-colors font-mono"
                  value={form.amount}
                  onChange={handleAmountChange}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Motivo / Descripción [*]</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 text-gray-400" size={16} />
                <textarea 
                  required
                  placeholder={form.type === 'OUT' ? "Ej. Compra de agua, Pago de servicio..." : "Ej. Sencillo adicional, Pago adelantado..."}
                  className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-medium text-gray-900 transition-colors resize-none h-24"
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                ></textarea>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className={`w-full text-white py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${submitting ? 'opacity-70 cursor-not-allowed' : ''} ${form.type === 'OUT' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {submitting ? 'Guardando...' : `Registrar ${form.type === 'OUT' ? 'Egreso' : 'Ingreso'}`}
            </button>
            {onViewHistory && (
              <button
                type="button"
                onClick={onViewHistory}
                className="w-full text-indigo-600 hover:text-indigo-805 text-xs font-bold py-1.5 transition-colors cursor-pointer text-center"
              >
                🔍 Ver historial de egresos/ingresos
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
