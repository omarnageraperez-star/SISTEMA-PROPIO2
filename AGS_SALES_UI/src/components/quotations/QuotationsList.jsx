import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Filter, Calendar, FileText, ChevronRight, Sliders,
  TrendingUp, CheckCircle, Clock, Copy, GitBranch, ShoppingCart, Eye,
  Trash2, XCircle, ArrowUpRight, DollarSign, AlertCircle, RefreshCw
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import Swal from 'sweetalert2';

export default function QuotationsList({
  config,
  token,
  userProfile,
  systemSettings,
  onNewQuotation,
  onEditQuotation,
  onPreviewQuotation,
  onOpenSettings
}) {
  const baseUrl = config?.apiUrl?.replace(/\/$/, '') || '';
  const symbol = systemSettings?.currency_symbol || '$';

  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [summary, setSummary] = useState({
    total_count: 0,
    total_amount: 0,
    converted_count: 0,
    converted_amount: 0,
    conversion_rate: 0,
    active_count: 0,
    expiring_soon_count: 0,
    counts_by_status: {}
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const canCreate = (
    userProfile?.role === 'SUPERADMIN' ||
    userProfile?.role === 'ADMIN' ||
    userProfile?.custom_permissions?.['quotations.create_edit'] !== false
  );

  useEffect(() => {
    fetchQuotations();
    fetchSummary();
  }, [statusFilter, dateFrom, dateTo]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      let queryParams = [];
      if (statusFilter !== 'ALL') queryParams.push(`status=${statusFilter}`);
      if (dateFrom) queryParams.push(`date_from=${dateFrom}`);
      if (dateTo) queryParams.push(`date_to=${dateTo}`);
      if (searchTerm.trim()) queryParams.push(`search=${encodeURIComponent(searchTerm.trim())}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await apiRequest(`${baseUrl}/quotations/quotations/${queryString}`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setQuotations(Array.isArray(data) ? data : (data.results || []));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await apiRequest(`${baseUrl}/quotations/quotations/summary/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchQuotations();
  };

  // Duplicar
  const handleDuplicate = async (quotation) => {
    try {
      const res = await apiRequest(`${baseUrl}/quotations/quotations/${quotation.id}/duplicate/`, {
        method: 'POST'
      }, token);
      if (res.ok) {
        const duplicated = await res.json();
        Swal.fire({
          icon: 'success',
          title: 'Cotización Duplicada',
          text: `Se ha creado el borrador ${duplicated.consecutive}`,
          timer: 2000,
          showConfirmButton: false
        });
        fetchQuotations();
        fetchSummary();
      }
    } catch (e) {
      Swal.fire('Error', 'No se pudo duplicar la cotización.', 'error');
    }
  };

  // Crear revisión
  const handleCreateRevision = async (quotation) => {
    try {
      const res = await apiRequest(`${baseUrl}/quotations/quotations/${quotation.id}/create-revision/`, {
        method: 'POST'
      }, token);
      if (res.ok) {
        const rev = await res.json();
        Swal.fire({
          icon: 'success',
          title: 'Nueva Versión Generada',
          text: `Se ha creado la revisión ${rev.consecutive}`,
          timer: 2000,
          showConfirmButton: false
        });
        fetchQuotations();
        fetchSummary();
      }
    } catch (e) {
      Swal.fire('Error', 'No se pudo crear la nueva versión.', 'error');
    }
  };

  // Cancelar cotización
  const handleCancel = async (quotation) => {
    const confirm = await Swal.fire({
      title: '¿Cancelar Cotización?',
      text: `¿Seguro que deseas anular la cotización ${quotation.consecutive}? Se liberará cualquier reserva de inventario asociada.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sí, cancelar'
    });

    if (confirm.isConfirmed) {
      try {
        const res = await apiRequest(`${baseUrl}/quotations/quotations/${quotation.id}/cancel/`, {
          method: 'POST'
        }, token);
        if (res.ok) {
          Swal.fire('Cancelada', 'La cotización ha sido anulada.', 'success');
          fetchQuotations();
          fetchSummary();
        }
      } catch (e) {
        Swal.fire('Error', 'No se pudo cancelar la cotización.', 'error');
      }
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Borrador</span>;
      case 'SENT':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Enviada</span>;
      case 'APPROVED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Aprobada</span>;
      case 'REJECTED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Rechazada</span>;
      case 'EXPIRED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Vencida</span>;
      case 'CONVERTED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">Convertida</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">Cancelada</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-150 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Módulo de Cotizaciones
          </h2>
          <p className="text-xs text-slate-400">
            Crea, presupuesta, reserva inventario y convierte cotizaciones en ventas POS con un clic
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer shadow-xs"
              title="Ajustes de Cotizaciones"
            >
              <Sliders size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={() => { fetchQuotations(); fetchSummary(); }}
            className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer shadow-xs"
            title="Refrescar lista"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={onNewQuotation}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus size={16} /> Nueva Cotización
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Cotizado */}
          <div className="p-4 bg-white rounded-3xl border border-slate-150 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Cotizado</span>
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {symbol}{Math.round(summary.total_amount || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400">{summary.total_count} presupuestos</span>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
              <DollarSign size={20} />
            </div>
          </div>

          {/* Card 2: Convertidas a Venta */}
          <div className="p-4 bg-white rounded-3xl border border-slate-150 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ventas Facturadas</span>
              <div className="text-xl font-black text-emerald-600 mt-0.5">
                {symbol}{Math.round(summary.converted_amount || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400">{summary.converted_count} cotizaciones cerradas</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
              <CheckCircle size={20} />
            </div>
          </div>

          {/* Card 3: Tasa de Conversión */}
          <div className="p-4 bg-white rounded-3xl border border-slate-150 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tasa de Conversión</span>
              <div className="text-xl font-black text-purple-600 mt-0.5">
                {summary.conversion_rate}%
              </div>
              <span className="text-[11px] text-slate-400">Efectividad de cierre</span>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
              <TrendingUp size={20} />
            </div>
          </div>

          {/* Card 4: Por Vencer / En Seguimiento */}
          <div className="p-4 bg-white rounded-3xl border border-slate-150 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Por Vencer (3 días)</span>
              <div className="text-xl font-black text-amber-500 mt-0.5">
                {summary.expiring_soon_count}
              </div>
              <span className="text-[11px] text-slate-400">{summary.active_count} cotizaciones activas</span>
            </div>
            <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl border border-amber-100">
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white p-4 rounded-3xl border border-slate-150 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Tabs de Estado */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'Todas' },
              { id: 'DRAFT', label: 'Borradores' },
              { id: 'SENT', label: 'Enviadas' },
              { id: 'APPROVED', label: 'Aprobadas' },
              { id: 'CONVERTED', label: 'Convertidas' },
              { id: 'EXPIRED', label: 'Vencidas' },
              { id: 'REJECTED', label: 'Rechazadas' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Búsqueda y Rango de Fecha */}
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por # o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
            </div>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              title="Desde"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              title="Hasta"
            />

            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 cursor-pointer"
            >
              Filtrar
            </button>
          </form>
        </div>

        {/* Tabla Principal de Cotizaciones */}
        <div className="bg-white rounded-3xl border border-slate-150 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Consecutivo</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Vendedor</th>
                  <th className="py-3 px-4">Emisión / Vigencia</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Cargando cotizaciones...
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No se encontraron cotizaciones con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  quotations.map(q => {
                    const isEditable = q.status === 'DRAFT' || q.status === 'SENT';

                    return (
                      <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Consecutivo & Revisión */}
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-indigo-600">{q.consecutive}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[10px] font-mono">
                              v{q.version}
                            </span>
                            {q.has_stock_reservation && (
                              <span className="p-0.5 text-emerald-600" title="Reserva de stock activa">
                                <Clock size={12} />
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{q.customer_name}</div>
                          <div className="text-[11px] text-slate-400">{q.customer_phone || q.customer_email || 'Sin contacto'}</div>
                        </td>

                        {/* Vendedor */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {q.user_name}
                        </td>

                        {/* Fechas */}
                        <td className="py-3.5 px-4 text-slate-600">
                          <div>{q.issue_date}</div>
                          <div className={`text-[11px] font-medium ${q.is_expired ? 'text-amber-600' : 'text-slate-400'}`}>
                            Hasta: {q.valid_until}
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(q.status)}
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-4 text-right font-black text-slate-800 text-sm">
                          {q.currency_symbol || symbol}{Math.round(q.total).toLocaleString()}
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Ver Detalle / PDF */}
                            <button
                              type="button"
                              onClick={() => onPreviewQuotation(q)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Ver Detalle y PDF"
                            >
                              <Eye size={15} />
                            </button>

                            {/* Editar */}
                            {isEditable && (
                              <button
                                type="button"
                                onClick={() => onEditQuotation(q)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Editar Cotización"
                              >
                                <FileText size={15} />
                              </button>
                            )}

                            {/* Duplicar */}
                            <button
                              type="button"
                              onClick={() => handleDuplicate(q)}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Duplicar como Borrador"
                            >
                              <Copy size={15} />
                            </button>

                            {/* Crear Revisión (v2, v3) */}
                            <button
                              type="button"
                              onClick={() => handleCreateRevision(q)}
                              className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              title="Crear Nueva Versión (v2, v3...)"
                            >
                              <GitBranch size={15} />
                            </button>

                            {/* Cancelar */}
                            {q.status !== 'CONVERTED' && q.status !== 'CANCELLED' && (
                              <button
                                type="button"
                                onClick={() => handleCancel(q)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Cancelar Cotización"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
