import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Settings, User, Lock, Sparkles, ShieldCheck } from 'lucide-react';
import { storage } from '../lib/storage';
import { apiRequest, parseError } from '../lib/api';
import defaultLogo from '../default_logo.png';
import { DarkSwal } from '../lib/swal';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [show, setShow]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [apiUrl, setApiUrl]   = useState('');

  // Dynamic business details state loaded before authenticating
  const [businessSettings, setBusinessSettings] = useState({
    business_name: 'AGS SALES',
    app_logo: ''
  });

  useEffect(() => {
    (async () => {
      const url = await storage.get('apiUrl');
      if (!url) {
        navigate('/setup');
        return;
      }
      setApiUrl(url);

      const token = await storage.get('token');
      if (token) {
        navigate('/');
        return;
      }

      // Fetch public settings with a short timeout — purely cosmetic, never blocks login
      try {
        const cleanUrl = url.endsWith('/') ? url : `${url}/`;
        const settingsController = new AbortController();
        const settingsTimeout = setTimeout(() => settingsController.abort(), 8000);
        const res = await fetch(`${cleanUrl}users/settings/`, { signal: settingsController.signal });
        clearTimeout(settingsTimeout);
        if (res.ok) {
          const data = await res.json();
          let logoUrl = data.app_logo || '';
          if (logoUrl && !logoUrl.startsWith('data:') && !logoUrl.startsWith('http')) {
            const base = url.replace('/api/', '').replace(/\/$/, '');
            logoUrl = `${base}/${logoUrl.startsWith('/') ? logoUrl.slice(1) : logoUrl}`;
          }
          setBusinessSettings({
            business_name: data.business_name || 'AGS SALES',
            app_logo: logoUrl
          });
        }
      } catch (e) {
        console.warn("Could not load public settings:", e);
      }
    })();
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Ingresa usuario y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    setDebugInfo('');
    let activeApiUrl = apiUrl;
    let loginUrl = '';
    try {
      if (!activeApiUrl) {
        activeApiUrl = await storage.get('apiUrl') || '';
        if (activeApiUrl) {
          setApiUrl(activeApiUrl);
        } else {
          setError('No se ha configurado la dirección del servidor.');
          setLoading(false);
          return;
        }
      }
      
      loginUrl = `${activeApiUrl}users/login/`;
      const res = await apiRequest(loginUrl, {
        method: 'POST',
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      if (res.ok) {
        const data = await res.json();
        const token   = data.access  || data.token;
        const refresh = data.refresh || null;
        
        // Fetch the user profile to get the actual user role and fields
        const profileUrl = `${activeApiUrl}users/profile/`;
        let user = { username: form.username, role: 'CLIENT' };
        try {
          const profileRes = await apiRequest(profileUrl, {}, token);
          if (profileRes.ok) {
            user = await profileRes.json();
          }
        } catch (e) {
          console.warn("Failed to fetch user profile, falling back:", e);
        }

        await storage.set('token',   token);
        await storage.set('refresh', refresh);
        await storage.set('user',    user);

        onLogin({ token, user, apiUrl: activeApiUrl });
        navigate('/');
      } else {
        const detail = await parseError(res);
        setError(detail || 'La autenticación falló.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sin conexión. Verifica que el servidor esté encendido.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, #1e1b4b 0%, #090d16 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px',
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
      position: 'relative'
    }}>
      
      {/* Back glow decoration */}
      <div style={{
        position: 'absolute',
        width: 350,
        height: 350,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(234,88,12,0.06) 0%, transparent 60%)',
        top: '15%',
        right: '5%',
        pointerEvents: 'none'
      }} />

      {/* Login Card */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.45)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '28px',
        padding: '38px 28px 28px',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
        maxWidth: '400px',
        boxSizing: 'border-box',
        animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        zIndex: 10
      }}>
        
        {/* Dynamic Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 90,
            height: 90,
            borderRadius: 22,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 12px 24px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            overflow: 'hidden',
          }}>
            <img 
              src={businessSettings.app_logo || defaultLogo} 
              alt="logo" 
              style={{ width: '80%', height: '80%', objectFit: 'contain' }} 
            />
          </div>
          
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 950, 
            color: '#ffffff', 
            margin: 0, 
            textTransform: 'uppercase', 
            letterSpacing: '0.04em',
            lineHeight: 1.2
          }}>
            {businessSettings.business_name}
          </h1>
          <p style={{ 
            fontSize: 10, 
            fontWeight: 800, 
            color: '#ea580c', 
            margin: '4px 0 0', 
            textTransform: 'uppercase', 
            letterSpacing: '0.15em' 
          }}>
            Ingreso Seguro
          </p>
        </div>

        {/* Inputs & Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Username */}
          <div style={{ position: 'relative' }}>
            <User size={16} color="#64748b" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              style={{ 
                paddingLeft: 42,
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid #1e293b',
                borderRadius: '14px',
                height: '52px',
                color: '#f1f5f9',
                fontSize: '15px',
                fontWeight: 600,
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s'
              }}
              type="text"
              placeholder="Nombre de usuario"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="login-input"
            />
          </div>

          {/* Password */}
          <div style={{ position: 'relative' }}>
            <Lock size={16} color="#64748b" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              style={{ 
                paddingLeft: 42,
                paddingRight: 44,
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid #1e293b',
                borderRadius: '14px',
                height: '52px',
                color: '#f1f5f9',
                fontSize: '15px',
                fontWeight: 600,
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s'
              }}
              type={show ? 'text' : 'password'}
              placeholder="Contraseña"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="login-input"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              {show ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 14,
              padding: '14px 16px',
              fontSize: 13,
              color: '#fca5a5',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚠️</span> <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/setup')}
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Settings size={14} /> Cambiar dirección IP del Servidor
              </button>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{ 
              marginTop: 10,
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 8px 24px rgba(249, 115, 22, 0.3)',
              transition: 'all 0.2s'
            }}
            className="login-submit"
          >
            {loading
              ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Conectando...</>
              : <><LogIn size={18} /> Ingresar a la App</>
            }
          </button>
        </form>

        {/* Divider & Links */}
        <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.05)', margin: '26px 0 18px' }} />
        
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button 
            type="button" 
            onClick={() => DarkSwal.fire('Recuperar Acceso', 'Para cambiar tu contraseña o reactivar tu cuenta, ponte en contacto con tu Administrador principal desde la plataforma en la PC.', 'info')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#94a3b8', 
              fontSize: 12, 
              fontWeight: 700, 
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            ¿No puedes acceder? Soporte del Sistema
          </button>
        </div>
      </div>

      {/* Change server option */}
      <button
        onClick={() => navigate('/setup')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 12,
          padding: '8px 16px',
          cursor: 'pointer',
          marginTop: 24,
          transition: 'all 0.2s',
          zIndex: 10
        }}
        className="login-server-btn"
      >
        <Settings size={14} color="#94a3b8" />
        <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>
          Configurar Servidor
        </span>
      </button>

      {apiUrl && (
        <p style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 10, fontFamily: 'monospace', zIndex: 10 }}>
          Conexión actual: {apiUrl}
        </p>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .login-input:focus {
          border-color: #f97316 !important;
          box-shadow: 0 0 0 1px #f97316 !important;
          background: rgba(15, 23, 42, 0.6) !important;
        }
        .login-submit:active {
          transform: scale(0.98);
          opacity: 0.9;
        }
        .login-server-btn:active {
          background: rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>
    </div>
  );
}
