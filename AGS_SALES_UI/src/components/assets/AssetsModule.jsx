import React, { useState, useEffect } from 'react';
import { Briefcase, Search, Plus, Edit3, Trash2, CheckCircle, X, ShieldAlert, Monitor, Server, Box, Building, Truck, Smartphone } from 'lucide-react';
import Swal from 'sweetalert2';

export default function AssetsModule({ config, token }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    asset_type: 'EQUIPMENT',
    serial_number: '',
    purchase_price: '',
    purchase_date: '',
    location: '',
    assigned_to: '',
    condition: 'NEW',
    notes: ''
  });

  const assetTypes = [
    { value: 'EQUIPMENT', label: 'Equipo' },
    { value: 'ELECTRONICS', label: 'Electrónica' },
    { value: 'FURNITURE', label: 'Mobiliario' },
    { value: 'VEHICLE', label: 'Vehículo' },
    { value: 'PROPERTY', label: 'Inmueble' },
    { value: 'OTHER', label: 'Otro' }
  ];

  const conditions = [
    { value: 'NEW', label: 'Nuevo' },
    { value: 'GOOD', label: 'Bueno' },
    { value: 'FAIR', label: 'Regular' },
    { value: 'POOR', label: 'Malo' }
  ];

  useEffect(() => {
    if (token) fetchAssets();
  }, [token]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}accounting/assets/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.results || data || []);
      } else {
        setErrorMsg('Error al cargar los activos');
      }
    } catch (e) {
      setErrorMsg('Error de red al conectar');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const url = editingId 
        ? `${config.apiUrl}accounting/assets/${editingId}/` 
        : `${config.apiUrl}accounting/assets/`;
      const method = editingId ? 'PATCH' : 'POST';

      const payload = { ...form };
      if (!payload.purchase_price) delete payload.purchase_price;
      if (!payload.purchase_date) delete payload.purchase_date;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg(editingId ? 'Activo actualizado con éxito' : 'Activo registrado con éxito');
        fetchAssets();
        handleCloseModal();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || JSON.stringify(data));
      }
    } catch (e) {
      setErrorMsg('Error de red al guardar el activo');
    }
    setLoading(false);
  };

  const handleEdit = (asset) => {
    setForm({
      name: asset.name || '',
      asset_type: asset.asset_type || 'EQUIPMENT',
      serial_number: asset.serial_number || '',
      purchase_price: asset.purchase_price || '',
      purchase_date: asset.purchase_date || '',
      location: asset.location || '',
      assigned_to: asset.assigned_to || '',
      condition: asset.condition || 'NEW',
      notes: asset.notes || ''
    });
    setEditingId(asset.id);
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: '¿Eliminar Activo?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
      try {
        const res = await fetch(`${config.apiUrl}accounting/assets/${id}/`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setSuccessMsg('Activo eliminado');
          fetchAssets();
          setTimeout(() => setSuccessMsg(''), 3000);
        } else {
          setErrorMsg('Error al eliminar');
        }
      } catch (e) {
        setErrorMsg('Error de red');
      }
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setForm({
      name: '',
      asset_type: 'EQUIPMENT',
      serial_number: '',
      purchase_price: '',
      purchase_date: '',
      location: '',
      assigned_to: '',
      condition: 'NEW',
      notes: ''
    });
  };

  const getIcon = (type) => {
    switch(type) {
      case 'ELECTRONICS': return <Monitor size={20} className="text-blue-500" />;
      case 'EQUIPMENT': return <Server size={20} className="text-indigo-500" />;
      case 'FURNITURE': return <Box size={20} className="text-amber-500" />;
      case 'VEHICLE': return <Truck size={20} className="text-emerald-500" />;
      case 'PROPERTY': return <Building size={20} className="text-rose-500" />;
      default: return <Briefcase size={20} className="text-gray-500" />;
    }
  };

  const normalizeText = (text) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  const filteredAssets = assets.filter(a => {
    const term = normalizeText(searchTerm);
    return normalizeText(a.name).includes(term) || 
      (a.serial_number && normalizeText(a.serial_number).includes(term));
  });

  return (
    <div className="h-full flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-300">
      <header className="glass-panel p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-2xl shadow-sm border border-slate-200/60 bg-white/80 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="relative">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight flex items-center gap-3 mb-1">
            <Briefcase className="text-indigo-600" size={28} strokeWidth={2.5} />
            Activos de la Empresa
          </h1>
          <p className="text-slate-500 text-sm font-semibold ml-10">Gestión de bienes, equipos e inventario fijo.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 z-10"
        >
          <Plus size={18} strokeWidth={3} /> Agregar Activo
        </button>
      </header>

      <div className="glass-panel p-3 flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl shadow-sm border border-slate-200/60 bg-white/80">
        <div className="relative w-full md:w-1/2 lg:w-[450px]">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-indigo-400" />
          </div>
          <input 
            type="text" 
            placeholder="Buscar activo por nombre o serie..." 
            className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm placeholder-slate-400"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {(errorMsg || successMsg) && (
        <div className="px-2">
          {errorMsg && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm shadow-sm flex items-center gap-2"><ShieldAlert size={16}/> {errorMsg}</div>}
          {successMsg && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl text-sm shadow-sm flex items-center gap-2"><CheckCircle size={16}/> {successMsg}</div>}
        </div>
      )}

      <div className="flex-1 overflow-auto glass-panel rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <th className="py-3 px-4 font-bold text-slate-500 uppercase text-xs">Activo</th>
              <th className="py-3 px-4 font-bold text-slate-500 uppercase text-xs">No. Serie</th>
              <th className="py-3 px-4 font-bold text-slate-500 uppercase text-xs">Ubicación</th>
              <th className="py-3 px-4 font-bold text-slate-500 uppercase text-xs">Asignado a</th>
              <th className="py-3 px-4 font-bold text-slate-500 uppercase text-xs">Estado</th>
              <th className="py-3 px-4 font-bold text-slate-500 uppercase text-xs text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-10 text-center text-slate-400 font-semibold">No se encontraron activos registrados.</td>
              </tr>
            ) : (
              filteredAssets.map(asset => (
                <tr key={asset.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">{getIcon(asset.asset_type)}</div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{asset.name}</p>
                        <p className="text-[11px] text-slate-400">{assetTypes.find(t => t.value === asset.asset_type)?.label || asset.asset_type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 font-semibold">{asset.serial_number || '-'}</td>
                  <td className="py-3 px-4 text-xs font-semibold text-slate-700">{asset.location || '-'}</td>
                  <td className="py-3 px-4 text-xs font-semibold text-slate-700">{asset.assigned_to || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                      asset.condition === 'NEW' ? 'bg-emerald-100 text-emerald-700' :
                      asset.condition === 'GOOD' ? 'bg-blue-100 text-blue-700' :
                      asset.condition === 'FAIR' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {conditions.find(c => c.value === asset.condition)?.label || asset.condition}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => handleEdit(asset)} className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"><Edit3 size={16} /></button>
                      <button onClick={() => handleDelete(asset.id)} className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Briefcase size={20} className="text-indigo-600" /> 
                {editingId ? 'Editar Activo' : 'Registrar Nuevo Activo'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">Nombre del Activo [*]</label>
                  <input required type="text" className="glass-input mt-1 w-full text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ej. Computadora de Oficina" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Tipo de Activo [*]</label>
                  <select className="glass-input mt-1 w-full text-sm" value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value})}>
                    {assetTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Número de Serie</label>
                  <input type="text" className="glass-input mt-1 w-full text-sm font-mono" value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Estado de Conservación [*]</label>
                  <select className="glass-input mt-1 w-full text-sm" value={form.condition} onChange={e => setForm({...form, condition: e.target.value})}>
                    {conditions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Ubicación</label>
                  <input type="text" className="glass-input mt-1 w-full text-sm" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Asignado a (Personal)</label>
                  <input type="text" className="glass-input mt-1 w-full text-sm" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Precio de Compra</label>
                  <input type="number" step="0.01" className="glass-input mt-1 w-full text-sm" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Fecha de Adquisición</label>
                  <input type="date" className="glass-input mt-1 w-full text-sm" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Notas / Descripción adicionales</label>
                <textarea rows="3" className="glass-input mt-1 w-full text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-premium !py-2.5 px-6 font-bold text-sm flex items-center gap-2">
                  <CheckCircle size={16} /> {loading ? 'Guardando...' : 'Guardar Activo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
