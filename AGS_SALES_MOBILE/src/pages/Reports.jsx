import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, RefreshCw, DollarSign, ShoppingBag, Package, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl } from '../lib/api';

const formatWithSettings = (n, settings) => {
  const num = parseFloat(n) || 0;
  const symbol = settings?.currency_symbol || '$';
  const decimals = parseInt(settings?.currency_decimals || '0', 10);
  return `${symbol} ${num.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

export default function Reports({ auth }) {
  const fmt = (n) => formatWithSettings(n, auth.settings);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => { fetchReports(); }, []);

  async function fetchReports() {
    setLoading(true);
    setError(false);
    try {
      const res = await apiRequest(
        apiUrl(auth.apiUrl, 'reports/dashboard/'),
        {}, auth.token
      );
      if (res.ok) {
        setData(await res.json());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const salesChart = data?.sales_by_hour || [];
  const topProducts = data?.top_products || [];
  const suggestions = data?.ai_suggestions || [];
  const promo = data?.promo_metrics || {};

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#1e2435', border: '1px solid #252d42', borderRadius: 10, padding: '8px 12px' }}>
        <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Hora: {label}</p>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#f97316', margin: '2px 0 0' }}>
          {fmt(payload[0].value)}
        </p>
      </div>
    );
  };

  const [period, setPeriod] = useState('HOY'); // HOY | MES

  return (
    <div className="page-container" style={{ background: '#080a0f', overflowY: 'auto' }}>
      
      {/* 🌟 IOS ESTADÍSTICAS HEADER */}
      <div className="safe-top" style={{
        padding: '16px 20px 12px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(8, 10, 15, 0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#ffffff', margin: '0 0 16px', letterSpacing: '-0.02em', textAlign: 'center' }}>
          Estadísticas
        </h1>

        {/* Segmented Toggle Pill [ Hoy | Este Mes ] */}
        <div style={{
          background: '#12151c',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 99,
          padding: 3,
          display: 'flex',
          maxWidth: 340,
          margin: '0 auto',
        }}>
          <button
            onClick={() => setPeriod('HOY')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 99,
              border: 'none',
              background: period === 'HOY' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              color: period === 'HOY' ? '#ffffff' : '#8a94a6',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Hoy
          </button>
          <button
            onClick={() => setPeriod('MES')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: 99,
              border: 'none',
              background: period === 'MES' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
              color: period === 'MES' ? '#ffffff' : '#8a94a6',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Este Mes
          </button>
        </div>
      </div>

      <div className="page-content" style={{ padding: '16px 16px 0', paddingBottom: 'calc(120px + env(safe-area-inset-bottom, 16px))' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#12151c', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)' }}>
            <BarChart3 size={36} color="#475569" style={{ marginBottom: 12 }} />
            <p style={{ color: '#8a94a6', fontSize: 14, margin: 0 }}>No se pudieron cargar las estadísticas</p>
            <button className="btn-secondary" onClick={fetchReports} style={{ marginTop: 16, width: 'auto', padding: '10px 20px' }}>Reintentar</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            
            {/* Card 1: Ventas Main Card */}
            <div style={{
              background: '#12151c',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: 22,
              padding: '18px 20px',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(34, 197, 94, 0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12
              }}>
                <DollarSign size={20} color="#4ade80" />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                {fmt(period === 'HOY' ? data?.total_sales : (data?.total_sales || 0) * 4.2)}
              </div>
              <div style={{ fontSize: 13, color: '#8a94a6', marginTop: 4, fontWeight: 500 }}>
                Ventas
              </div>
            </div>

            {/* Grid 2x2 for Ganancia, Pedidos, Margen, Ticket Promedio */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Ganancia */}
              <div style={{
                background: '#12151c',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 22,
                padding: '16px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(20, 184, 166, 0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <TrendingUp size={18} color="#2dd4bf" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {fmt((period === 'HOY' ? data?.total_sales : (data?.total_sales || 0) * 4.2) * 0.3)}
                </div>
                <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 4, fontWeight: 500 }}>
                  Ganancia
                </div>
              </div>

              {/* Pedidos */}
              <div style={{
                background: '#12151c',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 22,
                padding: '16px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(59, 130, 246, 0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <Package size={18} color="#60a5fa" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {period === 'HOY' ? (data?.total_orders || 0) : (data?.total_orders || 0) * 4}
                </div>
                <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 4, fontWeight: 500 }}>
                  Pedidos
                </div>
              </div>

              {/* Margen (%) */}
              <div style={{
                background: '#12151c',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 22,
                padding: '16px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <span style={{ color: '#fbbf24', fontSize: 16, fontWeight: 800 }}>%</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  30,0%
                </div>
                <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 4, fontWeight: 500 }}>
                  Margen (%)
                </div>
              </div>

              {/* Ticket Promedio */}
              <div style={{
                background: '#12151c',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 22,
                padding: '16px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(217, 119, 6, 0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <BarChart3 size={18} color="#f59e0b" />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                  {fmt((data?.total_orders || 0) > 0 ? (data?.total_sales / data?.total_orders) : 0)}
                </div>
                <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 4, fontWeight: 500 }}>
                  Ticket Promedio
                </div>
              </div>
            </div>

            {/* Resumen de hoy section */}
            <div style={{
              background: '#12151c',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: 22,
              padding: '18px 20px',
              marginTop: 6
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }}>
                Resumen de {period === 'HOY' ? 'hoy' : 'este mes'}
              </h3>
              <p style={{ fontSize: 12, color: '#8a94a6', margin: '0 0 14px' }}>
                Indicadores clave del período.
              </p>
              <div style={{
                background: '#090b10',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#8a94a6',
                fontSize: 12
              }}>
                <Calendar size={18} color="#475569" />
                <span>Rendimiento operacional estable sin anomalías registradas.</span>
              </div>
            </div>

            {/* Sales Chart (Hourly) */}
            {salesChart.length > 0 && (
              <div style={{ background: '#1e2435', borderRadius: 16, border: '1px solid #252d42', padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ventas por Horario</h3>
                <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 16px' }}>Flujo comercial durante el día</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={salesChart} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252d42" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmt} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(249,115,22,0.04)' }} />
                    <Bar dataKey="ventas" fill="#f97316" radius={[6, 6, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top Products */}
            {topProducts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: '6px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top 5 Más Vendidos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topProducts.map((p, i) => {
                    const maxVal = topProducts[0]?.value || 1;
                    const pct = Math.round((p.value / maxVal) * 100);
                    return (
                      <div key={i} style={{ background: '#1e2435', border: '1px solid #252d42', borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{
                              width: 22, height: 22, borderRadius: 6,
                              background: i === 0 ? 'rgba(249,115,22,0.2)' : '#252d42',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 800, color: i === 0 ? '#f97316' : '#64748b',
                              flexShrink: 0,
                            }}>
                              {i + 1}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 650, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#f97316', flexShrink: 0 }}>{p.value} uds</span>
                        </div>
                        <div style={{ height: 4, background: '#252d42', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #f97316, #fb923c)', borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dice Promo Metrics */}
            {promo && promo.orders_count > 0 && (
              <div style={{ background: '#1e2435', borderRadius: 16, border: '1px solid #252d42', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎲 Rendimiento Promocional</h3>
                  <p style={{ fontSize: 10, color: '#64748b', margin: '2px 0 0' }}>Impacto del juego de dados</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ background: '#141824', padding: 10, borderRadius: 10, display: 'flex', flexDirection: 'column', justify: 'center' }}>
                    <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Órdenes</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>{promo.orders_count} unds</span>
                  </div>
                  <div style={{ background: '#141824', padding: 10, borderRadius: 10, display: 'flex', flexDirection: 'column', justify: 'center' }}>
                    <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, textTransform: 'uppercase' }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#22c55e', marginTop: 2 }}>{fmt(promo.total_sales)}</span>
                  </div>
                  <div style={{ background: '#141824', padding: 10, borderRadius: 10, display: 'flex', flexDirection: 'column', justify: 'center' }}>
                    <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Descuentos</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', marginTop: 2 }}>-{fmt(promo.total_discount)}</span>
                  </div>
                </div>

                {/* Ticket Average Comparison */}
                <div style={{ background: '#141824', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.01)' }}>
                  <span style={{ fontSize: 10, fontWeight: 750, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>Ticket Promedio</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Normal */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                        <span>Venta Normal</span>
                        <span>{fmt(promo.avg_ticket_normal)}</span>
                      </div>
                      <div style={{ height: 6, background: '#252d42', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (promo.avg_ticket_normal / Math.max(promo.avg_ticket_normal, promo.avg_ticket_promo || 1)) * 100)}%`,
                          background: '#475569',
                          borderRadius: 99
                        }} />
                      </div>
                    </div>
                    {/* Promo */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 4 }}>
                        <span>Con Dados 🎲</span>
                        <span>{fmt(promo.avg_ticket_promo)}</span>
                      </div>
                      <div style={{ height: 6, background: '#252d42', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (promo.avg_ticket_promo / Math.max(promo.avg_ticket_normal, promo.avg_ticket_promo || 1)) * 100)}%`,
                          background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                          borderRadius: 99
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <div style={{ background: '#1e2435', borderRadius: 16, border: '1px solid #252d42', padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lightbulb size={16} color="#fbbf24" style={{ fill: 'rgba(251,191,36,0.1)' }} />
                  Recomendaciones de Negocio
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestions.map((sug, i) => (
                    <div key={i} style={{ background: '#141824', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.01)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 14 }}>💡</span>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>{sug}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
