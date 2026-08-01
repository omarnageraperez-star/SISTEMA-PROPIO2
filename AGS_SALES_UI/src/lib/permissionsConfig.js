/**
 * Catálogo Maestro de Permisos del Sistema AGS SALES ERP
 * Títulos y descripciones 100% fieles a la interfaz oficial del sistema.
 */

export const ROLE_CHOICES = [
  { value: 'SUPERADMIN', label: 'Super Administrador', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { value: 'ADMIN', label: 'Administrador', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'CASHIER', label: 'Cajero', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'USER', label: 'Usuario / Vendedor', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'SUPPLIER', label: 'Proveedor', badgeClass: 'bg-purple-100 text-purple-800 border-purple-300' },
];

export const PERMISSION_MODULES = [
  {
    id: 'pos',
    title: 'Terminal POS [F1]',
    badge: 'Terminal POS',
    permissions: [
      { key: 'pos.access', label: 'Acceso a Terminal POS [F1]', desc: 'Abrir pantalla de ventas e inventario en caja' },
      { key: 'pos.create_sale', label: 'Cobrar Venta / Emitir Ticket', desc: 'Procesar el cobro e imprimir comprobante' },
      { key: 'pos.apply_discount', label: 'Aplicar Descuento a Venta', desc: 'Descuentos porcentuales o directos' },
      { key: 'pos.void_sale', label: 'Anular Venta Procesada', desc: 'Cancelar ticket finalizado' },
      { key: 'pos.edit_price', label: 'Modificar Precio Unitario', desc: 'Alterar precio de lista en caja' },
      { key: 'pos.select_customer', label: 'Asignar Cliente a la Venta', desc: 'Vincular cliente al comprobante' },
      { key: 'pos.dice_game', label: 'Juego del Dado / Descuento Aleatorio', desc: 'Módulo de promociones interactivas en caja' },
    ]
  },
  {
    id: 'inventory',
    title: 'Inventario [F2]',
    badge: 'Inventario',
    permissions: [
      { key: 'inventory.access', label: 'Acceso a Inventario [F2]', desc: 'Ver catálogo general de productos' },
      { key: 'inventory.manage_products', label: 'Crear y Editar Productos', desc: 'Agregar o actualizar artículos' },
      { key: 'inventory.delete_products', label: 'Eliminar Productos', desc: 'Borrar permanentemente un producto' },
      { key: 'inventory.manage_categories', label: 'Gestión de Categorías', desc: 'Crear, editar o eliminar familias de productos' },
      { key: 'inventory.manage_promotions', label: 'Promociones y Ofertas', desc: 'Configurar descuentos masivos y combos' },
      { key: 'inventory.adjust_stock', label: 'Ajustar Stock Manual (Kardex)', desc: 'Ingresar o retirar existencias directamente' },
      { key: 'inventory.view_costs', label: 'Ver Precios de Costo y Ganancias', desc: 'Mostrar precios de compra y margen' },
      { key: 'inventory.barcodes', label: 'Generar e Imprimir Códigos de Barras', desc: 'Impresión de etiquetas con código de barras' },
    ]
  },
  {
    id: 'cash',
    title: 'Corte de Caja [F3] & Egresos',
    badge: 'Corte de Caja',
    permissions: [
      { key: 'cash.access', label: 'Acceso a Corte de Caja [F3]', desc: 'Ver estado actual de caja y egresos' },
      { key: 'cash.open_close', label: 'Realizar Arqueo y Cierre de Turno', desc: 'Cierre de turno y cuadre de valores' },
      { key: 'cash.movements', label: 'Registrar Egresos e Ingresos de Caja', desc: 'Retiros de efectivo o aportes' },
      { key: 'cash.history', label: 'Ver Historial de Cierres', desc: 'Consultar arqueos de turnos anteriores' },
    ]
  },
  {
    id: 'reports',
    title: 'Inteligencia [F4]',
    badge: 'Inteligencia',
    permissions: [
      { key: 'reports.access', label: 'Acceso a Inteligencia [F4]', desc: 'Ver módulo de analítica y estadísticas' },
      { key: 'reports.sales_profit', label: 'Reporte de Ventas y Utilidades', desc: 'Calcular ganancia neta' },
      { key: 'reports.top_products', label: 'Productos Más Vendidos', desc: 'Análisis de rotación de catálogo' },
      { key: 'reports.inventory_val', label: 'Valorización de Inventario', desc: 'Cálculo del capital en bodega' },
      { key: 'reports.bi_module', label: 'Módulo de Análisis BI', desc: 'Gráficos avanzados e inteligencia de negocios' },
    ]
  },
  {
    id: 'purchases',
    title: 'Compras [F5]',
    badge: 'Compras',
    permissions: [
      { key: 'purchases.access', label: 'Acceso a Compras [F5]', desc: 'Ver modulo de compras a proveedores' },
      { key: 'purchases.manage_suppliers', label: 'Directorio de Proveedores', desc: 'Crear y editar información de proveedores' },
      { key: 'purchases.manage_orders', label: 'Registrar Órdenes de Compra', desc: 'Cargar mercancía al stock' },
    ]
  },
  {
    id: 'sales_crm',
    title: 'Historial de Ventas [F6]',
    badge: 'Historial & Clientes',
    permissions: [
      { key: 'sales.view_history', label: 'Acceso a Historial de Ventas [F6]', desc: 'Explorar comprobantes emitidos' },
      { key: 'sales.view_details', label: 'Ver Detalle e Imprimir Copia', desc: 'Reimpresión de tickets antiguos' },
      { key: 'sales.credits', label: 'Ventas a Crédito y Cobranzas', desc: 'Gestión de fiados y pagos a plazos' },
      { key: 'sales.manage_customers', label: 'Directorio de Clientes', desc: 'Registrar y editar clientes' },
    ]
  },
  {
    id: 'assets',
    title: 'Activos de Empresa',
    badge: 'Activos Fijos',
    permissions: [
      { key: 'assets.access', label: 'Acceso a Activos Fijos', desc: 'Ver bienes patrimoniales' },
      { key: 'assets.manage', label: 'Crear y Editar Activos Fijos', desc: 'Registrar maquinaria, muebles y equipos' },
    ]
  },
  {
    id: 'settings',
    title: 'Ajustes del Sistema',
    badge: 'Ajustes',
    permissions: [
      { key: 'settings.access', label: 'Acceso a Ajustes del Sistema', desc: 'Entrar a panel de configuración' },
      { key: 'settings.business_info', label: 'Datos de la Empresa', desc: 'Nombre, NIT, dirección y logos' },
      { key: 'settings.ticket_editor', label: 'Editor de Ticket e Impresoras', desc: 'Formato de papel y selección de impresora' },
      { key: 'settings.scale', label: 'Balanza Electrónica y Puertos', desc: 'Configurar pesaje por puerto COM' },
      { key: 'settings.currency_taxes', label: 'Moneda, Decimales e Impuestos', desc: 'Símbolo monetario y tasa de IVA' },
      { key: 'settings.ai_config', label: 'Inteligencia Artificial (Gemini)', desc: 'Clave API de Gemini y promts' },
      { key: 'settings.smtp_config', label: 'Configuración de Correo SMTP', desc: 'Envío de facturas por email' },
      { key: 'settings.user_management', label: 'Gestión de Usuarios y Roles', desc: 'Creación de usuarios y matriz de permisos' },
      { key: 'settings.database', label: 'Copias de Seguridad (Backup BD)', desc: 'Generar o restaurar respaldos de base de datos' },
    ]
  }
];

export const ROLE_PRESETS = {
  SUPERADMIN: () => {
    const all = {};
    PERMISSION_MODULES.forEach(m => m.permissions.forEach(p => { all[p.key] = true; }));
    return all;
  },
  ADMIN: () => {
    const all = {};
    PERMISSION_MODULES.forEach(m => m.permissions.forEach(p => { all[p.key] = true; }));
    return all;
  },
  CASHIER: () => ({
    'pos.access': true,
    'pos.create_sale': true,
    'pos.apply_discount': false,
    'pos.void_sale': false,
    'pos.edit_price': false,
    'pos.select_customer': true,
    'pos.dice_game': true,
    'inventory.access': true,
    'inventory.manage_products': false,
    'inventory.delete_products': false,
    'inventory.manage_categories': false,
    'inventory.manage_promotions': false,
    'inventory.adjust_stock': false,
    'inventory.view_costs': false,
    'inventory.barcodes': true,
    'cash.access': true,
    'cash.open_close': true,
    'cash.movements': true,
    'cash.history': false,
    'sales.view_history': true,
    'sales.view_details': true,
    'sales.credits': true,
    'sales.manage_customers': true,
    'purchases.access': false,
    'reports.access': false,
    'assets.access': false,
    'settings.access': false,
  }),
  USER: () => ({
    'pos.access': true,
    'pos.create_sale': true,
    'pos.apply_discount': false,
    'pos.void_sale': false,
    'pos.edit_price': false,
    'pos.select_customer': true,
    'pos.dice_game': true,
    'inventory.access': true,
    'inventory.manage_products': false,
    'inventory.delete_products': false,
    'inventory.manage_categories': false,
    'inventory.manage_promotions': false,
    'inventory.adjust_stock': false,
    'inventory.view_costs': false,
    'inventory.barcodes': false,
    'cash.access': false,
    'sales.view_history': true,
    'sales.view_details': true,
    'sales.credits': false,
    'sales.manage_customers': true,
    'purchases.access': false,
    'reports.access': false,
    'assets.access': false,
    'settings.access': false,
  }),
  SUPPLIER: () => ({
    'pos.access': false,
    'inventory.access': true,
    'inventory.view_costs': true,
    'purchases.access': true,
    'purchases.manage_suppliers': false,
    'purchases.manage_orders': true,
    'reports.access': false,
    'assets.access': false,
    'settings.access': false,
  })
};

export function hasPermission(userProfile, permissionKey) {
  if (!userProfile) return false;
  if (userProfile.role === 'SUPERADMIN') return true;

  const customPerms = userProfile.custom_permissions;
  if (customPerms && typeof customPerms === 'object' && permissionKey in customPerms) {
    return Boolean(customPerms[permissionKey]);
  }

  const rolePreset = ROLE_PRESETS[userProfile.role] ? ROLE_PRESETS[userProfile.role]() : {};
  return Boolean(rolePreset[permissionKey]);
}
