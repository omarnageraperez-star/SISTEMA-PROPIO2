import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Package, ShoppingCart, FileText, BarChart3
} from 'lucide-react';
import { triggerHaptic } from '../lib/notifications';

import { hasPermission } from '../lib/permissionsConfig';

const NAV_ITEMS = [
  { path: '/',          icon: Home,         label: 'Inicio'      },
  { path: '/inventory', icon: Package,      label: 'Productos'   },
  { path: '/pos',       icon: ShoppingCart, label: 'Vender'      },
  { path: '/sales',     icon: FileText,     label: 'Pedidos'     },
  { path: '/reports',   icon: BarChart3,    label: 'Estadísticas'},
];

export default function BottomNav({ user }) {
  const navigate  = useNavigate();
  const { pathname } = useLocation();

  // Roles that can see each tab
  const canAccess = (path) => {
    if (path === '/') return true;
    if (path === '/inventory') return hasPermission(user, 'inventory.access');
    if (path === '/pos') return hasPermission(user, 'pos.access');
    if (path === '/sales') return hasPermission(user, 'sales.view_history');
    if (path === '/reports') return hasPermission(user, 'reports.access');
    return true;
  };

  const handleNavClick = (path) => {
    triggerHaptic('light');
    navigate(path);
  };

  return (
    <nav className="bottom-nav">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 2 }}>
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
          if (!canAccess(path)) return null;
          const isActive = path === '/'
            ? pathname === '/'
            : pathname.startsWith(path);

          return (
            <button
              key={path}
              onClick={() => handleNavClick(path)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 4px',
                borderRadius: 22,
                background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid transparent',
                boxShadow: isActive ? 'inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0,0,0,0.2)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                minWidth: 0,
              }}
            >
              <Icon
                size={21}
                color={isActive ? 'var(--color-accent)' : '#8a94a6'}
                strokeWidth={isActive ? 2.4 : 1.8}
                style={{
                  filter: isActive ? 'drop-shadow(0 2px 8px var(--color-accent-dim))' : 'none',
                  transition: 'all 0.2s',
                }}
              />
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--color-accent-light)' : '#8a94a6',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'color 0.2s',
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
