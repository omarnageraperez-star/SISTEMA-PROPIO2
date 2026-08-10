// AGS SALES - Premium JS enhancements

document.addEventListener("DOMContentLoaded", function() {
    // 1. Mejorar el User Dropdown de Jazzmin dinámicamente
    const userMenuLi = document.querySelector('.nav-item.dropdown.user-menu');
    if (userMenuLi) {
        const dropdownMenu = userMenuLi.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.classList.add('premium-dropdown');
            
            // Reemplazar la cabecera genérica con una versión Premium
            const userNameText = userMenuLi.querySelector('.d-none.d-md-inline')?.innerText || 'Usuario';
            const avatarImgSrc = userMenuLi.querySelector('img.img-circle')?.src || '/static/admin/img/default-user.png';
            
            // Custom HTML
            const headerHtml = `
                <div class="dropdown-header">
                    <img src="${avatarImgSrc}" alt="Avatar">
                    <strong>${userNameText}</strong>
                    <small class="text-muted">Administrador AGS</small>
                </div>
                <div class="dropdown-divider"></div>
                <a href="/admin/users/user/" class="dropdown-item">
                    <i class="fas fa-user-edit"></i> Editar mi Perfil
                </a>
                <a href="/admin/password_change/" class="dropdown-item">
                    <i class="fas fa-key"></i> Cambiar Contraseña
                </a>
                <div class="dropdown-divider"></div>
            `;
            
            // Mantener solo el botón de logout original que contiene el token CSRF o form
            const logoutItem = Array.from(dropdownMenu.querySelectorAll('a, form')).find(el => el.innerText.toLowerCase().includes('cerrar') || el.innerText.toLowerCase().includes('logout') || el.classList.contains('logout'));
            
            dropdownMenu.innerHTML = headerHtml;
            
            if (logoutItem) {
                if (logoutItem.tagName === 'FORM') {
                    // Si es un form, estilizar su botón interno
                    const btn = logoutItem.querySelector('button');
                    if(btn) {
                        btn.className = 'dropdown-item text-danger';
                        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Cerrar Sesión';
                    }
                    dropdownMenu.appendChild(logoutItem);
                } else {
                    logoutItem.className = 'dropdown-item text-danger';
                    logoutItem.innerHTML = '<i class="fas fa-sign-out-alt"></i> Cerrar Sesión';
                    dropdownMenu.appendChild(logoutItem);
                }
            }
        }
    }

    // 2. Fetch Dashboard Data if we are on the index page
    const contentWrapper = document.querySelector('.content-wrapper .content');
    const isIndex = document.querySelector('.dashboard-tools') || document.querySelector('#content-main');
    
    if (contentWrapper && isIndex && !document.getElementById('premium-dashboard-stats')) {
        // Inyectar el HTML del Dashboard antes del contenido principal de Jazzmin
        const dashboardHtml = `
            <!-- Panel de Control Premium -->
            <div id="premium-dashboard-stats" class="dashboard-grid mt-3">
                <div class="glass-panel kpi-card" style="border-left: 4px solid #10b981 !important;">
                    <div class="kpi-info">
                        <p>Total Ventas</p>
                        <h3 id="kpi-sales">Cargando...</h3>
                    </div>
                    <div class="icon-box" style="background: rgba(16, 185, 129, 0.1); color: #10b981;"><i class="fas fa-hand-holding-usd"></i></div>
                </div>
                <div class="glass-panel kpi-card" style="border-left: 4px solid #4f46e5 !important;">
                    <div class="kpi-info">
                        <p>Órdenes Completadas</p>
                        <h3 id="kpi-orders">...</h3>
                    </div>
                    <div class="icon-box" style="background: rgba(79, 70, 229, 0.1); color: #4f46e5;"><i class="fas fa-cash-register"></i></div>
                </div>
                <div class="glass-panel kpi-card" style="border-left: 4px solid #f59e0b !important;">
                    <div class="kpi-info">
                        <p>Productos Activos</p>
                        <h3 id="kpi-products">...</h3>
                    </div>
                    <div class="icon-box" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;"><i class="fas fa-boxes"></i></div>
                </div>
                <div class="glass-panel kpi-card" style="border-left: 4px solid #06b6d4 !important;">
                    <div class="kpi-info">
                        <p>Estado del Servidor</p>
                        <h3 id="kpi-status" style="color: #06b6d4; display: flex; align-items: center; gap: 8px; font-size: 1.5rem; font-weight: 700; margin-top: 5px;">
                            En Línea <span style="width: 10px; height: 10px; background: #06b6d4; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #06b6d4; animation: pulse 1.5s infinite;"></span>
                        </h3>
                    </div>
                    <div class="icon-box" style="background: rgba(6, 182, 212, 0.1); color: #06b6d4;"><i class="fas fa-server"></i></div>
                </div>
            </div>

            <!-- Accesos Rápidos Premium -->
            <div id="premium-quick-actions" class="mt-4" style="margin-bottom: 2rem;">
                <h4 style="font-weight: 700; margin-bottom: 1.25rem; color: #1e293b; display: flex; align-items: center; gap: 10px; font-size: 1.2rem;">
                    <i class="fas fa-bolt" style="color: #f59e0b;"></i> Accesos Rápidos al Sistema
                </h4>
                <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; margin-bottom: 1rem;">
                    <a href="/admin/sales/sale/add/" class="glass-panel kpi-card" style="padding: 1.25rem 1.5rem !important; text-decoration: none; border-left: 3px solid #4f46e5 !important;">
                        <div class="kpi-info">
                            <p style="margin: 0; font-size: 0.75rem; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">TRANSACCIONES</p>
                            <h4 style="margin: 5px 0 0 0; font-weight: 700; color: #1e293b; font-size: 1rem;">Registrar Venta</h4>
                        </div>
                        <div class="icon-box" style="width: 44px; height: 44px; background: rgba(79, 70, 229, 0.08); color: #4f46e5; font-size: 1.1rem;"><i class="fas fa-cart-plus"></i></div>
                    </a>
                    <a href="/admin/inventory/product/add/" class="glass-panel kpi-card" style="padding: 1.25rem 1.5rem !important; text-decoration: none; border-left: 3px solid #f59e0b !important;">
                        <div class="kpi-info">
                            <p style="margin: 0; font-size: 0.75rem; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">INVENTARIO</p>
                            <h4 style="margin: 5px 0 0 0; font-weight: 700; color: #1e293b; font-size: 1rem;">Nuevo Producto</h4>
                        </div>
                        <div class="icon-box" style="width: 44px; height: 44px; background: rgba(245, 158, 11, 0.08); color: #f59e0b; font-size: 1.1rem;"><i class="fas fa-plus-circle"></i></div>
                    </a>
                    <a href="/admin/inventory/stock/" class="glass-panel kpi-card" style="padding: 1.25rem 1.5rem !important; text-decoration: none; border-left: 3px solid #a855f7 !important;">
                        <div class="kpi-info">
                            <p style="margin: 0; font-size: 0.75rem; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">LOGÍSTICA</p>
                            <h4 style="margin: 5px 0 0 0; font-weight: 700; color: #1e293b; font-size: 1rem;">Control Stock</h4>
                        </div>
                        <div class="icon-box" style="width: 44px; height: 44px; background: rgba(168, 85, 247, 0.08); color: #a855f7; font-size: 1.1rem;"><i class="fas fa-cubes"></i></div>
                    </a>
                    <a href="/admin/accounting/cashregister/" class="glass-panel kpi-card" style="padding: 1.25rem 1.5rem !important; text-decoration: none; border-left: 3px solid #10b981 !important;">
                        <div class="kpi-info">
                            <p style="margin: 0; font-size: 0.75rem; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">FINANZAS</p>
                            <h4 style="margin: 5px 0 0 0; font-weight: 700; color: #1e293b; font-size: 1rem;">Control de Caja</h4>
                        </div>
                        <div class="icon-box" style="width: 44px; height: 44px; background: rgba(16, 185, 129, 0.08); color: #10b981; font-size: 1.1rem;"><i class="fas fa-wallet"></i></div>
                    </a>
                </div>
            </div>
        `;
        
        contentWrapper.insertAdjacentHTML('afterbegin', dashboardHtml);

        // Fetching API data super fast
        fetch('/api/reports/dashboard/')
            .then(res => {
                if(!res.ok) throw new Error("No autenticado");
                return res.json();
            })
            .then(data => {
                document.getElementById('kpi-sales').innerText = '$' + (data.total_sales || 0).toLocaleString('es-CO');
                document.getElementById('kpi-orders').innerText = data.total_orders || 0;
                document.getElementById('kpi-products').innerText = data.active_products || 0;
            })
            .catch(err => {
                console.log('Error fetching dashboard stats:', err);
                document.getElementById('kpi-sales').innerText = '$0';
                document.getElementById('kpi-orders').innerText = '0';
                document.getElementById('kpi-products').innerText = '0';
            });
    }

    // Estilos de animación dinámicos para el pulso verde del servidor
    const pulseStyle = document.createElement('style');
    pulseStyle.innerHTML = `
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(6, 182, 212, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
        }
    `;
    document.head.appendChild(pulseStyle);
});
