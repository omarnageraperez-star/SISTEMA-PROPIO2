import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Settings, LogOut, Shield, Server, ArrowRight, X, Save, Image, Mail, FileText, Landmark, Users, UserPlus, Trash2, Edit, Key, ShieldAlert, Database, QrCode, Box, Plus, MapPin, Calendar, Cpu, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import TopBar from '../components/TopBar';
import { apiRequest, apiUrl, parseError } from '../lib/api';
import { ROLE_CHOICES, PERMISSION_MODULES, ROLE_PRESETS, hasPermission } from '../lib/permissionsConfig';
import { DarkSwal, Toast } from '../lib/swal';
import { loadAndApplyTheme, saveTheme } from '../lib/theme';

const formatWithSettings = (n, settings) => {
  const num = parseFloat(n) || 0;
  const symbol = settings?.currency_symbol || '$';
  const decimals = parseInt(settings?.currency_decimals || '0', 10);
  return `${symbol} ${num.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

const compressImage = (file, maxWidth = 800, maxHeight = 800) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name || 'photo.jpg', {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.75);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const uploadFileToImgBB = async (file) => {
  try {
    const compressed = await compressImage(file);
    const body = new FormData();
    body.append('image', compressed);
    const res = await fetch('https://api.imgbb.com/1/upload?key=e15b92a922e0938b38eeea0b567cea75', {
      method: 'POST',
      body: body
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error en ImgBB: ${res.statusText} - ${errorText}`);
    }
    const json = await res.json();
    return json.data.url;
  } catch (error) {
    console.error("Error al subir archivo a ImgBB:", error);
    throw error;
  }
};

