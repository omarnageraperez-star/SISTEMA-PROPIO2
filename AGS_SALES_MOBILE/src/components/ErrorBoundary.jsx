import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          width: '100vw',
          backgroundColor: '#0a0c14',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 20,
            padding: 24,
            maxWidth: 400,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{ background: '#ef4444', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={26} color="white" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>Error inesperado en la App</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, wordBreak: 'break-word' }}>
              {this.state.error?.toString() || 'Ha ocurrido un problema al renderizar este apartado.'}
            </p>

            <button
              onClick={this.handleReset}
              style={{
                marginTop: 8,
                background: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '12px 20px',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} /> Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
