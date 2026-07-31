import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Landmark, ArrowUpRight, ArrowDownRight, Scale, AlertTriangle, Plus, X, Save, Clock, ArrowRight, ShieldCheck, DollarSign } from 'lucide-react';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl, parseError } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';
const formatWithSettings = (n, settings) => {
  const num = parseFloat(n) || 0;
  const symbol = settings?.currency_symbol || '$';
  const decimals = parseInt(settings?.currency_decimals || '0', 10);
  return `${symbol} ${num.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

export default function CashControl({ auth }) {
  const fmt = (n) => formatWithSettings(n, auth.settings);
  // Lists
  const [registers, setRegisters]   = useState([]);
  const [history, setHistory]       = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [openShifts, setOpenShifts] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');

  // Opening Shift form state
  const [openForm, setOpenForm]     = useState({ register_id: '', initial_balance: '0' });
  const [opening, setOpening]       = useState(false);

  // Closing Shift form state
  const [closeForm, setCloseForm]   = useState({ final_balance: '', notes: '' });
  const [closing, setClosing]       = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Cash Movement form state
  const [movForm, setMovForm]       = useState({ type: 'IN', amount: '', description: '' });
  const [movs, setMovs]             = useState([]);
  const [savingMov, setSavingMov]   = useState(false);
  const [showMovModal, setShowMovModal] = useState(false);

  // Calculated active shift metrics
  const [metrics, setMetrics] = useState({
    initBal: 0,
    salesTotal: 0,
    movsIn: 0,
    movsOut: 0,
    expected: 0
  });

  const [errMsg, setErrMsg] = useState('');

  const fetchRef = useRef(null);
  useEffect(() => {
    fetchRef.current = fetchActiveShiftAndHistory;
  });

  useEffect(() => {
    if (fetchRef.current) {
      fetchRef.current();
    }
    const interval = setInterval(() => {
      if (fetchRef.current) {
        fetchRef.current(true);
      }
    }, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const fetchActiveShiftAndHistory = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setErrMsg('');
    }
    try {
      // 1. Get registers options (only needed initially)
      if (!silent) {
        const regRes = await apiRequest(apiUrl(auth.apiUrl, 'accounting/cash-registers/'), {}, auth.token);
        if (regRes.ok) {
          const d = await regRes.json();
          const list = d.registers || [];
          setRegisters(list);
          
          // Auto-select mobile cash register
          const mobileReg = list.find(r => 
            r.name.toLowerCase().includes('movil') || 
            r.name.toLowerCase().includes('móvil') || 
            r.name.toLowerCase().includes('celular') || 
            r.name.toLowerCase().includes('apk')
          );
          if (mobileReg) {
            setOpenForm(p => ({ ...p, register_id: String(mobileReg.id) }));
          } else {
            setOpenForm(p => ({ ...p, register_id: 'CREATE_MOBILE' }));
          }
        }
      }

      // 2. Fetch active/open shifts
      const openRes = await apiRequest(apiUrl(auth.apiUrl, 'accounting/cash-shifts/?is_open=true'), {}, auth.token);
      let openShiftsList = [];
      if (openRes.ok) {
        const d = await openRes.json();
        openShiftsList = Array.isArray(d) ? d : d.results || [];
        setOpenShifts(openShiftsList);
      }

      // 3. Fetch history lists (closed shifts)
      const histRes = await apiRequest(apiUrl(auth.apiUrl, 'accounting/cash-shifts/?page_size=20'), {}, auth.token);
      if (histRes.ok) {
        const d = await histRes.json();
        const list = Array.isArray(d) ? d : d.results || [];
        setHistory(list.filter(s => !s.is_open));
      }

      // 4. Determine which shift is active for display
      const isAdmin = ['SUPERADMIN', 'ADMIN'].includes(auth.user?.role);
      if (isAdmin) {
        if (openShiftsList.length > 0) {
          let target = null;
          if (selectedShiftId && selectedShiftId !== 'NEW_SHIFT') {
            target = openShiftsList.find(s => String(s.id) === String(selectedShiftId));
          }
          if (!target) {
            // Default to admin's own shift if open, or the first open shift
            target = openShiftsList.find(s => s.username === auth.user?.username) || openShiftsList[0];
          }
          
          if (target && selectedShiftId !== 'NEW_SHIFT') {
            setActiveShift(target);
            setSelectedShiftId(String(target.id));
            await loadActiveShiftData(target);
          } else if (selectedShiftId === 'NEW_SHIFT') {
            setActiveShift(null);
          } else {
            setActiveShift(null);
          }
        } else {
          setActiveShift(null);
          setSelectedShiftId('');
        }
      } else {
        // Regular cashier: only see their own open shift
        const myShift = openShiftsList.find(s => s.username === auth.user?.username);
        if (myShift) {
          setActiveShift(myShift);
          setSelectedShiftId(String(myShift.id));
          await loadActiveShiftData(myShift);
        } else {
          setActiveShift(null);
          setSelectedShiftId('');
        }
      }
    } catch (e) {
      if (!silent) setErrMsg('Error al conectar con el servidor.');
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSelectShift = async (shiftId) => {
    setSelectedShiftId(shiftId);
    if (shiftId === 'NEW_SHIFT') {
      setActiveShift(null);
    } else {
      const target = openShifts.find(s => String(s.id) === String(shiftId));
      if (target) {
        setActiveShift(target);
        await loadActiveShiftData(target);
      } else {
        setActiveShift(null);
      }
    }
  };

  const loadActiveShiftData = async (shift) => {
    try {
      const initBal = parseFloat(shift.initial_balance || 0);

      // Fetch only the lightweight movements of the current shift (includes auto-logged sales)
      const movsRes = await apiRequest(apiUrl(auth.apiUrl, `accounting/cash-movements/?shift=${shift.id}`), {}, auth.token);
      let salesSum = 0;
      let inSum = 0;
      let outSum = 0;
      let movsList = [];

      if (movsRes.ok) {
        const d = await movsRes.json();
        movsList = Array.isArray(d) ? d : d.results || [];
        setMovs(movsList);
        movsList.forEach(m => {
          const amt = parseFloat(m.amount || 0);
          if (m.type === 'IN') {
            if (m.description?.toLowerCase().includes('venta')) {
              salesSum += amt;
            } else {
              inSum += amt;
            }
          } else if (m.type === 'OUT') {
            outSum += amt;
          }
        });
      }

      setMetrics({
        initBal,
        salesTotal: salesSum,
        movsIn: inSum,
        movsOut: outSum,
        expected: initBal + salesSum + inSum - outSum
      });
    } catch (e) {
      console.warn("Failed loading active shift metrics:", e);
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (!openForm.register_id) {
      setErrMsg('Por favor selecciona una caja.');
      return;
    }
    setOpening(true);
    setErrMsg('');
    try {
      let finalRegisterId = openForm.register_id;
      
      // Auto-create Caja Móvil on the fly
      if (finalRegisterId === 'CREATE_MOBILE') {
        const createRes = await apiRequest(apiUrl(auth.apiUrl, 'accounting/cash-registers/'), {
          method: 'POST',
          body: JSON.stringify({ name: 'Caja Móvil', is_active: true })
        }, auth.token);
        if (createRes.ok) {
          const newReg = await createRes.json();
          finalRegisterId = String(newReg.id);
        } else {
          setErrMsg('Error al crear la Caja Móvil en el servidor.');
          setOpening(false);
          return;
        }
      }

      const res = await apiRequest(apiUrl(auth.apiUrl, 'accounting/cash-shifts/open/'), {
        method: 'POST',
        body: JSON.stringify({
          register_id: parseInt(finalRegisterId),
          initial_balance: parseFloat(openForm.initial_balance || 0)
        })
      }, auth.token);

      if (res.ok) {
        await fetchActiveShiftAndHistory();
      } else {
        setErrMsg(await parseError(res));
      }
    } catch {
      setErrMsg('Error al intentar abrir la caja.');
    } finally {
      setOpening(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (closeForm.final_balance === '') {
      DarkSwal.fire('Atención', 'Por favor introduce el saldo final medido en caja.', 'warning');
      return;
    }
    setClosing(true);
    try {
      const finalVal = parseFloat(closeForm.final_balance);
      const res = await apiRequest(apiUrl(auth.apiUrl, `accounting/cash-shifts/${activeShift.id}/`), {
        method: 'PATCH',
        body: JSON.stringify({
          is_open: false,
          final_balance: finalVal,
          closed_at: new Date().toISOString()
        })
      }, auth.token);

      if (res.ok) {
        Toast.fire({ icon: 'success', title: 'Caja cerrada exitosamente' });
        setShowCloseModal(false);
        setCloseForm({ final_balance: '', notes: '' });
        await fetchActiveShiftAndHistory();
      } else {
        DarkSwal.fire('Error', 'Error al cerrar la caja.', 'error');
      }
    } catch {
      DarkSwal.fire('Error', 'Error de red al guardar.', 'error');
    } finally {
      setClosing(false);
    }
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();
    if (!movForm.amount || !movForm.description) {
      DarkSwal.fire('Atención', 'Introduce el monto y una descripción.', 'warning');
      return;
    }
    setSavingMov(true);
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'accounting/cash-movements/'), {
        method: 'POST',
        body: JSON.stringify({
          shift: activeShift.id,
          type: movForm.type,
          amount: parseFloat(movForm.amount),
          description: movForm.description
        })
      }, auth.token);

      if (res.ok) {
        Toast.fire({ icon: 'success', title: 'Movimiento de caja registrado' });
        setShowMovModal(false);
        setMovForm({ type: 'IN', amount: '', description: '' });
        await loadActiveShiftData(activeShift);
      } else {
        DarkSwal.fire('Error', 'Error al registrar movimiento.', 'error');
      }
    } catch {
      DarkSwal.fire('Error', 'Error de red.', 'error');
    } finally {
      setSavingMov(false);
    }
  };

  const diff = closeForm.final_balance !== ''
    ? parseFloat(closeForm.final_balance) - metrics.expected
    : 0;

  return (
    <div className="page-container fade-in-up">
      <TopBar title="Control de Caja" subtitle="Turnos, arqueos y egresos" />

      <div className="page-content" style={{ padding: '12px 16px 0', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 16px))' }}>
        {errMsg && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span>{errMsg}</span>
          </div>
        )}

        {/* Admin shift selector */}
        {!loading && ['SUPERADMIN', 'ADMIN'].includes(auth.user?.role) && openShifts.length > 0 && (
          <div style={{
            background: 'rgba(30, 36, 53, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.03)',
            borderRadius: 14,
            padding: 12,
            marginBottom: 16,
          }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Ver Turno Activo de:
            </label>
            <select
              className="input-field"
              value={selectedShiftId}
              onChange={e => handleSelectShift(e.target.value)}
              style={{ background: '#1e2435', color: '#f1f5f9', border: '1px solid #252d42', borderRadius: 8, height: 40, fontSize: 14, fontWeight: 600 }}
            >
              {openShifts.map(sh => (
                <option key={sh.id} value={sh.id}>
                  👤 {sh.username} ({sh.register_name || `Caja #${sh.id}`})
                </option>
              ))}
              <option value="NEW_SHIFT">➕ Abrir Turno / Otra Caja</option>
            </select>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : activeShift ? (
          // ACTIVE SHIFT INTERFACE
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status Card */}
            <div style={{
              background: 'linear-gradient(135deg, #1e2435, #252d42)',
              border: '1px solid #22c55e',
              borderRadius: 18,
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
              <div>
                <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 20, textTransform: 'uppercase' }}>Caja Abierta</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 2px 0', color: '#f1f5f9' }}>{activeShift.register_name || 'Caja Activa'}</h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>Por: {activeShift.username}</span>
              </div>
              <ShieldCheck size={40} color="#22c55e" style={{ opacity: 0.8 }} />
            </div>

            {/* Balances Card */}
            <div style={{
              background: 'rgba(30, 36, 53, 0.4)',
              borderRadius: 16,
              padding: 20,
              border: '1px solid rgba(255, 255, 255, 0.03)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Saldo de Efectivo Estimado</span>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: '#f1f5f9', margin: '4px 0 0' }}>{fmt(metrics.expected)}</h1>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid #252d42', paddingTop: 16 }}>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Saldo Inicial</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>{fmt(metrics.initBal)}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Ventas en Caja</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#22c55e' }}>{fmt(metrics.salesTotal)}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Egresos (Gastos)</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#ef4444' }}>{fmt(metrics.movsOut)}</span>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Entradas Extra</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#3b82f6' }}>{fmt(metrics.movsIn)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button onClick={() => setShowMovModal(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46 }}>
                <Plus size={16} /> Movimiento Caja
              </button>
              <button onClick={() => setShowCloseModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, background: '#ef4444' }}>
                <Scale size={16} /> Corte de Caja
              </button>
            </div>

            {/* Active movements */}
            <p className="section-header" style={{ margin: '10px 0 0' }}>Movimientos del turno ({movs.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {movs.length === 0 && (
                <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No se han registrado egresos o ingresos extra en este turno.</p>
              )}
              {movs.map(m => (
                <div key={m.id} style={{
                  background: 'rgba(30, 36, 53, 0.2)',
                  borderRadius: 12,
                  padding: 12,
                  border: '1px solid rgba(255,255,255,0.01)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: m.type === 'IN' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {m.type === 'IN'
                      ? <ArrowUpRight size={16} color="#22c55e" />
                      : <ArrowDownRight size={16} color="#ef4444" />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{m.description}</span>
                    <span style={{ fontSize: 10, color: '#64748b' }}>{new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: m.type === 'IN' ? '#22c55e' : '#ef4444' }}>
                    {m.type === 'IN' ? '+' : '-'}{fmt(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // CLOSED SHIFT INTERFACE - REQUIRE TO OPEN BOX
          <form onSubmit={handleOpenShift} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'linear-gradient(135deg, #1e2435, #252d42)',
              borderRadius: 18,
              padding: '24px 20px',
              border: '1px solid rgba(255,255,255,0.03)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              textAlign: 'center'
            }}>
              <Landmark size={44} color="#f97316" style={{ margin: '0 auto 12px', opacity: 0.9 }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Apertura de Turno de Caja</h2>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Debes abrir un turno para registrar movimientos y vincular ingresos.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Selecciona la Caja de Venta</label>
                <select
                  className="input-field"
                  value={openForm.register_id}
                  onChange={e => setOpenForm({ ...openForm, register_id: e.target.value })}
                  required
                  style={{ background: '#252d42', color: openForm.register_id ? '#f1f5f9' : '#64748b' }}
                >
                  <option value="">Selecciona una caja</option>
                  {registers.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                  {!registers.some(r => r.name.toLowerCase().includes('movil') || r.name.toLowerCase().includes('móvil') || r.name.toLowerCase().includes('celular') || r.name.toLowerCase().includes('apk')) && (
                    <option value="CREATE_MOBILE">✨ Caja Móvil (Crear Automáticamente)</option>
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Fondo Inicial de Efectivo (Base)</label>
                <input
                  className="input-field"
                  placeholder="Ej: 100000"
                  type="number"
                  inputMode="numeric"
                  value={openForm.initial_balance}
                  onChange={e => setOpenForm({ ...openForm, initial_balance: e.target.value })}
                  required
                />
              </div>

              <button className="btn-primary" type="submit" disabled={opening} style={{ height: 48, marginTop: 10 }}>
                {opening
                  ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Abriendo Caja...</>
                  : <><Plus size={18} /> Iniciar Turno / Abrir Caja</>
                }
              </button>
            </div>
          </form>
        )}

        {/* History closed lists */}
        {!loading && history.length > 0 && (
          <>
            <p className="section-header" style={{ marginTop: 24, marginBottom: 10 }}>Historial de Turnos Cerrados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24 }}>
              {history.map(s => {
                return (
                  <div key={s.id} style={{
                    background: 'rgba(30, 36, 53, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.02)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{s.register_name || `Caja #${s.id}`}</span>
                      <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} />
                        {new Date(s.opened_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                      <span>Cajero: {s.username}</span>
                      <span>Saldo Final: <strong>{fmt(s.final_balance)}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showMovModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && setShowMovModal(false)}>
          <div className="modal-sheet">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Registrar Movimiento</h2>
              <button onClick={() => setShowMovModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSaveMovement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Tipo de movimiento</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setMovForm({ ...movForm, type: 'IN' })}
                    style={{
                      height: 40,
                      borderRadius: 10,
                      border: '1px solid',
                      borderColor: movForm.type === 'IN' ? '#22c55e' : '#252d42',
                      background: movForm.type === 'IN' ? 'rgba(34,197,94,0.1)' : 'transparent',
                      color: movForm.type === 'IN' ? '#22c55e' : '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Ingreso (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovForm({ ...movForm, type: 'OUT' })}
                    style={{
                      height: 40,
                      borderRadius: 10,
                      border: '1px solid',
                      borderColor: movForm.type === 'OUT' ? '#ef4444' : '#252d42',
                      background: movForm.type === 'OUT' ? 'rgba(239,68,68,0.1)' : 'transparent',
                      color: movForm.type === 'OUT' ? '#ef4444' : '#64748b',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Egreso (-)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Monto ({auth.settings?.currency_symbol || '$'})</label>
                <input
                  className="input-field"
                  placeholder="Ej: 5000"
                  type="number"
                  inputMode="numeric"
                  value={movForm.amount}
                  onChange={e => setMovForm({ ...movForm, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Descripción / Concepto</label>
                <input
                  className="input-field"
                  placeholder="Ej: Compra de hielo o Reposición caja"
                  value={movForm.description}
                  onChange={e => setMovForm({ ...movForm, description: e.target.value })}
                  required
                />
              </div>

              <button className="btn-primary" type="submit" disabled={savingMov} style={{ height: 44, marginTop: 10 }}>
                {savingMov ? 'Registrar...' : 'Registrar'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showCloseModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && setShowCloseModal(false)}>
          <div className="modal-sheet">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Cerrar Caja (Corte)</h2>
              <button onClick={() => setShowCloseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 12, padding: 12, textAlign: 'center', border: '1px solid rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Saldo Estimado en Caja</span>
                <h3 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', margin: '2px 0 0' }}>{fmt(metrics.expected)}</h3>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Saldo Final Real (Dinero en Mano)</label>
                <input
                  className="input-field"
                  placeholder="Ej: 105000"
                  type="number"
                  inputMode="numeric"
                  value={closeForm.final_balance}
                  onChange={e => setCloseForm({ ...closeForm, final_balance: e.target.value })}
                  required
                />
              </div>

              {closeForm.final_balance !== '' && (
                <div style={{
                  background: diff === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${diff === 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Scale size={16} color={diff === 0 ? '#22c55e' : '#ef4444'} />
                  <span style={{ fontSize: 13, color: diff === 0 ? '#86efac' : '#fca5a5' }}>
                    {diff === 0
                      ? 'La caja está cuadrada a la perfección.'
                      : diff > 0
                        ? `Sobran ${fmt(diff)} en caja.`
                        : `Faltan ${fmt(Math.abs(diff))} en caja.`
                    }
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Observaciones (Opcional)</label>
                <textarea
                  className="input-field"
                  placeholder="Comentarios sobre descuadres, vales..."
                  rows={2}
                  value={closeForm.notes}
                  onChange={e => setCloseForm({ ...closeForm, notes: e.target.value })}
                  style={{ resize: 'none' }}
                />
              </div>

              <button className="btn-primary" type="submit" disabled={closing} style={{ height: 46, marginTop: 10, background: '#ef4444' }}>
                {closing ? 'Cerrando Caja...' : 'Finalizar Turno y Cerrar Caja'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
