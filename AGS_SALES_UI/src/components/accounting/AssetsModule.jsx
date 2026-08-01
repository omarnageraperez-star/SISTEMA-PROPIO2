import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { Plus, Edit2, Trash2, Search, Briefcase } from 'lucide-react';
import Swal from 'sweetalert2';
import AssetFormModal from './AssetFormModal';

export default function AssetsModule({ config, token }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  const fetchAssets = async () => {
    try {
      const res = await apiRequest(`${config.apiBaseUrl}/api/accounting/assets/`, {
        method: 'GET'
      }, token);
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar activo?',
      text: "No podrás revertir esto",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const res = await apiRequest(`${config.apiBaseUrl}/api/accounting/assets/${id}/`, {
          method: 'DELETE'
        }, token);
        if (res.ok) {
          fetchAssets();
          Swal.fire('Eliminado', 'El activo ha sido eliminado.', 'success');
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const filteredAssets = assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  const statusColors = {
    'ACTIVE': 'bg-emerald-100 text-emerald-700',
    'INACTIVE': 'bg-red-100 text-red-700',
    'SOLD': 'bg-slate-100 text-slate-700',
    'MAINTENANCE': 'bg-amber-100 text-amber-700'
  };

  const statusLabels = {
    'ACTIVE': 'Activo',
    'INACTIVE': 'Inactivo',
    'SOLD': 'Vendido',
    'MAINTENANCE': 'En Mantenimiento'
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 rounded-2xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Briefcase size={24} className="text-indigo-600" />
            Activos de la Empresa
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Gestiona los activos fijos, vehículos, equipos y más.
          </p>
        </div>
        <button
          onClick={() => { setSelectedAsset(null); setIsModalOpen(true); }}
          className="btn-premium px-4 py-2 !rounded-xl text-sm font-bold flex items-center gap-2 shadow-md"
        >
          <Plus size={16} /> Nuevo Activo
        </button>
      </div>

      <div className="glass-panel rounded-2xl shadow-sm border border-slate-200 bg-white flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar activo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input pl-9 w-full text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Nombre</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Ubicación</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Precio Compra</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Valor Actual</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Estado</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Cargando...</td></tr>
              ) : filteredAssets.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">No se encontraron activos.</td></tr>
              ) : (
                filteredAssets.map(asset => (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-slate-700">{asset.name}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{asset.description}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">{asset.location || '-'}</td>
                    <td className="p-4 text-sm font-bold text-slate-700">${parseFloat(asset.purchase_price).toLocaleString()}</td>
                    <td className="p-4 text-sm font-bold text-indigo-700">${parseFloat(asset.current_value || asset.purchase_price).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${statusColors[asset.status]}`}>
                        {statusLabels[asset.status]}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setSelectedAsset(asset); setIsModalOpen(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(asset.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <AssetFormModal
          config={config}
          token={token}
          asset={selectedAsset}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => { setIsModalOpen(false); fetchAssets(); }}
        />
      )}
    </div>
  );
}
