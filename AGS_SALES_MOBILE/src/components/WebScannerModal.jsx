import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, RefreshCw, Image, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { DarkSwal } from '../lib/swal';
import { triggerHaptic } from '../lib/notifications';

export default function WebScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isHttpSafari, setIsHttpSafari] = useState(false);
  const scannerRef = useRef(null);
  const isStartedRef = useRef(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Check if running inside native app APK vs Web browser
    if (Capacitor.isNativePlatform()) {
      runNativeScan();
      return;
    }

    // Web Browser mode (Safari on iOS / Chrome / etc.)
    let html5QrcodeScanner = null;
    let isMounted = true;

    // Detect if running on HTTP on external IP (Safari blocks getUserMedia in HTTP context)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';
    const httpBlocked = !isHttps && !isLocalhost;
    setIsHttpSafari(httpBlocked);

    async function startWebScanner() {
      setLoading(true);
      setErrorMsg('');

      // If HTTP external IP context (Safari blocks live camera stream), switch directly to photo scanner
      if (httpBlocked) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            stream.getTracks().forEach(track => track.stop());
          } catch (permErr) {
            console.warn("Camera stream request warning:", permErr);
          }
        }

        const elementId = "web-qr-reader-container";
        const container = document.getElementById(elementId);
        if (!container) return;

        html5QrcodeScanner = new Html5Qrcode(elementId);
        scannerRef.current = html5QrcodeScanner;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 180 },
          aspectRatio: 1.0,
        };

        await html5QrcodeScanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (isMounted && decodedText) {
              triggerHaptic('success');
              onScanSuccess(decodedText);
              stopScanner();
              onClose();
            }
          },
          () => {} // ignore frame errors
        );

        isStartedRef.current = true;
        if (isMounted) setLoading(false);
      } catch (e) {
        console.error("Web scanner start error:", e);
        if (isMounted) {
          setLoading(false);
          setIsHttpSafari(true);
          setErrorMsg('Safari restringe la cámara en vivo sobre HTTP. Usa el botón de foto a continuación.');
        }
      }
    }

    const t = setTimeout(startWebScanner, 100);

    return () => {
      isMounted = false;
      clearTimeout(t);
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current && isStartedRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.warn("Error stopping scanner:", e);
      }
      isStartedRef.current = false;
      scannerRef.current = null;
    }
  };

  const handleFileScan = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      let html5Qrcode = scannerRef.current;
      if (!html5Qrcode) {
        html5Qrcode = new Html5Qrcode("web-qr-reader-container");
        scannerRef.current = html5Qrcode;
      }
      const decodedText = await html5Qrcode.scanFile(file, true);
      if (decodedText) {
        triggerHaptic('success');
        onScanSuccess(decodedText);
        stopScanner();
        onClose();
      }
    } catch (err) {
      console.error("File scan error:", err);
      DarkSwal.fire({
        icon: 'error',
        title: 'Código no detectado',
        text: 'No se pudo leer un código de barras en la imagen. Intenta tomar la foto más de cerca y enfocada.'
      });
    } finally {
      setLoading(false);
      if (event.target) event.target.value = '';
    }
  };

  const runNativeScan = async () => {
    try {
      let check = await BarcodeScanner.checkPermissions();
      let granted = check.camera === 'granted';
      if (!granted) {
        const req = await BarcodeScanner.requestPermissions();
        granted = req.camera === 'granted' || req.camera === 'limited';
      }
      if (!granted) {
        DarkSwal.fire({ icon: 'warning', title: 'Permiso Denegado', text: 'Se requiere acceso a la cámara para escanear.' });
        onClose();
        return;
      }

      try {
        const isAvailable = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!isAvailable.available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      } catch (err) {}

      const res = await BarcodeScanner.scan();
      if (res && res.barcodes && res.barcodes.length > 0) {
        const code = res.barcodes[0].rawValue || res.barcodes[0].displayValue;
        if (code) {
          triggerHaptic('success');
          onScanSuccess(code);
        }
      }
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e);
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('user canceled')) {
        DarkSwal.fire({ icon: 'error', title: 'Error al escanear', text: 'Ocurrió un error abriendo la cámara.' });
      }
    } finally {
      onClose();
    }
  };

  if (!isOpen || Capacitor.isNativePlatform()) return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 300, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }} onClick={e => e.target === e.currentTarget && (stopScanner(), onClose())}>
      <div className="modal-sheet" style={{
        height: '80vh',
        maxHeight: 540,
        maxWidth: 440,
        margin: 'auto',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 28,
        background: '#080a0f',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        padding: 20,
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Hidden native camera/file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileScan}
          style={{ display: 'none' }}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera size={20} color="#3b82f6" />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Escanear Código de Barras
            </h2>
          </div>
          <button
            onClick={() => { stopScanner(); onClose(); }}
            style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={18} color="#ffffff" />
          </button>
        </div>

        {/* Camera Feed / Fallback Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderRadius: 20, background: '#000000', border: '1px solid rgba(255,255,255,0.06)' }}>
          
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#8a94a6', padding: 20 }}>
              <RefreshCw size={28} color="#3b82f6" className="animate-spin" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Cargando escáner...</span>
            </div>
          )}

          {isHttpSafari && !loading && (
            <div style={{ textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={32} color="#3b82f6" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Escáner Cámara iPhone
              </h3>
              <p style={{ fontSize: 12, color: '#8a94a6', margin: 0, lineHeight: 1.4, maxWidth: 280 }}>
                Presiona el botón para tomar una foto del código de barras con la cámara de tu iPhone.
              </p>
              
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 99,
                  padding: '14px 24px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)',
                  marginTop: 6
                }}
              >
                <Camera size={18} color="white" />
                📸 Tomar Foto del Código
              </button>
            </div>
          )}

          <div id="web-qr-reader-container" style={{ width: '100%', height: '100%', display: loading || isHttpSafari ? 'none' : 'block' }} />
        </div>

        {/* Footer controls */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              background: '#12151c',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <Image size={14} color="#3b82f6" />
            Cargar foto desde Galería
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
