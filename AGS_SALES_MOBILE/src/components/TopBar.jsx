import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';

export default function TopBar({ title, subtitle, showBack = false, rightAction = null, onBack = null, logo = null }) {
  const navigate = useNavigate();

  return (
    <div
      className="safe-top"
      style={{
        background: 'linear-gradient(180deg, rgba(20,24,36,0.98) 0%, rgba(10,12,20,0.92) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 18px',
        gap: 12,
        minHeight: 56,
      }}>
        {showBack && (
          <button
            onClick={onBack || (() => navigate(-1))}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#1e2435',
              border: '1px solid #252d42',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={18} color="#f1f5f9" />
          </button>
        )}

        {logo && (
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#ffffff',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #252d42',
            flexShrink: 0,
          }}>
            <img src={logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#f1f5f9',
            margin: 0,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 12, color: '#64748b', margin: 0, marginTop: 1 }}>
              {subtitle}
            </p>
          )}
        </div>

        {rightAction}
      </div>
    </div>
  );
}
