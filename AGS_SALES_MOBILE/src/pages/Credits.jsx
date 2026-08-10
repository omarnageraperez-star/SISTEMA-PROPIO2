import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Users, AlertTriangle, Calendar, FileText, X, Plus, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { apiRequest } from '../lib/api';
import { DarkSwal, Toast } from '../lib/swal';

export default function Credits({ auth }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState([]);
  const [summary, setSummary] = useState({
    total_debt: 0,
    debtors_count: 0,
    total_overdue: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCredit, setSelectedCredit] = useState(null);
  
  // Abono form states
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoNote, setAbonoNote] = useState('');
  const [submittingAbono, setSubmittingAbono] = useState(false);

  useEffect(() => {
    fetchData();
  }, [auth.token, auth.apiUrl]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const baseUrl = auth.apiUrl?.replace(/\/$/, '') || '';
      
      // Fetch summary
      const sumRes = await fetch(`${baseUrl}/sales/sales/credit-summary/`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }
      
      // Fetch active credits
      const crRes = await fetch(`${baseUrl}/sales/sales/credits/`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (crRes.ok) {
        const crData = await crRes.json();
        const results = Array.isArray(crData) ? crData : (crData.results || []);
        setCredits(results);
      }
    } catch (e) {
      console.error("Error fetching credit data:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (val) => {
    const symbol = auth.settings?.currency_symbol || '$';
    const num = Math.round(parseFloat(val || 0));
    return `${symbol} ${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const handleRegisterAbono = async (e) => {
    e.preventDefault();
    if (!abonoAmount || parseFloat(abonoAmount) <= 0) {
      Toast.fire({ icon: 'error', title: 'Ingrese un monto válido.' });
      return;
    }

    const pending = parseFloat(selectedCredit.total) - parseFloat(selectedCredit.amount_paid);
    if (parseFloat(abonoAmount) > pending + 0.01) {
      Toast.fire({ icon: 'error', title: 'El monto excede el saldo pendiente.' });
      return;
    }

    setSubmittingAbono(true);
    try {
      const baseUrl = auth.apiUrl?.replace(/\/$/, '') || '';
      const res = await apiRequest(`${baseUrl}/sales/sales/${selectedCredit.id}/pay-credit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(abonoAmount),
          note: abonoNote
        })
      }, auth.token);

      if (res.ok) {
        const data = await res.json();
        Toast.fire({ icon: 'success', title: 'Abono registrado exitosamente.' });
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
        DarkSwal.fire('Error', err.detail || 'No se pudo registrar el abono.', 'error');
      }
    } catch (error) {
      console.error(error);
      DarkSwal.fire('Error', 'No se pudo conectar con el servidor.', 'error');
    } finally {
      setSubmittingAbono(false);
    }
  };

  const filteredCredits = credits.filter(c => {
    const clientName = `${c.customer_name || ''} ${c.invoice_number || ''}`.toLowerCase();
    return clientName.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="page-container fade-in-up">
      <TopBar title="Cuentas por Cobrar" subtitle="Control de deudas de clientes" />

      <div className="page-content" style={{ padding: '16px 16px 0', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 16px))' }}>
        {/* Mobile Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Por Cobrar</span>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f97316', marginTop: 4 }}>{formatPrice(summary.total_debt)}</div>
          </div>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Deudores</span>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>{summary.debtors_count} Clientes</div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
          <input
            type="text"
            placeholder="Buscar por cliente o factura..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              background: 'rgba(30, 41, 59, 0.3)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 14,
              color: '#ffffff',
              fontSize: 14,
              outline: 'none'
            }}
          />
        </div>

        {/* Debtors List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
            <div className="spinner" style={{ width: 32, height: 32, border: '3px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>Cargando deudas...</span>
          </div>
        ) : filteredCredits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8' }}>
            <FileText size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>Sin deudas registradas</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>Todos los créditos están al día.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredCredits.map(c => {
              const pending = parseFloat(c.total) - parseFloat(c.amount_paid);
              const isOverdue = c.due_date && new Date(c.due_date) < new Date();
              
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCredit(c)}
                  style={{
                    background: 'rgba(30, 41, 59, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{c.customer_name}</h4>
                      <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', display: 'block', marginTop: 2 }}>
                        Fac: {c.invoice_number}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 8,
                      background: c.credit_status === 'PENDING' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(249, 115, 22, 0.12)',
                      color: c.credit_status === 'PENDING' ? '#ef4444' : '#f97316',
                      border: c.credit_status === 'PENDING' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(249, 115, 22, 0.2)'
                    }}>
                      {c.credit_status === 'PENDING' ? 'SIN ABONO' : 'ABONADO'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: '10px 14px' }}>
                    <div>
                      <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Saldo Pendiente</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#f97316' }}>{formatPrice(pending)}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Total de Venta</span>
                      <span style={{ fontSize: 13, fontWeight: 650, color: '#94a3b8' }}>{formatPrice(c.total)}</span>
                    </div>
                  </div>

                  {c.due_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isOverdue ? '#ef4444' : '#64748b' }}>
                      <Calendar size={13} />
                      <span>Vence: {c.due_date} {isOverdue && '(Vencida)'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Bottom Sheet Modal */}
      {selectedCredit && !showAbonoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 99, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{
            width: '100%',
            background: '#151b2a',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: '24px 20px calc(24px + env(safe-area-inset-bottom, 16px))',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '85%',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#ffffff' }}>Detalle de Crédito</h3>
              <button 
                onClick={() => setSelectedCredit(null)}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
              <div>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cliente</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>{selectedCredit.customer_name}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12 }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Saldo Pendiente</span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#f97316', marginTop: 4 }}>
                    {formatPrice(parseFloat(selectedCredit.total) - parseFloat(selectedCredit.amount_paid))}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12 }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>Abonado</span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>
                    {formatPrice(selectedCredit.amount_paid)}
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '10px 0 6px', fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Historial de Abonos</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!selectedCredit.credit_payments || selectedCredit.credit_payments.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                    No hay abonos registrados para esta deuda.
                  </span>
                ) : (
                  selectedCredit.credit_payments.map((p, idx) => (
                    <div key={p.id || idx} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>{formatPrice(p.amount)}</span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          {new Date(p.paid_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      {p.note && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>“{p.note}”</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setShowAbonoModal(true)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'var(--color-accent)',
                border: 'none',
                borderRadius: 14,
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                marginTop: 20,
                boxShadow: '0 4px 16px var(--color-accent-dim)'
              }}
            >
              Registrar Abono
            </button>
          </div>
        </div>
      )}

      {/* Abono Form Modal */}
      {showAbonoModal && selectedCredit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{
            width: '100%',
            maxWidth: 360,
            background: '#151b2a',
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#ffffff' }}>Registrar Abono</h3>
              <button 
                onClick={() => setShowAbonoModal(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleRegisterAbono} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, fontSize: 13 }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>Cliente</span>
                <span style={{ fontWeight: 750, color: '#f1f5f9', display: 'block', marginTop: 2 }}>{selectedCredit.customer_name}</span>
                <span style={{ color: '#64748b', display: 'block', fontSize: 11, marginTop: 8 }}>Saldo Pendiente</span>
                <span style={{ fontWeight: 800, color: '#f97316', fontSize: 16, display: 'block', marginTop: 2 }}>
                  {formatPrice(parseFloat(selectedCredit.total) - parseFloat(selectedCredit.amount_paid))}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Monto a Abonar</label>
                <input
                  type="number"
                  placeholder="Ingrese el monto..."
                  required
                  value={abonoAmount}
                  onChange={e => setAbonoAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(30, 41, 59, 0.3)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    color: '#ffffff',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Nota / Observación</label>
                <textarea
                  placeholder="Ej. Abono en efectivo..."
                  rows={2}
                  value={abonoNote}
                  onChange={e => setAbonoNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(30, 41, 59, 0.3)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    color: '#ffffff',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submittingAbono}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--color-accent)',
                  border: 'none',
                  borderRadius: 14,
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  marginTop: 10,
                  boxShadow: '0 4px 16px var(--color-accent-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: submittingAbono ? 0.6 : 1
                }}
              >
                {submittingAbono ? (
                  <div className="spinner" style={{ width: 18, height: 18, border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
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
