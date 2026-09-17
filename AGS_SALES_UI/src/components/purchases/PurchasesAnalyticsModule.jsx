import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Building2, Calendar, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { apiRequest } from '../../lib/api';

export default function PurchasesAnalyticsModule({ config, token, systemSettings }) {
  const symbol = systemSettings?.currency_symbol || '$';
  const decimals = parseInt(systemSettings?.currency_decimals ?? '2', 10);

  const formatPrice = (val) => {
    const num = parseFloat(val || 0);
    return `${symbol}${num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');

  // Data
  const [analytics, setAnalytics] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceComparison, setPriceComparison] = useState([]);
  const [priceTrends, setPriceTrends] = useState([]);

  // Lists
  const [providers, setProviders] = useState([]);
  const [products, setProducts] = useState([]);

  // Loading
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProviders();
    fetchProducts();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchPriceHistory();
      fetchPriceComparison();
      fetchPriceTrends();
    }
  }, [selectedProduct, selectedProvider, startDate, endDate]);

  const fetchProviders = async () => {
    try {
      const res = await apiRequest(`${config.apiBaseUrl}/api/purchases/providers/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setProviders(Array.isArray(data) ? data : data.results || []);
      }
    } catch (e) {
      console.error('Error fetching providers:', e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await apiRequest(`${config.apiBaseUrl}/api/inventory/products/`, {}, token);
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : data.results || []);
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = `${config.apiBaseUrl}/api/purchases/order-details/analytics/?`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      if (selectedProvider) url += `provider_id=${selectedProvider}&`;

      const res = await apiRequest(url, {}, token);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceHistory = async () => {
    try {
      let url = `${config.apiBaseUrl}/api/purchases/order-details/price_history/?product_id=${selectedProduct}`;
      if (selectedProvider) url += `&provider_id=${selectedProvider}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const res = await apiRequest(url, {}, token);
      if (res.ok) {
        const data = await res.json();
        setPriceHistory(data);
      }
    } catch (e) {
      console.error('Error fetching price history:', e);
    }
  };

  const fetchPriceComparison = async () => {
    try {
      const url = `${config.apiBaseUrl}/api/purchases/order-details/price_comparison/?product_id=${selectedProduct}`;
      const res = await apiRequest(url, {}, token);
      if (res.ok) {
        const data = await res.json();
        setPriceComparison(data);
      }
    } catch (e) {
      console.error('Error fetching price comparison:', e);
    }
  };

  const fetchPriceTrends = async () => {
    try {
      let url = `${config.apiBaseUrl}/api/purchases/order-details/price_trends/?product_id=${selectedProduct}`;
      if (selectedProvider) url += `&provider_id=${selectedProvider}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const res = await apiRequest(url, {}, token);
      if (res.ok) {
        const data = await res.json();
        setPriceTrends(data);
      }
    } catch (e) {
      console.error('Error fetching price trends:', e);
    }
  };

  const handleApplyFilters = () => {
    fetchAnalytics();
    if (selectedProduct) {
      fetchPriceHistory();
      fetchPriceComparison();
      fetchPriceTrends();
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <TrendingUp className="text-blue-600" size={28} />
          Análisis de Compras
        </h1>
        <p className="text-gray-500 mt-1">Dashboard de análisis de precios y tendencias de compras</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Filter size={20} className="text-blue-600" />
          Filtros
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha Inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Proveedor</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos los proveedores</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Producto</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="">Seleccionar producto</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleApplyFilters}
          className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          Aplicar Filtros
        </button>
      </div>

      {/* KPIs */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Gastado</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(analytics.total_spent)}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <DollarSign className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Órdenes</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.total_orders}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <ShoppingCart className="text-green-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Proveedor Top</p>
                <p className="text-lg font-bold text-gray-900 mt-1 truncate">{analytics.top_provider || 'N/A'}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <Building2 className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Producto Top</p>
                <p className="text-lg font-bold text-gray-900 mt-1 truncate">{analytics.top_product || 'N/A'}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <Package className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {selectedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Price Trends Line Chart */}
          {priceTrends.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendencia de Precios</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={priceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} name="Precio" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Price Comparison Bar Chart */}
          {priceComparison.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparación por Proveedor</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priceComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="provider" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avg_price" fill="#3b82f6" name="Precio Promedio" />
                  <Bar dataKey="min_price" fill="#10b981" name="Precio Mínimo" />
                  <Bar dataKey="max_price" fill="#ef4444" name="Precio Máximo" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Price History Table */}
      {selectedProduct && priceHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Historial de Precios</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fecha</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Proveedor</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Precio Unitario</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Cantidad</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Total</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Variación</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((item, index) => {
                  const prevPrice = index > 0 ? priceHistory[index - 1].unit_price : item.unit_price;
                  const variation = index > 0 ? ((item.unit_price - prevPrice) / prevPrice) * 100 : 0;
                  const isUp = variation > 0;
                  const isDown = variation < 0;

                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{item.date}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{item.provider}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{formatPrice(item.unit_price)}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">{item.quantity}</td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{formatPrice(item.total_price)}</td>
                      <td className="py-3 px-4 text-sm text-center">
                        {index === 0 ? (
                          <span className="text-gray-400">-</span>
                        ) : isUp ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <ArrowUp size={14} /> {variation.toFixed(1)}%
                          </span>
                        ) : isDown ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                            <ArrowDown size={14} /> {Math.abs(variation).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">0%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedProduct && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Selecciona un producto para ver el análisis de precios</p>
        </div>
      )}
    </div>
  );
}
