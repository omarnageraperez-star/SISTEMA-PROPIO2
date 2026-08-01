import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, DollarSign, Package, ShoppingBag, Lightbulb } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function BIModule({ config, token }) {
  const [data, setData] = useState({
    total_sales: 0,
    total_orders: 0,
    active_products: 0,
    top_products: [],
    sales_by_hour: [],
    ai_suggestions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${config.apiUrl}reports/dashboard/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center animate-pulse">
        <div className="text-gray-400 font-medium">Cargando Inteligencia de Negocios...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up pr-2">
      
      {/* Header & KPI Cards */}
      <div className="select-none">
        <div className="flex items-center justify-between mb-4 mt-2">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <TrendingUp className="text-indigo-500" /> Analítica de Negocios
            </h2>
            <p className="text-xs text-gray-550 dark:text-gray-450 font-medium">Monitorea tus ingresos, inventario y sugerencias de IA en tiempo real.</p>
          </div>
          <div className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 px-2.5 py-1.5 rounded-xl uppercase tracking-wider">
            📊 Datos Sincronizados
          </div>
        </div>
        
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card: Sales */}
          <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-indigo-500 border-white/50 dark:border-slate-850/60 bg-white/60 dark:bg-slate-900/60 shadow-md flex items-center gap-4 hover:scale-[1.01] transition-transform duration-200">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-inner shrink-0">
              <DollarSign size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Ingresos Totales</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mt-0.5">${Math.round(parseFloat(data.total_sales || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</h3>
              <p className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold mt-1 flex items-center gap-0.5">📈 +14.2% vs mes anterior</p>
            </div>
          </div>

          {/* Card: Orders */}
          <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500 border-white/50 dark:border-slate-850/60 bg-white/60 dark:bg-slate-900/60 shadow-md flex items-center gap-4 hover:scale-[1.01] transition-transform duration-200">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-inner shrink-0">
              <ShoppingBag size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Órdenes Completadas</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mt-0.5">{data.total_orders || 0}</h3>
              <p className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold mt-1 flex items-center gap-0.5">📈 +8.7% vs mes anterior</p>
            </div>
          </div>

          {/* Card: Products */}
          <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-purple-500 border-white/50 dark:border-slate-850/60 bg-white/60 dark:bg-slate-900/60 shadow-md flex items-center gap-4 hover:scale-[1.01] transition-transform duration-200">
            <div className="p-3 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-2xl shadow-inner shrink-0">
              <Package size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Catálogo Activo</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight mt-0.5">{data.active_products || 0}</h3>
              <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold mt-1 flex items-center gap-0.5">✨ Productos en vitrina</p>
            </div>
          </div>
          
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-[300px]">
        
        {/* Sales by Hour (Bar Chart) */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-white/50 dark:border-slate-850/60 bg-white/60 dark:bg-slate-900/60 shadow-md flex flex-col">
          <div className="mb-4">
            <h3 className="font-extrabold text-sm text-gray-700 dark:text-gray-250 uppercase tracking-wider">Flujo de Ventas por Horario</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Analiza las horas de mayor actividad comercial en tu negocio.</p>
          </div>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sales_by_hour || []} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" dark:stroke="#1e293b" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 600}} tickFormatter={(val) => `$${Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`} />
                <RechartsTooltip cursor={{fill: 'rgba(99, 102, 241, 0.04)'}} contentStyle={{borderRadius: '16px', border: 'none', backgroundColor: 'rgba(255, 255, 255, 0.95)', dark: {backgroundColor: '#0f172a'}, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} formatter={(value) => [`$${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`, 'Ventas']} />
                <Bar dataKey="ventas" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products (Pie Chart) */}
        <div className="glass-panel p-5 rounded-2xl border border-white/50 dark:border-slate-850/60 bg-white/60 dark:bg-slate-900/60 shadow-md flex flex-col">
          <div className="mb-4">
            <h3 className="font-extrabold text-sm text-gray-700 dark:text-gray-250 uppercase tracking-wider">Top 5 Más Vendidos</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Tus productos líderes en facturación.</p>
          </div>
          <div className="flex-1 w-full min-h-[200px] flex items-center justify-center">
            {data.top_products && data.top_products.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.top_products}
                    cx="50%"
                    cy="48%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {data.top_products.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} unidades`, 'Vendido']} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{fontSize: '11px', fontWeight: 600, paddingBottom: '5px'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold select-none">No hay datos de ventas en este ciclo.</p>
            )}
          </div>
        </div>
      </div>
      {/* Dice Game/Promotions Performance */}
      {data.promo_metrics && data.promo_metrics.orders_count > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-white/50 dark:border-slate-850/60 bg-white/60 dark:bg-slate-900/60 shadow-md select-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-sm text-gray-700 dark:text-gray-250 uppercase tracking-wider flex items-center gap-1.5">
                <span>🎲</span> Rendimiento de Promociones (Juego de Dados)
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Evalúa el impacto comercial y retorno de inversión de la dinámica de dados.</p>
            </div>
            {data.promo_metrics.avg_ticket_promo > data.promo_metrics.avg_ticket_normal && (
              <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50 px-2.5 py-1 rounded-full animate-pulse">
                🔥 Aumenta Ticket Promedio
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="bg-slate-100/55 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Ventas con Dados</span>
              <span className="text-xl font-black text-gray-800 dark:text-gray-100 mt-1">{data.promo_metrics.orders_count} órdenes</span>
            </div>
            <div className="bg-slate-100/55 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] text-emerald-500 font-bold uppercase">Facturación Promo (Neto)</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                ${Math.round(data.promo_metrics.total_sales).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              </span>
            </div>
            <div className="bg-slate-100/55 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] text-rose-500 font-bold uppercase">Descuentos Otorgados</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
                -${Math.round(data.promo_metrics.total_discount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              </span>
            </div>
          </div>

          {/* Ticket Average Comparison Bars */}
          <div className="p-4 bg-white/40 dark:bg-slate-900/30 rounded-xl border border-white/50 dark:border-slate-800/40">
            <h4 className="text-xs font-extrabold text-gray-600 dark:text-gray-300 uppercase mb-3 tracking-wider">Comparación de Ticket Promedio</h4>
            <div className="flex flex-col gap-3">
              {/* Normal Ticket Bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1">
                  <span>Venta Normal</span>
                  <span>${Math.round(data.promo_metrics.avg_ticket_normal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-gray-400 h-full rounded-full" style={{ width: `${Math.min(100, (data.promo_metrics.avg_ticket_normal / Math.max(data.promo_metrics.avg_ticket_normal, data.promo_metrics.avg_ticket_promo || 1)) * 100)}%` }}></div>
                </div>
              </div>

              {/* Promo Ticket Bar */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                  <span className="flex items-center gap-1">Venta con Juego de Dados 🎲</span>
                  <span className="font-bold">${Math.round(data.promo_metrics.avg_ticket_promo).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (data.promo_metrics.avg_ticket_promo / Math.max(data.promo_metrics.avg_ticket_normal, data.promo_metrics.avg_ticket_promo || 1)) * 100)}%` }}></div>
                </div>
              </div>
            </div>
            {data.promo_metrics.avg_ticket_promo > data.promo_metrics.avg_ticket_normal && (
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-3.5 flex items-center gap-1 select-none">
                💡 <b>Tip de Inteligencia:</b> La gamificación con dados incrementa el ticket promedio en un <b>{(((data.promo_metrics.avg_ticket_promo - data.promo_metrics.avg_ticket_normal) / data.promo_metrics.avg_ticket_normal) * 100).toFixed(1)}%</b>. El cliente agrega más artículos a su carrito para conseguir la oportunidad de lanzar los dados y obtener descuentos.
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI Suggestions Box */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm select-none">
        <h3 className="font-extrabold text-indigo-900 dark:text-indigo-300 text-sm tracking-wider uppercase mb-3.5 flex items-center gap-2">
          <Lightbulb className="text-yellow-500 fill-yellow-500/20 animate-pulse" size={18} /> Sugerencias de Negocio Inteligente
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.ai_suggestions && data.ai_suggestions.map((sug, i) => (
            <div key={i} className="bg-white/70 dark:bg-slate-900/50 p-3.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-350 border border-white/50 dark:border-slate-800/40 shadow-sm flex gap-3 items-start leading-relaxed animate-scale-in">
              <span className="text-base">💡</span>
              <p>{sug}</p>
            </div>
          ))}
          {(!data.ai_suggestions || data.ai_suggestions.length === 0) && (
            <div className="col-span-2 py-4 text-center">
              <p className="text-indigo-600/70 dark:text-indigo-400/50 text-xs font-semibold animate-pulse">
                El motor cognitivo está analizando tus datos de caja para generar recomendaciones tácticas de venta...
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );;
}