export default function More({ auth, onLogout, onSettingsUpdate }) {
  const fmt = (n) => formatWithSettings(n, auth.settings);
  const navigate = useNavigate();

  // Settings State
  const [settings, setSettings] = useState({
    business_name: '',
    business_nit: '',
    business_address: '',
    business_phone: '',
    currency_symbol: '$',
    currency_decimals: '0',
    tax_name: 'IVA',
    tax_rate: '19',
    app_logo: '',
    ticket_logo: '',
    ticket_header: '',
    ticket_footer: '',
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_password: '',
    ai_provider: 'gemini',
    ai_api_key: '',
    ai_prompt_context: '',
    notify_admin_on_sale: 'true',
    notify_admin_on_shift: 'true',
    notify_low_stock: 'true',
    notify_permission_change: 'true',
  });

  // Modal displays
  const [expandedSections, setExpandedSections] = useState({
    business: true,
    system: false,
    server: false
  });
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const [activeTheme, setActiveTheme] = useState('orange');

  useEffect(() => {
    (async () => {
      const theme = await loadAndApplyTheme();
      setActiveTheme(theme);
    })();
  }, []);

  const handleThemeChange = async (themeName) => {
    await saveTheme(themeName);
    setActiveTheme(themeName);
    Toast.fire({
      icon: 'success',
      title: `Tema ${themeName === 'orange' ? 'Naranja' : themeName === 'purple' ? 'Púrpura' : themeName === 'green' ? 'Verde' : 'Cian'} aplicado`
    });
  };
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showUserFormModal, setShowUserFormModal] = useState(false);
  const [showAssetsModal, setShowAssetsModal] = useState(false);
  const [showAssetFormModal, setShowAssetFormModal] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [assetForm, setAssetForm] = useState({ name: '', asset_type: 'EQUIPMENT', serial_number: '', purchase_price: '', purchase_date: '', location: '', assigned_to: '', condition: 'NEW', notes: '' });

  // Loading/saving spinners
  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Users list state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = new user
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    phone_number: '',
    password: '',
    role: 'USER',
    is_active: true
  });
  const [permissionsState, setPermissionsState] = useState({});
  const [activePermModuleTab, setActivePermModuleTab] = useState('ALL');
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (!auth?.apiUrl || !auth?.token) return;
    try {
      const url = apiUrl(auth.apiUrl, 'users/settings/');
      const res = await apiRequest(url, {}, auth.token);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      }
    } catch (e) {
      console.warn("Failed to fetch settings:", e);
    }
  };

  // User management loaders & handlers
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'users/admin-users/'), {}, auth.token);
      if (res.ok) {
        const d = await res.json();
        setUsers(Array.isArray(d) ? d : d.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenUsers = () => {
    fetchUsers();
    setShowUsersModal(true);
  };

  const handleOpenUserCreate = () => {
    setEditingUser(null);
    const defaultRole = 'USER';
    const defaultPerms = ROLE_PRESETS[defaultRole] ? ROLE_PRESETS[defaultRole]() : {};
    setUserForm({
      username: '',
      email: '',
      phone_number: '',
      password: '',
      role: defaultRole,
      is_active: true
    });
    setPermissionsState(defaultPerms);
    setActivePermModuleTab('ALL');
    setShowUserFormModal(true);
  };

  const handleOpenUserEdit = (userObj) => {
    setEditingUser(userObj);
    const userRole = userObj.role || 'USER';
    const defaultPerms = ROLE_PRESETS[userRole] ? ROLE_PRESETS[userRole]() : {};
    const existingCustom = (userObj.custom_permissions && typeof userObj.custom_permissions === 'object') ? userObj.custom_permissions : {};
    const mergedPerms = { ...defaultPerms, ...existingCustom };

    setUserForm({
      username: userObj.username,
      email: userObj.email || '',
      phone_number: userObj.phone_number || '',
      password: '', // leave empty to not change password
      role: userRole,
      is_active: userObj.is_active ?? true
    });
    setPermissionsState(mergedPerms);
    setActivePermModuleTab('ALL');
    setShowUserFormModal(true);
  };

  const handleRoleChangeMobile = (newRole) => {
    setUserForm(prev => ({ ...prev, role: newRole }));
    const newPreset = ROLE_PRESETS[newRole] ? ROLE_PRESETS[newRole]() : {};
    setPermissionsState(newPreset);
  };

  const handleTogglePermissionMobile = (key) => {
    setPermissionsState(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleEnableAllPermissionsMobile = () => {
    const all = {};
    PERMISSION_MODULES.forEach(m => m.permissions.forEach(p => { all[p.key] = true; }));
    setPermissionsState(all);
  };

  const handleDisableAllPermissionsMobile = () => {
    const none = {};
    PERMISSION_MODULES.forEach(m => m.permissions.forEach(p => { none[p.key] = false; }));
    setPermissionsState(none);
  };

  const handleResetToRolePresetMobile = () => {
    const rolePreset = ROLE_PRESETS[userForm.role] ? ROLE_PRESETS[userForm.role]() : {};
    setPermissionsState(rolePreset);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.username) {
      DarkSwal.fire('Atención', 'El nombre de usuario es obligatorio.', 'warning');
      return;
    }
    if (!editingUser && !userForm.password) {
      DarkSwal.fire('Atención', 'La contraseña es obligatoria para nuevos usuarios.', 'warning');
      return;
    }
    setSavingUser(true);
    try {
      const payload = { 
        ...userForm,
        custom_permissions: permissionsState
      };
      if (!payload.password) {
        delete payload.password; // do not send empty password on edit
      }

      const url = editingUser 
        ? apiUrl(auth.apiUrl, `users/admin-users/${editingUser.id}/`)
        : apiUrl(auth.apiUrl, 'users/admin-users/');
      const method = editingUser ? 'PATCH' : 'POST';

      const res = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      }, auth.token);

      if (res.ok) {
        Toast.fire({
          icon: 'success',
          title: editingUser ? 'Usuario actualizado' : 'Usuario creado exitosamente'
        });
        setShowUserFormModal(false);
        fetchUsers();
      } else {
        DarkSwal.fire('Error al guardar', await parseError(res), 'error');
      }
    } catch {
      DarkSwal.fire('Error', 'Error de red al guardar el usuario.', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (userObj) => {
    if (userObj.id === auth.user?.id) {
      DarkSwal.fire('Atención', 'No puedes eliminar tu propio usuario actual.', 'warning');
      return;
    }
    const confirmRes = await DarkSwal.fire({
      title: '¿Eliminar Usuario?',
      html: `¿Seguro de eliminar al usuario <b>"${userObj.username}"</b>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmRes.isConfirmed) return;
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, `users/admin-users/${userObj.id}/`), { method: 'DELETE' }, auth.token);
      if (res.ok) {
        Toast.fire({ icon: 'success', title: 'Usuario eliminado' });
        fetchUsers();
      } else {
        DarkSwal.fire('Error', 'No se pudo eliminar el usuario.', 'error');
      }
    } catch {
      DarkSwal.fire('Error', 'Error de conexión.', 'error');
    }
  };

  // ═══════════ ASSETS FUNCTIONS ═══════════
  async function fetchAssets() {
    setAssetsLoading(true);
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'accounting/assets/'), {}, auth.token);
      if (res.ok) {
        const d = await res.json();
        setAssets(Array.isArray(d) ? d : d.results || []);
      }
    } catch (e) {
      console.error('Error fetching assets:', e);
    }
    setAssetsLoading(false);
  }

  async function handleSaveAsset(e) {
    e.preventDefault();
    if (!assetForm.name.trim()) return DarkSwal.fire('Atención', 'El nombre del activo es obligatorio.', 'warning');
    try {
      const body = { ...assetForm };
      if (!body.purchase_price) delete body.purchase_price;
      if (!body.purchase_date) delete body.purchase_date;
      if (!body.serial_number) delete body.serial_number;
      if (!body.location) delete body.location;
      if (!body.assigned_to) delete body.assigned_to;
      if (!body.notes) delete body.notes;

      let res;
      if (editingAsset) {
        res = await apiRequest(apiUrl(auth.apiUrl, `accounting/assets/${editingAsset.id}/`), { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, auth.token);
      } else {
        res = await apiRequest(apiUrl(auth.apiUrl, 'accounting/assets/'), { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, auth.token);
      }
      if (!res.ok) {
        const errText = await parseError(res);
        return DarkSwal.fire('Error', errText, 'error');
      }
      Toast.fire({ icon: 'success', title: editingAsset ? 'Activo actualizado' : 'Activo creado' });
      setShowAssetFormModal(false);
      fetchAssets();
    } catch (e) {
      DarkSwal.fire('Error', 'Error al guardar activo: ' + (e.message || e), 'error');
    }
  }

  async function handleDeleteAsset(id) {
    const confirmRes = await DarkSwal.fire({
      title: '¿Eliminar Activo Fijo?',
      text: 'Esta acción eliminará el registro permanentemente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmRes.isConfirmed) return;
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, `accounting/assets/${id}/`), { method: 'DELETE' }, auth.token);
      if (!res.ok) {
        const errText = await parseError(res);
        return DarkSwal.fire('Error', errText, 'error');
      }
      Toast.fire({ icon: 'success', title: 'Activo eliminado' });
      fetchAssets();
    } catch (e) {
      DarkSwal.fire('Error', 'Error al eliminar: ' + (e.message || e), 'error');
    }
  }

  function buildImgUrl(path) {
    if (!path || typeof path !== 'string') return '';
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    if (!auth || !auth.apiUrl) return path;
    try {
      const base = auth.apiUrl.replace('/api/', '').replace(/\/$/, '');
      return `${base}/${path.startsWith('/') ? path.slice(1) : path}`;
    } catch {
      return path;
    }
  }

  const handleSelectLogo = async (type) => {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        webUseInput: true
      });
      if (image.webPath) {
        setSuccessMsg('');
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result;
          setSettings(prev => ({ ...prev, [type]: base64data }));
          const labelMap = { app_logo: 'Logo de App', ticket_logo: 'Logo del Ticket', transfer_qr: 'Código QR' };
          Toast.fire({ icon: 'info', title: `Imagen para ${labelMap[type] || 'Ajustes'} cargada. Guarda los cambios.` });
        };
        reader.readAsDataURL(blob);
      }
    } catch (e) {
      console.warn("User cancelled or camera failed:", e);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSuccessMsg('');
    try {
      const res = await apiRequest(apiUrl(auth.apiUrl, 'users/settings/'), {
        method: 'POST',
        body: JSON.stringify(settings),
      }, auth.token);
      if (res.ok) {
        Toast.fire({ icon: 'success', title: 'Configuración guardada correctamente' });
        if (onSettingsUpdate) {
          onSettingsUpdate(settings);
        }
        setShowSettingsModal(false);
      } else {
        DarkSwal.fire('Error', 'No se pudo guardar la configuración.', 'error');
      }
    } catch {
      DarkSwal.fire('Error', 'Error de red al guardar.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const roleNameMap = {
    SUPERADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    CASHIER: 'Cajero',
    SELLER: 'Vendedor',
    WAREHOUSE: 'Bodega',
    SUPERVISOR: 'Supervisor',
  };

  const roleName = roleNameMap[auth.user?.role] || auth.user?.role || 'Usuario';

  const handleConfirmLogout = async () => {
    const res = await DarkSwal.fire({
      title: '¿Cerrar Sesión?',
      text: '¿Estás seguro de que deseas salir de tu cuenta?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    });
    if (res.isConfirmed) {
      onLogout();
    }
  };

  return (
    <div className="page-container fade-in-up">
      <TopBar title="Más Opciones" subtitle="Configuración y perfil" />

      <div className="page-content" style={{ padding: '16px 16px 0', paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 16px))' }}>
        {/* User Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1e2435, #252d42)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 18,
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-light))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 800,
            color: 'white',
            boxShadow: '0 4px 16px var(--color-accent-dim)'
          }}>
            {(auth.user?.first_name || auth.user?.username || 'U')[0].toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              {auth.user?.first_name ? `${auth.user.first_name} ${auth.user.last_name || ''}` : auth.user?.username}
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={12} color="var(--color-accent)" />
              {roleName}
            </p>
          </div>
        </div>

        {/* 🎨 SELECTOR DE TEMA / VIBE DE LA TERMINAL */}
        <div style={{
          background: 'rgba(20, 24, 38, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 20,
          padding: '14px 18px',
          marginBottom: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', display: 'block' }}>Vibe de la Terminal</span>
            <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 2 }}>Selecciona el color de acento</span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {/* Orange Vibe */}
            <button
              onClick={() => handleThemeChange('orange')}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#f97316',
                border: activeTheme === 'orange' ? '2.5px solid #ffffff' : 'none',
                boxShadow: '0 0 10px rgba(249, 115, 22, 0.6)',
                cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
            />
            {/* Purple Vibe */}
            <button
              onClick={() => handleThemeChange('purple')}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#a855f7',
                border: activeTheme === 'purple' ? '2.5px solid #ffffff' : 'none',
                boxShadow: '0 0 10px rgba(168, 85, 247, 0.6)',
                cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
            />
            {/* Green Vibe */}
            <button
              onClick={() => handleThemeChange('green')}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#22c55e',
                border: activeTheme === 'green' ? '2.5px solid #ffffff' : 'none',
                boxShadow: '0 0 10px rgba(34, 197, 94, 0.6)',
                cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
            />
            {/* Cyan Vibe */}
            <button
              onClick={() => handleThemeChange('cyan')}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#06b6d4',
                border: activeTheme === 'cyan' ? '2.5px solid #ffffff' : 'none',
                boxShadow: '0 0 10px rgba(6, 182, 212, 0.6)',
                cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
            />
          </div>
        </div>

        {/* MODULE 1: GESTIÓN DE EMPRESA */}
        <div style={{
          background: 'rgba(20, 24, 38, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 20,
          marginBottom: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <button
            onClick={() => toggleSection('business')}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.02)',
              border: 'none',
              borderBottom: expandedSections.business ? '1px solid rgba(255,255,255,0.06)' : 'none',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Landmark size={18} color="#f97316" />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>Operación de Empresa</span>
            </div>
            {expandedSections.business ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
          </button>

          {expandedSections.business && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Reports */}
              {hasPermission(auth.user, 'reports.access') && (
                <button
                  onClick={() => navigate('/reports')}
                  style={{
                    background: 'rgba(30, 36, 53, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: 12,
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BarChart3 size={14} color="#8b5cf6" style={{ margin: 'auto' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>Reportes y Estadísticas</span>
                  <ArrowRight size={14} color="#475569" />
                </button>
              )}

              {/* Credits / Cuentas por cobrar */}
              {hasPermission(auth.user, 'sales.credits') && (
                <button
                  onClick={() => navigate('/credits')}
                  style={{
                    background: 'rgba(30, 36, 53, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: 12,
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CreditCard size={14} color="#f97316" style={{ margin: 'auto' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>Cuentas por Cobrar</span>
                  <ArrowRight size={14} color="#475569" />
                </button>
              )}

              {/* Cash Control */}
              {hasPermission(auth.user, 'cash.access') && (
                <button
                  onClick={() => navigate('/cash-control')}
                  style={{
                    background: 'rgba(30, 36, 53, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: 12,
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Landmark size={14} color="#22c55e" style={{ margin: 'auto' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>Arqueo y Control de Caja</span>
                  <ArrowRight size={14} color="#475569" />
                </button>
              )}

              {/* User Management */}
              {['SUPERADMIN'].includes(auth.user?.role) && (
                <button
                  onClick={handleOpenUsers}
                  style={{
                    background: 'rgba(30, 36, 53, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: 12,
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={14} color="#10b981" style={{ margin: 'auto' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>Gestión de Usuarios</span>
                  <ArrowRight size={14} color="#475569" />
                </button>
              )}

              {/* Company Assets */}
              {hasPermission(auth.user, 'assets.access') && (
                <button
                  onClick={() => { fetchAssets(); setShowAssetsModal(true); }}
                  style={{
                    background: 'rgba(30, 36, 53, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: 12,
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Box size={14} color="#f59e0b" style={{ margin: 'auto' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>Activos Fijos de la Empresa</span>
                  <ArrowRight size={14} color="#475569" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* MODULE 2: CONFIGURACIÓN DEL SISTEMA */}
        <div style={{
          background: 'rgba(20, 24, 38, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 20,
          marginBottom: 16,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <button
            onClick={() => toggleSection('system')}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.02)',
              border: 'none',
              borderBottom: expandedSections.system ? '1px solid rgba(255,255,255,0.06)' : 'none',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Settings size={18} color="#3b82f6" />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>Configuración del Sistema</span>
            </div>
            {expandedSections.system ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
          </button>

          {expandedSections.system && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* System settings */}
              {hasPermission(auth.user, 'settings.access') && (
                <button
                  onClick={() => { fetchSettings(); setShowSettingsModal(true); }}
                  style={{
                    background: 'rgba(30, 36, 53, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: 12,
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Settings size={14} color="#3b82f6" style={{ margin: 'auto' }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>Ajustes del Sistema</span>
                  <ArrowRight size={14} color="#475569" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* MODULE 3: SERVIDOR Y CONEXIÓN */}
        <div style={{
          background: 'rgba(20, 24, 38, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 20,
          marginBottom: 24,
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <button
            onClick={() => toggleSection('server')}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.02)',
              border: 'none',
              borderBottom: expandedSections.server ? '1px solid rgba(255,255,255,0.06)' : 'none',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Server size={18} color="#a78bfa" />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>Servidor & Conexiones</span>
            </div>
            {expandedSections.server ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
          </button>

          {expandedSections.server && (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Connection settings */}
              <button
                onClick={() => navigate('/setup')}
                style={{
                  background: 'rgba(30, 36, 53, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: 12,
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Server size={14} color="#f97316" style={{ margin: 'auto' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', display: 'block' }}>Configurar Servidor</span>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block', wordBreak: 'break-all', marginTop: 2 }}>{auth.apiUrl}</span>
                </div>
                <ArrowRight size={14} color="#475569" />
              </button>
            </div>
          )}
        </div>

        {/* Account settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <button
            onClick={handleConfirmLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: 14,
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              width: '100%',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
            className="list-item"
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LogOut size={16} color="#ef4444" style={{ margin: 'auto' }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#ef4444', flex: 1 }}>Cerrar Sesión</span>
          </button>
        </div>

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: 30, paddingBottom: 24 }}>
          <p style={{ fontSize: 11, color: '#334155', margin: 0 }}>AGS SALES Mobile v1.0.0</p>
          <p style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>Assia Group Solutions © 2026</p>
        </div>
      </div>

      {/* User Management Modal */}
      {showUsersModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && setShowUsersModal(false)}>
          <div className="modal-sheet" style={{ maxHeight: '85vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users color="#10b981" size={20} />
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Gestión de Usuarios</h2>
              </div>
              <button onClick={() => setShowUsersModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} color="#64748b" />
              </button>
            </div>

            <button onClick={handleOpenUserCreate} className="btn-primary" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <UserPlus size={16} /> Crear Nuevo Usuario
            </button>

            {loadingUsers ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '55vh', paddingBottom: 16 }}>
                {users.length === 0 && <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center' }}>No hay usuarios registrados.</p>}
                {users.map(u => (
                  <div key={u.id} style={{
                    background: 'rgba(30, 36, 53, 0.4)',
                    border: '1px solid rgba(255,255,255,0.02)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', display: 'block' }}>{u.username}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{
                          background: u.role === 'SUPERADMIN' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                          color: u.role === 'SUPERADMIN' ? '#ef4444' : '#3b82f6',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          {roleNameMap[u.role] || u.role}
                        </span>
                        <span style={{ fontSize: 11, color: u.is_active ? '#22c55e' : '#ef4444' }}>
                          ● {u.is_active ? 'Activo' : 'Bloqueado'}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleOpenUserEdit(u)} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Edit size={14} color="#3b82f6" />
                      </button>
                      <button onClick={() => handleDeleteUser(u)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* User Form Sheet (Nested creation/edit with Granular Permissions Toggles) */}
      {showUserFormModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 300 }} onClick={e => e.target === e.currentTarget && setShowUserFormModal(false)}>
          <div className="modal-sheet" style={{ height: '88vh', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                  {editingUser ? `Permisos: ${editingUser.username}` : 'Crear Nuevo Usuario'}
                </h2>
                <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Asignación de rol y toggles de permisos</p>
              </div>
              <button onClick={() => setShowUserFormModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 16, paddingRight: 4, paddingBottom: 20 }}>
              
              {/* Account Details */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>
                  1. Información de Cuenta
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nombre de usuario *</label>
                    <input
                      className="input-field"
                      placeholder="Ej: omar12"
                      value={userForm.username}
                      onChange={e => setUserForm({ ...userForm, username: e.target.value.replace(/\s+/g, '') })}
                      required
                      disabled={!!editingUser}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Email</label>
                      <input
                        className="input-field"
                        placeholder="email@ejemplo.com"
                        type="email"
                        value={userForm.email}
                        onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Teléfono</label>
                      <input
                        className="input-field"
                        placeholder="3001234567"
                        value={userForm.phone_number}
                        onChange={e => setUserForm({ ...userForm, phone_number: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                      Contraseña {editingUser && '(Dejar en blanco para no cambiar)'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Key size={16} color="#64748b" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        className="input-field"
                        style={{ paddingLeft: 40 }}
                        placeholder="••••••••"
                        type="password"
                        value={userForm.password}
                        onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                        required={!editingUser}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <input
                      type="checkbox"
                      id="userActiveCheck"
                      checked={userForm.is_active}
                      onChange={e => setUserForm({ ...userForm, is_active: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: '#f97316' }}
                    />
                    <label htmlFor="userActiveCheck" style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, cursor: 'pointer' }}>
                      Usuario Habilitado / Activo
                    </label>
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>
                  2. Seleccionar Rol Principal
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {ROLE_CHOICES.map(rc => {
                    const isSelected = userForm.role === rc.value;
                    return (
                      <button
                        key={rc.value}
                        type="button"
                        onClick={() => handleRoleChangeMobile(rc.value)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 12,
                          border: isSelected ? '2px solid #f97316' : '1px solid rgba(255,255,255,0.05)',
                          background: isSelected ? 'rgba(249, 115, 22, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                          color: isSelected ? '#f97316' : '#94a3b8',
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {rc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granular Permissions Matrix */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    3. Matriz de Permisos Específicos
                  </p>
                </div>

                {/* Quick actions buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={handleEnableAllPermissionsMobile}
                    style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', borderRadius: 8, padding: '6px 4px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Activar Todos
                  </button>
                  <button
                    type="button"
                    onClick={handleDisableAllPermissionsMobile}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: 8, padding: '6px 4px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Desactivar Todos
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToRolePresetMobile}
                    style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', borderRadius: 8, padding: '6px 4px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Preset Rol
                  </button>
                </div>

                {/* Module tabs filter */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => setActivePermModuleTab('ALL')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      border: 'none',
                      background: activePermModuleTab === 'ALL' ? '#f97316' : 'rgba(255,255,255,0.05)',
                      color: activePermModuleTab === 'ALL' ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer'
                    }}
                  >
                    Todos
                  </button>
                  {PERMISSION_MODULES.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setActivePermModuleTab(m.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        border: 'none',
                        background: activePermModuleTab === m.id ? '#f97316' : 'rgba(255,255,255,0.05)',
                        color: activePermModuleTab === m.id ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer'
                      }}
                    >
                      {m.title}
                    </button>
                  ))}
                </div>

                {/* Module Permissions List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {PERMISSION_MODULES
                    .filter(m => activePermModuleTab === 'ALL' || activePermModuleTab === m.id)
                    .map(m => (
                      <div key={m.id} style={{ background: '#0a0c14', borderRadius: 10, padding: 10, border: '1px solid #1e2435' }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px 0', display: 'flex', itemsAlign: 'center', justifyContent: 'space-between' }}>
                          <span>{m.title}</span>
                          <span style={{ color: '#f97316', fontSize: 10 }}>
                            {m.permissions.filter(p => permissionsState[p.key]).length}/{m.permissions.length}
                          </span>
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {m.permissions.map(p => {
                            const isChecked = Boolean(permissionsState[p.key]);
                            return (
                              <div
                                key={p.key}
                                onClick={() => handleTogglePermissionMobile(p.key)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  background: isChecked ? 'rgba(34, 197, 94, 0.1)' : 'rgba(30, 36, 53, 0.5)',
                                  border: `1px solid ${isChecked ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.03)'}`,
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ flex: 1, paddingRight: 8 }}>
                                  <p style={{ fontSize: 12, fontWeight: 700, color: isChecked ? '#f1f5f9' : '#94a3b8', margin: 0 }}>
                                    {p.label}
                                  </p>
                                  <p style={{ fontSize: 10, color: '#64748b', margin: '2px 0 0' }}>
                                    {p.desc}
                                  </p>
                                </div>

                                <div style={{
                                  width: 36,
                                  height: 20,
                                  borderRadius: 10,
                                  background: isChecked ? '#22c55e' : '#334155',
                                  position: 'relative',
                                  transition: 'background 0.2s',
                                  flexShrink: 0
                                }}>
                                  <div style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    position: 'absolute',
                                    top: 2,
                                    left: isChecked ? 18 : 2,
                                    transition: 'left 0.2s'
                                  }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>

              </div>

              <button className="btn-primary" type="submit" disabled={savingUser} style={{ height: 46, marginTop: 6 }}>
                {savingUser ? 'Guardando...' : <><Save size={18} /> Guardar Permisos y Cuenta</>}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Settings Modal */}
      {showSettingsModal && (() => {
        const safeSettings = settings || {};
        return createPortal(
          <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && setShowSettingsModal(false)}>
            <div className="modal-sheet" style={{ height: '88vh', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Ajustes del Sistema</h2>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={22} color="#64748b" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 16, paddingRight: 4, paddingBottom: 20 }}>
              
              {/* Section: Logos */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Image size={14} /> Logos del Negocio
                </p>
                
                {/* App Logo */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Logo de la Aplicación</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 10, background: '#0a0c14', border: '1px solid #252d42', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {settings.app_logo ? <img src={buildImgUrl(settings.app_logo)} alt="app logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Settings size={20} color="#64748b" />}
                    </div>
                    <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13, height: 'auto' }} onClick={() => handleSelectLogo('app_logo')}>
                      Cambiar Logo
                    </button>
                  </div>
                </div>

                {/* Ticket Logo */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Logo del Ticket (Recibo)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 10, background: '#0a0c14', border: '1px solid #252d42', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {settings.ticket_logo ? <img src={buildImgUrl(settings.ticket_logo)} alt="ticket logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Settings size={20} color="#64748b" />}
                    </div>
                    <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13, height: 'auto' }} onClick={() => handleSelectLogo('ticket_logo')}>
                      Cambiar Logo
                    </button>
                  </div>
                </div>
              </div>

              {/* Section: QR Payments */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <QrCode size={14} /> Código QR para Transferencias (Nequi / Daviplata / Bancos)
                </p>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Imagen Código QR para Cobros</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 80, height: 80, borderRadius: 10, background: '#ffffff', border: '1px solid #252d42', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                      {settings.transfer_qr ? <img src={buildImgUrl(settings.transfer_qr)} alt="QR transfer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <QrCode size={28} color="#64748b" />}
                    </div>
                    <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: 13, height: 'auto' }} onClick={() => handleSelectLogo('transfer_qr')}>
                      {settings.transfer_qr ? 'Cambiar QR' : 'Cargar Imagen QR'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Datos / Cuenta para Transferir</label>
                  <input
                    className="input-field"
                    placeholder="Ej: Nequi/Daviplata: 3001234567 - Ahorros Bancolombia #123456789"
                    value={settings.transfer_info || ''}
                    onChange={e => setSettings({ ...settings, transfer_info: e.target.value })}
                  />
                </div>
              </div>

              {/* Section: Business Info */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Landmark size={14} /> Información Comercial
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Nombre del Negocio</label>
                    <input
                      className="input-field"
                      placeholder="Ej: AGS SALES"
                      value={settings.business_name || ''}
                      onChange={e => setSettings({ ...settings, business_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>NIT / Identificador</label>
                    <input
                      className="input-field"
                      placeholder="Ej: 123456789-0"
                      value={settings.business_nit || ''}
                      onChange={e => setSettings({ ...settings, business_nit: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Dirección comercial</label>
                    <input
                      className="input-field"
                      placeholder="Ej: Calle 20 # 15-30"
                      value={settings.business_address || ''}
                      onChange={e => setSettings({ ...settings, business_address: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Teléfono de contacto</label>
                    <input
                      className="input-field"
                      placeholder="Ej: 3001234567"
                      value={settings.business_phone || ''}
                      onChange={e => setSettings({ ...settings, business_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Currency & Taxes */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  💰 Impuestos y Moneda
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Símbolo Moneda</label>
                      <input
                        className="input-field"
                        placeholder="Ej: $"
                        value={settings.currency_symbol || ''}
                        onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Decimales</label>
                      <input
                        className="input-field"
                        placeholder="Ej: 0"
                        type="number"
                        value={settings.currency_decimals || ''}
                        onChange={e => setSettings({ ...settings, currency_decimals: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Nombre Impuesto</label>
                      <input
                        className="input-field"
                        placeholder="Ej: IVA"
                        value={settings.tax_name || ''}
                        onChange={e => setSettings({ ...settings, tax_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Tasa Impuesto (%)</label>
                      <input
                        className="input-field"
                        placeholder="Ej: 19"
                        type="number"
                        value={settings.tax_rate || ''}
                        onChange={e => setSettings({ ...settings, tax_rate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Promociones */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255, 255, 255, 0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🎲 Juego de Promociones
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    id="dicePromoCheck"
                    checked={settings.dice_promo_enabled === 'true'}
                    onChange={e => setSettings({ ...settings, dice_promo_enabled: e.target.checked ? 'true' : 'false' })}
                    style={{ width: 18, height: 18, accentColor: '#f97316' }}
                  />
                  <label htmlFor="dicePromoCheck" style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 650, cursor: 'pointer' }}>
                    Habilitar Juego de Dados
                  </label>
                </div>
                <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0 28px', lineHeight: 1.3 }}>
                  Permite a los cajeros lanzar dados al cobrar para aplicar un descuento aleatorio basado en el resultado.
                </p>
              </div>

              {/* Section: Real-time Push Notifications Control */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255, 255, 255, 0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔔 Control de Notificaciones Push (Alertas en Celular)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      id="notifyAdminSaleCheck"
                      checked={safeSettings.notify_admin_on_sale !== 'false'}
                      onChange={e => setSettings({ ...settings, notify_admin_on_sale: e.target.checked ? 'true' : 'false' })}
                      style={{ width: 18, height: 18, accentColor: '#f97316' }}
                    />
                    <label htmlFor="notifyAdminSaleCheck" style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 650, cursor: 'pointer' }}>
                      Notificar Venta a Administradores en Tiempo Real
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      id="notifyAdminShiftCheck"
                      checked={safeSettings.notify_admin_on_shift !== 'false'}
                      onChange={e => setSettings({ ...settings, notify_admin_on_shift: e.target.checked ? 'true' : 'false' })}
                      style={{ width: 18, height: 18, accentColor: '#f97316' }}
                    />
                    <label htmlFor="notifyAdminShiftCheck" style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 650, cursor: 'pointer' }}>
                      Notificar Apertura / Cierre de Caja a Administradores
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      id="notifyLowStockCheck"
                      checked={safeSettings.notify_low_stock !== 'false'}
                      onChange={e => setSettings({ ...settings, notify_low_stock: e.target.checked ? 'true' : 'false' })}
                      style={{ width: 18, height: 18, accentColor: '#f97316' }}
                    />
                    <label htmlFor="notifyLowStockCheck" style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 650, cursor: 'pointer' }}>
                      Alertas de Stock Bajo / Agotado en Celular
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      id="notifyPermsCheck"
                      checked={safeSettings.notify_permission_change !== 'false'}
                      onChange={e => setSettings({ ...settings, notify_permission_change: e.target.checked ? 'true' : 'false' })}
                      style={{ width: 18, height: 18, accentColor: '#f97316' }}
                    />
                    <label htmlFor="notifyPermsCheck" style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 650, cursor: 'pointer' }}>
                      Notificar Cambios de Permisos a Usuarios Afectados
                    </label>
                  </div>
                </div>
              </div>

              {/* Section: Receipts / Tickets */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} /> Personalización de Recibos y Tickets
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Origen del Logo en el Ticket</label>
                    <select
                      className="input-field"
                      value={settings.ticket_logo_type || 'BUSINESS'}
                      onChange={e => setSettings({ ...settings, ticket_logo_type: e.target.value })}
                    >
                      <option value="BUSINESS">Usar Logo Predeterminado del Sistema / Negocio</option>
                      <option value="CUSTOM">Usar Logo Personalizado para Imprimir Tickets</option>
                      <option value="NONE">Sin Logo en los Recibos</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Ancho de Papel Térmico</label>
                    <select
                      className="input-field"
                      value={settings.ticket_paper_width || '80mm'}
                      onChange={e => setSettings({ ...settings, ticket_paper_width: e.target.value })}
                    >
                      <option value="80mm">80mm (Estándar Impresoras POS)</option>
                      <option value="58mm">58mm (Impresoras Térmicas Portátiles Bluetooth)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Encabezado del Ticket</label>
                    <input
                      className="input-field"
                      placeholder="Ej: N° VENTA o FACTURA"
                      value={settings.ticket_header || ''}
                      onChange={e => setSettings({ ...settings, ticket_header: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Pie de página del Ticket</label>
                    <textarea
                      className="input-field"
                      placeholder="Ej: ¡Gracias por su compra!"
                      rows={2}
                      value={settings.ticket_footer || ''}
                      onChange={e => setSettings({ ...settings, ticket_footer: e.target.value })}
                      style={{ resize: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Section: SMTP Mail */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={14} /> Servidor de Correos (SMTP)
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Servidor SMTP</label>
                    <input
                      className="input-field"
                      placeholder="Ej: smtp.gmail.com"
                      value={settings.smtp_host || ''}
                      onChange={e => setSettings({ ...settings, smtp_host: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Puerto SMTP</label>
                    <input
                      className="input-field"
                      placeholder="Ej: 587"
                      value={settings.smtp_port || ''}
                      onChange={e => setSettings({ ...settings, smtp_port: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Usuario SMTP</label>
                    <input
                      className="input-field"
                      placeholder="Ej: cuenta@gmail.com"
                      value={settings.smtp_user || ''}
                      onChange={e => setSettings({ ...settings, smtp_user: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Contraseña SMTP</label>
                    <input
                      className="input-field"
                      placeholder="••••••••••••"
                      type="password"
                      value={settings.smtp_password || ''}
                      onChange={e => setSettings({ ...settings, smtp_password: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section: AI Configuration */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Cpu size={14} /> Configuración de Inteligencia Artificial
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Proveedor de IA</label>
                    <select
                      className="input-field"
                      value={settings.ai_provider || 'gemini'}
                      onChange={e => setSettings({ ...settings, ai_provider: e.target.value })}
                    >
                      <option value="gemini">Google Gemini AI (Recomendado)</option>
                      <option value="openai">OpenAI (ChatGPT)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Clave API (API Key)</label>
                    <input
                      className="input-field"
                      placeholder="Ej: AIzaSy... o sk-..."
                      type="password"
                      value={settings.ai_api_key || ''}
                      onChange={e => setSettings({ ...settings, ai_api_key: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Contexto / Prompt de IA</label>
                    <textarea
                      className="input-field"
                      rows={3}
                      placeholder="Ej: Recomendar productos complementarios basados en compras del cliente."
                      value={settings.ai_prompt_context || ''}
                      onChange={e => setSettings({ ...settings, ai_prompt_context: e.target.value })}
                      style={{ resize: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Section: Database backup */}
              <div style={{ background: 'rgba(30, 36, 53, 0.4)', borderRadius: 14, padding: '14px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Database size={14} /> Gestión de Base de Datos
                </p>
                <button
                  type="button"
                  onClick={() => DarkSwal.fire('Respaldo en la Nube', 'Copia de seguridad completada. Los respaldos se gestionan automáticamente en el servidor.', 'success')}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, width: '100%', fontSize: 13 }}
                >
                  <Database size={16} /> Crear Respaldo (Backup) Completo
                </button>
              </div>

              {successMsg && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#22c55e' }}>
                  {successMsg}
                </div>
              )}

              <button className="btn-primary" type="submit" disabled={savingSettings}>
                {savingSettings
                  ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Guardando...</>
                  : <><Save size={18} /> Guardar Configuración</>
                }
              </button>
            </form>
          </div>
        </div>,
        document.body
      );
    })()}

      {/* ═══════════ ASSETS MODAL ═══════════ */}
      {showAssetsModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => e.target === e.currentTarget && setShowAssetsModal(false)}>
          <div className="modal-sheet" style={{ maxHeight: '90vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Box size={20} color="#f59e0b" /> Activos Fijos
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditingAsset(null); setAssetForm({ name: '', asset_type: 'EQUIPMENT', serial_number: '', purchase_price: '', purchase_date: '', location: '', assigned_to: '', condition: 'NEW', notes: '' }); setShowAssetFormModal(true); }} style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid #f97316', borderRadius: 8, padding: '6px 12px', color: '#f97316', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={14} /> Nuevo
                </button>
                <button onClick={() => setShowAssetsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X size={22} color="#64748b" />
                </button>
              </div>
            </div>

            {assetsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 32, height: 32 }} /></div>
            ) : assets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: '#64748b' }}>
                <Box size={40} color="#475569" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 14, margin: 0 }}>No hay activos registrados</p>
                <p style={{ fontSize: 12, margin: '4px 0 0', color: '#475569' }}>Agrega equipos, muebles, vehículos y más</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '65vh', overflowY: 'auto', paddingBottom: 16 }}>
                {/* Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>Total Activos</p>
                    <p style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: '2px 0 0' }}>{assets.length}</p>
                  </div>
                  <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <p style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>Valor Total</p>
                    <p style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', margin: '2px 0 0' }}>{fmt(assets.reduce((s, a) => s + parseFloat(a.purchase_price || 0), 0))}</p>
                  </div>
                </div>

                {assets.map(asset => {
                  const typeLabels = { EQUIPMENT: 'Equipo', ELECTRONICS: 'Electrónica', FURNITURE: 'Mobiliario', VEHICLE: 'Vehículo', PROPERTY: 'Inmueble', OTHER: 'Otro' };
                  const condLabels = { NEW: 'Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo' };
                  const condColors = { NEW: '#22c55e', GOOD: '#3b82f6', FAIR: '#f59e0b', POOR: '#ef4444' };
                  const typeEmojis = { EQUIPMENT: '🔧', ELECTRONICS: '💻', FURNITURE: '🪑', VEHICLE: '🚗', PROPERTY: '🏢', OTHER: '📦' };
                  return (
                    <div key={asset.id} style={{ background: 'rgba(30, 36, 53, 0.5)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 16 }}>{typeEmojis[asset.asset_type] || '📦'}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{asset.name}</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', padding: '2px 8px', borderRadius: 6 }}>{typeLabels[asset.asset_type] || asset.asset_type}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, background: `${condColors[asset.condition]}18`, color: condColors[asset.condition], padding: '2px 8px', borderRadius: 6 }}>{condLabels[asset.condition] || asset.condition}</span>
                          </div>
                          {asset.serial_number && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0' }}>S/N: {asset.serial_number}</p>}
                          {asset.location && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={10} /> {asset.location}</p>}
                          {asset.assigned_to && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0' }}>👤 {asset.assigned_to}</p>}
                          {asset.purchase_price && <p style={{ fontSize: 13, color: '#22c55e', fontWeight: 800, margin: '4px 0 0' }}>{fmt(asset.purchase_price)}</p>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditingAsset(asset); setAssetForm({ name: asset.name, asset_type: asset.asset_type, serial_number: asset.serial_number || '', purchase_price: asset.purchase_price || '', purchase_date: asset.purchase_date || '', location: asset.location || '', assigned_to: asset.assigned_to || '', condition: asset.condition, notes: asset.notes || '' }); setShowAssetFormModal(true); }} style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                            <Edit size={14} color="#3b82f6" />
                          </button>
                          <button onClick={() => handleDeleteAsset(asset.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                            <Trash2 size={14} color="#ef4444" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ═══════════ ASSET FORM MODAL ═══════════ */}
      {showAssetFormModal && createPortal(
        <div className="modal-overlay" style={{ zIndex: 210 }} onClick={e => e.target === e.currentTarget && setShowAssetFormModal(false)}>
          <div className="modal-sheet" style={{ maxHeight: '85vh' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{editingAsset ? 'Editar Activo' : 'Nuevo Activo Fijo'}</h2>
              <button onClick={() => setShowAssetFormModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#64748b" /></button>
            </div>

            <form onSubmit={handleSaveAsset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nombre del Activo *</label>
                <input className="input-field" placeholder="Ej: Vitrina principal, Computador caja" value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Tipo</label>
                  <select className="input-field" value={assetForm.asset_type} onChange={e => setAssetForm({ ...assetForm, asset_type: e.target.value })}>
                    <option value="EQUIPMENT">🔧 Equipo</option>
                    <option value="ELECTRONICS">💻 Electrónica</option>
                    <option value="FURNITURE">🪑 Mobiliario</option>
                    <option value="VEHICLE">🚗 Vehículo</option>
                    <option value="PROPERTY">🏢 Inmueble</option>
                    <option value="OTHER">📦 Otro</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Estado</label>
                  <select className="input-field" value={assetForm.condition} onChange={e => setAssetForm({ ...assetForm, condition: e.target.value })}>
                    <option value="NEW">✅ Nuevo</option>
                    <option value="GOOD">👍 Bueno</option>
                    <option value="FAIR">⚠️ Regular</option>
                    <option value="POOR">❌ Malo</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Número de Serie</label>
                <input className="input-field" placeholder="Ej: SN-12345" value={assetForm.serial_number} onChange={e => setAssetForm({ ...assetForm, serial_number: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Valor de Compra</label>
                  <input className="input-field" type="number" placeholder="0" value={assetForm.purchase_price} onChange={e => setAssetForm({ ...assetForm, purchase_price: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Fecha Compra</label>
                  <input className="input-field" type="date" value={assetForm.purchase_date} onChange={e => setAssetForm({ ...assetForm, purchase_date: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Ubicación</label>
                  <input className="input-field" placeholder="Ej: Bodega, Local 1" value={assetForm.location} onChange={e => setAssetForm({ ...assetForm, location: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Asignado a</label>
                  <input className="input-field" placeholder="Ej: Juan Pérez" value={assetForm.assigned_to} onChange={e => setAssetForm({ ...assetForm, assigned_to: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Notas</label>
                <textarea className="input-field" rows={2} placeholder="Observaciones adicionales..." value={assetForm.notes} onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })} style={{ resize: 'none' }} />
              </div>

              <button className="btn-primary" type="submit">
                <Save size={18} /> {editingAsset ? 'Actualizar Activo' : 'Registrar Activo'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
