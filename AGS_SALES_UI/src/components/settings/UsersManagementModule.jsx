import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Shield, ShieldAlert, Edit, X, Zap, Sliders, AlertCircle, 
  RotateCcw, Check, ShoppingCart, Package, Wallet, Users as UsersIcon, 
  Truck, BarChart2, Settings, Lock, Eye, CheckCircle2, ChevronRight, ShoppingBag
} from 'lucide-react';
import Swal from 'sweetalert2';
import { ROLE_CHOICES, PERMISSION_MODULES, ROLE_PRESETS } from '../../lib/permissionsConfig';

const MODULE_ICONS = {
  pos: ShoppingCart,
  catalog_orders: ShoppingBag,
  inventory: Package,
  cash: Wallet,
  sales_crm: UsersIcon,
  purchases: Truck,
  reports: BarChart2,
  settings: Settings,
};

export default function UsersManagementModule({ config, token, loadUsersPanelTrigger, userProfile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone_number: '',
    role: 'USER',
    password: '',
    is_active: true,
  });
  
  // Permissions Dict State: { 'pos.access': true, 'inventory.manage_products': false, ... }
  const [permissionsState, setPermissionsState] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeModuleTab, setActiveModuleTab] = useState('ALL');

  const isSuperAdmin = userProfile?.role === 'SUPERADMIN';

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}users/admin-users/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.results || data || []);
      }
    } catch (e) {
      console.error("Error al cargar usuarios:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [loadUsersPanelTrigger]);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    const defaultRole = 'USER';
    const defaultPerms = ROLE_PRESETS[defaultRole] ? ROLE_PRESETS[defaultRole]() : {};
    setFormData({
      username: '',
      email: '',
      phone_number: '',
      role: defaultRole,
      password: '',
      is_active: true,
    });
    setPermissionsState(defaultPerms);
    setActiveModuleTab('ALL');
    setShowModal(true);
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    const userRole = user.role || 'USER';
    
    // Compute permissions: mix role preset with custom_permissions if any
    const defaultPerms = ROLE_PRESETS[userRole] ? ROLE_PRESETS[userRole]() : {};
    const existingCustom = (user.custom_permissions && typeof user.custom_permissions === 'object') ? user.custom_permissions : {};
    const mergedPerms = { ...defaultPerms, ...existingCustom };

    setFormData({
      username: user.username || '',
      email: user.email || '',
      phone_number: user.phone_number || '',
      role: userRole,
      password: '',
      is_active: user.is_active ?? true,
    });
    setPermissionsState(mergedPerms);
    setActiveModuleTab('ALL');
    setShowModal(true);
  };

  const handleRoleChange = (newRole) => {
    setFormData(prev => ({ ...prev, role: newRole }));
    const newPreset = ROLE_PRESETS[newRole] ? ROLE_PRESETS[newRole]() : {};
    setPermissionsState(newPreset);
  };

  const handleTogglePermission = (key) => {
    setPermissionsState(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleEnableAllPermissions = () => {
    const all = {};
    PERMISSION_MODULES.forEach(m => m.permissions.forEach(p => { all[p.key] = true; }));
    setPermissionsState(all);
  };

  const handleDisableAllPermissions = () => {
    const none = {};
    PERMISSION_MODULES.forEach(m => m.permissions.forEach(p => { none[p.key] = false; }));
    setPermissionsState(none);
  };

  const handleResetToRolePreset = () => {
    const rolePreset = ROLE_PRESETS[formData.role] ? ROLE_PRESETS[formData.role]() : {};
    setPermissionsState(rolePreset);
  };

  const handleSaveUser = async (e) => {
    if (e) e.preventDefault();
    if (!formData.username.trim()) {
      Swal.fire('Atención', 'El nombre de usuario es obligatorio.', 'warning');
      return;
    }
    if (!editingUser && !formData.password) {
      Swal.fire('Atención', 'Debe ingresar una contraseña inicial para la nueva cuenta.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const isNew = !editingUser;
      const url = isNew 
        ? `${config.apiUrl}users/admin-users/` 
        : `${config.apiUrl}users/admin-users/${editingUser.id}/`;

      const payload = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        phone_number: formData.phone_number.trim(),
        role: formData.role,
        is_active: formData.is_active,
        custom_permissions: permissionsState
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: isNew ? 'Usuario creado exitosamente' : 'Usuario actualizado correctamente',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2500
        });
        setShowModal(false);
        fetchUsers();
        window.dispatchEvent(new CustomEvent('permissions-updated'));
      } else {
        const err = await res.json();
        Swal.fire('Error al guardar', typeof err === 'object' ? JSON.stringify(err) : 'Error inesperado', 'error');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'Error de red al guardar los cambios', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (roleStr) => {
    const roleObj = ROLE_CHOICES.find(r => r.value === roleStr);
    const label = roleObj ? roleObj.label : roleStr;
    const badgeClass = roleObj?.badgeClass || 'bg-slate-100 text-slate-700 border-slate-200';
    return (
      <span className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-extrabold border inline-block ${badgeClass}`}>
        {label}
      </span>
    );
  };

  // Metrics counter for current permissions state
  const totalPermissionsCount = PERMISSION_MODULES.reduce((acc, m) => acc + m.permissions.length, 0);
  const activePermissionsCount = Object.values(permissionsState).filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 mb-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
            <ShieldAlert className="text-indigo-600" size={22} />
            Gestión Avanzada de Usuarios y Permisos
          </h3>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Administración centralizada de cuentas, roles y matriz de permisos por toggles (Exclusivo SuperAdmin)
          </p>
        </div>

        {isSuperAdmin && (
          <button 
            onClick={handleOpenCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-100 shrink-0"
          >
            <Plus size={18} /> Nuevo Usuario
          </button>
        )}
      </div>

      {/* Notice for non SuperAdmin */}
      {!isSuperAdmin && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-center gap-3 text-xs font-semibold">
          <AlertCircle size={18} className="text-amber-600 shrink-0" />
          <span>Atención: Solo las cuentas registradas como <strong>Super Administrador</strong> pueden modificar la asignación de roles y toggles de permisos.</span>
        </div>
      )}

      {/* Users Table - Clean 100% Fit without Horizontal Scrollbar */}
      <div className="w-full overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-left border-collapse table-auto">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="py-3 px-3 text-[11px] font-black text-slate-400 uppercase tracking-wider">Usuario</th>
              <th className="py-3 px-2 text-[11px] font-black text-slate-400 uppercase tracking-wider">Rol Asignado</th>
              <th className="py-3 px-2 text-[11px] font-black text-slate-400 uppercase tracking-wider">Email</th>
              <th className="py-3 px-2 text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado</th>
              {isSuperAdmin && <th className="py-3 px-3 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center border border-indigo-200 uppercase shrink-0">
                      {u.username.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-sm text-slate-800 truncate" title={u.username}>{u.username}</p>
                      {u.custom_permissions && Object.keys(u.custom_permissions).length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-bold">
                          <Sliders size={10} /> Personalizado
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2">{getRoleBadge(u.role)}</td>
                <td className="py-3 px-2 text-xs text-slate-500 font-medium truncate max-w-[160px]" title={u.email || ''}>
                  {u.email || '-'}
                </td>
                <td className="py-3 px-2">
                  {u.is_active 
                    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo</span>
                    : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactivo</span>
                  }
                </td>
                {isSuperAdmin && (
                  <td className="py-3 px-3 text-right">
                    <button 
                      onClick={() => handleOpenEditModal(u)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 text-xs font-extrabold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95 whitespace-nowrap"
                      title="Editar Rol y Permisos"
                    >
                      <Sliders size={13} /> Permisos y Roles
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-400 text-sm">
                  No se encontraron usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal - Role & Permissions Professional Editor */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Shield size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">
                    {editingUser ? `Panel de Control de Permisos: ${editingUser.username}` : 'Crear Nueva Cuenta de Usuario'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Asignación dinámica de rol y activación individual de permisos</p>
                </div>
              </div>

              <button 
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Content Container */}
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
              
              {/* Section 1: User General Details */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/90 space-y-4 shadow-sm">
                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                  <Users size={15} /> 1. Datos Generales de la Cuenta
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Nombre de Usuario *</label>
                    <input 
                      type="text" 
                      required 
                      disabled={!!editingUser}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 text-slate-800 shadow-sm"
                      value={formData.username}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                      placeholder="ej: luis_cajero"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Correo Electrónico</label>
                    <input 
                      type="email" 
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-sm"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="usuario@ejemplo.com"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Teléfono Móvil</label>
                    <input 
                      type="text" 
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-sm"
                      value={formData.phone_number}
                      onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                      placeholder="+57 300 000 0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 items-center">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">
                      Contraseña {editingUser ? '(dejar en blanco si no deseas cambiarla)' : '*'}
                    </label>
                    <input 
                      type="password" 
                      required={!editingUser}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 shadow-sm"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••••••"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-5 sm:pt-4">
                    <input 
                      type="checkbox" 
                      id="is_active_chk" 
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <label htmlFor="is_active_chk" className="text-sm font-extrabold text-slate-800 cursor-pointer select-none">
                      Permitir Acceso al Sistema (Usuario Activo)
                    </label>
                  </div>
                </div>
              </div>

              {/* Section 2: Role Selection Grid */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                    <Shield size={15} /> 2. Rol Principal del Usuario
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">Al hacer clic en un rol, se aplicará automáticamente su plantilla sugerida</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {ROLE_CHOICES.map(rc => {
                    const isSelected = formData.role === rc.value;
                    return (
                      <div 
                        key={rc.value}
                        onClick={() => handleRoleChange(rc.value)}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-center flex flex-col items-center justify-center gap-1.5 select-none ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 shadow-md scale-[1.02]' 
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isSelected ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs font-black leading-tight">{rc.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Granular Permissions Matrix with Pinned Professional Toolbar */}
              <div className="space-y-4 pt-2">
                
                {/* Responsive Pinned Control Header (NO HORIZONTAL SCROLLING, ALWAYS FULLY VISIBLE) */}
                <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <Sliders size={18} className="text-indigo-400 shrink-0" />
                      <h4 className="text-sm font-extrabold text-white">
                        3. Matriz de Activación de Permisos Específicos
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                        {activePermissionsCount} / {totalPermissionsCount} Habilitados
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Enciende o apaga interruptores (toggles) para personalizar el acceso exacto de esta cuenta
                    </p>
                  </div>

                  {/* Action Buttons Group - Responsive Flex Wrap (Never pushes off screen) */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button 
                      type="button" 
                      onClick={handleEnableAllPermissions}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <Zap size={14} /> Activar Todos
                    </button>

                    <button 
                      type="button" 
                      onClick={handleDisableAllPermissions}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <X size={14} /> Desactivar Todos
                    </button>

                    <button 
                      type="button" 
                      onClick={handleResetToRolePreset}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <RotateCcw size={14} /> Preset del Rol
                    </button>
                  </div>
                </div>

                {/* Module Navigation Tabs (Responsive Flex Wrap Pills) */}
                <div className="flex flex-wrap gap-2 py-1">
                  <button 
                    type="button"
                    onClick={() => setActiveModuleTab('ALL')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                      activeModuleTab === 'ALL' 
                        ? 'bg-slate-900 text-white shadow-md' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Sliders size={14} /> Todos los Módulos ({totalPermissionsCount})
                  </button>

                  {PERMISSION_MODULES.map(m => {
                    const IconComp = MODULE_ICONS[m.id] || Sliders;
                    const activeInMod = m.permissions.filter(p => permissionsState[p.key]).length;
                    const totalInMod = m.permissions.length;
                    const isTabActive = activeModuleTab === m.id;

                    return (
                      <button 
                        key={m.id}
                        type="button"
                        onClick={() => setActiveModuleTab(m.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                          isTabActive 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <IconComp size={13} />
                        <span>{m.badge}</span>
                        <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                          isTabActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {activeInMod}/{totalInMod}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Permissions Cards List Grouped by Module */}
                <div className="space-y-5 pt-1">
                  {PERMISSION_MODULES
                    .filter(m => activeModuleTab === 'ALL' || activeModuleTab === m.id)
                    .map(m => {
                      const IconComp = MODULE_ICONS[m.id] || Sliders;
                      const activeInMod = m.permissions.filter(p => permissionsState[p.key]).length;
                      const totalInMod = m.permissions.length;

                      return (
                        <div key={m.id} className="bg-slate-50/90 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                          
                          {/* Module Header Bar */}
                          <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                <IconComp size={16} />
                              </div>
                              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                {m.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                                {activeInMod} de {totalInMod} Permisos Activos
                              </span>
                            </div>
                          </div>

                          {/* Permission Toggles Responsive Grid */}
                          <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {m.permissions.map(p => {
                              const isChecked = Boolean(permissionsState[p.key]);
                              return (
                                <div 
                                  key={p.key}
                                  onClick={() => handleTogglePermission(p.key)}
                                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                                    isChecked 
                                      ? 'bg-emerald-50/50 border-emerald-300 shadow-sm hover:border-emerald-400' 
                                      : 'bg-white border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                                  }`}
                                >
                                  <div className="flex-1 pr-2">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      {isChecked ? (
                                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                      ) : (
                                        <Lock size={13} className="text-slate-400 shrink-0" />
                                      )}
                                      <p className={`text-xs font-extrabold leading-tight ${isChecked ? 'text-slate-900' : 'text-slate-700'}`}>
                                        {p.label}
                                      </p>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-normal pl-5">
                                      {p.desc}
                                    </p>
                                  </div>

                                  {/* Professional iOS / Tailwind Animated Toggle Switch */}
                                  <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isChecked ? 'bg-emerald-500' : 'bg-slate-300'
                                  }`}>
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      isChecked ? 'translate-x-5' : 'translate-x-0'
                                    }`} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>

              </div>

              {/* Modal Bottom Save Bar */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-extrabold text-sm hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm transition-all shadow-md shadow-indigo-200 flex items-center gap-2"
                >
                  {saving ? 'Guardando...' : <><Check size={18} /> Guardar Configuración de Permisos</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
