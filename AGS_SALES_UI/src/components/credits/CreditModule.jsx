import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Users, AlertTriangle, Calendar, FileText, ChevronRight, User, Plus, X, ArrowLeft, ArrowUpRight, TrendingUp, CheckCircle, Sparkles } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import Swal from 'sweetalert2';

export default function CreditModule({ config, token, systemSettings }) {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState([]);
  const [summary, setSummary] = useState({
    total_debt: 0,
    debtors_count: 0,
    total_overdue: 0
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PARTIAL'
  const [selectedCredit, setSelectedCredit] = useState(null);
  
  // Abono Modal states
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoNote, setAbonoNote] = useState('');
  const [submittingAbono, setSubmittingAbono] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token, config?.apiUrl]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const baseUrl = config?.apiUrl?.replace(/\/$/, '') || '';
      
      // Fetch summary
      const sumRes = await apiRequest(`${baseUrl}/sales/sales/credit-summary/`, {}, token);
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }
      
      // Fetch all credit sales
      const crRes = await apiRequest(`${baseUrl}/sales/sales/credits/`, {}, token);
      if (crRes.ok) {
        const crData = await crRes.json();
        const results = Array.isArray(crData) ? crData : (crData.results || []);
        setCredits(results);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (val) => {
    const symbol = systemSettings?.currency_symbol || '$';
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const handleRegisterAbono = async (e) => {
    e.preventDefault();
    if (!abonoAmount || parseFloat(abonoAmount) <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Monto inválido',
        text: 'Por favor ingrese un monto mayor a cero.'
      });
      return;
    }

    const pending = parseFloat(selectedCredit.total) - parseFloat(selectedCredit.amount_paid);
    if (parseFloat(abonoAmount) > pending + 0.01) {
      Swal.fire({
        icon: 'error',
        title: 'Monto excede saldo',
        text: `El abono no puede ser mayor que el saldo pendiente de ${formatPrice(pending)}.`
      });
      return;
    }

    setSubmittingAbono(true);
    try {
      const baseUrl = config?.apiUrl?.replace(/\/$/, '') || '';
      const res = await apiRequest(`${baseUrl}/sales/sales/${selectedCredit.id}/pay-credit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(abonoAmount),
          note: abonoNote
        })
      }, token);

      if (res.ok) {
        const data = await res.json();
        Swal.fire({
          icon: 'success',
          title: 'Abono Registrado',
          text: 'El abono se ha contabilizado en el sistema y en el arqueo de caja.',
          timer: 2000,
          showConfirmButton: false
        });
        setShowAbonoModal(false);
        setAbonoAmount('');
        setAbonoNote('');
        
        if (data.sale) {
          setSelectedCredit(data.sale);
        } else {
          setSelectedCredit(null);
        }
        fetchData();
      } else {
        const err = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Error al registrar abono',
          text: err.detail || 'No se pudo registrar el abono.'
        });
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'Error de Red',
        text: 'No se pudo conectar con el servidor.'
      });
    } finally {
      setSubmittingAbono(false);
    }
  };

  const filteredCredits = credits.filter(c => {
    const clientName = `${c.customer_name || ''} ${c.customer_doc || ''}`.toLowerCase();
    const invoiceNum = (c.invoice_number || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = clientName.includes(query) || invoiceNum.includes(query);
    
    if (statusFilter === 'ALL') return matchesSearch;
    return c.credit_status === statusFilter && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0 bg-slate-50/50">
      <header className="mb-6 bg-white/80 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg">
            <DollarSign size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cuentas por Cobrar</h1>
            <p className="text-slate-500 text-sm">Administra los créditos a clientes, abonos e historiales de fiados.</p>
          </div>
        </div>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all text-sm cursor-pointer"
        >
          Sincronizar
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Total por Cobrar</span>
            <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{formatPrice(summary.total_debt)}</h3>
          </div>
          <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl">
            <TrendingUp size={28} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Clientes Deudores</span>
            <h3 className="text-3xl font-extrabold text-slate-800 mt-1">{summary.debtors_count}</h3>
          </div>
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Users size={28} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Monto Vencido</span>
            <h3 className="text-3xl font-extrabold text-red-600 mt-1">{formatPrice(summary.total_overdue)}</h3>
          </div>
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl">
            <AlertTriangle size={28} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden">
        <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por cliente o factura..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
              />
            </div>
            
            <div className="flex gap-2">
              {['ALL', 'PENDING', 'PARTIAL'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    statusFilter === st 
                      ? 'bg-slate-800 text-white shadow-md' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st === 'ALL' ? 'Todos' : st === 'PENDING' ? 'Sin abono' : 'Abonados'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-slate-400 font-semibold text-sm">Cargando créditos...</span>
              </div>
            ) : filteredCredits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText size={48} className="stroke-1 mb-3" />
                <p className="font-bold text-sm">No se encontraron deudas pendientes</p>
                <p className="text-xs mt-1 text-slate-500">Intente cambiar el filtro o realizar una búsqueda</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3.5 px-6">Cliente</th>
                    <th className="py-3.5 px-6">Factura</th>
                    <th className="py-3.5 px-6">Deuda Total</th>
                    <th className="py-3.5 px-6">Abonado</th>
                    <th className="py-3.5 px-6">Saldo Pendiente</th>
                    <th className="py-3.5 px-6">Fecha Vence</th>
                    <th className="py-3.5 px-6">Estado</th>
                    <th className="py-3.5 px-6 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {filteredCredits.map(c => {
                    const pending = parseFloat(c.total) - parseFloat(c.amount_paid);
                    const isOverdue = c.due_date && new Date(c.due_date) < new Date();
                    
                    return (
                      <tr 
                        key={c.id} 
                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                          selectedCredit?.id === c.id ? 'bg-blue-50/40 hover:bg-blue-50/50' : ''
                        }`}
                        onClick={() => setSelectedCredit(c)}
                      >
                        <td className="py-4 px-6 font-bold text-slate-800">
                          {c.customer_name || 'Cliente sin nombre'}
                        </td>
                        <td className="py-4 px-6 font-mono text-xs font-semibold text-slate-500">
                          {c.invoice_number}
                        </td>
                        <td className="py-4 px-6 font-semibold">{formatPrice(c.total)}</td>
                        <td className="py-4 px-6 text-emerald-600 font-semibold">{formatPrice(c.amount_paid)}</td>
                        <td className="py-4 px-6 text-orange-650 font-bold">{formatPrice(pending)}</td>
                        <td className="py-4 px-6 text-xs font-medium">
                          {c.due_date ? (
                            <span className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                              <Calendar size={13} />
                              {c.due_date}
                              {isOverdue && ' (Vencida)'}
                            </span>
                          ) : (
                            <span className="text-slate-400">Sin límite</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.credit_status === 'PENDING' 
                              ? 'bg-red-50 text-red-650 border-red-200' 
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            {c.credit_status === 'PENDING' ? 'Sin Abonos' : 'Abono Parcial'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedCredit(c);
                              setShowAbonoModal(true);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm shadow-blue-500/10 cursor-pointer"
                          >
                            Abonar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selectedCredit && (
          <div className="w-full md:w-96 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-right-8 duration-300">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                Detalle del Crédito
              </h3>
              <button 
                onClick={() => setSelectedCredit(null)}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 border-b border-slate-100 flex flex-col gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cliente Deudor</span>
                <h4 className="font-bold text-slate-800 text-base mt-0.5">{selectedCredit.customer_name}</h4>
                {selectedCredit.customer && (
                  <p className="text-xs text-slate-500 mt-0.5">ID Cliente: {selectedCredit.customer}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Saldo Pendiente</span>
                  <p className="text-base font-extrabold text-orange-650 mt-0.5">
                    {formatPrice(parseFloat(selectedCredit.total) - parseFloat(selectedCredit.amount_paid))}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Total de Venta</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{formatPrice(selectedCredit.total)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col min-h-0">
              <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3">Historial de Abonos</h5>
              
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
                {!selectedCredit.credit_payments || selectedCredit.credit_payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs">
                    <Calendar size={24} className="stroke-1 mb-1.5" />
                    <span>No hay abonos registrados aún</span>
                  </div>
                ) : (
                  selectedCredit.credit_payments.map((p, idx) => (
                    <div key={p.id || idx} className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-emerald-600">{formatPrice(p.amount)}</span>
                        <span className="text-[10px] text-slate-400">{new Date(p.paid_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      {p.note && <p className="text-xs text-slate-500 italic mt-0.5">“{p.note}”</p>}
                      {p.registered_by_username && (
                        <span className="text-[9px] text-slate-400 self-end mt-1">Registró: {p.registered_by_username}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
              
              <button
                onClick={() => setShowAbonoModal(true)}
                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Plus size={16} />
                Registrar Nuevo Abono
              </button>
            </div>
          </div>
        )}
      </div>

      {showAbonoModal && selectedCredit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Registrar Abono</h3>
              <button 
                onClick={() => setShowAbonoModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterAbono} className="flex flex-col gap-4">
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-col gap-1">
                <span className="text-xs font-semibold text-blue-600">Cliente</span>
                <span className="font-bold text-slate-800 text-base">{selectedCredit.customer_name}</span>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-100/50 text-xs">
                  <span className="text-slate-500">Saldo pendiente:</span>
                  <span className="font-bold text-orange-650">
                    {formatPrice(parseFloat(selectedCredit.total) - parseFloat(selectedCredit.amount_paid))}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500">Monto del Abono</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="1"
                    placeholder="Monto a abonar..."
                    required
                    value={abonoAmount}
                    onChange={e => setAbonoAmount(e.target.value)}
                    className="w-full pl-7 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-bold text-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500">Nota / Observación</label>
                <textarea
                  placeholder="Ej. Pago en efectivo por el cliente..."
                  rows="3"
                  value={abonoNote}
                  onChange={e => setAbonoNote(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 text-sm placeholder-slate-400 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingAbono}
                className="w-full py-3 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer mt-2 text-sm disabled:opacity-50"
              >
                {submittingAbono ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Confirmar Abono
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
