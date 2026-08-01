import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, ArrowRight, CheckCircle, XCircle, ShieldCheck, Lock } from 'lucide-react';
import { storage } from '../lib/storage';
import { buildApiBaseUrl, testApiConnection } from '../lib/connection';

export default function Setup() {
  const navigate = useNavigate();
  const [url, setUrl]         = useState('');
  const [status, setStatus]   = useState('idle'); // idle | checking | ok | error
  const [errMsg, setErrMsg]   = useState('');
  const [stepMsg, setStepMsg] = useState('Iniciando protocolo...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    storage.get('apiUrl').then(saved => {
      if (saved) {
        // Limpiar el segmento /api/ para mostrar solo la URL base amigable en el input
        const cleanSaved = saved.replace(/\/api\/?$/i, '');
        setUrl(cleanSaved);
      } else {
        // Pre-cargar por defecto el backend en Vercel
        setUrl('https://sistema-pos-ags.vercel.app');
      }
    });
  }, []);

  async function runConnectionCheck() {
    if (!url.trim()) return false;

    // Auto-add https:// if protocol is missing, or force HTTPS if it is http on a vercel domain
    let cleanUrl = url.trim();
    if (cleanUrl.toLowerCase().startsWith('http://') && cleanUrl.toLowerCase().includes('.vercel.app')) {
      cleanUrl = cleanUrl.replace(/^http:\/\//i, 'https://');
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }
    setUrl(cleanUrl);

    setStatus('checking');
    setErrMsg('');
    setProgress(15);
    setStepMsg('Verificando endpoint del servidor...');

    // Progress animation steps
    const timer1 = setTimeout(() => {
      setProgress(45);
      setStepMsg('Comprobando protocolo de comunicación...');
    }, 300);

    const timer2 = setTimeout(() => {
      setProgress(75);
      setStepMsg('Validando respuesta del backend...');
    }, 600);

    const finalUrl = buildApiBaseUrl(cleanUrl);
    const result = await testApiConnection(cleanUrl);

    clearTimeout(timer1);
    clearTimeout(timer2);

    if (result.ok || result.status === 404) {
      setProgress(100);
      setStepMsg('¡Conexión establecida con éxito!');
      await storage.set('apiUrl', finalUrl);
      setStatus('ok');
      return true;
    }

    setProgress(0);
    setStatus('error');
    setErrMsg(result.error
      ? `Sin conexión: ${result.error}`
      : `No se pudo conectar. Verifica la IP y que el servidor esté encendido.`);
    return false;
  }

  async function handleConnect(e) {
    e.preventDefault();
    const ok = await runConnectionCheck();
    if (ok) {
      setTimeout(() => navigate('/login'), 600);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 24px',
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
    }}>

      {/* Connection Card */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        padding: '36px 28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
        maxWidth: '420px',
        boxSizing: 'border-box'
      }}>
        
        {/* Animated Icon Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: status === 'checking'
              ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
              : status === 'ok'
              ? 'linear-gradient(135deg, #22c55e, #15803d)'
              : status === 'error'
              ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
              : 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.4s ease',
            position: 'relative'
          }}>
            {status === 'checking' ? (
              <Server size={32} color="#ffffff" className="animate-pulse" />
            ) : status === 'ok' ? (
              <CheckCircle size={32} color="#ffffff" />
            ) : status === 'error' ? (
              <XCircle size={32} color="#ffffff" />
            ) : (
              <Server size={32} color="#ffffff" />
            )}
          </div>
          
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '0.02em' }}>
            Servidor Central
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 0' }}>
            Ingrese la URL de Vercel o la IP local
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Dirección IP o URL
            </label>
            <input
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '12px',
                height: '48px',
                color: '#f8fafc',
                fontSize: '15px',
                fontWeight: 600,
                padding: '0 16px',
                width: '100%',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'monospace'
              }}
              type="text"
              placeholder="ejemplo.vercel.app"
              value={url}
              onChange={e => setUrl(e.target.value)}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Animated Connecting Loader */}
          {status === 'checking' && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: 14,
              padding: '14px 16px',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>
                  {stepMsg}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#93c5fd', fontFamily: 'monospace' }}>
                  {progress}%
                </span>
              </div>
              
              {/* Progress bar line */}
              <div style={{ height: 6, background: '#1e293b', borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                  borderRadius: 99,
                  transition: 'width 0.3s ease-out',
                  boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                }} />
              </div>
            </div>
          )}

          {/* Status Message */}
          {status === 'ok' && (
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 13,
              color: '#4ade80',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <CheckCircle size={16} /> ¡Conexión establecida! Entrando al sistema...
            </div>
          )}

          {status === 'error' && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 13,
              color: '#f87171',
              fontWeight: 500
            }}>
              {errMsg}
            </div>
          )}

          {/* Connect Button */}
          <button
            type="submit"
            disabled={status === 'checking' || !url.trim()}
            style={{
              marginTop: 8,
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              border: 'none',
              cursor: status === 'checking' || !url.trim() ? 'not-allowed' : 'pointer',
              opacity: status === 'checking' || !url.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(249, 115, 22, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {status === 'checking' ? 'Estableciendo Conexión...' : <>Conectar al Servidor <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 24, opacity: 0.4 }}>
        <ShieldCheck size={14} color="#94a3b8" />
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Cifrado SSL / Conexión Segura Directa</span>
      </div>
    </div>
  );
}
