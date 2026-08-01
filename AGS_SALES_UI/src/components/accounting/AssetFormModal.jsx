import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { X, Save, Briefcase } from 'lucide-react';
import Swal from 'sweetalert2';

export default function AssetFormModal({ config, token, asset, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    purchase_date: '',
    purchase_price: '',
    current_value: '',
    status: 'ACTIVE',
    location: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (asset) {
      setFormData({
        name: asset.name || '',
        description: asset.description || '',
        purchase_date: asset.purchase_date || '',
        purchase_price: asset.purchase_price || '',
        current_value: asset.current_value || '',
        status: asset.status || 'ACTIVE',
        location: asset.location || ''
      });
    }
  }, [asset]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.purchase_price) {
      Swal.fire('Error', 'El nombre y el precio de compra son obligatorios.', 'error');
      return;
    }

    setLoading(true);
    try {
      const url = asset 
        ? `${config.apiBaseUrl}/api/accounting/assets/${asset.id}/`
        : `${config.apiBaseUrl}/api/accounting/assets/`;
      const method = asset ? 'PUT' : 'POST';

      const payload = { ...formData };
      if (!payload.purchase_date) delete payload.purchase_date;
      if (!payload.current_value) delete payload.current_value;

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      }, token);

      if (res.ok) {
        Swal.fire('Éxito', asset ? 'Activo actualizado' : 'Activo creado', 'success');
        onSaved();
      } else {
        const data = await res.json();
        Swal.fire('Error', JSON.stringify(data), 'error');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo guardar el activo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Briefcase size={20} className="text-indigo-600" />
            {asset ? 'Editar Activo' : 'Nuevo Activo'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Nombre del Activo *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className="glass-input w-full text-sm" placeholder="Ej: Computador Dell Optiplex" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Descripción</label>
              <textarea name="description" value={formData.description} onChange={handleChange} className="glass-input w-full text-sm resize-none h-20" placeholder="Detalles técnicos, marca, modelo..."></textarea>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Fecha de Compra</label>
              <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} className="glass-input w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Ubicación</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} className="glass-input w-full text-sm" placeholder="Oficina 1, Bodega..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Precio Compra ($) *</label>
              <input type="number" step="0.01" name="purchase_price" value={formData.purchase_price} onChange={handleChange} required className="glass-input w-full text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Valor Actual Estimado ($)</label>
              <input type="number" step="0.01" name="current_value" value={formData.current_value} onChange={handleChange} className="glass-input w-full text-sm font-mono" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">Estado</label>
              <select name="status" value={formData.status} onChange={handleChange} className="glass-input w-full text-sm font-semibold">
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="SOLD">Vendido</option>
                <option value="MAINTENANCE">En Mantenimiento</option>
              </select>
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading} className="btn-premium px-6 py-2.5 !rounded-xl text-sm font-bold flex items-center gap-2 shadow-md">
            <Save size={16} />
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
