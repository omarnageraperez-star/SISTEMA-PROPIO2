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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase size={18} className="text-blue-600" />
              {asset ? 'Editar Activo' : 'Nuevo Activo'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Información del activo fijo</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Nombre del Activo *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" placeholder="Ej: Computador Dell Optiplex" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Descripción</label>
              <textarea name="description" value={formData.description} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none h-20" placeholder="Detalles técnicos, marca, modelo..."></textarea>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Fecha de Compra</label>
              <input type="date" name="purchase_date" value={formData.purchase_date} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Ubicación</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" placeholder="Oficina 1, Bodega..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Precio Compra ($) *</label>
              <input type="number" step="0.01" name="purchase_price" value={formData.purchase_price} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Valor Actual Estimado ($)</label>
              <input type="number" step="0.01" name="current_value" value={formData.current_value} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-mono" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Estado</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm">
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="SOLD">Vendido</option>
                <option value="MAINTENANCE">En Mantenimiento</option>
              </select>
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-sm">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save size={16} />
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
