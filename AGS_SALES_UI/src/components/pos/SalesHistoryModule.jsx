import React, { useState, useEffect } from 'react';
import { 
  Search, Eye, Printer, AlertTriangle, XCircle, Calendar, FileText, CheckCircle, RefreshCw, ArrowDownRight, ArrowUpRight, Scale
} from 'lucide-react';
import Swal from 'sweetalert2';
import { apiRequest } from '../../lib/api';
import { printTicket, printCashCut } from '../../lib/print';
import { hasPermission } from '../../lib/permissionsConfig';

export default function SalesHistoryModule({ config, token, systemSettings, userProfile, initialTab, onTabChange }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'sales'); // 'sales', 'movements', 'shifts'

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Sales Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Movements States
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementStartDate, setMovementStartDate] = useState('');
  const [movementEndDate, setMovementEndDate] = useState('');

  // Shifts States
  const [shifts, setShifts] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [shiftSearch, setShiftSearch] = useState('');
  const [shiftStatusFilter, setShiftStatusFilter] = useState('');
  const [shiftStartDate, setShiftStartDate] = useState('');
  const [shiftEndDate, setShiftEndDate] = useState('');

  // Details Modal State
  const [selectedSale, setSelectedSale] = useState(null);
  
  const symbol = systemSettings?.currency_symbol || '$';
  
  const formatPrice = (val) => {
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const canVoid = hasPermission(userProfile, 'pos.void_sale');

  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSales();
    } else if (activeTab === 'movements') {
      fetchMovements();
    } else if (activeTab === 'shifts') {
      fetchShifts();
    }
  }, [activeTab]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`${config.apiUrl}sales/sales/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setSales(data.results || data || []);
      }
    } catch (e) {
      console.error("Error fetching sales:", e);
    }
    setLoading(false);
  };

  const fetchMovements = async () => {
    setLoadingMovements(true);
    try {
      const res = await apiRequest(`${config.apiUrl}accounting/cash-movements/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setMovements(data.results || data || []);
      }
    } catch (e) {
      console.error("Error fetching movements:", e);
    }
    setLoadingMovements(false);
  };

  const fetchShifts = async () => {
    setLoadingShifts(true);
    try {
      const res = await apiRequest(`${config.apiUrl}accounting/cash-shifts/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setShifts(data.results || data || []);
      }
    } catch (e) {
      console.error("Error fetching shifts:", e);
    }
    setLoadingShifts(false);
  };

  const handleAnular = async (sale) => {
    if (!canVoid) {
      Swal.fire('Acceso Denegado', 'Solo los administradores pueden anular facturas.', 'error');
      return;
    }
    Swal.fire({
      title: `¿Anular Factura ${sale.invoice_number}?`,
      html: `Esta acción es <b>irreversible</b>.<br/>Se devolverán <b>${Math.round(sale.details.reduce((acc, d) => acc + parseFloat(d.quantity), 0))} unidades</b> al inventario y se registrará un egreso de reembolso en caja.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#aaa',
      confirmButtonText: 'Sí, anular venta',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await apiRequest(`${config.apiUrl}sales/sales/${sale.id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'CANCELLED' })
          }, token);
          
          if (res.ok) {
            Swal.fire('Venta Anulada', 'La factura ha sido anulada con éxito. Inventario y caja actualizados.', 'success');
            fetchSales();
            if (selectedSale && selectedSale.id === sale.id) {
              setSelectedSale(null);
            }
          } else {
            const errData = await res.json();
            Swal.fire('Error', 'No se pudo anular la factura: ' + JSON.stringify(errData), 'error');
          }
        } catch (e) {
          Swal.fire('Error de red', 'No se pudo contactar con el servidor.', 'error');
        }
      }
    });
  };

  // Client side filters for Sales
  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      (sale.invoice_number && sale.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (String(sale.id).includes(searchQuery));
      
    const matchesStatus = statusFilter === '' || sale.status === statusFilter;
    const matchesType = typeFilter === '' || sale.invoice_type === typeFilter;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const saleDate = new Date(sale.created_at);
      saleDate.setHours(0,0,0,0);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        if (saleDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(0,0,0,0);
        if (saleDate > end) matchesDate = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  // Client side filters for Cash Movements
  const filteredMovements = movements.filter(mov => {
    const matchesSearch = 
      (mov.description && mov.description.toLowerCase().includes(movementSearch.toLowerCase())) ||
      (mov.username && mov.username.toLowerCase().includes(movementSearch.toLowerCase())) ||
      (mov.register_name && mov.register_name.toLowerCase().includes(movementSearch.toLowerCase()));
      
    const matchesType = movementTypeFilter === '' || mov.type === movementTypeFilter;
    
    let matchesDate = true;
    if (movementStartDate || movementEndDate) {
      const movDate = new Date(mov.created_at);
      movDate.setHours(0,0,0,0);
      
      if (movementStartDate) {
        const start = new Date(movementStartDate);
        start.setHours(0,0,0,0);
        if (movDate < start) matchesDate = false;
      }
      if (movementEndDate) {
        const end = new Date(movementEndDate);
        end.setHours(0,0,0,0);
        if (movDate > end) matchesDate = false;
      }
    }
    return matchesSearch && matchesType && matchesDate;
  });

  // Client-side filters for Cash Shifts
  const filteredShifts = shifts.filter(sh => {
    const matchesSearch = 
      (sh.username && sh.username.toLowerCase().includes(shiftSearch.toLowerCase())) ||
      (sh.register_name && sh.register_name.toLowerCase().includes(shiftSearch.toLowerCase())) ||
      (String(sh.id).includes(shiftSearch));
      
    let matchesStatus = true;
    if (shiftStatusFilter === 'open') matchesStatus = sh.is_open === true;
    else if (shiftStatusFilter === 'closed') matchesStatus = sh.is_open === false;
    
    let matchesDate = true;
    if (shiftStartDate || shiftEndDate) {
      const shDate = new Date(sh.opened_at);
      shDate.setHours(0,0,0,0);
      
      if (shiftStartDate) {
        const start = new Date(shiftStartDate);
        start.setHours(0,0,0,0);
        if (shDate < start) matchesDate = false;
      }
      if (shiftEndDate) {
        const end = new Date(shiftEndDate);
        end.setHours(0,0,0,0);
        if (shDate > end) matchesDate = false;
      }
    }
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handlePrintShiftTicket = async (sh) => {
    Swal.fire({
      title: 'Generando Ticket',
      text: 'Recuperando transacciones del turno...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      // 1. Fetch sales
      const salesRes = await fetch(`${config.apiUrl}sales/sales/?status=COMPLETED&page_size=10000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let salesSum = 0;
      let totalCards = 0;
      let totalTransfers = 0;
      let totalSalesCount = 0;
      
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        const salesList = salesData.results || salesData || [];
        
        const openTime = new Date(sh.opened_at).getTime();
        const closeTime = sh.closed_at ? new Date(sh.closed_at).getTime() : new Date().getTime();
        
        salesList.forEach(sale => {
          const saleTime = new Date(sale.created_at).getTime();
          if (saleTime >= openTime && saleTime <= closeTime) {
            const amt = parseFloat(sale.total || 0);
            salesSum += amt;
            totalSalesCount++;
            if (sale.payment_method === 'CARD') totalCards += amt;
            else if (sale.payment_method === 'TRANSFER') totalTransfers += amt;
          }
        });
      }

      // 2. Fetch Movements
      const movsRes = await fetch(`${config.apiUrl}accounting/cash-movements/?shift=${sh.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let inSum = 0;
      let outSum = 0;
      if (movsRes.ok) {
        const movsData = await movsRes.json();
        const movsList = movsData.results || movsData || [];
        movsList.forEach(m => {
          const amt = parseFloat(m.amount || 0);
          if (m.type === 'IN') inSum += amt;
          else if (m.type === 'OUT') outSum += amt;
        });
      }

      const initBal = parseFloat(sh.initial_balance || 0);
      const expectedBalance = initBal + salesSum + inSum - outSum;
      const finalBal = sh.final_balance ? parseFloat(sh.final_balance) : expectedBalance;
      const diff = finalBal - expectedBalance;

      const totals = {
        totalCash: salesSum - totalCards - totalTransfers,
        totalCards,
        totalTransfers,
        totalSales: salesSum,
        totalSalesCount,
        movementsIn: inSum,
        movementsOut: outSum,
        expectedBalance,
        finalBalance: finalBal,
        difference: diff,
        notes: sh.is_open ? "TURNO ABIERTO (TICKET PREVIO)" : "REIMPRESIÓN DE ARQUEO"
      };

      Swal.close();
      
      printCashCut(sh, totals, systemSettings, systemSettings?.ticket_logo || config?.ticket_logo, { 
        apiUrl: config?.apiUrl,
        silent: true,
        printerName: config?.default_printer
      });
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Imprimiendo corte de caja...',
        showConfirmButton: false,
        timer: 2000
      });

    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo generar el ticket del turno.', 'error');
    }
  };

  // Sales KPIs
  const activeSales = filteredSales.filter(s => s.status === 'COMPLETED');
  const cancelledSales = filteredSales.filter(s => s.status === 'CANCELLED');
  const totalRevenue = activeSales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);

  // Movements KPIs
  const totalInflows = filteredMovements.filter(m => m.type === 'IN').reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
  const totalOutflows = filteredMovements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);
  const netBalance = totalInflows - totalOutflows;

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden animate-in fade-in duration-300">
      
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="text-white" size={20} />
            </div>
            {
              activeTab === 'sales' 
                ? 'Historial de Ventas' 
                : activeTab === 'movements' 
                  ? 'Movimientos de Caja' 
                  : 'Cortes de Caja'
            }
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {
              activeTab === 'sales' 
                ? 'Consulta, busca, reimprime y anula las facturas del punto de venta.' 
                : activeTab === 'movements'
                  ? 'Visualiza y filtra los movimientos de dinero adicionales realizados en caja.'
                  : 'Visualiza, busca y reimprime los cortes de caja y arqueos de cada cajero/usuario.'
            }
          </p>
        </div>
        <button 
          onClick={activeTab === 'sales' ? fetchSales : activeTab === 'movements' ? fetchMovements : fetchShifts}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} className={(activeTab === 'sales' ? loading : activeTab === 'movements' ? loadingMovements : loadingShifts) ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => { setActiveTab('sales'); onTabChange && onTabChange('sales'); }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Facturas
        </button>
        <button 
          onClick={() => { setActiveTab('movements'); onTabChange && onTabChange('movements'); }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'movements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Movimientos
        </button>
        {canVoid && (
          <button 
            onClick={() => { setActiveTab('shifts'); onTabChange && onTabChange('shifts'); }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'shifts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Cortes
          </button>
        )}
      </div>

      {activeTab === 'sales' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ingresos Netos</p>
                  <p className="text-lg font-semibold text-gray-900">{formatPrice(totalRevenue)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Facturas Válidas</p>
                  <p className="text-lg font-semibold text-gray-900">{activeSales.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle size={20} className="text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Facturas Anuladas</p>
                  <p className="text-lg font-semibold text-gray-900">{cancelledSales.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar factura o cliente..." 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <Calendar size={16} className="text-gray-400" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-gray-700"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="text-gray-400">-</span>
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-gray-700"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-red-500 hover:text-red-700 text-xs font-medium ml-1"
                >
                  Limpiar
                </button>
              )}
            </div>

            <select 
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="">Todos los Tipos</option>
              <option value="POS">POS Electrónico</option>
              <option value="ELECTRONIC">Factura Electrónica</option>
            </select>

            <select 
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los Estados</option>
              <option value="COMPLETED">Completadas</option>
              <option value="CANCELLED">Anuladas</option>
            </select>
          </div>

          {/* Sales Table */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{sale.invoice_number || `TEMP-${sale.id}`}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(sale.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sale.customer_name || 'Cliente Final'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          sale.invoice_type === 'ELECTRONIC'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {sale.invoice_type === 'ELECTRONIC' ? 'Electrónica' : 'POS'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatPrice(sale.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          sale.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {sale.status === 'COMPLETED' ? 'Válida' : 'Anulada'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setSelectedSale(sale)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => printTicket(sale, systemSettings, systemSettings?.ticket_logo || config?.ticket_logo, { preview: true, printerName: config?.default_printer })}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Printer size={16} />
                          </button>
                          {canVoid && (
                            <button 
                              disabled={sale.status === 'CANCELLED'}
                              onClick={() => handleAnular(sale)}
                              className={`p-1.5 rounded transition-colors ${
                                sale.status === 'CANCELLED'
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-gray-400 hover:text-red-600 hover:bg-gray-100'
                              }`}
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                        {loading ? 'Cargando...' : 'No se encontraron facturas'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'movements' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500 bg-white/50 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                <ArrowUpRight size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Ingresos (Entradas)</span>
                <h3 className="text-xl font-extrabold text-emerald-800 font-mono leading-tight">{formatPrice(totalInflows)}</h3>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-red-500 bg-white/50 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-red-50 text-red-650 rounded-lg shrink-0">
                <ArrowDownRight size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Egresos (Salidas)</span>
                <h3 className="text-xl font-extrabold text-red-700 font-mono leading-tight">{formatPrice(totalOutflows)}</h3>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-indigo-500 bg-white/50 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-650 rounded-lg shrink-0">
                <Scale size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Balance de Caja</span>
                <h3 className={`text-xl font-extrabold font-mono leading-tight ${netBalance >= 0 ? 'text-indigo-800' : 'text-rose-700'}`}>
                  {netBalance >= 0 ? '+' : ''}{formatPrice(netBalance)}
                </h3>
              </div>
            </div>
          </div>

          {/* Filters Area - Movements */}
          <div className="glass-panel p-4 rounded-2xl border border-white/60 bg-white/40 shadow-sm shrink-0 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por motivo, caja o cajero..." 
                className="w-full bg-white/80 border border-slate-200 rounded-xl pl-9 pr-4 py-2 outline-none focus:border-indigo-500 text-xs font-semibold text-slate-700"
                value={movementSearch}
                onChange={e => setMovementSearch(e.target.value)}
              />
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-650 font-semibold">
              <Calendar size={14} className="text-slate-400" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-slate-700 py-0.5"
                value={movementStartDate}
                onChange={e => setMovementStartDate(e.target.value)}
              />
              <span className="text-slate-300">al</span>
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-slate-700 py-0.5"
                value={movementEndDate}
                onChange={e => setMovementEndDate(e.target.value)}
              />
              {(movementStartDate || movementEndDate) && (
                <button 
                  onClick={() => { setMovementStartDate(''); setMovementEndDate(''); }}
                  className="text-red-500 hover:text-red-700 font-bold ml-1 text-[10px] uppercase"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Type Selector */}
            <select 
              className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 text-xs font-semibold text-slate-700 cursor-pointer"
              value={movementTypeFilter}
              onChange={e => setMovementTypeFilter(e.target.value)}
            >
              <option value="">Todos los Movimientos</option>
              <option value="OUT">Egresos (Salidas)</option>
              <option value="IN">Ingresos (Entradas)</option>
            </select>
          </div>

          {/* Movements List Table */}
          <div className="flex-1 glass-panel border border-slate-100 rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs select-none">
                    <th className="py-3.5 px-4 font-extrabold">Fecha y Hora</th>
                    <th className="py-3.5 px-4 font-extrabold">Tipo</th>
                    <th className="py-3.5 px-4 font-extrabold">Motivo / Descripción</th>
                    <th className="py-3.5 px-4 font-extrabold">Caja</th>
                    <th className="py-3.5 px-4 font-extrabold">Cajero</th>
                    <th className="py-3.5 px-4 text-right font-extrabold">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map((mov) => (
                    <tr key={mov.id} className="hover:bg-slate-50/50 text-slate-700 font-medium text-xs transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {new Date(mov.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 select-none">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 w-fit ${
                          mov.type === 'IN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {mov.type === 'IN' ? (
                            <><ArrowUpRight size={10} /> Ingreso</>
                          ) : (
                            <><ArrowDownRight size={10} /> Egreso</>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {mov.description || 'Sin descripción'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {mov.register_name || `Caja #${mov.shift}`}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-bold">
                        {mov.username || 'Sistema'}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold font-mono text-sm ${mov.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {mov.type === 'IN' ? '+' : '-'}{formatPrice(mov.amount)}
                      </td>
                    </tr>
                  ))}
                  
                  {filteredMovements.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 font-semibold">
                        {loadingMovements ? 'Cargando listado de movimientos...' : 'No se encontraron movimientos con los filtros seleccionados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'shifts' && (
        <>
          {/* KPI Banner Cards - Shifts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-indigo-500 bg-white/50 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Turnos Registrados</span>
                <h3 className="text-xl font-extrabold text-indigo-800 font-mono leading-tight">{filteredShifts.length}</h3>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500 bg-white/50 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0 relative">
                <CheckCircle size={20} />
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Turnos Activos</span>
                <h3 className="text-xl font-extrabold text-emerald-800 font-mono leading-tight">
                  {filteredShifts.filter(s => s.is_open).length}
                </h3>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border-l-4 border-l-slate-700 bg-white/50 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                <Scale size={20} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Total en Caja (Cerrados)</span>
                <h3 className="text-xl font-extrabold text-slate-800 font-mono leading-tight">
                  {formatPrice(filteredShifts.filter(s => !s.is_open).reduce((sum, s) => sum + parseFloat(s.final_balance || 0), 0))}
                </h3>
              </div>
            </div>
          </div>

          {/* Filters Area - Shifts */}
          <div className="glass-panel p-4 rounded-2xl border border-white/60 bg-white/40 shadow-sm shrink-0 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por cajero, caja o ID..." 
                className="w-full bg-white/80 border border-slate-200 rounded-xl pl-9 pr-4 py-2 outline-none focus:border-indigo-500 text-xs font-semibold text-slate-700"
                value={shiftSearch}
                onChange={e => setShiftSearch(e.target.value)}
              />
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-650 font-semibold">
              <Calendar size={14} className="text-slate-400" />
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-slate-700 py-0.5"
                value={shiftStartDate}
                onChange={e => setShiftStartDate(e.target.value)}
              />
              <span className="text-slate-300">al</span>
              <input 
                type="date" 
                className="bg-transparent border-none outline-none text-slate-700 py-0.5"
                value={shiftEndDate}
                onChange={e => setShiftEndDate(e.target.value)}
              />
              {(shiftStartDate || shiftEndDate) && (
                <button 
                  onClick={() => { setShiftStartDate(''); setShiftEndDate(''); }}
                  className="text-red-500 hover:text-red-700 font-bold ml-1 text-[10px] uppercase"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Status Selector */}
            <select 
              className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 text-xs font-semibold text-slate-700 cursor-pointer"
              value={shiftStatusFilter}
              onChange={e => setShiftStatusFilter(e.target.value)}
            >
              <option value="">Todos los Estados</option>
              <option value="open">Abiertos (Activos)</option>
              <option value="closed">Cerrados (Arqueados)</option>
            </select>
          </div>

          {/* Shifts List Table */}
          <div className="flex-1 glass-panel border border-slate-100 rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white">
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs select-none">
                    <th className="py-3.5 px-4 font-extrabold">ID Turno</th>
                    <th className="py-3.5 px-4 font-extrabold">Cajero / Usuario</th>
                    <th className="py-3.5 px-4 font-extrabold">Caja Registradora</th>
                    <th className="py-3.5 px-4 font-extrabold">Apertura</th>
                    <th className="py-3.5 px-4 font-extrabold">Cierre</th>
                    <th className="py-3.5 px-4 font-extrabold text-right">Saldo Inicial</th>
                    <th className="py-3.5 px-4 font-extrabold text-right">Efectivo Real</th>
                    <th className="py-3.5 px-4 font-extrabold text-center">Estado</th>
                    <th className="py-3.5 px-4 font-extrabold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShifts.map((sh) => (
                    <tr key={sh.id} className="hover:bg-slate-50/50 text-slate-700 font-medium text-xs transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono font-bold">
                        #{sh.id}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-bold">
                        {sh.username || 'Sistema'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">
                        {sh.register_name || `Caja #${sh.cash_register}`}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {new Date(sh.opened_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {sh.closed_at ? new Date(sh.closed_at).toLocaleString() : <span className="text-emerald-600 font-bold">En Curso...</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-slate-600">
                        {formatPrice(sh.initial_balance)}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold font-mono ${sh.is_open ? 'text-slate-400' : 'text-slate-800'}`}>
                        {sh.is_open ? '—' : formatPrice(sh.final_balance)}
                      </td>
                      <td className="py-3 px-4 text-center select-none">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-block ${
                          sh.is_open
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-slate-150 text-slate-650 border border-slate-200'
                        }`}>
                          {sh.is_open ? 'Abierto' : 'Cerrado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handlePrintShiftTicket(sh)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1.5 rounded-xl transition-all shadow-sm font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                          title="Reimprimir Arqueo"
                        >
                          <Printer size={13} /> Reimprimir
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {filteredShifts.length === 0 && (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-400 font-semibold">
                        {loadingShifts ? 'Cargando listado de turnos...' : 'No se encontraron turnos de caja con los filtros seleccionados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <FileText className="text-indigo-500" size={18} /> 
                  Detalles de Factura: {selectedSale.invoice_number || `TEMP-${selectedSale.id}`}
                </h2>
                <p className="text-[10px] text-slate-550 font-bold font-mono uppercase mt-0.5">
                  ID Venta: #{selectedSale.id} | Cajero: {selectedSale.user_username || 'Sistema'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedSale(null)} 
                className="text-slate-400 hover:text-slate-650 text-xl font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-700">
              
              {/* Customer & Info Card */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Cliente</span>
                  <span className="text-xs font-bold text-slate-750 block mt-0.5">
                    {selectedSale.customer_name || 'Cliente Final'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Fecha y Hora</span>
                  <span className="text-xs font-bold text-slate-750 block mt-0.5">
                    {new Date(selectedSale.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Tipo de Factura</span>
                  <span className="text-xs font-bold text-slate-750 block mt-0.5 uppercase">
                    {selectedSale.invoice_type === 'ELECTRONIC' ? 'Factura Electrónica' : 'POS Electrónico'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Estado de Factura</span>
                  <span className={`text-[10px] font-extrabold mt-1 inline-block uppercase px-2 py-0.5 rounded-full ${
                    selectedSale.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-red-50 text-red-650 border border-red-100'
                  }`}>
                    {selectedSale.status === 'COMPLETED' ? 'Válida' : 'Anulada'}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Artículos Vendidos</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/60 border-b border-slate-100 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3 text-center">Cant</th>
                        <th className="py-2.5 px-3 text-right">Unitario</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {(selectedSale.details || []).map((detail, index) => (
                        <tr key={index} className="hover:bg-slate-50/30">
                          <td className="py-2 px-3 font-semibold text-slate-800">{detail.product_name || 'Producto'}</td>
                          <td className="py-2 px-3 text-center font-mono text-slate-500">x{Math.round(parseFloat(detail.quantity))}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">{formatPrice(detail.unit_price)}</td>
                          <td className="py-2 px-3 text-right font-bold font-mono text-slate-800">{formatPrice(detail.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments details */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Método y Detalle de Pagos</h4>
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3.5 space-y-1.5 font-semibold text-xs">
                  {(selectedSale.payments || []).map((p, index) => (
                    <div key={index} className="flex justify-between items-center text-slate-700">
                      <span>{p.payment_method_name || 'Efectivo'} {p.reference ? `(${p.reference})` : ''}</span>
                      <span className="font-mono font-bold text-slate-800">{formatPrice(p.amount)}</span>
                    </div>
                  ))}
                  {(!selectedSale.payments || selectedSale.payments.length === 0) && (
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Pago en Efectivo (Predeterminado)</span>
                      <span className="font-mono font-bold text-slate-800">{formatPrice(selectedSale.total)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Totals */}
            {/* Financial Totals */}
              <div className="border-t border-slate-100 pt-4 flex flex-col items-end gap-1.5">
                <div className="flex justify-between w-full max-w-[200px] text-xs font-semibold text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatPrice(selectedSale.subtotal)}</span>
                </div>
                <div className="flex justify-between w-full max-w-[200px] text-xs font-semibold text-slate-500">
                  <span>Impuestos:</span>
                  <span className="font-mono">{formatPrice(selectedSale.tax)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between w-full max-w-[200px] text-xs font-bold text-emerald-500">
                    <span>Descuento{selectedSale.promo_percent > 0 ? ` (${selectedSale.promo_percent}%)` : ''}:</span>
                    <span className="font-mono">-{formatPrice(selectedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between w-full max-w-[200px] text-sm font-extrabold text-indigo-700 border-t border-indigo-100 pt-2">
                  <span>TOTAL:</span>
                  <span className="font-mono">{formatPrice(selectedSale.total)}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button 
                type="button" 
                onClick={() => printTicket(selectedSale, systemSettings, systemSettings?.ticket_logo || config?.ticket_logo, { preview: true, printerName: config?.default_printer })}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm hover:shadow cursor-pointer"
              >
                <Printer size={14} /> Reimprimir Recibo
              </button>
              
              {canVoid && (
                <button 
                  type="button"
                  disabled={selectedSale.status === 'CANCELLED'}
                  onClick={() => handleAnular(selectedSale)}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedSale.status === 'CANCELLED'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-red-50 hover:bg-red-100 text-red-650 border border-red-200'
                  }`}
                >
                  <AlertTriangle size={14} /> Anular Factura
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
