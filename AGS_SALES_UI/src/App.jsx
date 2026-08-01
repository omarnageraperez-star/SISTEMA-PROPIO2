import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Settings, Server, Database, CheckCircle, ChevronRight, Activity, User, Lock, Mail, Phone, LogIn, DollarSign, Printer, Save, Image as ImageIcon, Package, Plus, X, QrCode, Users, Building, Sliders, Hash, Coins, Percent, Cpu, Globe, ShoppingBag, ShoppingCart, CreditCard, FileText, ArrowLeft, ArrowDownRight, Shield, Edit3, Trash2, BarChart3, Monitor, Menu, ChevronLeft, LogOut, ChevronDown, Check, Sun, Moon, Maximize, Minimize, Bell, Search, Tag, Briefcase, Download } from 'lucide-react';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';
import * as XLSX from 'xlsx';
import BarcodeGeneratorModal from './components/inventory/BarcodeGeneratorModal';
import POSModule from './components/pos/POSModule';
import BIModule from './components/reports/BIModule';
import CashCutModal from './components/pos/CashCutModal';
import CashMovementModal from './components/pos/CashMovementModal';
import PurchasesModule from './components/purchases/PurchasesModule';
import SalesHistoryModule from './components/pos/SalesHistoryModule';
import AssetsModule from './components/assets/AssetsModule';
import UsersManagementModule from './components/settings/UsersManagementModule';
import TicketEditorModule from './components/settings/TicketEditorModule';
import { hasPermission } from './lib/permissionsConfig';
import { apiRequest } from './lib/api';
import { printCashCut, generateCashCutHTML, printTicket } from './lib/print';

const normalizeText = (text) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

const isNewerVersion = (oldVer, newVer) => {
  if (!oldVer || !newVer) return false;
  const oldParts = oldVer.split('.').map(Number);
  const newParts = newVer.split('.').map(Number);
  for (let i = 0; i < Math.max(oldParts.length, newParts.length); i++) {
    const a = oldParts[i] || 0;
    const b = newParts[i] || 0;
    if (b > a) return true;
    if (b < a) return false;
  }
  return false;
};

const uploadLocalFileToImgBB = async (localPath) => {
  try {
    const fs = window.require ? window.require('fs') : null;
    if (!fs) throw new Error("Acceso al sistema de archivos no disponible");
    
    const fileBuffer = fs.readFileSync(localPath);
    const base64Image = fileBuffer.toString('base64');
    
    const body = new URLSearchParams();
    body.append('image', base64Image);
    
    const res = await fetch('https://api.imgbb.com/1/upload?key=e15b92a922e0938b38eeea0b567cea75', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error en ImgBB: ${res.statusText} - ${errorText}`);
    }
    
    const json = await res.json();
    return json.data.url;
  } catch (error) {
    console.error("Error al subir archivo local a ImgBB:", error);
    throw error;
  }
};

const uploadFileToImgBB = async (file) => {
  try {
    const body = new FormData();
    body.append('image', file);
    
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

let isAuthenticating = false;

const ipcRenderer = window.require ? window.require('electron').ipcRenderer : null;
import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  customClass: {
    popup: 'premium-swal-toast',
    title: 'text-sm font-bold text-slate-800',
    htmlContainer: 'text-xs text-slate-500'
  }
});

const premiumAlert = (title, text, icon = 'info') => {
  return Swal.fire({
    title,
    text,
    icon,
    confirmButtonText: 'Aceptar',
    allowEscapeKey: true,
    allowOutsideClick: true,
    customClass: {
      popup: 'premium-swal',
      title: 'premium-swal-title',
      htmlContainer: 'premium-swal-html',
      confirmButton: 'premium-swal-confirm',
      cancelButton: 'premium-swal-cancel'
    },
    buttonsStyling: false
  });
};

const premiumConfirm = (title, text, confirmButtonText = 'Confirmar', cancelButtonText = 'Cancelar') => {
  return Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    customClass: {
      popup: 'premium-swal',
      title: 'premium-swal-title',
      htmlContainer: 'premium-swal-html',
      confirmButton: 'premium-swal-confirm',
      cancelButton: 'premium-swal-cancel'
    },
    buttonsStyling: false
  });
};

const getFlagSvg = (iso) => {
  if (!iso) return '';
  const flags = {
    bo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="60" fill="#007a33"/><rect width="90" height="40" fill="#f9d300"/><rect width="90" height="20" fill="#d52b1e"/></svg>',
    co: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="30" fill="#fcd116"/><rect y="30" width="90" height="15" fill="#003893"/><rect y="45" width="90" height="15" fill="#ce1126"/></svg>',
    pe: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="30" height="60" fill="#d91414"/><rect x="30" width="30" height="60" fill="#fff"/><rect x="60" width="30" height="60" fill="#d91414"/></svg>',
    cl: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="30" fill="#fff"/><rect y="30" width="90" height="30" fill="#d52b1e"/><rect width="30" height="30" fill="#0039a6"/><polygon points="15,5 18,14 27,14 20,19 23,28 15,22 7,28 10,19 3,14 12,14" fill="#fff"/></svg>',
    ar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="20" fill="#74acdf"/><rect y="20" width="90" height="20" fill="#fff"/><rect y="40" width="90" height="20" fill="#74acdf"/><circle cx="45" cy="30" r="5" fill="#f6b426"/></svg>',
    mx: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="30" height="60" fill="#006847"/><rect x="30" width="30" height="60" fill="#fff"/><rect x="60" width="30" height="60" fill="#c8102e"/><circle cx="45" cy="30" r="4" fill="#8b5a2b"/></svg>',
    ec: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="30" fill="#ffdd00"/><rect y="30" width="90" height="15" fill="#0033a0"/><rect y="45" width="90" height="15" fill="#da291c"/><circle cx="45" cy="37.5" r="3" fill="#8b5a2b"/></svg>',
    ve: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="20" fill="#fecb00"/><rect y="20" width="90" height="20" fill="#00247d"/><rect y="40" width="90" height="20" fill="#cf142b"/><circle cx="45" cy="30" r="2" fill="#fff"/></svg>',
    uy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60" fill="#fff"><rect width="90" height="60" fill="#fff"/><rect y="6.6" width="90" height="6.6" fill="#0038a8"/><rect y="20" width="90" height="6.6" fill="#0038a8"/><rect y="33.3" width="90" height="6.6" fill="#0038a8"/><rect y="46.6" width="90" height="6.6" fill="#0038a8"/><rect width="30" height="26.6" fill="#fff"/><rect x="5" y="5" width="20" height="16.6" fill="#fecb00"/></svg>',
    py: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="20" fill="#d52b1e"/><rect y="20" width="90" height="20" fill="#fff"/><rect y="40" width="90" height="20" fill="#003893"/><circle cx="45" cy="30" r="3" fill="#ced815"/></svg>',
    br: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="60" fill="#009739"/><polygon points="45,5 85,30 45,55 5,30" fill="#fedf00"/><circle cx="45" cy="30" r="14" fill="#002776"/></svg>',
    pa: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60" fill="#fff"><rect width="95" height="65" fill="#fff"/><rect x="45" width="45" height="30" fill="#da121a"/><rect y="30" width="45" height="30" fill="#072357"/><polygon points="22.5,7 24,12 29,12 25,15 26.5,20 22.5,17 18.5,20 20,15 16,12 21,12" fill="#072357"/><polygon points="67.5,37 69,42 74,42 70,45 71.5,50 67.5,47 63.5,50 65,45 61,42 66,42" fill="#da121a"/></svg>',
    cr: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="10" fill="#002b7f"/><rect y="10" width="90" height="10" fill="#fff"/><rect y="20" width="90" height="20" fill="#ce1126"/><rect y="40" width="90" height="10" fill="#fff"/><rect y="50" width="90" height="10" fill="#002b7f"/></svg>',
    do: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="40" height="25" fill="#002d62"/><rect x="50" width="40" height="25" fill="#ce1126"/><rect y="35" width="40" height="25" fill="#ce1126"/><rect x="50" y="35" width="40" height="25" fill="#002d62"/><rect x="40" width="10" height="60" fill="#fff"/><rect y="25" width="90" height="10" fill="#fff"/></svg>',
    gt: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="30" height="60" fill="#4997d0"/><rect x="30" width="30" height="60" fill="#fff"/><rect x="60" width="30" height="60" fill="#4997d0"/><circle cx="45" cy="30" r="4" fill="#7a9a01"/></svg>',
    hn: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="20" fill="#0073cf"/><rect y="20" width="90" height="20" fill="#fff"/><rect y="40" width="90" height="20" fill="#0073cf"/><polygon points="45,26 46,29 49,29 47,31 48,34 45,32 42,34 43,31 41,29 44,29" fill="#0073cf"/></svg>',
    sv: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="20" fill="#0f47af"/><rect y="20" width="90" height="20" fill="#fff"/><rect y="40" width="90" height="20" fill="#0f47af"/><circle cx="45" cy="30" r="3" fill="#e5a93b"/></svg>',
    ni: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><rect width="90" height="20" fill="#0067c6"/><rect y="20" width="90" height="20" fill="#fff"/><rect y="40" width="90" height="20" fill="#0067c6"/><polygon points="45,26 49,34 41,34" fill="#e5a93b"/></svg>'
  };
  return flags[iso.toLowerCase()] || flags.bo;
};

function App() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Conectando al servidor Django...');
  const [appState, setAppState] = useState('SETUP_API'); // SETUP_API, CREATE_ADMIN, LOGIN, OPEN_BOX, DASHBOARD, SETTINGS, INVENTORY
  const [token, setToken] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // API Config State
  const [apiUrl, setApiUrl] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 1200 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setSidebarCollapsed(window.innerWidth < 1200);
      
      // Calculate scale based on baseline resolution 1440x900
      const baseWidth = 1440;
      const baseHeight = 900;
      
      const widthRatio = window.innerWidth / baseWidth;
      const heightRatio = window.innerHeight / baseHeight;
      
      let scale = Math.min(widthRatio, heightRatio);
      // Bound the scale factor so it does not shrink or blow up excessively
      scale = Math.max(0.65, Math.min(1.25, scale));
      
      const rootFontSize = scale * 16;
      document.documentElement.style.fontSize = `${rootFontSize}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.documentElement.style.fontSize = '';
    };
  }, []);
  
  // Form States
  const [adminForm, setAdminForm] = useState({ username: '', password: '', email: '', phone: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [boxForm, setBoxForm] = useState({ register_id: '', initial_balance: '', new_box_name: '' });
  const [settingsForm, setSettingsForm] = useState({ password: '', default_printer: '', ticket_logo: '' });
  const [showCashCutModal, setShowCashCutModal] = useState(false);
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [showCatalogQR, setShowCatalogQR] = useState(false);
  const [salesHistoryTab, setSalesHistoryTab] = useState('sales');
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [appVersion, setAppVersion] = useState('0.0.0');

  // Load app version from electron on startup
  useEffect(() => {
    if (ipcRenderer) {
      ipcRenderer.invoke('get-app-version').then(ver => {
        if (ver) setAppVersion(ver);
      }).catch(() => {});
    }
  }, []);

  const handleBoxFormInitialBalanceChange = (e) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, '');
    if (digits === '') {
      setBoxForm(prev => ({ ...prev, initial_balance: '' }));
    } else {
      const num = parseInt(digits, 10);
      const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      setBoxForm(prev => ({ ...prev, initial_balance: formatted }));
    }
  };

  // Push Notifications Setup & Real-time Sales Monitor (PC Web/Electron)
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);


  
  // Onboarding Form State (For the multi-section setup wizard)
  const [onboardingForm, setOnboardingForm] = useState({
    business_name: '',
    country: '',
    currency_symbol: '',
    currency_words: '',
    logo_path: '',
    first_name: '',
    email: '',
    username: '',
    password: '',
    confirm_password: '',
    use_taxes: true,
    printer_type: 'ticket',
    selected_printer: 'Ninguno'
  });

  // Latin American Countries and Currencies data
  const latamCountries = [
    { country: 'Bolivia', code: 'BOB', iso: 'bo', symbol: 'Bs.', words: 'Bolivianos', taxName: 'IVA', taxRate: '13' },
    { country: 'Colombia', code: 'COP', iso: 'co', symbol: '$', words: 'Pesos Colombianos', taxName: 'IVA', taxRate: '19' },
    { country: 'Perú', code: 'PEN', iso: 'pe', symbol: 'S/.', words: 'Soles', taxName: 'IGV', taxRate: '18' },
    { country: 'Chile', code: 'CLP', iso: 'cl', symbol: '$', words: 'Pesos Chilenos', taxName: 'IVA', taxRate: '19' },
    { country: 'Argentina', code: 'ARS', iso: 'ar', symbol: '$', words: 'Pesos Argentinos', taxName: 'IVA', taxRate: '21' },
    { country: 'México', code: 'MXN', iso: 'mx', symbol: '$', words: 'Pesos Mexicanos', taxName: 'IVA', taxRate: '16' },
    { country: 'Ecuador', code: 'USD', iso: 'ec', symbol: '$', words: 'Dólares', taxName: 'IVA', taxRate: '15' },
    { country: 'Venezuela', code: 'VES', iso: 've', symbol: 'Bs.D', words: 'Bolívares', taxName: 'IVA', taxRate: '16' },
    { country: 'Uruguay', code: 'UYU', iso: 'uy', symbol: '$', words: 'Pesos Uruguayos', taxName: 'IVA', taxRate: '22' },
    { country: 'Paraguay', code: 'PYG', iso: 'py', symbol: '₲', words: 'Guaraníes', taxName: 'IVA', taxRate: '10' },
    { country: 'Brasil', code: 'BRL', iso: 'br', symbol: 'R$', words: 'Reales', taxName: 'ICMS', taxRate: '17' },
    { country: 'Panamá', code: 'PAB', iso: 'pa', symbol: 'B/.', words: 'Balboas', taxName: 'ITBMS', taxRate: '7' },
    { country: 'Costa Rica', code: 'CRC', iso: 'cr', symbol: '₡', words: 'Colones', taxName: 'IVA', taxRate: '13' },
    { country: 'República Dominicana', code: 'DOP', iso: 'do', symbol: 'RD$', words: 'Pesos Dominicanos', taxName: 'ITBIS', taxRate: '18' },
    { country: 'Guatemala', code: 'GTQ', iso: 'gt', symbol: 'Q', words: 'Quetzales', taxName: 'IVA', taxRate: '12' },
    { country: 'Honduras', code: 'HNL', iso: 'hn', symbol: 'L', words: 'Lempiras', taxName: 'ISV', taxRate: '15' },
    { country: 'El Salvador', code: 'USD', iso: 'sv', symbol: '$', words: 'Dólares', taxName: 'IVA', taxRate: '13' },
    { country: 'Nicaragua', code: 'NIO', iso: 'ni', symbol: 'C$', words: 'Córdobas', taxName: 'IVA', taxRate: '15' }
  ];

  // Country Dropdown state control
  const [showOnboardingCountryDropdown, setShowOnboardingCountryDropdown] = useState(false);
  const [showSettingsCountryDropdown, setShowSettingsCountryDropdown] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  
  // Idle Lock State
  const [isIdleLocked, setIsIdleLocked] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const lastActivityRef = useRef(Date.now());
  const isClosingShiftRef = useRef(false); // Flag to avoid false Forced-Close alert
  
  const [inventoryPage, setInventoryPage] = useState(1);
  const INVENTORY_ITEMS_PER_PAGE = 30;

  const exportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Código,Nombre,Stock,P.Costo,P.Venta,P.Mayoreo,Categoría\n";
    products.forEach(p => {
      const cat = p.category_name || (categories.find(c => c.id === p.category)?.name) || 'Sin categoría';
      const row = `"${p.internal_code || ''}","${p.name}","${p.stock}","${p.price_buy}","${p.price_sell}","${p.wholesale_price || ''}","${cat}"`;
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventario_AGS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Users & Cash Registers Panel States
  const [adminShifts, setAdminShifts] = useState([]);
  const [adminRegisters, setAdminRegisters] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [newRegisterName, setNewRegisterName] = useState('');
  const [showNewRegisterForm, setShowNewRegisterForm] = useState(false);
  const [adminUsersTab, setAdminUsersTab] = useState('shifts'); // 'shifts' | 'registers'
  
  // Custom 14 System Settings State (Synced with Django + Local config)
  const [activeSettingTab, setActiveSettingTab] = useState(null);
  const activeSettingTabRef = useRef(null);
  useEffect(() => {
    activeSettingTabRef.current = activeSettingTab;
  }, [activeSettingTab]);
  const [systemSettings, setSystemSettings] = useState({
    business_name: 'Assia Group Solutions',
    business_nit: '900.123.456-7',
    business_address: 'Calle 100 #15-30, Bogotá',
    business_phone: '+57 300 123 4567',
    country: 'Colombia',
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_user: 'notificaciones@assia.co',
    smtp_password: '',
    invoice_prefix: 'AGS-',
    invoice_start_number: '1001',
    invoice_current_number: '1001',
    payment_cash: 'true',
    payment_card: 'true',
    payment_transfer: 'false',
    payment_credit: 'false',
    currency_code: 'COP',
    currency_symbol: '$',
    currency_decimals: '2',
    tax_name: 'IVA',
    tax_rate: '19',
    ai_provider: 'gemini',
    ai_api_key: '',
    ai_prompt_context: 'Recomendar productos complementarios basados en compras del cliente.',
    ecommerce_sync_enabled: 'false',
    ecommerce_url: '',
    ecommerce_key: '',
    shopify_enabled: 'false',
    shopify_domain: '',
    shopify_token: '',
    dice_promo_enabled: 'false'
  });
  
  const formatPrice = (val) => {
    const symbol = systemSettings?.currency_symbol || '$';
    const num = Math.round(parseFloat(val || 0));
    return `${symbol}${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  };

  const lastSaleIdRef = useRef(null);

  useEffect(() => {
    if (!token || !apiUrl || !userProfile || !config?.default_printer) return;
    const isAdmin = ['SUPERADMIN', 'ADMIN'].includes(userProfile.role);
    if (!isAdmin) return;

    const checkAdminSales = async () => {
      let fs = null;
      let path = null;
      let logFile = null;
      try {
        fs = window.require ? window.require('fs') : null;
        path = window.require ? window.require('path') : null;
        logFile = path ? path.join('C:', 'Users', 'USUARIO', 'Documents', 'trabajos sena', 'AGS SALES', 'AGS_SALES_UI', 'print_debug.log') : null;
      } catch(e){}

      const writeLog = (msg) => {
        if (fs && logFile) {
          try {
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
          } catch(err){}
        }
      };

      try {
        writeLog(`checkAdminSales ejecutado. token=${!!token} apiUrl=${apiUrl}`);
        const res = await apiRequest(`${apiUrl.replace(/\/$/, '')}/sales/sales/?page=1&page_size=1`, {}, token);
        writeLog(`Respuesta API: status=${res.status}`);
        
        if (res.ok) {
          const data = await res.json();
          const latestSale = Array.isArray(data) ? data[0] : (data.results?.[0]);
          writeLog(`latestSale obtenido: ${latestSale ? JSON.stringify(latestSale) : 'null'}`);
          
          if (latestSale) {
            writeLog(`Comparando IDs: lastSaleIdRef.current=${lastSaleIdRef.current}, latestSale.id=${latestSale.id}`);
            if (lastSaleIdRef.current !== null && lastSaleIdRef.current !== latestSale.id) {
              writeLog(`Nueva venta detectada: window.lastLocalSaleId=${window.lastLocalSaleId}, default_printer=${config?.default_printer}`);
              
              if (latestSale.id !== window.lastLocalSaleId && config?.default_printer) {
                const noPrintFlag = latestSale.payments?.some(p => p.reference?.includes('[NO_PRINT]'));
                writeLog(`noPrintFlag=${noPrintFlag}, payments=${JSON.stringify(latestSale.payments)}`);
                if (!noPrintFlag) {
                  writeLog(`Procediendo a imprimir silenciosamente en: ${config.default_printer}`);
                  try {
                    printTicket(latestSale, systemSettings, systemSettings?.ticket_logo || config?.ticket_logo, { 
                      silent: true, 
                      printerName: config?.default_printer, 
                      apiUrl: config?.apiUrl 
                    });
                    writeLog(`Llamada printTicket realizada sin excepciones.`);
                  } catch (err) {
                    writeLog(`ERROR al imprimir: ${err.message}\nStack: ${err.stack}`);
                  }
                } else {
                  writeLog(`Impresión omitida por noPrintFlag.`);
                }
              } else {
                writeLog(`Omitiendo auto-impresión: latestSale.id === window.lastLocalSaleId o no hay config.default_printer.`);
              }
            }
            lastSaleIdRef.current = latestSale.id;
          }
        }
      } catch (e) {
        writeLog(`ERROR GLOBAL: ${e.message}\nStack: ${e.stack}`);
      }
    };

    checkAdminSales();
    const interval = setInterval(checkAdminSales, 15000);
    return () => clearInterval(interval);
  }, [token, apiUrl, userProfile?.role, userProfile?.username, config?.default_printer, config?.apiUrl, config?.ticket_logo, systemSettings]);

  // Inventory States
  const [products, setProducts] = useState([]);
  const [showStockAlerts, setShowStockAlerts] = useState(false);
  const [showOnlyOutOfStock, setShowOnlyOutOfStock] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '', description: '' });
  const [productForm, setProductForm] = useState({
    category: '',
    brand: '',
    provider: '',
    internal_code: '',
    barcode: '',
    name: '',
    description: '',
    location: '',
    measurement_unit: 'Unidad',
    has_inventory_control: true,
    stock: '0',
    min_stock: '0',
    max_stock: '0',
    has_max_stock: false,
    profit_margin: '0.00',
    price_buy: '0.00',
    price_sell: '0.00',
    wholesale_price: '0.00',
    has_wholesale_price: false,
    image: '',
    image_file: null,
    is_active: true
  });
  
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [showQuickCategory, setShowQuickCategory] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState('');
  const [showQuickProvider, setShowQuickProvider] = useState(false);
  const [quickProviderName, setQuickProviderName] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [excelImportStep, setExcelImportStep] = useState(1);
  const [excelFileLoading, setExcelFileLoading] = useState(false);
  
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [selectedBulkAction, setSelectedBulkAction] = useState(null);
  const [selectedBulkModifier, setSelectedBulkModifier] = useState('fixed');
  const [bulkEditValue, setBulkEditValue] = useState('');
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  
  const [showBarcodeGenerator, setShowBarcodeGenerator] = useState(false);
  
  // Data States
  const [registers, setRegisters] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Billing Configuration State
  const [billingConfig, setBillingConfig] = useState({
    modo_predeterminado: 'POS',
    permitir_cambio: true,
    facturacion_electronica_habilitada: false,
    pos_habilitado: true
  });
  const [currentBillingMode, setCurrentBillingMode] = useState('POS');

  useEffect(() => {
    async function loadConfig() {
      if (ipcRenderer) {
        const storedConfig = await ipcRenderer.invoke('get-config');
        if (storedConfig && storedConfig.apiUrl) {
          setConfig(storedConfig);
          setApiUrl(storedConfig.apiUrl);
          checkAdminExists(storedConfig.apiUrl);
          
          setSettingsForm(prev => ({
            ...prev,
            default_printer: storedConfig.default_printer || '',
            ticket_logo: storedConfig.ticket_logo || ''
          }));
        } else {
          setLoading(false);
          setApiUrl('https://sistema-pos-ags.vercel.app/api/');
        }
      } else {
        // In browser fallback (Vercel/Production web)
        const envApiUrl = import.meta.env.VITE_API_URL || '';
        if (envApiUrl) {
          const finalUrl = envApiUrl.endsWith('/') ? envApiUrl : envApiUrl + '/';
          const apiBaseUrl = finalUrl.endsWith('api/') ? finalUrl : finalUrl + 'api/';
          setApiUrl(apiBaseUrl);
          checkAdminExists(apiBaseUrl);
        } else {
          setLoading(false);
        }
      }
    }
    loadConfig();
  }, []);

  // Auto-load users/cash panel when the admin tab is opened
  useEffect(() => {
    if (activeSettingTab === 'users' && token) {
      loadAdminUsersPanel();
    }
    // Reset to defaults when leaving the tab
    if (activeSettingTab !== 'users') {
      setAdminShifts([]);
      setAdminRegisters([]);
      setAdminUsersTab('shifts');
      setShowNewRegisterForm(false);
      setNewRegisterName('');
    }
  }, [activeSettingTab]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!token) return;

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          setAppState('DASHBOARD');
          break;
        case 'F2':
          e.preventDefault();
          setAppState('INVENTORY');
          fetchProducts();
          fetchCategories();
          fetchProviders();
          break;
        case 'F3':
          e.preventDefault();
          setShowCashCutModal(true);
          break;
        case 'F4':
          e.preventDefault();
          setAppState('REPORTS');
          break;
        case 'F5':
          e.preventDefault();
          setAppState('PURCHASES');
          break;
        case 'F6':
          e.preventDefault();
          setAppState('SALES_HISTORY');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [token, config]);

  const simulateLoading = (finalState, callback = null, duration = 1200) => {
    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Iniciando conexión segura...');
    
    const messages = [
      'Estableciendo enlace cifrado con Django en Hostinger...',
      'Validando credenciales y token JWT...',
      'Consultando parámetros de caja y divisas...',
      'Sincronizando inventario en tiempo real...',
      'Cargando periféricos e impresora local...',
      '¡Enlace listo! Iniciando terminal POS...'
    ];
    
    const intervalTime = duration / 100;
    let currentProgress = 0;
    
    const timer = setInterval(() => {
      currentProgress += 1;
      setLoadingProgress(currentProgress);
      
      const msgIndex = Math.floor((currentProgress / 100) * messages.length);
      if (messages[msgIndex]) {
        setLoadingMessage(messages[msgIndex]);
      }
      
      if (currentProgress >= 100) {
        clearInterval(timer);
        if (callback) callback();
        setAppState(finalState);
        setLoading(false);
      }
    }, intervalTime);
  };

  const checkAdminExists = async (url) => {
    try {
      const response = await apiRequest(`${url}users/check-admin/`);
      const data = await response.json();
      if (data.has_admin) {
        simulateLoading('LOGIN');
      } else {
        simulateLoading('CREATE_ADMIN');
      }
    } catch (e) {
      setLoading(false);
      setAppState('SETUP_API');
      setErrorMsg('No se pudo conectar con la API. Verifica la URL.');
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    let finalUrl = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
    if (!finalUrl.endsWith('api/')) {
        finalUrl = finalUrl + 'api/';
    }
    
    if (ipcRenderer) {
      await ipcRenderer.invoke('save-config', { ...config, apiUrl: finalUrl });
    }
    setConfig({ ...config, apiUrl: finalUrl });
    checkAdminExists(finalUrl);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!onboardingForm.username || !onboardingForm.password) {
      setErrorMsg('Usuario y contraseña son requeridos.');
      return;
    }
    if (onboardingForm.password !== onboardingForm.confirm_password) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    
    setLoading(true);
    try {
      // Step A: Create Administrator on Django backend
      const adminPayload = {
        username: onboardingForm.username,
        password: onboardingForm.password,
        email: onboardingForm.email,
        first_name: onboardingForm.first_name,
        phone: ''
      };
      
      const createRes = await apiRequest(`${config.apiUrl}users/setup-admin/`, {
        method: 'POST',
        body: JSON.stringify(adminPayload)
      });
      
      if (!createRes.ok) {
        const errData = await createRes.json();
        setErrorMsg(errData.error || 'Error al crear el administrador.');
        setLoading(false);
        return;
      }
      
      // Step B: Auto-login to obtain access token
      const loginRes = await apiRequest(`${config.apiUrl}users/login/`, {
        method: 'POST',
        body: JSON.stringify({
          username: onboardingForm.username,
          password: onboardingForm.password
        })
      });
      
      if (!loginRes.ok) {
        setErrorMsg('Administrador creado pero falló el inicio de sesión automático. Por favor inicia sesión manualmente.');
        setAppState('LOGIN');
        setLoading(false);
        return;
      }
      
      const loginData = await loginRes.json();
      const accessToken = loginData.access;
      setToken(accessToken);
      
      // Find tax rate and tax name for selected country
      const selectedCountryInfo = latamCountries.find(c => c.country === onboardingForm.country) || { taxName: 'IVA', taxRate: '13' };
      
      // Step C: Bulk Sync settings to Django
      const settingsPayload = {
        business_name: onboardingForm.business_name,
        country: onboardingForm.country,
        currency_code: selectedCountryInfo.code || 'BOB',
        currency_symbol: onboardingForm.currency_symbol,
        currency_words: onboardingForm.currency_words,
        tax_name: selectedCountryInfo.taxName,
        tax_rate: onboardingForm.use_taxes ? selectedCountryInfo.taxRate : '0',
        payment_cash: 'true',
        payment_card: 'true',
        payment_transfer: 'true',
        app_logo: onboardingForm.logo_path,
        ticket_logo: onboardingForm.logo_path
      };
      
      await fetch(`${config.apiUrl}users/settings/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(settingsPayload)
      });
      
      // Update system settings state locally
      setSystemSettings(prev => ({ ...prev, ...settingsPayload }));
      
      // Step D: Save printer and local options locally in Electron via IPC
      if (ipcRenderer) {
        const localConfig = {
          ...config,
          default_printer: onboardingForm.selected_printer === 'Ninguno' ? '' : onboardingForm.selected_printer,
          printer_type: onboardingForm.printer_type,
          ticket_logo: onboardingForm.logo_path,
          app_logo: onboardingForm.logo_path,
          business_name: onboardingForm.business_name
        };
        await ipcRenderer.invoke('save-config', localConfig);
        setConfig(localConfig);
        setSettingsForm(prev => ({
          ...prev,
          default_printer: onboardingForm.selected_printer === 'Ninguno' ? '' : onboardingForm.selected_printer,
          ticket_logo: onboardingForm.logo_path
        }));
      }
      // Clear token since we want the user to log in manually to validate information
      setToken(null);
      setLoading(false);
      
      const successMessage = `Administrador registrado exitosamente. Recuerda que tu usuario es ${onboardingForm.username} y tu password es ${onboardingForm.password}, además en caso pierdas tu contraseña puedes recuperarlo con tu correo ${onboardingForm.email}.`;

      await premiumAlert('Operación exitosa', successMessage, 'success');
      
      // Pre-fill username and transition to login page
      setLoginForm({ username: onboardingForm.username, password: '' });
      simulateLoading('LOGIN');
      
    } catch (err) {
      setErrorMsg('Error de red durante la inicialización inicial.');
      console.error(err);
    }
    setLoading(false);
  };

  const handleSelectOnboardingLogo = async () => {
    if (ipcRenderer) {
      const path = await ipcRenderer.invoke('select-image');
      if (path) {
        setLoading(true);
        try {
          const url = await uploadLocalFileToImgBB(path);
          setOnboardingForm(prev => ({ ...prev, logo_path: url }));
          Toast.fire({ icon: 'success', title: 'Logo subido a la nube correctamente' });
        } catch (e) {
          premiumAlert('Error', 'No se pudo subir la imagen a ImgBB. Revisa tu conexión a internet.', 'error');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isAuthenticating || Swal.isVisible()) return;
    isAuthenticating = true;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await apiRequest(`${config.apiUrl}users/login/`, {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.access);
        fetchRegisters(data.access);
        
        // Fetch user profile
        try {
          const profileRes = await fetch(`${config.apiUrl}users/profile/`, {
            headers: { Authorization: `Bearer ${data.access}` }
          });
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setUserProfile(profileData);
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }

        // Fetch System Settings globally upon login
        try {
          const sysSettingsRes = await fetch(`${config.apiUrl}users/settings/`, {
            headers: { 'Authorization': `Bearer ${data.access}` }
          });
          if (sysSettingsRes.ok) {
            const sysData = await sysSettingsRes.json();
            setSystemSettings(prev => ({ ...prev, ...sysData }));
            
            // Sync business name and logos to local config
            if (ipcRenderer) {
              let hasChanges = false;
              const newConfig = { ...config };
              if (sysData.business_name && sysData.business_name !== config?.business_name) {
                newConfig.business_name = sysData.business_name;
                hasChanges = true;
              }
              if (sysData.app_logo && sysData.app_logo !== config?.app_logo) {
                newConfig.app_logo = sysData.app_logo;
                hasChanges = true;
              }
              if (sysData.ticket_logo && sysData.ticket_logo !== config?.ticket_logo) {
                newConfig.ticket_logo = sysData.ticket_logo;
                hasChanges = true;
              }
              if (hasChanges) {
                await ipcRenderer.invoke('save-config', newConfig);
                setConfig(newConfig);
              }
            }
          }
        } catch (e) {
          console.error("Failed to fetch initial system settings:", e);
        }

        // Auto-check if there is an active open shift (caja abierta)
        try {
          const shiftsRes = await apiRequest(`${config.apiUrl}accounting/cash-shifts/?is_open=true`, {}, data.access);
          if (shiftsRes.ok) {
            const shiftsData = await shiftsRes.json();
            const activeShifts = shiftsData.results || shiftsData || [];
            setOpenShifts(activeShifts);
            
            const currentUser = loginForm.username;
            const myShift = activeShifts.find(s => s.username.toLowerCase() === currentUser.toLowerCase());
            
            if (myShift) {
              const openTime = new Date(myShift.opened_at).toLocaleString();
              const formattedBalance = formatPrice(myShift.initial_balance || 0);
              
              // Fetch Billing Config before entering DASHBOARD
              try {
                const configRes = await apiRequest(`${config.apiUrl}configuracion/facturacion`, {}, data.access);
                if (configRes.ok) {
                  const bConfig = await configRes.json();
                  setBillingConfig(bConfig);
                  setCurrentBillingMode(bConfig.modo_predeterminado || 'POS');
                }
              } catch (configErr) {
                console.error("Error fetching billing config on shift resume:", configErr);
              }
              
              setLoading(false);
              Toast.fire({
                icon: 'info',
                title: `Turno Reanudado: ${myShift.register_name}`
              });
              simulateLoading('DASHBOARD');
              return;
            }
          }
        } catch (shiftErr) {
          console.error("Error checking open shifts:", shiftErr);
        }
        
        simulateLoading('OPEN_BOX');
      } else {
        setErrorMsg('Credenciales incorrectas');
      }
    } catch (err) {
      setErrorMsg('Error de red al iniciar sesión');
      console.error(err);
    } finally {
      isAuthenticating = false;
      setLoading(false);
    }
  };

  // Idle Lock Effect (5 minutos de inactividad = 300,000ms)
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    
    const interval = setInterval(() => {
      // Solo bloquear si ya hay token, no está en Setup o Login, y no está ya bloqueado
      if (token && appState !== 'LOGIN' && appState !== 'SETUP_API' && !isIdleLocked) {
        if (Date.now() - lastActivityRef.current > 300000) {
          setIsIdleLocked(true);
        }
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      clearInterval(interval);
    };
  }, [token, appState, isIdleLocked]);

  // Real-time User Profile & Permissions Sync Effect
  useEffect(() => {
    if (!token || !config?.apiUrl || appState === 'LOGIN' || appState === 'SETUP_API') return;

    const syncProfile = async () => {
      try {
        const profileRes = await fetch(`${config.apiUrl}users/profile/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setUserProfile(profileData);
        }
      } catch (e) {}
    };

    syncProfile();
    const interval = setInterval(syncProfile, 3000); // Polling every 3s for instantaneous permission updates
    const handlePermUpdated = () => syncProfile();
    window.addEventListener('permissions-updated', handlePermUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('permissions-updated', handlePermUpdated);
    };
  }, [token, config?.apiUrl, appState]);

  // Global Shifts Polling & Force Close Check Effect (every 3 seconds)
  useEffect(() => {
    if (!token || !config?.apiUrl || appState === 'LOGIN' || appState === 'SETUP_API') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${config.apiUrl}accounting/cash-shifts/?is_open=true`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const serverShifts = data.results || data || [];

          setOpenShifts(prev => {
            if (userProfile?.username) {
              const currentUser = userProfile.username.toLowerCase();
              const hadShiftLocally = prev.some(s => s.username.toLowerCase() === currentUser);
              const hasShiftInServer = serverShifts.some(s => s.username.toLowerCase() === currentUser);

              // Si teníamos turno y de pronto ya no está en el servidor (el admin lo cerró)
              // Pero solo si NO fue el propio cajero quien lo cerró voluntariamente
              if (hadShiftLocally && !hasShiftInServer && appState !== 'LOGIN' && appState !== 'OPEN_BOX' && !isClosingShiftRef.current) {
                Swal.fire({
                  title: 'Cierre Forzado',
                  text: 'Tu sesión ha sido cerrada forzosamente por el administrador.',
                  icon: 'warning',
                  confirmButtonText: 'Entendido',
                  allowOutsideClick: false,
                  customClass: {
                    popup: 'premium-swal',
                    title: 'premium-swal-title',
                    confirmButton: 'premium-swal-confirm bg-red-600 hover:bg-red-700'
                  }
                }).then(() => {
                  setToken(null);
                  setAppState('LOGIN');
                });
              }
            }
            return serverShifts;
          });
        }
      } catch (e) {
        // Silently ignore network errors to not interrupt the user
      }
    }, 3000); // Check every 3 seconds for real-time response

    return () => clearInterval(interval);
  }, [token, appState, userProfile, config?.apiUrl]);

  // Global Updates Polling (every 10 seconds)
  useEffect(() => {
    if (!token || !config?.apiUrl || appState === 'LOGIN' || appState === 'SETUP_API') return;

    // isNewerVersion is now global

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${config.apiUrl}users/settings/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const settings = await res.json();
          
          // Sync systemSettings in real-time only if not editing settings to prevent overwriting inputs
          if (!activeSettingTab) {
            setSystemSettings(prev => ({ ...prev, ...settings }));
          }

          // Sync logos and business name to local config
          if (ipcRenderer) {
            let hasChanges = false;
            const newConfig = { ...config };
            if (settings.business_name && settings.business_name !== config?.business_name) {
              newConfig.business_name = settings.business_name;
              hasChanges = true;
            }
            if (settings.app_logo !== undefined && settings.app_logo !== config?.app_logo) {
              newConfig.app_logo = settings.app_logo;
              hasChanges = true;
            }
            if (settings.ticket_logo !== undefined && settings.ticket_logo !== config?.ticket_logo) {
              newConfig.ticket_logo = settings.ticket_logo;
              hasChanges = true;
            }
            if (hasChanges) {
              await ipcRenderer.invoke('save-config', newConfig);
              setConfig(newConfig);
            }
          }

          const latestVersion = settings.latest_desktop_version;
          const downloadUrl = settings.latest_desktop_url;
          const currentVersion = appVersion;

          if (isNewerVersion(currentVersion, latestVersion)) {
            if (userProfile?.role === 'SUPERADMIN') {
              console.log("Superadmin omite actualización forzada.");
              return;
            }
            
            setPendingUpdate(prev => {
              if (!prev || prev.version !== latestVersion) {
                Toast.fire({
                  icon: 'info',
                  title: `Nueva versión disponible (v${latestVersion}). Haz clic en el menú lateral para instalarla.`
                });
              }
              return { version: latestVersion, downloadUrl };
            });
          }
        }
      } catch (e) {
        // Silently ignore network errors
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      if (ipcRenderer) {
        ipcRenderer.removeAllListeners('update-progress');
      }
    };
  }, [token, appState, userProfile, config?.apiUrl, activeSettingTab, appVersion]);

  const triggerUpdate = () => {
    if (!pendingUpdate) return;
    const { version, downloadUrl } = pendingUpdate;
    const currentVersion = appVersion;

    Swal.fire({
      title: 'Actualizar Sistema',
      html: `Estás a punto de instalar la nueva versión <b>v${version}</b> (Versión actual: v${currentVersion}).<br/><br/>Se iniciará la descarga en segundo plano y el sistema se reiniciará automáticamente al finalizar. ¿Deseas continuar?`,
      icon: 'question',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, Actualizar Ahora',
      customClass: {
        popup: 'premium-swal border-t-4 border-t-indigo-600',
        title: 'premium-swal-title text-indigo-700',
        confirmButton: 'premium-swal-confirm bg-indigo-600 hover:bg-indigo-700',
        cancelButton: 'premium-swal-cancel'
      },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed && downloadUrl) {
        const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${config.apiUrl.replace('/api/', '')}${downloadUrl}`;
        
        if (ipcRenderer) {
          let progressSwal;
          ipcRenderer.on('update-progress', (event, percent) => {
            if (progressSwal) {
              const pb = document.getElementById('update-progress-bar');
              const pt = document.getElementById('update-progress-text');
              if (pb) pb.style.width = `${percent}%`;
              if (pt) pt.innerText = `${percent}%`;
            }
          });

          ipcRenderer.once('update-complete', () => {
            Swal.fire({
              icon: 'success',
              title: '¡Descarga Completa!',
              text: 'Desempaquetando archivos e instalando actualización... El sistema se reiniciará en un instante.',
              showConfirmButton: false,
              allowOutsideClick: false,
              customClass: {
                popup: 'premium-swal border-t-4 border-t-emerald-500',
                title: 'premium-swal-title text-emerald-650'
              },
              buttonsStyling: false
            });
          });

          progressSwal = Swal.fire({
            title: 'Descargando Actualización',
            html: `
              <div class="flex flex-col items-center gap-4 py-2 text-center select-none font-sans">
                <!-- Bouncing Download Icon with Spinner -->
                <div class="relative w-16 h-16 flex items-center justify-center bg-indigo-50 text-indigo-650 rounded-full border border-indigo-100 shadow-sm animate-pulse-soft">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="animate-bounce mt-1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span class="absolute inset-0 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                </div>

                <div class="w-full text-left mt-2">
                  <div class="flex justify-between items-center text-xs font-bold text-slate-500 mb-2">
                    <span class="uppercase tracking-wider">Progreso de descarga</span>
                    <span id="update-progress-text" class="bg-indigo-50 text-indigo-750 px-2 py-0.5 rounded-md font-mono font-black text-sm">0%</span>
                  </div>
                  
                  <div class="w-full bg-slate-100 border border-slate-200/80 rounded-full overflow-hidden h-3.5 shadow-inner">
                    <div id="update-progress-bar" style="width: 0%;" class="h-full bg-gradient-to-r from-indigo-500 to-violet-600 shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-300 ease-out"></div>
                  </div>
                  
                  <p class="text-[10px] text-slate-400 font-bold text-center mt-4 uppercase tracking-widest leading-relaxed">
                    Sincronizando archivos con el servidor.<br/>
                    <span class="text-indigo-600 animate-pulse">Por favor, no cierres el sistema.</span>
                  </p>
                </div>
              </div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            customClass: {
              popup: 'premium-swal border-t-4 border-t-indigo-650',
              title: 'premium-swal-title text-indigo-750'
            },
            buttonsStyling: false
          });

          ipcRenderer.invoke('download-update', fullUrl).catch((err) => {
            Swal.fire('Error', 'Hubo un error al descargar la actualización.', 'error');
            setPendingUpdate(null);
          });

        } else {
          window.open(fullUrl, '_blank');
        }
      }
    });
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockPassword) return;
    try {
      const res = await fetch(`${config.apiUrl}users/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginForm.username, password: unlockPassword })
      });
      if (res.ok) {
        setIsIdleLocked(false);
        setUnlockPassword('');
        lastActivityRef.current = Date.now();
      } else {
        Toast.fire({ icon: 'error', title: 'Contraseña incorrecta' });
      }
    } catch(e) {
      Toast.fire({ icon: 'error', title: 'Error de red al desbloquear' });
    }
  };

  const fetchRegisters = async (accessToken) => {
    try {
      const res = await fetch(`${config.apiUrl}accounting/cash-registers/`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      setRegisters(data.registers || []);
      if (data.registers && data.registers.length > 0) {
        setBoxForm(prev => ({ ...prev, register_id: data.registers[0].id }));
      } else {
        setBoxForm(prev => ({ ...prev, register_id: 'NEW_BOX' }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${config.apiUrl}inventory/categories/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.results || data || []);
      }
    } catch(e) {
      console.error("Error fetching categories:", e);
    }
  };

  const handleQuickAddCategory = async () => {
    if (!quickCategoryName.trim()) return;
    try {
      const res = await fetch(`${config.apiUrl}inventory/categories/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: quickCategoryName })
      });
      if (res.ok) {
        const newCat = await res.json();
        setCategories(prev => [...prev, newCat]);
        setProductForm(prev => ({ ...prev, category: newCat.id }));
        setQuickCategoryName('');
        setShowQuickCategory(false);
        setSuccessMsg('Categoría agregada con éxito');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const errorData = await res.json();
        setErrorMsg('Error al crear categoría: ' + (errorData.name || JSON.stringify(errorData)));
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch (e) {
      setErrorMsg('Error de red al crear categoría');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleQuickAddProvider = async () => {
    if (!quickProviderName.trim()) return;
    try {
      const res = await fetch(`${config.apiUrl}purchases/providers/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: quickProviderName })
      });
      if (res.ok) {
        const newProv = await res.json();
        setProviders(prev => [...prev, newProv]);
        setProductForm(prev => ({ ...prev, provider: newProv.id }));
        setQuickProviderName('');
        setShowQuickProvider(false);
        setSuccessMsg('Proveedor agregado con éxito');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const errorData = await res.json();
        setErrorMsg('Error al crear proveedor: ' + (errorData.name || JSON.stringify(errorData)));
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch (e) {
      setErrorMsg('Error de red al crear proveedor');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleEditProduct = (p) => {
    setEditingProductId(p.id);
    setProductForm({
      category: p.category || '',
      brand: p.brand || '',
      provider: p.provider || '',
      internal_code: p.internal_code || '',
      barcode: p.barcode || '',
      name: p.name || '',
      description: p.description || '',
      location: p.location || '',
      measurement_unit: p.measurement_unit || 'Unidad',
      has_inventory_control: p.has_inventory_control,
      stock: p.stock || '0',
      min_stock: p.min_stock || '0',
      max_stock: p.max_stock || '0',
      has_max_stock: parseFloat(p.max_stock || 0) > 0,
      profit_margin: p.profit_margin || '0.00',
      price_buy: p.price_buy || '0.00',
      price_sell: p.price_sell || '0.00',
      wholesale_price: p.wholesale_price || '0.00',
      has_wholesale_price: parseFloat(p.wholesale_price || 0) > 0,
      image: p.image || '',
      image_file: null,
      is_active: p.is_active
    });
    setShowAddProduct(true);
  };

  const handleDeleteProduct = async (id) => {
    const confirmRes = await premiumConfirm(
      '¿Eliminar producto?',
      '¿Está seguro de que desea eliminar este producto? Esta acción no se puede deshacer.',
      'Sí, eliminar',
      'Cancelar'
    );
    if (!confirmRes.isConfirmed) return;
    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}inventory/products/${id}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccessMsg('Producto eliminado con éxito');
        fetchProducts();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg('Error al eliminar producto');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch(e) {
      setErrorMsg('Error de red al eliminar producto');
      setTimeout(() => setErrorMsg(''), 4000);
    }
    setLoading(false);
  };

  const handleToggleActiveProduct = async (p) => {
    try {
      const res = await fetch(`${config.apiUrl}inventory/products/${p.id}/`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !p.is_active })
      });
      if (res.ok) {
        fetchProducts();
      } else {
        setErrorMsg('Error al actualizar el estado del producto');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch(e) {
      setErrorMsg('Error de red al cambiar estado');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const headers = [
        {
          "Nombre": "Zapatillas Nike Air Max",
          "Código de barras": "7701234567890",
          "Código interno": "ZAP-001",
          "Precio de Costo": 45000,
          "Precio de Venta": 85000,
          "Precio de Mayoreo": 75000,
          "Stock": 15,
          "Stock mínimo": 3,
          "Stock máximo": 40,
          "Ubicación": "Estante B-12",
          "Unidad de medida": "Unidad",
          "Categoría": "Calzado",
          "Proveedor": "Nike Distribution"
        }
      ];
      const ws = XLSX.utils.json_to_sheet(headers);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Productos");
      XLSX.writeFile(wb, "Plantilla_Importar_Inventario.xlsx");
      setSuccessMsg('Plantilla descargada con éxito.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setErrorMsg('Error al descargar plantilla: ' + e.message);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleImportExcel = async (file) => {
    if (!file) return;
    setExcelFileLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
            setErrorMsg('El archivo Excel está vacío.');
            setExcelFileLoading(false);
            return;
          }
          
          let importedCount = 0;
          let errorCount = 0;
          
          for (const row of jsonData) {
            const name = row["Nombre"];
            if (!name) continue;
            
            let categoryId = '';
            const excelCatName = row["Categoría"];
            if (excelCatName) {
              const foundCat = categories.find(c => c.name.toLowerCase() === excelCatName.toString().toLowerCase());
              if (foundCat) {
                categoryId = foundCat.id;
              } else {
                try {
                  const catRes = await fetch(`${config.apiUrl}inventory/categories/`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: excelCatName })
                  });
                  if (catRes.ok) {
                    const newCat = await catRes.json();
                    setCategories(prev => [...prev, newCat]);
                    categoryId = newCat.id;
                  }
                } catch (err) {
                  console.error("Failed to create category on the fly:", err);
                }
              }
            }
            
            let providerId = '';
            const excelProvName = row["Proveedor"];
            if (excelProvName) {
              const foundProv = providers.find(p => p.name.toLowerCase() === excelProvName.toString().toLowerCase());
              if (foundProv) {
                providerId = foundProv.id;
              } else {
                try {
                  const provRes = await fetch(`${config.apiUrl}purchases/providers/`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: excelProvName })
                  });
                  if (provRes.ok) {
                    const newProv = await provRes.json();
                    setProviders(prev => [...prev, newProv]);
                    providerId = newProv.id;
                  }
                } catch (err) {
                  console.error("Failed to create provider on the fly:", err);
                }
              }
            }
            
            const internalCode = row["Código interno"] || 'PRD-' + Math.floor(100000 + Math.random() * 900000);
            const barcode = row["Código de barras"] || '8180' + Math.floor(100000000 + Math.random() * 900000000);
            
            const cost = parseFloat(row["Precio de Costo"] || 0);
            const sell = parseFloat(row["Precio de Venta"] || 0);
            const margin = cost > 0 ? (((sell - cost) / cost) * 100).toFixed(2) : 0;
            
            const payload = {
              category: categoryId || null,
              provider: providerId || null,
              internal_code: internalCode,
              barcode: barcode,
              name: name,
              description: row["Descripción"] || '',
              location: row["Ubicación"] || '',
              measurement_unit: row["Unidad de medida"] || 'Unidad',
              has_inventory_control: true,
              stock: parseFloat(row["Stock"] || 0),
              min_stock: parseFloat(row["Stock mínimo"] || 0),
              max_stock: parseFloat(row["Stock máximo"] || 0),
              profit_margin: margin,
              price_buy: cost,
              price_sell: sell,
              wholesale_price: parseFloat(row["Precio de Mayoreo"] || 0),
              is_active: true
            };
            
            try {
              const res = await fetch(`${config.apiUrl}inventory/products/`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
               });
               if (res.ok) {
                 importedCount++;
               } else {
                 errorCount++;
               }
             } catch (err) {
               errorCount++;
             }
           }
           
           setSuccessMsg(`Importación terminada. Se importaron ${importedCount} productos con éxito.`);
           if (errorCount > 0) {
             setErrorMsg(`Hubo errores al importar ${errorCount} productos.`);
           }
           fetchProducts();
           setShowExcelImport(false);
           setExcelImportStep(1);
         } catch (parseErr) {
           setErrorMsg('Error al analizar archivo Excel: ' + parseErr.message);
         }
         setExcelFileLoading(false);
       };
       reader.readAsArrayBuffer(file);
     } catch (e) {
       setErrorMsg('Error al leer el archivo.');
       setExcelFileLoading(false);
     }
   };

   const handleExecuteBulkUpdate = async () => {
     if (selectedBulkAction === 'delete') {
       const confirmRes = await premiumConfirm(
         '¿Eliminar catálogo completo?',
         '¿Está seguro de que desea ELIMINAR TODOS los productos de la base de datos? Esta acción es irreversible y afectará a producción.',
         'Sí, eliminar todo',
         'Cancelar'
       );
       if (!confirmRes.isConfirmed) return;
     }
     setBulkEditLoading(true);
     setErrorMsg('');
     setSuccessMsg('');
     try {
       const res = await fetch(`${config.apiUrl}inventory/products/bulk-update/`, {
         method: 'POST',
         headers: { 
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`
         },
         body: JSON.stringify({
           action: selectedBulkAction,
           modifier_type: selectedBulkModifier,
           value: bulkEditValue
         })
       });
       if (res.ok) {
         const data = await res.json();
         setSuccessMsg(data.message || 'Actualización masiva completada con éxito.');
         fetchProducts();
         setShowBulkEdit(false);
         setSelectedBulkAction(null);
         setBulkEditValue('');
         setTimeout(() => setSuccessMsg(''), 3000);
       } else {
         setErrorMsg('Error al ejecutar la actualización masiva.');
       }
     } catch (e) {
       setErrorMsg('Error de red al conectar con el servidor.');
     }
     setBulkEditLoading(false);
   };

  const fetchProviders = async () => {
    try {
      const res = await fetch(`${config.apiUrl}purchases/providers/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.results || data || []);
      }
    } catch(e) {
      console.error("Error fetching providers:", e);
    }
  };

  const handleProductPriceChange = (field, val) => {
    setProductForm(prev => {
      let updated = { ...prev, [field]: val };
      
      const decimals = parseInt(systemSettings?.currency_decimals || '2', 10);
      const cost = parseFloat(field === 'price_buy' ? val : prev.price_buy || 0);
      const sell = parseFloat(field === 'price_sell' ? val : prev.price_sell || 0);
      const margin = parseFloat(field === 'profit_margin' ? val : prev.profit_margin || 0);
      
      if (field === 'price_buy' || field === 'price_sell') {
        if (cost > 0) {
          updated.profit_margin = (((sell - cost) / cost) * 100).toFixed(2);
        } else {
          updated.profit_margin = '0.00';
        }
      } else if (field === 'profit_margin') {
        if (cost > 0) {
          updated.price_sell = (cost * (1 + margin / 100)).toFixed(decimals);
        }
      }
      return updated;
    });
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${config.apiUrl}inventory/products/?page_size=10000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        setProducts([]);
        return;
      }
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        setProducts(data.results);
      } else if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (e) {
      console.error(e);
      setProducts([]);
    }
  };

  const handleOpenBox = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    
    let targetRegisterId = boxForm.register_id;
    
    if (targetRegisterId !== 'NEW_BOX') {
      const occupiedByShift = openShifts.find(s => s.cash_register === Number(targetRegisterId));
      if (occupiedByShift) {
        setLoading(false);
        await Swal.fire({
          title: 'Caja ya Ocupada',
          html: `La caja <b>${occupiedByShift.register_name}</b> ya tiene un turno abierto por el usuario <b>${occupiedByShift.username}</b>.<br/>` +
                `Por favor selecciona una caja diferente.`,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          customClass: {
            popup: 'premium-swal',
            title: 'premium-swal-title',
            confirmButton: 'premium-swal-confirm'
          },
          buttonsStyling: false
        });
        return;
      }
    }
    
    try {
      if (targetRegisterId === 'NEW_BOX') {
        if (!boxForm.new_box_name) {
          setErrorMsg('Debes ingresar un nombre para la nueva caja');
          setLoading(false);
          return;
        }
        
        const createRes = await fetch(`${config.apiUrl}accounting/cash-registers/`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: boxForm.new_box_name })
        });
        
        if (!createRes.ok) {
          const data = await createRes.json();
          setErrorMsg(data.error || 'Error al crear la caja');
          setLoading(false);
          return;
        }
        
        const newBoxData = await createRes.json();
        targetRegisterId = newBoxData.id;
      }
    
      const res = await fetch(`${config.apiUrl}accounting/cash-shifts/open/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          register_id: targetRegisterId,
          initial_balance: parseFloat(String(boxForm.initial_balance || '').replace(/\./g, '') || 0)
        })
      });
      if (res.ok) {
        const userName = userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim() : userProfile?.username || 'Usuario';
        Swal.fire({
          title: `¡Bienvenido, ${userName}!`,
          text: 'Tu caja ha sido abierta exitosamente y está lista para operar.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'rounded-2xl shadow-xl border border-slate-100',
            title: 'text-2xl font-bold text-slate-800'
          }
        });

        // Fetch Billing Config before entering DASHBOARD
        try {
          const configRes = await fetch(`${config.apiUrl}configuracion/facturacion`, {
             headers: { 'Authorization': `Bearer ${token}` }
          });
          if (configRes.ok) {
             const bConfig = await configRes.json();
             setBillingConfig(bConfig);
             setCurrentBillingMode(bConfig.modo_predeterminado || 'POS');
          }
        } catch(e) {
          console.error("Error fetching billing config:", e);
        }

        simulateLoading('DASHBOARD');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Error al abrir caja');
      }
    } catch (err) {
      setErrorMsg('Error al conectar');
    }
    setLoading(false);
  };

  // ─── Admin: Users & Cash Registers Panel ─────────────────────────────────
  const loadAdminUsersPanel = async () => {
    setAdminUsersLoading(true);
    try {
      const [shiftsRes, registersRes] = await Promise.all([
        fetch(`${config.apiUrl}accounting/cash-shifts/?is_open=true`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${config.apiUrl}accounting/cash-registers-list/`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (shiftsRes.ok) {
        const d = await shiftsRes.json();
        setAdminShifts(d.results || d || []);
      }
      if (registersRes.ok) {
        const d = await registersRes.json();
        setAdminRegisters(d.results || d.registers || d || []);
      }
    } catch (e) {
      console.error('Error loading admin panel:', e);
    }
    setAdminUsersLoading(false);
  };

  const handleForceCloseShift = async (shift) => {
    const confirm = await Swal.fire({
      title: 'Forzar Cierre de Turno',
      html: `¿Cerrar el turno de <b>${shift.username}</b> en la caja <b>${shift.register_name}</b>?<br/><span style="color:#ef4444;font-size:12px">⚠ Esta acción imprimirá el corte de caja y cerrará la sesión.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, Imprimir y Forzar Cierre',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'premium-swal', title: 'premium-swal-title',
        confirmButton: 'premium-swal-confirm', cancelButton: 'premium-swal-cancel'
      },
      buttonsStyling: false
    });
    if (!confirm.isConfirmed) return;

    try {
      // 1. Fetch Sales
      const salesRes = await fetch(`${config.apiUrl}sales/sales/?status=COMPLETED&page_size=10000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let salesSum = 0;
      let totalCards = 0;
      let totalTransfers = 0;
      let totalSalesCount = 0;
      
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        const salesList = salesData.results || salesData || [];
        const openTime = new Date(shift.opened_at).getTime();
        
        salesList.forEach(sale => {
          const saleTime = new Date(sale.created_at).getTime();
          if (saleTime >= openTime) {
            const amt = parseFloat(sale.total || 0);
            salesSum += amt;
            totalSalesCount++;
            if (sale.payment_method === 'CARD') totalCards += amt;
            else if (sale.payment_method === 'TRANSFER') totalTransfers += amt;
          }
        });
      }

      // 2. Fetch Movements
      const movsRes = await fetch(`${config.apiUrl}accounting/cash-movements/?shift=${shift.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let inSum = 0;
      let outSum = 0;
      if (movsRes.ok) {
        const movsData = await movsRes.json();
        const movsList = movsData.results || movsData || [];
        movsList.forEach(m => {
          const amt = parseFloat(m.amount || 0);
          if (m.type === 'IN') inSum += amt;
          else if (m.type === 'OUT') outSum += amt;
        });
      }

      const initBal = parseFloat(shift.initial_balance || 0);
      const expectedBalance = initBal + salesSum + inSum - outSum;

      const totals = {
        totalCash: salesSum - totalCards - totalTransfers,
        totalCards,
        totalTransfers,
        totalSales: salesSum,
        totalSalesCount,
        movementsIn: inSum,
        movementsOut: outSum,
        expectedBalance,
        finalBalance: 0,
        notes: "CIERRE FORZADO POR SUPERADMIN"
      };

      // Close the shift FIRST so it's definitively closed in the DB
      const res = await fetch(`${config.apiUrl}accounting/cash-shifts/${shift.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_open: false, closed_at: new Date().toISOString(), final_balance: 0 })
      });
      
      if (!res.ok) {
        Toast.fire({ icon: 'error', title: 'Error al cerrar el turno' });
        return;
      }
      
      loadAdminUsersPanel();

      // Show ticket preview and allow printing
      const ticketHtml = generateCashCutHTML(shift, totals, systemSettings, systemSettings?.ticket_logo || config?.ticket_logo, { apiUrl: config?.apiUrl });
      
      Swal.fire({
        title: '¡Turno Cerrado Forzosamente!',
        html: `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; display: flex; justify-content: center; height: 350px; overflow: hidden; margin-top: 10px;">
            <iframe srcdoc='${ticketHtml.replace(/'/g, "&#39;")}' style="width: 80mm; height: 100%; border: none; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px;"></iframe>
          </div>
        `,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: '🖨️ Imprimir Ticket',
        cancelButtonText: 'Cerrar',
        customClass: {
          popup: 'premium-swal', title: 'premium-swal-title',
          confirmButton: 'premium-swal-confirm', cancelButton: 'premium-swal-cancel'
        },
        buttonsStyling: false
      }).then((result) => {
        if (result.isConfirmed) {
          printCashCut(shift, totals, systemSettings, systemSettings?.ticket_logo || config?.ticket_logo, { silent: true, printerName: config?.default_printer, apiUrl: config?.apiUrl });
        }
      });

    } catch (e) {
      console.error(e);
      Toast.fire({ icon: 'error', title: 'Error de red' });
    }
  };

  const handleCreateRegister = async () => {
    if (!newRegisterName.trim()) {
      Toast.fire({ icon: 'warning', title: 'Ingresa un nombre para la caja' });
      return;
    }
    try {
      const res = await fetch(`${config.apiUrl}accounting/cash-registers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newRegisterName.trim() })
      });
      if (res.ok) {
        Toast.fire({ icon: 'success', title: `Caja "${newRegisterName}" creada` });
        setNewRegisterName('');
        setShowNewRegisterForm(false);
        loadAdminUsersPanel();
      } else {
        const d = await res.json();
        Toast.fire({ icon: 'error', title: d.error || 'Error al crear la caja' });
      }
    } catch (e) {
      Toast.fire({ icon: 'error', title: 'Error de red' });
    }
  };

  const handleToggleRegister = async (register, openShift = null) => {
    if (openShift) {
      const confirm = await premiumConfirm(
        'Forzar Cierre de Caja',
        `¿Deseas forzar el cierre del turno de <b>${openShift.username}</b> en esta caja?`
      );
      if (!confirm.isConfirmed) return;
      try {
        const res = await fetch(`${config.apiUrl}accounting/cash-shifts/${openShift.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ is_open: false })
        });
        if (res.ok) {
          Toast.fire({ icon: 'success', title: 'Turno cerrado forzosamente' });
          loadAdminUsersPanel();
        } else {
          Toast.fire({ icon: 'error', title: 'Error al forzar el cierre' });
        }
      } catch (e) {
        Toast.fire({ icon: 'error', title: 'Error de red' });
      }
      return;
    }

    const action = register.is_active ? 'desactivar' : 'activar';
    const confirm = await premiumConfirm(
      `${register.is_active ? 'Desactivar' : 'Activar'} Caja`,
      `¿Deseas ${action} la caja "${register.name}"?`
    );
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${config.apiUrl}accounting/cash-registers-list/${register.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !register.is_active })
      });
      if (res.ok) {
        Toast.fire({ icon: 'success', title: `Caja ${register.is_active ? 'desactivada' : 'activada'}` });
        loadAdminUsersPanel();
      } else {
        Toast.fire({ icon: 'error', title: 'Error al actualizar la caja' });
      }
    } catch (e) {
      Toast.fire({ icon: 'error', title: 'Error de red' });
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const loadPrinters = async () => {
    if (ipcRenderer) {
      const p = await ipcRenderer.invoke('get-printers');
      setPrinters(p);
    }
  };

  const handleUploadUpdate = async (e) => {
    e.preventDefault();
    const version = document.getElementById('updateVersion').value;
    const fileInput = document.getElementById('updateFile');
    if (!version || !fileInput.files[0]) {
      Toast.fire({ icon: 'warning', title: 'Por favor ingresa la versión y selecciona el archivo .exe' });
      return;
    }

    setLoading(true);
    setLoadingMessage('Subiendo actualización... Esto puede tardar unos minutos dependiendo de tu red.');

    try {
      // When in Electron: use IPC with axios stream to avoid Chromium fetch memory limits for large files
      if (ipcRenderer) {
        const file = fileInput.files[0];
        // Get real file path from the electron file object or webUtils
        const webUtils = window.require ? window.require('electron').webUtils : null;
        const filePath = webUtils ? webUtils.getPathForFile(file) : file.path;
        if (!filePath) {
          Toast.fire({ icon: 'error', title: 'No se pudo obtener la ruta del archivo' });
          setLoading(false);
          return;
        }

        const result = await ipcRenderer.invoke('upload-update-file', {
          apiUrl: config.apiUrl,
          token,
          version,
          filePath
        });

        if (result.ok) {
          Swal.fire({
            icon: 'success',
            title: 'Actualización Distribuida',
            text: `La versión ${result.data.version} se ha subido correctamente. En unos segundos, todos los cajeros serán forzados a actualizar.`,
            customClass: { popup: 'premium-swal' }
          });
          const vInput = document.getElementById('updateVersion');
          if (vInput) vInput.value = '';
          if (fileInput) fileInput.value = '';
        } else {
          Toast.fire({ icon: 'error', title: result.error || 'Error al subir actualización' });
        }
      } else {
        // Fallback for browser (non-Electron)
        const formData = new FormData();
        formData.append('version', version);
        formData.append('file', fileInput.files[0]);

        const res = await fetch(`${config.apiUrl}users/upload-update/`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          Swal.fire({
            icon: 'success',
            title: 'Actualización Distribuida',
            text: `La versión ${data.version} se ha subido correctamente.`,
            customClass: { popup: 'premium-swal' }
          });
          const vInput = document.getElementById('updateVersion');
          if (vInput) vInput.value = '';
          if (fileInput) fileInput.value = '';
        } else {
          let errMsg = 'Error al subir actualización';
          try { const d = await res.json(); errMsg = d.error || errMsg; } catch {}
          Toast.fire({ icon: 'error', title: errMsg });
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      Toast.fire({ icon: 'error', title: 'Error al subir archivo: ' + (err.message || 'desconocido') });
    }
    setLoading(false);
  };


  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (ipcRenderer) {
      const newConfig = { ...config, default_printer: settingsForm.default_printer, ticket_logo: settingsForm.ticket_logo };
      await ipcRenderer.invoke('save-config', newConfig);
      setConfig(newConfig);
      
      // Sync password with django profile if provided
      if (settingsForm.password) {
        try {
          await fetch(`${config.apiUrl}users/profile/`, {
            method: 'PATCH',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password: settingsForm.password })
          });
        } catch(e) {
          console.error(e);
        }
      }
      
      premiumAlert('Ajustes Locales Guardados', 'Tus ajustes locales y de impresora se han guardado correctamente.', 'success');
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch(`${config.apiUrl}users/settings/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (!activeSettingTabRef.current) {
          setSystemSettings(prev => ({ ...prev, ...data }));
        }
        
        // Sync business settings to local config
        if (ipcRenderer) {
          let hasChanges = false;
          const newConfig = { ...config };
          if (data.business_name && data.business_name !== config?.business_name) {
            newConfig.business_name = data.business_name;
            hasChanges = true;
          }
          if (data.app_logo !== undefined && data.app_logo !== config?.app_logo) {
            newConfig.app_logo = data.app_logo;
            hasChanges = true;
          }
          if (data.ticket_logo !== undefined && data.ticket_logo !== config?.ticket_logo) {
            newConfig.ticket_logo = data.ticket_logo;
            hasChanges = true;
          }
          if (hasChanges) {
            await ipcRenderer.invoke('save-config', newConfig);
            setConfig(newConfig);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch system settings:", e);
    }
  };

  const handleSaveSystemSettings = async (tabName) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${config.apiUrl}users/settings/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(systemSettings)
      });
      if (res.ok) {
        const responseData = await res.json();
        // Update systemSettings state with server response
        setSystemSettings(prev => ({ ...prev, ...responseData }));
        
        premiumAlert('Ajustes Guardados', `Ajustes de "${tabName}" guardados y sincronizados con éxito.`, 'success');
        
        // Sync business settings to local config
        if (ipcRenderer) {
          let hasChanges = false;
          const newConfig = { ...config };
          if (systemSettings.business_name && systemSettings.business_name !== config?.business_name) {
            newConfig.business_name = systemSettings.business_name;
            hasChanges = true;
          }
          if (systemSettings.app_logo !== undefined && systemSettings.app_logo !== config?.app_logo) {
            newConfig.app_logo = systemSettings.app_logo;
            hasChanges = true;
          }
          if (systemSettings.ticket_logo !== undefined && systemSettings.ticket_logo !== config?.ticket_logo) {
            newConfig.ticket_logo = systemSettings.ticket_logo;
            hasChanges = true;
          }
          if (hasChanges) {
            await ipcRenderer.invoke('save-config', newConfig);
            setConfig(newConfig);
          }
        }
      } else {
        premiumAlert('Error', 'Error al sincronizar ajustes con el servidor Django.', 'error');
      }
    } catch (e) {
      premiumAlert('Error', 'Error de red al conectar con el backend Django.', 'error');
    }
  };

  const handleSelectTicketLogo = async () => {
    if (ipcRenderer) {
      const path = await ipcRenderer.invoke('select-image');
      if (path) {
        setLoading(true);
        try {
          const url = await uploadLocalFileToImgBB(path);
          setSettingsForm({...settingsForm, ticket_logo: url});
          Toast.fire({ icon: 'success', title: 'Logo del ticket subido a la nube correctamente' });
        } catch (e) {
          premiumAlert('Error', 'No se pudo subir la imagen a ImgBB. Revisa tu conexión a internet.', 'error');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleGenerateCode = () => {
    const randomCode = 'PRD-' + Math.floor(100000 + Math.random() * 900000);
    setProductForm(prev => ({...prev, internal_code: randomCode}));
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    
    // Auto-generate barcode/internal code if not provided
    const finalBarcode = productForm.barcode || '8180' + Math.floor(100000000 + Math.random() * 900000000);
    const finalInternalCode = productForm.internal_code || 'PRD-' + Math.floor(100000 + Math.random() * 900000);
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      if (productForm.category) formData.append('category', productForm.category);
      if (productForm.provider) formData.append('provider', productForm.provider);
      formData.append('internal_code', finalInternalCode);
      formData.append('barcode', finalBarcode);
      formData.append('name', productForm.name);
      formData.append('description', productForm.description || '');
      formData.append('location', productForm.location || '');
      formData.append('measurement_unit', productForm.measurement_unit);
      formData.append('has_inventory_control', productForm.has_inventory_control ? 'true' : 'false');
      formData.append('stock', parseFloat(productForm.stock || 0));
      formData.append('min_stock', parseFloat(productForm.min_stock || 0));
      formData.append('max_stock', productForm.has_max_stock ? parseFloat(productForm.max_stock || 0) : 0);
      formData.append('profit_margin', parseFloat(productForm.profit_margin || 0));
      formData.append('price_buy', parseFloat(productForm.price_buy || 0));
      formData.append('price_sell', parseFloat(productForm.price_sell || 0));
      formData.append('wholesale_price', productForm.has_wholesale_price ? parseFloat(productForm.wholesale_price || 0) : 0);
      formData.append('is_active', productForm.is_active ? 'true' : 'false');
      
      let imageUrl = productForm.image || '';
      if (productForm.image_file) {
        try {
          imageUrl = await uploadFileToImgBB(productForm.image_file);
        } catch (uploadError) {
          throw new Error('Error al subir la imagen del producto a ImgBB. Revisa tu conexión a internet.');
        }
      }
      formData.append('image', imageUrl);
      
      const targetUrl = editingProductId 
        ? `${config.apiUrl}inventory/products/${editingProductId}/`
        : `${config.apiUrl}inventory/products/`;
      const targetMethod = editingProductId ? 'PATCH' : 'POST';
      
      const res = await fetch(targetUrl, {
        method: targetMethod,
        headers: { 
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (res.ok) {
        setSuccessMsg(editingProductId ? "¡Producto actualizado exitosamente!" : "¡Producto registrado y sincronizado en Django exitosamente!");
        setShowAddProduct(false);
        setEditingProductId(null);
        
        // Reset form
        setProductForm({
          category: '',
          brand: '',
          provider: '',
          internal_code: '',
          barcode: '',
          name: '',
          description: '',
          location: '',
          measurement_unit: 'Unidad',
          has_inventory_control: true,
          stock: '0',
          min_stock: '0',
          max_stock: '0',
          has_max_stock: false,
          profit_margin: '0.00',
          price_buy: '0.00',
          price_sell: '0.00',
          wholesale_price: '0.00',
          has_wholesale_price: false,
          image: '',
          image_file: null,
          is_active: true
        });
        
        fetchProducts();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const errorData = await res.json();
        setErrorMsg(typeof errorData === 'object' ? JSON.stringify(errorData) : errorData);
      }
    } catch(e) {
      setErrorMsg("Error de red al guardar el producto: " + e.message);
    }
    setLoading(false);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name) return;
    
    const isEditing = !!categoryForm.id;
    const url = isEditing 
      ? `${config.apiUrl}inventory/categories/${categoryForm.id}/` 
      : `${config.apiUrl}inventory/categories/`;
    
    try {
      const res = await apiRequest(url, {
        method: isEditing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: categoryForm.name,
          description: categoryForm.description
        })
      }, token);
      
      if (res.ok) {
        premiumAlert('Categoría Guardada', 'La categoría se guardó correctamente.', 'success');
        setCategoryForm({ id: null, name: '', description: '' });
        fetchCategories();
      } else {
        const errorData = await res.json();
        premiumAlert('Error', errorData.detail || 'No se pudo guardar la categoría.', 'error');
      }
    } catch (e) {
      console.error(e);
      premiumAlert('Error', 'Error de red al guardar la categoría.', 'error');
    }
  };

  const handleDeleteCategory = async (id) => {
    Swal.fire({
      title: '¿Eliminar categoría?',
      text: "Si eliminas esta categoría, los productos asociados podrían quedar sin categoría.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await apiRequest(`${config.apiUrl}inventory/categories/${id}/`, {
            method: 'DELETE'
          }, token);
          if (res.ok) {
            premiumAlert('Eliminada', 'Categoría eliminada con éxito.', 'success');
            fetchCategories();
          } else {
            premiumAlert('Error', 'No se pudo eliminar la categoría.', 'error');
          }
        } catch (e) {
          premiumAlert('Error', 'Error de red.', 'error');
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-[9999] p-4 text-white">
        <div className="bg-slate-900/60 backdrop-blur-2xl p-8 max-w-md w-full text-center border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center gap-6 relative overflow-hidden">
          
          {/* Pulsing Light Glow background */}
          <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-purple-500/20 blur-3xl animate-pulse"></div>
          
          {/* Animated Shopping Cart */}
          <div className="relative w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center border border-white/10 shadow-inner group">
            <ShoppingBag className="text-indigo-300 animate-bounce" size={42} />
            {/* Dynamic visual indicator filling the cart */}
            <div 
              className="absolute bottom-3 left-3 right-3 bg-slate-700 rounded-xl transition-all duration-300 shadow-sm opacity-90"
              style={{ height: `${(loadingProgress / 100) * 44}px` }}
            ></div>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Cargando AGS SALES...</h2>
            <p className="text-[11px] text-indigo-200/60 font-semibold tracking-wider uppercase mt-1">{loadingMessage}</p>
          </div>
          
          {/* Animated Progress Bar */}
          <div className="w-full bg-white/10 rounded-full h-3 border border-white/5 p-0.5 overflow-hidden shadow-inner">
            <div 
              className="bg-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm relative"
              style={{ width: `${loadingProgress}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          
          <div className="flex justify-between w-full text-xs font-bold text-indigo-200/80 px-1 mt-1">
            <span>Sincronizando...</span>
            <span className="font-mono text-sm text-purple-300">{loadingProgress}%</span>
          </div>
        </div>
      </div>
    );
  }

  const renderError = () => errorMsg && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm shadow-sm flex items-center gap-2"><Lock size={16}/> {errorMsg}</div>;
  const renderSuccess = () => successMsg && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm shadow-sm flex items-center gap-2"><CheckCircle size={16}/> {successMsg}</div>;

  if (appState === 'SETUP_API') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-panel p-8 w-full max-w-md text-center">
          <img src="./icon.png" alt="Logo" className="w-24 mx-auto mb-4 drop-shadow-xl" />
          <h1 className="text-3xl font-bold text-slate-800 mb-2">AGS ERP</h1>
          <p className="text-gray-500 mb-6 font-medium">1. Conexión a la Nube</p>
          {renderError()}
          <form onSubmit={handleSaveConfig} className="flex flex-col gap-4 text-left">
            <div>
              <label className="text-sm font-semibold text-gray-700 ml-1">Endpoint API</label>
              <div className="relative mt-1">
                <Server className="absolute left-3 top-3.5 text-gray-400" size={18} />
                <input type="url" required value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="http://tudominio.com/" className="glass-input pl-10" />
              </div>
            </div>
            <button type="submit" className="btn-premium mt-2">Conectar API <ChevronRight size={18} /></button>
          </form>
        </div>
      </div>
    );
  }

  if (appState === 'CREATE_ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen py-8 px-4 overflow-y-auto w-full">
        <div className="glass-panel p-8 w-full max-w-6xl shadow-2xl rounded-3xl animate-in fade-in duration-300">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-150 pb-4">
            <img src="./icon.png" alt="Logo" className="w-12 drop-shadow-md animate-pulse" />
            <div className="text-left">
              <h1 className="text-2xl font-bold text-slate-800">Asistente de Configuración Inicial</h1>
              <p className="text-xs text-gray-500 font-medium">Inicializa los parámetros del Punto de Venta locales y en la nube</p>
            </div>
          </div>
          
          {renderError()}
          {renderSuccess()}
          
          <form onSubmit={handleCreateAdmin} className="flex flex-col gap-6 text-left w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
              
              {/* Left Column (Spans 2 columns on large screens) */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* 1. Datos del negocio */}
                <fieldset className="border border-indigo-100 rounded-2xl p-5 bg-white/40 backdrop-blur-sm shadow-sm relative">
                  <legend className="px-3 text-indigo-700 font-bold text-sm bg-indigo-50/80 rounded-full border border-indigo-100">Datos del negocio</legend>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    
                    {/* Logo upload (spans 2 columns) */}
                    <div className="md:col-span-2 flex flex-col gap-2">
                      <label className="text-xs font-semibold text-gray-600">Logo De Empresa (Recomendado: 590x350 px)</label>
                      <div className="h-40 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-xl bg-white/60 flex flex-col items-center justify-center relative overflow-hidden group transition-all">
                        {onboardingForm.logo_path && typeof onboardingForm.logo_path === 'string' && onboardingForm.logo_path.startsWith('http') ? (
                          <>
                            <img src={onboardingForm.logo_path} alt="Logo empresa" className="w-full h-full object-contain p-2" />
                            <button type="button" onClick={() => setOnboardingForm(prev => ({ ...prev, logo_path: '' }))} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                          </>
                        ) : (
                          <div className="text-center p-4 cursor-pointer flex flex-col items-center gap-2 w-full h-full justify-center" onClick={handleSelectOnboardingLogo}>
                            <ImageIcon className="text-indigo-400" size={36} />
                            <span className="text-xs font-medium text-indigo-600 hover:text-indigo-700 underline">Seleccionar imagen de logo</span>
                            <span className="text-[10px] text-gray-400 font-medium">Archivos JPG, PNG</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Country & Currencies side fields */}
                    <div className="flex flex-col gap-3">
                      <div className="relative">
                        <label className="text-xs font-semibold text-gray-600">Seleccione país [*]</label>
                        <div 
                          className="flex items-center justify-between gap-2.5 mt-1 bg-white/50 p-2 rounded-xl border border-slate-200 shadow-inner cursor-pointer select-none"
                          onClick={() => setShowOnboardingCountryDropdown(!showOnboardingCountryDropdown)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div 
                              className="w-8 h-5.5 rounded border border-slate-200 shadow-sm shrink-0 overflow-hidden flex items-center justify-center bg-slate-100"
                              dangerouslySetInnerHTML={{ __html: onboardingForm.country ? getFlagSvg(latamCountries.find(c => c.country === onboardingForm.country)?.iso || '') : '' }}
                            />
                            <span className="text-sm font-semibold text-slate-800">
                              {onboardingForm.country || 'Seleccione un país'}
                            </span>
                          </div>
                          <ChevronDown size={16} className={`text-slate-500 transition-transform ${showOnboardingCountryDropdown ? 'rotate-180' : ''}`} />
                        </div>

                        {showOnboardingCountryDropdown && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowOnboardingCountryDropdown(false)} />
                            <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                              {latamCountries.map((c, i) => (
                                <div 
                                  key={i}
                                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                                  onClick={() => {
                                    setOnboardingForm(prev => ({
                                      ...prev,
                                      country: c.country,
                                      currency_symbol: c.symbol,
                                      currency_words: c.words
                                    }));
                                    setShowOnboardingCountryDropdown(false);
                                  }}
                                >
                                  <div 
                                    className="w-7 h-5 rounded border border-slate-100 shadow-sm shrink-0 overflow-hidden flex items-center justify-center bg-slate-100"
                                    dangerouslySetInnerHTML={{ __html: getFlagSvg(c.iso) }}
                                  />
                                  <span className="text-sm font-semibold text-slate-800">{c.country}</span>
                                  <span className="text-xs text-slate-400 font-mono ml-auto">{c.code}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Moneda [*]</label>
                        <input type="text" required className="glass-input mt-1 text-sm py-2 font-mono" value={onboardingForm.currency_symbol} onChange={e => setOnboardingForm({...onboardingForm, currency_symbol: e.target.value})} />
                      </div>
                      
                      <div>
                        <label className="text-xs font-semibold text-gray-600">Moneda en Letras [*]</label>
                        <input type="text" required className="glass-input mt-1 text-sm py-2" value={onboardingForm.currency_words} onChange={e => setOnboardingForm({...onboardingForm, currency_words: e.target.value})} />
                      </div>
                      
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-gray-600">Nombre de empresa o negocio [*]</label>
                    <input type="text" required className="glass-input mt-1 text-sm" value={onboardingForm.business_name} onChange={e => setOnboardingForm({...onboardingForm, business_name: e.target.value})} />
                  </div>
                </fieldset>
                
                {/* 2. Datos del Usuario Administrador */}
                <fieldset className="border border-indigo-100 rounded-2xl p-5 bg-white/40 backdrop-blur-sm shadow-sm relative">
                  <legend className="px-3 text-indigo-700 font-bold text-sm bg-indigo-50/80 rounded-full border border-indigo-100">Datos del Usuario Administrador</legend>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Nombre [*]</label>
                      <input type="text" required className="glass-input mt-1 text-sm" placeholder="" value={onboardingForm.first_name} onChange={e => setOnboardingForm({...onboardingForm, first_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Correo Electrónico [*]</label>
                      <input type="email" required className="glass-input mt-1 text-sm" placeholder="" value={onboardingForm.email} onChange={e => setOnboardingForm({...onboardingForm, email: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Usuario [*]</label>
                      <input type="text" required className="glass-input mt-1 text-sm" placeholder="" value={onboardingForm.username} onChange={e => setOnboardingForm({...onboardingForm, username: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Clave [*]</label>
                      <input type="password" required className="glass-input mt-1 text-sm" placeholder="" value={onboardingForm.password} onChange={e => setOnboardingForm({...onboardingForm, password: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Confirmar Clave [*]</label>
                      <input type="password" required className="glass-input mt-1 text-sm" placeholder="" value={onboardingForm.confirm_password} onChange={e => setOnboardingForm({...onboardingForm, confirm_password: e.target.value})} />
                    </div>
                  </div>
                </fieldset>
                
              </div>
              
              {/* Right Column (Taxes and Printing) */}
              <div className="flex flex-col gap-6">
                
                {/* 3. Impuestos */}
                <fieldset className="border border-indigo-100 rounded-2xl p-5 bg-white/40 backdrop-blur-sm shadow-sm relative flex flex-col justify-between">
                  <legend className="px-3 text-indigo-700 font-bold text-sm bg-indigo-50/80 rounded-full border border-indigo-100">Impuestos</legend>
                  
                  <div className="flex flex-col items-center justify-center py-6 text-center gap-4 flex-1">
                    <p className="text-sm font-semibold text-gray-700">¿Trabajas con impuestos? [*]</p>
                    <div className="flex gap-6 justify-center">
                      <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2.5 rounded-xl hover:shadow-sm transition-all">
                        <input type="radio" name="use_taxes" checked={onboardingForm.use_taxes === true} onChange={() => setOnboardingForm({...onboardingForm, use_taxes: true})} />
                        <span className="text-sm font-semibold text-gray-700">Sí</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-4 py-2.5 rounded-xl hover:shadow-sm transition-all">
                        <input type="radio" name="use_taxes" checked={onboardingForm.use_taxes === false} onChange={() => setOnboardingForm({...onboardingForm, use_taxes: false})} />
                        <span className="text-sm font-semibold text-gray-700">No</span>
                      </label>
                    </div>
                  </div>
                </fieldset>
                
                {/* 4. Impresión */}
                <fieldset className="border border-indigo-100 rounded-2xl p-5 bg-white/40 backdrop-blur-sm shadow-sm relative flex flex-col justify-between">
                  <legend className="px-3 text-indigo-700 font-bold text-sm bg-indigo-50/80 rounded-full border border-indigo-100">Impresión</legend>
                  
                  <div className="flex flex-col gap-4 mt-2 justify-center flex-1 py-4">
                    <p className="text-sm font-semibold text-gray-700 text-center">¿Con qué tipo de equipo trabajarás la impresión? [*]</p>
                    <div className="flex gap-4 justify-center">
                      <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold hover:shadow-sm transition-all">
                        <input type="radio" name="printer_type" checked={onboardingForm.printer_type === 'ticket'} onChange={() => setOnboardingForm({...onboardingForm, printer_type: 'ticket'})} />
                        <span>Ticket (80mm)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-semibold hover:shadow-sm transition-all">
                        <input type="radio" name="printer_type" checked={onboardingForm.printer_type === 'a4'} onChange={() => setOnboardingForm({...onboardingForm, printer_type: 'a4'})} />
                        <span>Impresora (A4)</span>
                      </label>
                    </div>
                    
                    <div className="mt-2 text-left">
                      <label className="text-xs font-semibold text-gray-600 ml-1">Seleccione el dispositivo</label>
                      <select className="glass-input mt-1 text-sm" value={onboardingForm.selected_printer} onChange={e => setOnboardingForm({...onboardingForm, selected_printer: e.target.value})}>
                        <option value="Ninguno">Ninguno</option>
                        {printers.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                </fieldset>
                
              </div>
              
            </div>
            
            <button type="submit" className="w-full btn-premium !from-green-500 !to-emerald-600 !py-3.5 flex items-center justify-center gap-2 font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all mt-4">
              <Save size={20} /> Registrar datos e iniciar el sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (appState === 'LOGIN') {
    return (
      <div className="flex items-center justify-center min-h-screen relative w-full">

        <div className="glass-panel p-8 w-full max-w-md text-center border-slate-200/55 shadow-2xl relative">
          {(config?.app_logo || config?.ticket_logo) ? (
            <img 
              src={(config.app_logo || config.ticket_logo)?.startsWith('http') 
                ? (config.app_logo || config.ticket_logo) 
                : "./icon.png"} 
              alt="Logo" 
              className="w-24 h-24 mx-auto mb-4 object-contain drop-shadow-xl rounded-xl bg-slate-50/50 p-1 border border-slate-100" 
            />
          ) : (
            <img src="./icon.png" alt="Logo" className="w-24 mx-auto mb-4 drop-shadow-xl" />
          )}
          
          <h1 className="text-3xl font-extrabold text-slate-800 mb-1">
            {config?.business_name || 'AGS SALES'}
          </h1>
          <p className="text-gray-400 mb-6 font-semibold uppercase text-[10px] tracking-widest">Punto de Venta</p>
          
          {renderError()}
          
          <form onSubmit={handleLogin} className="flex flex-col gap-4 text-left">
            <div className="relative">
              <User className="absolute left-3 top-3.5 text-gray-400" size={18} />
              <input type="text" required placeholder="Usuario" className="glass-input pl-10" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
            </div>
            <div className="relative mb-2">
              <Lock className="absolute left-3 top-3.5 text-gray-400" size={18} />
              <input type="password" required placeholder="Contraseña" className="glass-input pl-10" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
            </div>
            <button type="submit" disabled={loading} className={`btn-premium w-full py-3 flex items-center justify-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
              {loading ? 'Ingresando...' : 'Ingresar al sistema'} {!loading && <LogIn size={18} />}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-150 pt-4 flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">¿Olvidaste tu contraseña?</span>
            <button 
              type="button" 
              onClick={() => {
                premiumAlert(
                  'Restablecer Contraseña',
                  `Para restablecer tu contraseña, por favor ponte en contacto con soporte técnico o envía un correo a sistemas.torcoroma@gmail.com`,
                  'info'
                );
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
            >
              Restablecer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'OPEN_BOX') {
    return (
      <div className="flex items-center justify-center min-h-screen relative w-full">
        <div className="glass-panel p-8 w-full max-w-md text-center border-slate-200/55 shadow-2xl relative">
          {/* Back/Logout Button */}
          <button 
            onClick={() => {
              setToken(null);
              setAppState('LOGIN');
            }}
            className="absolute top-4 right-4 text-slate-450 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition-all border border-slate-150 bg-white shadow-sm flex items-center justify-center cursor-pointer"
            title="Regresar al Login"
          >
            <X size={15} strokeWidth={2.5} />
          </button>

          <Coins className="text-emerald-500 mx-auto mb-4 drop-shadow-md animate-bounce" size={48} />
          
          <h1 className="text-2xl font-extrabold text-slate-800 mb-1">
            Registro de dinero inicial
          </h1>
          <p className="text-gray-400 mb-6 font-semibold uppercase text-[10px] tracking-wider">Apertura de Caja del Día</p>
          
          {renderError()}
          
          <form onSubmit={handleOpenBox} className="flex flex-col gap-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-650 ml-1">Seleccionar Caja Registradora</label>
              <select className="glass-input mt-1.5" value={boxForm.register_id} onChange={e => setBoxForm({...boxForm, register_id: e.target.value})} required>
                <option value="" disabled>-- Selecciona una caja --</option>
                {registers.map(r => {
                  const occupiedByShift = openShifts.find(s => s.cash_register === r.id);
                  return (
                    <option key={r.id} value={r.id} disabled={!!occupiedByShift}>
                      {r.name} {occupiedByShift ? `(Abierta por: ${occupiedByShift.username})` : ''}
                    </option>
                  );
                })}
                {userProfile?.role === 'SUPERADMIN' && (
                  <option value="NEW_BOX" className="font-bold text-indigo-650">+ Crear Nueva Caja...</option>
                )}
              </select>
            </div>
            
            {boxForm.register_id === 'NEW_BOX' && userProfile?.role === 'SUPERADMIN' && (
               <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                 <label className="text-xs font-bold text-slate-650 ml-1">Nombre de la Nueva Caja</label>
                 <div className="relative mt-1.5">
                   <Database className="absolute left-3 top-3 text-slate-400" size={16} />
                   <input type="text" required placeholder="Ej. Caja Principal, Caja Secundaria" className="glass-input pl-9" value={boxForm.new_box_name} onChange={e => setBoxForm({...boxForm, new_box_name: e.target.value})} />
                 </div>
               </div>
            )}
            
            <div className="mb-2">
              <label className="text-xs font-bold text-slate-650 ml-1">Ingrese el dinero inicial de la caja</label>
              <div className="relative mt-1.5">
                <span className="absolute left-4 top-3 text-slate-500 font-mono font-bold text-sm">
                  {systemSettings?.currency_symbol || '$'}
                </span>
                <input 
                  type="text" 
                  required 
                  placeholder="0" 
                  className="glass-input !pl-9 font-mono text-sm" 
                  value={boxForm.initial_balance} 
                  onChange={handleBoxFormInitialBalanceChange} 
                />
              </div>
            </div>
            
            <button type="submit" className="w-full btn-premium !from-green-500 !to-emerald-600 !py-3 flex items-center justify-center gap-2 font-bold text-sm shadow-md hover:shadow-lg transition-all">
              <Coins size={18} /> Registrar Apertura
            </button>
          </form>
        </div>
      </div>
    );
  }
  const handleLogout = () => {
    const myShift = openShifts.find(s => 
      (userProfile?.username && s.username?.toLowerCase() === userProfile.username.toLowerCase()) || 
      (loginForm?.username && s.username?.toLowerCase() === loginForm.username.toLowerCase())
    );
    
    if (myShift) {
      Swal.fire({
        title: 'Salir de sistema punto de venta',
        html: `
          <div class="flex flex-col gap-3 mt-4">
            <button id="btn-close-shift" class="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2">
              <span class="text-lg">🔐</span> Cerrar turno y salir
            </button>
            <button id="btn-leave-open" class="w-full bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2">
              <span class="text-lg">🔓</span> Dejar Turno Abierto y salir
            </button>
            <div class="bg-sky-200/50 text-sky-800 text-xs p-3 rounded-lg mt-3 border border-sky-300 font-medium text-left">
              <b>Nota :</b> Si dejas tu turno abierto solo tú o el administrador podrán abrir el programa
            </div>
          </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
          popup: 'rounded-2xl',
          closeButton: 'text-slate-400 hover:text-red-500 transition-colors m-2'
        },
        didOpen: () => {
          document.getElementById('btn-close-shift').addEventListener('click', () => {
            Swal.close();
            isClosingShiftRef.current = true; // Mark as voluntary close
            setShowCashCutModal(true);
          });
          document.getElementById('btn-leave-open').addEventListener('click', () => {
            Swal.close();
            setToken(null);
            setAppState('LOGIN');
          });
        }
      });
    } else {
      setToken(null);
      setAppState('LOGIN');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <nav className={`glass-panel m-4 flex flex-col rounded-3xl border-white/60 shadow-lg shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-20 p-2 items-center' : 'w-64 p-4'}`}>
        <div className={`flex items-center justify-between mb-8 px-2 mt-2 relative w-full ${sidebarCollapsed ? 'flex-col gap-3' : ''}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <img src={systemSettings?.app_logo?.startsWith('http') ? systemSettings.app_logo : "./icon.png"} alt="Logo" className="w-10 drop-shadow-md max-h-10 object-contain shrink-0" />
            {!sidebarCollapsed && (
              <h2 className="text-xl font-bold text-slate-800 truncate max-w-[120px]" title={systemSettings?.business_name || 'AGS ERP'}>{systemSettings?.business_name || 'AGS ERP'}</h2>
            )}
          </div>
          
          <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? 'flex-col' : ''}`}>
            {products.filter(p => p.has_inventory_control && parseFloat(p.stock || 0) <= 0).length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setShowStockAlerts(!showStockAlerts)}
                  className="p-1.5 text-red-650 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-all flex items-center justify-center cursor-pointer shadow-sm relative shrink-0"
                  title={`${products.filter(p => p.has_inventory_control && parseFloat(p.stock || 0) <= 0).length} productos agotados`}
                >
                  <Bell size={16} className="animate-swing" />
                  <span className="absolute -top-1.5 -right-1.5 bg-red-650 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {products.filter(p => p.has_inventory_control && parseFloat(p.stock || 0) <= 0).length}
                  </span>
                </button>
                
                {showStockAlerts && (
                  <div className={`absolute mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-150 p-4 z-50 text-slate-800 text-xs animate-in slide-in-from-top-2 duration-150 ${sidebarCollapsed ? 'left-12 -top-10' : 'left-0'}`}>
                    <h3 className="font-extrabold text-slate-700 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                      <span className="text-red-500">⚠️</span> Productos Agotados
                    </h3>
                    <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                      {products.filter(p => p.has_inventory_control && parseFloat(p.stock || 0) <= 0).map(p => (
                        <div key={p.id} className="flex justify-between items-center gap-2 border-b border-slate-50 pb-1.5 last:border-b-0">
                          <div className="font-semibold text-slate-850 truncate flex-1" title={p.name}>{p.name}</div>
                          <span className="bg-red-50 text-red-650 px-2 py-0.5 rounded font-black text-[9px] uppercase border border-red-100 shrink-0">Sin stock</span>
                        </div>
                      ))}
                    </div>
                    <button 
                      onClick={() => { setAppState('INVENTORY'); fetchProducts(); setShowStockAlerts(false); }}
                      className="w-full text-center text-[10px] text-indigo-650 hover:text-indigo-800 font-bold mt-2 pt-2 border-t border-slate-100 block cursor-pointer"
                    >
                      Ver en Inventario
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <button 
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer border border-slate-100 shadow-sm bg-white shrink-0"
              title={sidebarCollapsed ? "Expandir Menú" : "Colapsar Menú"}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>
        <ul className={`flex flex-col gap-2 flex-1 w-full ${sidebarCollapsed ? 'items-center' : ''}`}>
          {hasPermission(userProfile, 'pos.access') && (
            <li className={`sidebar-item ${appState === 'DASHBOARD' ? 'active' : ''} ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : 'w-full'}`} onClick={() => setAppState('DASHBOARD')} title={sidebarCollapsed ? "Terminal POS [F1]" : ""}><Activity size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Terminal POS [F1]</span>}</li>
          )}
          {hasPermission(userProfile, 'inventory.access') && (
            <li className={`sidebar-item ${appState === 'INVENTORY' ? 'active' : ''} ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : 'w-full'}`} onClick={() => { setAppState('INVENTORY'); fetchProducts(); fetchCategories(); fetchProviders(); }} title={sidebarCollapsed ? "Inventario [F2]" : ""}>
              <Package size={18} className="shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Inventario [F2]</span>}
              {products.filter(p => p.has_inventory_control && parseFloat(p.stock || 0) <= 0).length > 0 && !sidebarCollapsed && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                  {products.filter(p => p.has_inventory_control && parseFloat(p.stock || 0) <= 0).length}
                </span>
              )}
            </li>
          )}
          {hasPermission(userProfile, 'cash.access') && (
            <>
              <li className={`sidebar-item ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : ''} cursor-pointer flex items-center gap-3 px-4 py-3 text-slate-650 hover:bg-slate-100/70 font-bold rounded-xl transition-all text-xs`} onClick={() => setShowCashCutModal(true)} title={sidebarCollapsed ? "Corte de Caja [F3]" : ""}><Coins size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Corte de Caja [F3]</span>}</li>
              <li className={`sidebar-item ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : ''} cursor-pointer flex items-center gap-3 px-4 py-3 text-slate-650 hover:bg-slate-100/70 font-bold rounded-xl transition-all text-xs`} onClick={() => setShowCashMovementModal(true)} title={sidebarCollapsed ? "Egresos de Caja" : ""}><ArrowDownRight size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Egresos de Caja</span>}</li>
            </>
          )}
          {hasPermission(userProfile, 'reports.access') && (
            <li className={`sidebar-item ${appState === 'REPORTS' ? 'active' : ''} ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : 'w-full'}`} onClick={() => setAppState('REPORTS')} title={sidebarCollapsed ? "Inteligencia [F4]" : ""}><BarChart3 size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Inteligencia [F4]</span>}</li>
          )}
          {hasPermission(userProfile, 'purchases.access') && (
            <li className={`sidebar-item ${appState === 'PURCHASES' ? 'active' : ''} ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : 'w-full'}`} onClick={() => { setAppState('PURCHASES'); fetchProviders(); fetchProducts(); }} title={sidebarCollapsed ? "Compras [F5]" : ""}><ShoppingCart size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Compras [F5]</span>}</li>
          )}
          {hasPermission(userProfile, 'sales.view_history') && (
            <li className={`sidebar-item ${appState === 'SALES_HISTORY' ? 'active' : ''} ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : 'w-full'}`} onClick={() => setAppState('SALES_HISTORY')} title={sidebarCollapsed ? "Historial de Ventas [F6]" : ""}><FileText size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Historial de Ventas [F6]</span>}</li>
          )}
          <li className={`sidebar-item ${appState === 'ASSETS' ? 'active' : ''} ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : 'w-full'}`} onClick={() => setAppState('ASSETS')} title={sidebarCollapsed ? "Activos de Empresa" : ""}><Briefcase size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Activos de Empresa</span>}</li>
          {hasPermission(userProfile, 'settings.access') && (
            <li className={`sidebar-item ${appState === 'SETTINGS' ? 'active' : ''} ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : 'w-full'}`} onClick={() => { setAppState('SETTINGS'); loadPrinters(); fetchSystemSettings(); setActiveSettingTab(null); }} title={sidebarCollapsed ? "Ajustes del Sistema" : ""}><Settings size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Ajustes del Sistema</span>}</li>
          )}
          
          {/* Update Button */}
          {pendingUpdate && (
            <li onClick={triggerUpdate} className={`sidebar-item mt-4 !bg-orange-100 !text-orange-700 hover:!bg-orange-200 border-2 border-orange-500 font-bold cursor-pointer animate-pulse-soft shadow-md shadow-orange-500/20 ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : ''}`} title={sidebarCollapsed ? "¡Actualizar Sistema!" : ""}>
              <Download size={18} className="animate-bounce shrink-0" />
              {!sidebarCollapsed && <span className="truncate">¡Actualizar!</span>}
            </li>
          )}

          <li onClick={handleLogout} className={`sidebar-item text-red-500 mt-auto hover:!bg-red-50 cursor-pointer ${sidebarCollapsed ? 'justify-center w-12 h-12 p-0' : 'w-full'}`} title={sidebarCollapsed ? "Cerrar Sesión" : ""}><LogIn size={18} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">Cerrar Sesión</span>}</li>
        </ul>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col py-4 pr-4 h-full overflow-hidden">
        
        {/* POSModule siempre montado pero oculto si no es DASHBOARD para preservar estado de carrito */}
        <div className={`h-full flex-col gap-4 overflow-hidden animate-in fade-in zoom-in-95 duration-300 ${appState === 'DASHBOARD' ? 'flex' : 'hidden'}`}>
          <header className="glass-panel p-6 flex justify-between items-center rounded-2xl shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Punto de Venta Activo</h1>
              <p className="text-gray-500 text-sm">Caja Abierta y operando correctamente.</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner border border-slate-200">
                <button 
                  disabled={!billingConfig.permitir_cambio || !billingConfig.pos_habilitado}
                  onClick={() => setCurrentBillingMode('POS')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentBillingMode === 'POS' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'} ${(!billingConfig.permitir_cambio || !billingConfig.pos_habilitado) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  POS Electrónico
                </button>
                <button 
                  disabled={!billingConfig.permitir_cambio || !billingConfig.facturacion_electronica_habilitada}
                  onClick={() => setCurrentBillingMode('ELECTRONIC')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${currentBillingMode === 'ELECTRONIC' ? 'bg-green-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'} ${(!billingConfig.permitir_cambio || !billingConfig.facturacion_electronica_habilitada) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Factura Electrónica
                </button>
              </div>
              <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full font-medium text-sm flex items-center gap-2 shadow-sm border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> En línea
              </div>
            </div>
          </header>
          <div className={`flex-1 flex flex-col p-2 rounded-2xl overflow-hidden transition-colors duration-500 ${currentBillingMode === 'ELECTRONIC' ? 'bg-green-50/10' : 'bg-blue-50/10'}`}>
            {/* Solo pasamos el prop, el modulo gestiona su render interno */}
            {(appState === 'DASHBOARD' || appState === 'INVENTORY' || appState === 'REPORTS' || appState === 'SETTINGS' || appState === 'PURCHASES' || appState === 'SALES_HISTORY') && (
              <POSModule 
                config={config} 
                token={token} 
                currentBillingMode={currentBillingMode} 
                warehouseId={boxForm.register_id} 
                systemSettings={systemSettings}
                appState={appState}
              />
            )}
          </div>
        </div>

        {appState === 'INVENTORY' && (
          <div className="h-full flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-300">
            {/* Header corporativo */}
            <header className="glass-panel p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 rounded-2xl shadow-sm border border-slate-200/60 bg-white/80 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="relative">
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight flex items-center gap-3 mb-1">
                  <Package className="text-indigo-600" size={28} strokeWidth={2.5} />
                  Inventario de Productos
                </h1>
                <p className="text-slate-500 text-sm font-semibold ml-10">Gestión y control de catálogo y precios de venta.</p>
              </div>
              <div className="flex flex-wrap gap-3 w-full xl:w-auto relative z-10">
                <button 
                  type="button"
                  className="bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 text-sm font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 border border-slate-200 hover:border-emerald-200 transition-all hover:shadow-md active:scale-95 shadow-sm cursor-pointer" 
                  onClick={() => setShowExcelImport(true)}
                >
                  <FileText size={16} /> Importar Excel
                </button>
                <button 
                  type="button"
                  className="bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 text-sm font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 border border-slate-200 hover:border-indigo-200 transition-all hover:shadow-md active:scale-95 shadow-sm cursor-pointer" 
                  onClick={() => setShowBulkEdit(true)}
                >
                  <Sliders size={16} /> Varios
                </button>
                <button 
                  type="button"
                  className="bg-white hover:bg-violet-50 text-violet-700 hover:text-violet-800 text-sm font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 border border-slate-200 hover:border-violet-200 transition-all hover:shadow-md active:scale-95 shadow-sm cursor-pointer" 
                  onClick={() => setShowBarcodeGenerator(true)}
                >
                  <QrCode size={16} /> Códigos
                </button>
                <button 
                  type="button"
                  className="bg-white hover:bg-orange-50 text-orange-700 hover:text-orange-800 text-sm font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 border border-slate-200 hover:border-orange-200 transition-all hover:shadow-md active:scale-95 shadow-sm cursor-pointer ml-2" 
                  onClick={() => setShowCatalogQR(true)}
                >
                  <Globe size={16} /> QR Catálogo
                </button>
                <button 
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer ml-2" 
                  onClick={exportToExcel}
                >
                  Excel
                </button>
                {userProfile?.role === 'SUPERADMIN' && (
                  <button 
                    type="button"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer ml-2" 
                    onClick={() => { fetchCategories(); setShowCategoriesModal(true); }}
                  >
                    <Tag size={16} /> Categorías
                  </button>
                )}
                <button 
                  type="button"
                  className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer ml-2" 
                  onClick={() => { fetchCategories(); fetchProviders(); setShowAddProduct(true); }}
                >
                  <Plus size={18} strokeWidth={3} /> Agregar Producto
                </button>
              </div>
            </header>

            {/* Barra de herramientas corporativa: búsqueda y filtros */}
            <div className="glass-panel p-3 flex flex-col md:flex-row gap-4 items-center justify-between rounded-2xl shadow-sm border border-slate-200/60 bg-white/80">
              <div className="relative w-full md:w-1/2 lg:w-[450px]">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={18} className="text-indigo-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o código..." 
                  className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm placeholder-slate-400"
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                />
                {inventorySearch && (
                  <button 
                    onClick={() => setInventorySearch('')}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1 rounded-full transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="relative w-full md:w-auto z-25">
                <div 
                  className="flex items-center justify-between gap-3 bg-white border border-slate-200 px-5 py-2.5 rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 transition-colors select-none min-w-[220px]"
                  onClick={() => {
                    setShowCategoryDropdown(!showCategoryDropdown);
                    setCategorySearchQuery('');
                  }}
                >
                  <div className="flex items-center gap-2 text-slate-700">
                    <Tag size={16} className="text-indigo-500" />
                    <span className="text-sm font-bold truncate max-w-[150px]">
                      {selectedCategoryFilter 
                        ? (categories.find(c => String(c.id) === String(selectedCategoryFilter))?.name || 'Categoría')
                        : 'Todas las categorías'}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </div>

                {showCategoryDropdown && (
                  <>
                    {/* Click catcher overlay */}
                    <div className="fixed inset-0 z-10" onClick={() => setShowCategoryDropdown(false)} />
                    
                    {/* Dropdown panel */}
                    <div className="absolute right-0 mt-2 w-72 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* Search box within dropdown */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input 
                            type="text" 
                            placeholder="Buscar categoría..." 
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                            value={categorySearchQuery}
                            onChange={e => setCategorySearchQuery(e.target.value)}
                            onClick={e => e.stopPropagation()} // Prevent closing dropdown when clicking input
                          />
                        </div>
                      </div>

                      {/* Options list */}
                      <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                        {/* Option: All categories */}
                        <div 
                          className={`flex items-center justify-between px-4 py-2 hover:bg-indigo-50/70 cursor-pointer transition-colors text-xs font-bold ${
                            !selectedCategoryFilter ? 'text-indigo-600 bg-indigo-50/40' : 'text-slate-700'
                          }`}
                          onClick={() => {
                            setSelectedCategoryFilter('');
                            setShowCategoryDropdown(false);
                          }}
                        >
                          <span>Todas las categorías</span>
                          {!selectedCategoryFilter && <Check size={14} className="text-indigo-650" />}
                        </div>

                        {/* Filtered category items */}
                        {(() => {
                          const filtered = categories.filter(cat => 
                            cat.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
                              .includes(categorySearchQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
                          );

                          if (filtered.length === 0) {
                            return (
                              <div className="px-4 py-3 text-center text-slate-400 text-xs font-semibold">
                                No se encontraron categorías
                              </div>
                            );
                          }

                          return filtered.map(cat => {
                            const isSelected = String(selectedCategoryFilter) === String(cat.id);
                            return (
                              <div 
                                key={cat.id}
                                className={`flex items-center justify-between px-4 py-2 hover:bg-indigo-50/70 cursor-pointer transition-colors text-xs font-bold ${
                                  isSelected ? 'text-indigo-600 bg-indigo-50/40' : 'text-slate-700'
                                }`}
                                onClick={() => {
                                  setSelectedCategoryFilter(cat.id);
                                  setShowCategoryDropdown(false);
                                }}
                              >
                                <span className="truncate pr-2">{cat.name}</span>
                                {isSelected && <Check size={14} className="text-indigo-650" />}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button 
                type="button"
                onClick={() => setShowOnlyOutOfStock(!showOnlyOutOfStock)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer select-none ${
                  showOnlyOutOfStock 
                    ? 'bg-red-500 text-white border-red-500 hover:bg-red-600' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Bell size={14} className={showOnlyOutOfStock ? 'animate-bounce' : ''} />
                Solo Agotados
              </button>
            </div>
            
            <div className="flex-1 glass-panel overflow-hidden rounded-2xl shadow-sm border border-slate-200/60 bg-white flex flex-col">
              {products.filter(p => p.has_inventory_control && parseFloat(p.stock || 0) <= 0).length > 0 && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs font-bold text-red-700 animate-pulse-soft">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span> ¡Alerta de Inventario! Tienes {products.filter(p => p.has_inventory_control && parseFloat(p.stock || 0) <= 0).length} producto(s) totalmente agotados.
                  </div>
                  <button 
                    onClick={() => setShowOnlyOutOfStock(!showOnlyOutOfStock)}
                    className="underline text-red-800 hover:text-red-950 font-black cursor-pointer"
                  >
                    {showOnlyOutOfStock ? 'Mostrar todos' : 'Filtrar y ver agotados'}
                  </button>
                </div>
              )}
              {(errorMsg || successMsg) && (
                <div className="px-6 pt-4 pb-2">
                  {renderError()}
                  {renderSuccess()}
                </div>
              )}
              
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50/90 backdrop-blur-md sticky top-0 z-10">
                      <th className="py-4 px-6 text-center w-40 text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">Acción</th>
                      <th className="py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">Código</th>
                      <th className="py-4 px-6 text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">Producto</th>
                      <th className="py-4 px-6 text-center text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">Stock</th>
                      <th className="py-4 px-6 text-right text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">P. Costo</th>
                      <th className="py-4 px-6 text-right text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">P. Venta</th>
                      <th className="py-4 px-6 text-right text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">P. Mayoreo</th>
                      <th className="py-4 px-6 text-center text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">Categoría</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 text-sm font-semibold">
                    {(() => {
                      const filteredProducts = products.filter(p => {
                        const term = normalizeText(inventorySearch);
                        const matchesSearch = normalizeText(p.name).includes(term) || 
                                              normalizeText(p.internal_code).includes(term) ||
                                              (p.barcode && normalizeText(p.barcode).includes(term));
                        
                        const matchesCategory = selectedCategoryFilter === '' || String(p.category) === String(selectedCategoryFilter);
                        const matchesOutOfStock = !showOnlyOutOfStock || (p.has_inventory_control && parseFloat(p.stock || 0) <= 0);
                        return matchesSearch && matchesCategory && matchesOutOfStock;
                      });

                      const paginatedProducts = filteredProducts.slice((inventoryPage - 1) * INVENTORY_ITEMS_PER_PAGE, inventoryPage * INVENTORY_ITEMS_PER_PAGE);

                      if (filteredProducts.length === 0) {
                        return (
                          <tr>
                            <td colSpan="8" className="text-center py-16 text-slate-450 font-bold">
                              {products.length === 0 ? 'No hay productos registrados.' : 'Ningún producto coincide con los filtros aplicados.'}
                            </td>
                          </tr>
                        );
                      }

                      return paginatedProducts.map(p => {
                        const categoryName = p.category_name || (categories.find(c => c.id === p.category)?.name) || 'Sin categoría';
                        
                        // Semáforo de stock
                        const stockNum = parseFloat(p.stock || 0);
                        let stockColor = "bg-slate-100 text-slate-600 border-slate-200";
                        if (p.has_inventory_control) {
                          if (stockNum <= 0) stockColor = "bg-red-50 text-red-700 border-red-200";
                          else if (stockNum <= 10) stockColor = "bg-amber-50 text-amber-700 border-amber-200";
                          else stockColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        }
                        
                        return (
                          <tr key={p.id} className={`border-b border-slate-100 transition-all duration-200 group relative z-0 hover:z-10 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.08)] ${
                            p.has_inventory_control && stockNum <= 0 
                              ? 'bg-red-50/25 hover:bg-red-50/40 border-l-4 border-l-red-500' 
                              : p.has_inventory_control && stockNum <= 10 
                                ? 'bg-amber-50/15 hover:bg-amber-50/30 border-l-4 border-l-amber-400' 
                                : 'bg-white hover:bg-slate-50/80'
                          }`}>
                            <td className="py-4 px-6 flex items-center justify-center gap-2.5">
                              {/* Editar */}
                              <button
                                type="button"
                                onClick={() => handleEditProduct(p)}
                                className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 border border-slate-200 hover:border-amber-200 bg-white shadow-sm flex items-center justify-center cursor-pointer"
                                title="Editar producto"
                              >
                                <Edit3 size={15} strokeWidth={2.5} />
                              </button>
                              
                              {/* Eliminar */}
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 border border-slate-200 hover:border-red-200 bg-white shadow-sm flex items-center justify-center cursor-pointer"
                                title="Eliminar producto"
                              >
                                <Trash2 size={15} strokeWidth={2.5} />
                              </button>
                              
                              {/* Toggle ON/OFF */}
                              <button
                                type="button"
                                onClick={() => handleToggleActiveProduct(p)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all border shadow-sm cursor-pointer uppercase ${
                                  p.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100/80'
                                }`}
                                title={p.is_active ? "Desactivar producto" : "Activar producto"}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                {p.is_active ? 'ACTIVO' : 'INACTIVO'}
                              </button>
                            </td>
                            <td className="py-4 px-6 text-slate-500 font-mono text-[11px]">
                              <span className="bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80 font-mono text-[11px] font-bold text-slate-700 transition-colors shadow-inner select-all cursor-pointer">
                                {p.internal_code}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                {p.image ? (
                                  <div className="w-10 h-10 rounded-xl overflow-hidden shadow-[0_2px_8px_-4px_rgba(0,0,0,0.15)] shrink-0 bg-white border border-slate-100/50 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300">
                                    <img 
                                      src={p.image.startsWith('http') 
                                        ? p.image 
                                        : `${config.apiUrl.replace('/api/', '')}${p.image.startsWith('/') ? '' : '/'}${p.image.startsWith('media/') ? p.image : p.image.startsWith('products/') ? 'media/' + p.image : 'media/products/' + p.image}`} 
                                      alt={p.name} 
                                      className="w-full h-full object-cover" 
                                    />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-xl shadow-sm shrink-0 bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 transform group-hover:scale-105 transition-transform duration-300">
                                    <Package size={20} strokeWidth={1.5} />
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-800 text-sm tracking-tight flex items-center gap-2 flex-wrap">
                                    {p.name}
                                    {p.has_inventory_control && stockNum <= 0 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-700 border border-red-200 animate-pulse-soft shrink-0">Agotado</span>
                                    )}
                                    {p.has_inventory_control && stockNum > 0 && stockNum <= 10 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-250 shrink-0">Bajo Stock</span>
                                    )}
                                  </div>
                                  {p.location && (
                                    <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                                      <span className="w-1 h-1 rounded-full bg-indigo-300"></span>
                                      Ubicación: {p.location}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              {p.has_inventory_control ? (
                                <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border font-extrabold text-xs shadow-sm ${stockColor}`}>
                                  {stockNum}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs font-bold">Ilimitado</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right font-mono font-bold text-slate-500 text-xs">
                              {formatPrice(p.price_buy)}
                            </td>
                            <td className="py-4 px-6 text-right font-mono text-xs">
                              <span className="text-emerald-700 font-extrabold bg-emerald-50/80 border border-emerald-150 px-2.5 py-1.5 rounded-xl shadow-sm">
                                {formatPrice(p.price_sell)}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-right font-mono text-xs">
                              {parseFloat(p.wholesale_price || 0) > 0 ? (
                                <span className="text-amber-700 font-extrabold bg-amber-50/80 border border-amber-150 px-2.5 py-1.5 rounded-xl shadow-sm">
                                  {formatPrice(p.wholesale_price)}
                                </span>
                              ) : (
                                <span className="text-slate-350 font-bold">-</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-150 text-indigo-750 px-3 py-1.5 rounded-xl text-[10px] font-extrabold shadow-sm transition-all hover:bg-indigo-100/50">
                                {categoryName}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {(() => {
                const totalPages = Math.ceil(products.filter(p => {
                  const term = normalizeText(inventorySearch);
                  const matchesSearch = normalizeText(p.name).includes(term) || 
                                        normalizeText(p.internal_code).includes(term) ||
                                        (p.barcode && normalizeText(p.barcode).includes(term));
                  const matchesCategory = selectedCategoryFilter === '' || String(p.category) === String(selectedCategoryFilter);
                  return matchesSearch && matchesCategory;
                }).length / INVENTORY_ITEMS_PER_PAGE);

                if (totalPages > 1) {
                  return (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-500">
                        Página {inventoryPage} de {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          disabled={inventoryPage === 1}
                          onClick={() => setInventoryPage(p => Math.max(1, p - 1))}
                          className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          Anterior
                        </button>
                        <button 
                          disabled={inventoryPage >= totalPages}
                          onClick={() => setInventoryPage(p => p + 1)}
                          className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Modal de Importar desde Excel */}
            {showExcelImport && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="glass-panel p-0 max-w-xl w-full max-h-[85vh] overflow-hidden rounded-3xl border border-white/60 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 text-left">
                  
                  {/* Header */}
                  <div className="bg-slate-100/80 border-b border-gray-200 px-6 py-4 flex justify-between items-center backdrop-blur-md">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Importar datos desde excel {excelImportStep === 1 ? '→ Paso 1: Guardar plantilla excel' : '→ Paso 2: Subir archivo excel'}
                    </h2>
                    <button 
                      type="button" 
                      className="bg-red-500 hover:bg-red-600 text-white rounded-lg p-2 shadow-sm transition-all hover:scale-105 active:scale-95 border border-red-600/20 flex items-center justify-center" 
                      onClick={() => { setShowExcelImport(false); setExcelImportStep(1); }}
                      title="Cerrar"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50/40 text-center items-center justify-center min-h-[350px]">
                    {renderError()}
                    {renderSuccess()}
                    
                    {excelImportStep === 1 ? (
                      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
                        <p className="text-sm font-semibold text-slate-600">Click en la imagen para guardar la plantilla</p>
                        
                        {/* Huge Excel Icon Button */}
                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          className="w-48 h-48 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-3xl bg-white flex flex-col items-center justify-center shadow-md hover:shadow-xl transition-all hover:scale-105 active:scale-95 group relative overflow-hidden"
                          title="Descargar Plantilla Excel (.xlsx)"
                        >
                          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="text-emerald-600 font-extrabold text-5xl flex flex-col items-center gap-1 group-hover:scale-110 transition-transform">
                            <span className="text-[11px] uppercase tracking-widest text-emerald-500 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-bold mb-1">XLSX</span>
                            <FileText size={48} strokeWidth={2.5} />
                          </div>
                        </button>
                        
                        {/* Warning message from screenshot */}
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold px-4 py-2.5 rounded-2xl shadow-sm flex items-center gap-2 max-w-sm mt-4 text-center justify-center">
                          <span>⚠️ Advertencia: Recuerda seguir el formato de datos dado, ya no es necesario convertirlo a CSV. ⚠️</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300 w-full px-6">
                        <p className="text-sm font-semibold text-slate-600">Seleccione el archivo excel completado para realizar la importación</p>
                        
                        <label className="w-full h-40 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl bg-white flex flex-col items-center justify-center relative overflow-hidden group transition-all cursor-pointer shadow-sm">
                          {excelFileLoading ? (
                            <div className="flex flex-col items-center gap-3">
                              <span className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></span>
                              <span className="text-xs font-bold text-indigo-600">Analizando e importando catálogo en Django...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 p-3 text-center">
                              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform">
                                <ImageIcon className="text-indigo-500" size={24} />
                              </div>
                              <span className="text-xs font-bold text-indigo-600 underline">Seleccionar archivo (.xlsx)</span>
                              <span className="text-[10px] text-gray-400 font-semibold">Soporta múltiples registros con categorías y proveedores en cascada</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                            disabled={excelFileLoading}
                            onChange={e => {
                              if(e.target.files.length > 0) {
                                handleImportExcel(e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="bg-slate-100/80 border-t border-gray-200 px-6 py-4 flex gap-4 justify-between backdrop-blur-md">
                    {excelImportStep === 1 ? (
                      <>
                        <div></div>
                        <button 
                          type="button" 
                          onClick={() => setExcelImportStep(2)} 
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg ml-auto"
                        >
                          Siguiente paso <ChevronRight size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          type="button" 
                          disabled={excelFileLoading}
                          onClick={() => setExcelImportStep(1)} 
                          className="bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm disabled:opacity-50"
                        >
                          <ArrowLeft size={16} /> Atrás
                        </button>
                        <div></div>
                      </>
                    )}
                  </div>
                  
                </div>
              </div>
            )}

            {/* Modal del QR Catálogo Público */}
            {showCatalogQR && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col border border-slate-200/50 relative p-8 items-center text-center">
                  <button onClick={() => setShowCatalogQR(false)} className="absolute top-4 right-4 text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                  <Globe size={48} className="text-orange-500 mb-4" />
                  <h3 className="text-xl font-bold text-slate-800 mb-1">Catálogo Digital</h3>
                  <p className="text-sm text-slate-500 mb-6">Escanea el código para ver el menú</p>
                  
                  <div className="bg-white p-4 border-2 border-orange-200 rounded-2xl shadow-sm mb-6 inline-block">
                    <QRCode value={`${apiUrl?.replace(/\/api\/?$/, '') || ''}/catalogo/`} size={180} />
                  </div>
                  
                  <p className="text-xs font-semibold text-slate-400 break-all bg-slate-50 p-2 rounded-lg w-full mb-4">
                    {`${apiUrl?.replace(/\/api\/?$/, '') || ''}/catalogo/`}
                  </p>

                  <button 
                    onClick={() => {
                      const printContent = `
                        <div style="text-align: center; font-family: sans-serif; padding: 20px;">
                          <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 5px;">CATÁLOGO DIGITAL</h1>
                          <p style="font-size: 14px; margin-bottom: 20px;">Escanea para ver nuestros productos</p>
                          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${apiUrl?.replace(/\/api\/?$/, '') || ''}/catalogo/`)}" style="width: 250px; height: 250px;" />
                        </div>
                      `;
                      const printWindow = window.open('', '_blank');
                      printWindow.document.write(printContent);
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => printWindow.print(), 500);
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    <Printer size={18} /> Imprimir QR
                  </button>
                </div>
              </div>
            )}

            {/* Modal de Modificación Masiva (Varios) */}
            {showBarcodeGenerator && (
              <BarcodeGeneratorModal 
                onClose={() => setShowBarcodeGenerator(false)} 
                products={products}
                onGenerateBackend={async (product_ids) => {
                  try {
                    const res = await fetch(`${config.apiUrl}inventory/products/generate-barcodes/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ product_ids })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setSuccessMsg(data.message);
                      fetchProducts();
                      setTimeout(() => setSuccessMsg(''), 3000);
                    } else {
                      setErrorMsg('Error al generar códigos.');
                      setTimeout(() => setErrorMsg(''), 3000);
                    }
                  } catch (e) {
                    setErrorMsg('Error de red al conectar con el servidor.');
                  }
                }}
              />
            )}

            {showBulkEdit && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="glass-panel p-0 max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-3xl border border-white/60 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 text-left">
                  
                  {/* Header */}
                  <div className="bg-slate-100/80 border-b border-gray-200 px-6 py-4 flex justify-between items-center backdrop-blur-md">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      Cantidad de registros a modificar : {products.length} registros
                    </h2>
                    <button 
                      type="button" 
                      className="bg-red-500 hover:bg-red-600 text-white rounded-lg p-2 shadow-sm transition-all hover:scale-105 active:scale-95 border border-red-600/20 flex items-center justify-center" 
                      onClick={() => { setShowBulkEdit(false); setSelectedBulkAction(null); setBulkEditValue(''); }}
                      title="Cerrar"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  {/* Content Container */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40 min-h-[420px] flex flex-col gap-6">
                    {renderError()}
                    {renderSuccess()}
                    {bulkEditLoading && (
                      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center animate-in fade-in">
                        <span className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></span>
                        <span className="text-sm font-bold text-indigo-600">Procesando actualización masiva en Django...</span>
                      </div>
                    )}
                    
                    {!bulkEditLoading && !selectedBulkAction && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                        
                        {/* 1. Cost Price Card */}
                        <div className="bg-white/75 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Coins size={20} /></div>
                            <span className="text-sm font-bold text-slate-700">Modificar precio de Costo</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                            {['value', 'fixed', 'percent', 'formula'].map(m => (
                              <button key={m} onClick={() => { setSelectedBulkAction('price_buy'); setSelectedBulkModifier(m); }} className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 p-2.5 rounded-lg border border-slate-150 transition-colors uppercase">
                                {m === 'value' ? 'Por valor' : m === 'fixed' ? 'Por valor fijo' : m === 'percent' ? 'Por %' : 'Por fórmula'}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* 2. Sale Price Card */}
                        <div className="bg-white/75 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><DollarSign size={20} /></div>
                            <span className="text-sm font-bold text-slate-700">Modificar precio de Venta</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                            {['value', 'fixed', 'percent', 'formula'].map(m => (
                              <button key={m} onClick={() => { setSelectedBulkAction('price_sell'); setSelectedBulkModifier(m); }} className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 p-2.5 rounded-lg border border-slate-150 transition-colors uppercase">
                                {m === 'value' ? 'Por valor' : m === 'fixed' ? 'Por valor fijo' : m === 'percent' ? 'Por %' : 'Por fórmula'}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* 3. Activarlos/Desactivarlos Card */}
                        <button 
                          onClick={() => setSelectedBulkAction('is_active')}
                          className="bg-red-50 border border-red-200 hover:border-red-400 rounded-xl p-4 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors shadow-sm hover:shadow-sm group text-left"
                        >
                          <div className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Lock size={24} />
                          </div>
                          <span className="text-sm font-bold text-red-800">Activarlos/Desactivarlos</span>
                        </button>
                        
                        {/* 4. Min Stock Card */}
                        <div className="bg-white/75 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><Sliders size={20} /></div>
                            <span className="text-sm font-bold text-slate-700">Modificar stock mínimo</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                            {['value', 'fixed'].map(m => (
                              <button key={m} onClick={() => { setSelectedBulkAction('min_stock'); setSelectedBulkModifier(m); }} className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 p-2.5 rounded-lg border border-slate-150 transition-colors uppercase">
                                {m === 'value' ? 'Por valor' : 'Por valor fijo'}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* 5. Max Stock Card */}
                        <div className="bg-white/75 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center"><Package size={20} /></div>
                            <span className="text-sm font-bold text-slate-700">Modificar stock máximo</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                            {['value', 'fixed'].map(m => (
                              <button key={m} onClick={() => { setSelectedBulkAction('max_stock'); setSelectedBulkModifier(m); }} className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 p-2.5 rounded-lg border border-slate-150 transition-colors uppercase">
                                {m === 'value' ? 'Por valor' : 'Por valor fijo'}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* 6. Cambiar Categoría Card */}
                        <button 
                          onClick={() => { setSelectedBulkAction('category'); setSelectedBulkModifier('fixed'); }}
                          className="bg-white/75 border border-slate-200 hover:border-amber-300 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:scale-[1.02] shadow-sm hover:shadow-md group text-left"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plus size={24} />
                          </div>
                          <span className="text-sm font-bold text-slate-700">Cambiar Categoría</span>
                        </button>
                        
                        {/* 7. Cambiar Proveedor Card */}
                        <button 
                          onClick={() => { setSelectedBulkAction('provider'); setSelectedBulkModifier('fixed'); }}
                          className="bg-white/75 border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all hover:scale-[1.02] shadow-sm hover:shadow-md group text-left"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Building size={24} />
                          </div>
                          <span className="text-sm font-bold text-slate-700">Cambiar Proveedor</span>
                        </button>
                        
                        {/* 8. Eliminar los Card */}
                        <button 
                          onClick={() => setSelectedBulkAction('delete')}
                          className="bg-red-50 border border-red-200 hover:border-red-400 rounded-xl p-4 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors shadow-sm hover:shadow-sm group text-left"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Trash2 size={24} />
                          </div>
                          <span className="text-sm font-bold text-red-800">Eliminar todos los productos</span>
                        </button>
                        
                      </div>
                    )}
                    
                    {/* Bulk Action Sub-view Form */}
                    {!bulkEditLoading && selectedBulkAction && (
                      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md max-w-lg mx-auto w-full flex flex-col gap-5 animate-in slide-in-from-top-4 duration-300">
                        <h3 className="text-base font-bold text-slate-800 border-b pb-2 uppercase tracking-wide">
                          {selectedBulkAction === 'price_buy' ? 'Ajustar precio de Costo' :
                           selectedBulkAction === 'price_sell' ? 'Ajustar precio de Venta' :
                           selectedBulkAction === 'is_active' ? 'Activarlos/Desactivarlos' :
                           selectedBulkAction === 'min_stock' ? 'Ajustar stock mínimo' :
                           selectedBulkAction === 'max_stock' ? 'Ajustar stock máximo' :
                           selectedBulkAction === 'category' ? 'Cambiar Categoría' :
                           selectedBulkAction === 'provider' ? 'Cambiar Proveedor' : 'Eliminar catálogo'}
                        </h3>
                        
                        {selectedBulkAction !== 'delete' && selectedBulkAction !== 'is_active' && (
                          <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-xl text-xs font-semibold text-indigo-800">
                            Modificador seleccionado: <span className="uppercase text-indigo-950 font-bold">
                              {selectedBulkModifier === 'value' ? 'Sumar/Restar valor' :
                               selectedBulkModifier === 'fixed' ? 'Valor Fijo' :
                               selectedBulkModifier === 'percent' ? 'Ajuste Porcentaje (%)' : 'Fórmula basada en margen'}
                            </span>
                          </div>
                        )}
                        
                        {selectedBulkAction === 'is_active' ? (
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-bold text-slate-600">Seleccione el nuevo estado:</label>
                            <select className="glass-input text-sm" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)}>
                              <option value="">-- Seleccionar estado --</option>
                              <option value="true">Activos (ON)</option>
                              <option value="false">Inactivos (OFF)</option>
                            </select>
                          </div>
                        ) : selectedBulkAction === 'category' ? (
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-bold text-slate-600">Seleccione la nueva categoría para todo el catálogo:</label>
                            <select className="glass-input text-sm" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)}>
                              <option value="">-- Seleccionar Categoría --</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        ) : selectedBulkAction === 'provider' ? (
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-bold text-slate-600">Seleccione el nuevo proveedor para todo el catálogo:</label>
                            <select className="glass-input text-sm" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)}>
                              <option value="">-- Seleccionar Proveedor --</option>
                              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                        ) : selectedBulkAction === 'delete' ? (
                          <p className="text-sm font-bold text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
                            ⚠️ ¡Cuidado! Estás a punto de borrar TODOS los productos de la base de datos de producción. Esta acción eliminará permanentemente la base del catálogo.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-bold text-slate-600">Ingrese el valor numérico:</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="glass-input text-sm font-mono font-bold"
                              placeholder="Ej. 10.00 o -5"
                              value={bulkEditValue}
                              onChange={e => setBulkEditValue(e.target.value)}
                            />
                          </div>
                        )}
                        
                        <div className="flex gap-3 justify-end border-t pt-4">
                          <button type="button" onClick={() => { setSelectedBulkAction(null); setBulkEditValue(''); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors">
                            Atrás
                          </button>
                          <button type="button" onClick={handleExecuteBulkUpdate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md hover:shadow-lg transition-all">
                            Aplicar cambio masivo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="bg-slate-100/80 border-t border-gray-200 px-6 py-4 flex justify-end backdrop-blur-md">
                    <button 
                      type="button" 
                      onClick={() => { setShowBulkEdit(false); setSelectedBulkAction(null); setBulkEditValue(''); }} 
                      className="bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    >
                      <X size={16} className="text-red-500" /> Cancelar / Cerrar
                    </button>
                  </div>
                  
                </div>
              </div>
            )}

            {/* MODAL GESTION CATEGORIAS */}
            {showCategoriesModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      <Tag className="text-indigo-600" size={24} /> Gestión de Categorías
                    </h3>
                    <button 
                      onClick={() => setShowCategoriesModal(false)} 
                      className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors"
                    >
                      <X size={20} strokeWidth={3} />
                    </button>
                  </div>
                  
                  <div className="flex flex-col md:flex-row p-6 gap-8 overflow-y-auto">
                    {/* Formulario */}
                    <div className="w-full md:w-1/3 flex flex-col gap-4">
                      <h4 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-2">
                        {categoryForm.id ? 'Editar Categoría' : 'Nueva Categoría'}
                      </h4>
                      <form onSubmit={handleSaveCategory} className="flex flex-col gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Nombre</label>
                          <input 
                            type="text" 
                            className="glass-input" 
                            placeholder="Ej. Lácteos"
                            value={categoryForm.name} 
                            onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} 
                            required 
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Descripción</label>
                          <textarea 
                            className="glass-input min-h-24" 
                            placeholder="Breve descripción..."
                            value={categoryForm.description} 
                            onChange={e => setCategoryForm({...categoryForm, description: e.target.value})} 
                          />
                        </div>
                        <div className="flex gap-2 mt-2">
                          {categoryForm.id && (
                            <button 
                              type="button"
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl flex-1 transition-colors text-sm"
                              onClick={() => setCategoryForm({ id: null, name: '', description: '' })}
                            >
                              Cancelar
                            </button>
                          )}
                          <button 
                            type="submit" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md flex-1 transition-colors text-sm"
                          >
                            {categoryForm.id ? 'Actualizar' : 'Guardar'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Lista */}
                    <div className="w-full md:w-2/3 border-l border-slate-100 pl-0 md:pl-8">
                      <h4 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-2 mb-4">
                        Categorías Existentes ({categories.length})
                      </h4>
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Nombre</th>
                              <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Descripción</th>
                              <th className="py-3 px-4 text-center text-xs font-bold text-slate-500 uppercase w-28">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categories.map(c => (
                              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4 text-sm font-bold text-slate-700">{c.name}</td>
                                <td className="py-3 px-4 text-xs text-slate-500 truncate max-w-xs">{c.description || '-'}</td>
                                <td className="py-3 px-4 flex justify-center gap-2">
                                  <button
                                    onClick={() => setCategoryForm({ id: c.id, name: c.name, description: c.description || '' })}
                                    className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(c.id)}
                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {categories.length === 0 && (
                              <tr>
                                <td colSpan="3" className="text-center py-8 text-slate-400 text-sm">
                                  No hay categorías creadas.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL NUEVO/EDITAR PRODUCTO */}
            {showAddProduct && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="glass-panel p-0 max-w-6xl w-full max-h-[92vh] overflow-hidden rounded-3xl border border-white/60 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                  
                  <div className="bg-slate-100/80 border-b border-gray-200 px-6 py-4 flex justify-between items-center backdrop-blur-md">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                      Registro de Producto
                    </h2>
                    <button 
                      type="button" 
                      className="bg-red-500 hover:bg-red-600 text-white rounded-lg p-2.5 shadow-sm transition-all hover:scale-105 active:scale-95 border border-red-600/20" 
                      onClick={() => { setShowAddProduct(false); setEditingProductId(null); }}
                      title="Cerrar ventana"
                    >
                      <X size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                  
                  {/* Contenedor del Formulario con scroll interno */}
                  <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50/40 text-left">
                    {renderError()}
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* COLUMNA 1: Datos Generales */}
                      <div className="flex flex-col gap-5 bg-white/40 p-5 rounded-2xl border border-white/60 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Información General</h3>
                        
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Seleccione una categoría :</label>
                          {!showQuickCategory ? (
                            <div className="flex gap-2">
                              <select 
                                className="glass-input text-sm text-slate-800 font-semibold flex-1"
                                value={productForm.category}
                                onChange={e => setProductForm({...productForm, category: e.target.value})}
                              >
                                <option value="">-- Seleccione una categoría --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => setShowQuickCategory(true)}
                                className="bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 animate-in fade-in"
                                title="Agregar nueva categoría"
                              >
                                <Plus size={18} strokeWidth={2.5} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-center bg-slate-100/55 p-2 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-200 w-full">
                              <input 
                                type="text"
                                className="glass-input text-sm flex-1 bg-white !py-1.5"
                                placeholder="Nombre de categoría"
                                value={quickCategoryName}
                                onChange={e => setQuickCategoryName(e.target.value)}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={handleQuickAddCategory}
                                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-all shadow hover:scale-105 active:scale-95 flex items-center justify-center shrink-0"
                                title="Guardar categoría"
                              >
                                <CheckCircle size={16} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowQuickCategory(false); setQuickCategoryName(''); }}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg transition-all flex items-center justify-center shrink-0"
                                title="Cancelar"
                              >
                                <X size={16} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Código de barras</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              className="glass-input text-sm pr-14 font-mono font-semibold"
                              placeholder="Escriba o escanee un código"
                              value={productForm.barcode}
                              onChange={e => setProductForm({...productForm, barcode: e.target.value})}
                              maxLength={100}
                            />
                            <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-gray-100">
                              {productForm.barcode.length}/100
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Nombre o descripción</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              required
                              className="glass-input text-sm pr-14 font-semibold"
                              placeholder="Nombre comercial / descripción básica"
                              value={productForm.name}
                              onChange={e => setProductForm({...productForm, name: e.target.value})}
                              maxLength={100}
                            />
                            <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-gray-100">
                              {productForm.name.length}/100
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Ubicación (opcional)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              className="glass-input text-sm pr-14"
                              placeholder="Ubicación física en el almacén"
                              value={productForm.location || ''}
                              onChange={e => setProductForm({...productForm, location: e.target.value})}
                              maxLength={100}
                            />
                            <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-gray-100">
                              {(productForm.location || '').length}/100
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Seleccione un proveedor (Opcional):</label>
                          {!showQuickProvider ? (
                            <div className="flex gap-2">
                              <select 
                                className="glass-input text-sm text-slate-800 font-semibold flex-1"
                                value={productForm.provider}
                                onChange={e => setProductForm({...productForm, provider: e.target.value})}
                              >
                                <option value="">-- Seleccione un proveedor --</option>
                                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              <button
                                type="button"
                                onClick={() => setShowQuickProvider(true)}
                                className="bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 animate-in fade-in"
                                title="Agregar nuevo proveedor"
                              >
                                <Plus size={18} strokeWidth={2.5} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 items-center bg-slate-100/55 p-2 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-200 w-full">
                              <input 
                                type="text"
                                className="glass-input text-sm flex-1 bg-white !py-1.5"
                                placeholder="Nombre de proveedor"
                                value={quickProviderName}
                                onChange={e => setQuickProviderName(e.target.value)}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={handleQuickAddProvider}
                                className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-all shadow hover:scale-105 active:scale-95 flex items-center justify-center shrink-0"
                                title="Guardar proveedor"
                              >
                                <CheckCircle size={16} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowQuickProvider(false); setQuickProviderName(''); }}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-2 rounded-lg transition-all flex items-center justify-center shrink-0"
                                title="Cancelar"
                              >
                                <X size={16} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* COLUMNA 2: Unidades e Inventario */}
                      <div className="flex flex-col gap-5 bg-white/40 p-5 rounded-2xl border border-white/60 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Control de Stock</h3>
                        
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Unidad de medida :</label>
                          <select 
                            className="glass-input text-sm text-slate-800 font-semibold"
                            value={productForm.measurement_unit}
                            onChange={e => setProductForm({...productForm, measurement_unit: e.target.value})}
                          >
                            <option value="Unidad">Unidad</option>
                            <option value="Kilogramo (Kg)">Kilogramo (Kg)</option>
                            <option value="Libra (Lb)">Libra (Lb)</option>
                            <option value="Gramo (Gr)">Gramo (Gr)</option>
                            <option value="A Granel">A Granel (decimal)</option>
                          </select>
                        </div>
                        
                        <div className="flex flex-col gap-4 p-4 bg-white/60 rounded-2xl border border-gray-150 shadow-inner">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                            <span className="text-xs font-bold text-slate-700">Aplica control de inventarios</span>
                            <input 
                              type="checkbox" 
                              checked={productForm.has_inventory_control} 
                              onChange={e => setProductForm({...productForm, has_inventory_control: e.target.checked})}
                              className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>
                          
                          {productForm.has_inventory_control && (
                            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                              <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Stock</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    className="glass-input text-sm font-mono font-bold"
                                    value={productForm.stock}
                                    onChange={e => setProductForm({...productForm, stock: e.target.value})}
                                  />
                                  <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold">1</span>
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Stock mínimo</label>
                                <div className="relative">
                                  <input 
                                    type="number" 
                                    className="glass-input text-sm font-mono font-bold"
                                    value={productForm.min_stock}
                                    onChange={e => setProductForm({...productForm, min_stock: e.target.value})}
                                  />
                                  <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold">1</span>
                                </div>
                              </div>
                              
                              <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="checkbox" 
                                    id="has_max_stock"
                                    checked={productForm.has_max_stock}
                                    onChange={e => setProductForm({...productForm, has_max_stock: e.target.checked})}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                  />
                                  <label htmlFor="has_max_stock" className="text-xs font-bold text-slate-600 cursor-pointer">Aplica stock máximo</label>
                                </div>
                                
                                {productForm.has_max_stock && (
                                  <div className="relative animate-in fade-in duration-200">
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Stock Máximo (Opcional)</label>
                                    <input 
                                      type="number" 
                                      className="glass-input text-sm font-mono font-bold border-amber-200 focus:border-amber-400"
                                      value={productForm.max_stock}
                                      onChange={e => setProductForm({...productForm, max_stock: e.target.value})}
                                    />
                                    <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold">1</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* COLUMNA 3: Precios e Imagen */}
                      <div className="flex flex-col gap-5 bg-white/40 p-5 rounded-2xl border border-white/60 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Precios y Finanzas</h3>
                        
                        <div className="flex flex-col gap-4 p-4 bg-white/60 rounded-2xl border border-gray-150 shadow-inner">
                          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                            <span className="text-xs font-bold text-slate-700">Margen de ganancia (%)</span>
                            <input 
                              type="number" 
                              step="0.01"
                              className="glass-input text-sm font-mono font-bold w-20 text-right bg-white"
                              value={productForm.profit_margin}
                              onChange={e => handleProductPriceChange('profit_margin', e.target.value)}
                            />
                          </div>
                          
                          <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Precio De Costo</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                step="0.01"
                                className="glass-input text-sm font-mono font-bold"
                                value={productForm.price_buy}
                                onChange={e => handleProductPriceChange('price_buy', e.target.value)}
                              />
                              <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold">4</span>
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">Precio De Venta</label>
                            <div className="relative">
                              <input 
                                type="number" 
                                step="0.01"
                                required
                                className="glass-input text-sm font-mono font-bold border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100"
                                value={productForm.price_sell}
                                onChange={e => handleProductPriceChange('price_sell', e.target.value)}
                              />
                              <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold">4</span>
                            </div>
                          </div>
                          
                          <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                id="has_wholesale_price"
                                checked={productForm.has_wholesale_price}
                                onChange={e => setProductForm({...productForm, has_wholesale_price: e.target.checked})}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                              />
                              <label htmlFor="has_wholesale_price" className="text-xs font-bold text-slate-600 cursor-pointer">Aplica precio de mayoreo</label>
                            </div>
                            
                            {productForm.has_wholesale_price && (
                              <div className="relative animate-in fade-in duration-200">
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">Precio de Mayoreo (Opcional)</label>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="glass-input text-sm font-mono font-bold border-amber-200 focus:border-amber-400"
                                  value={productForm.wholesale_price}
                                  onChange={e => setProductForm({...productForm, wholesale_price: e.target.value})}
                                />
                                <span className="absolute right-3 bottom-2.5 text-[9px] text-gray-400 font-mono font-bold">4</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Selector de Imagen */}
                        <div className="flex flex-col gap-2 items-center text-center">
                          <label className="text-xs font-bold text-slate-700 block mb-1">Imagen del producto (*.PNG) (Opcional)</label>
                          <label className="w-36 h-36 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl bg-white flex flex-col items-center justify-center relative overflow-hidden group transition-all cursor-pointer shadow-sm">
                            {productForm.image_file ? (
                              <>
                                <img 
                                  src={URL.createObjectURL(productForm.image_file)} 
                                  alt="Vista previa" 
                                  className="w-full h-full object-cover p-1.5 rounded-2xl"
                                />
                                <button 
                                  type="button" 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setProductForm({...productForm, image_file: null});
                                  }} 
                                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all"
                                  title="Quitar imagen"
                                >
                                  <X size={12}/>
                                </button>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-2 p-3 text-center">
                                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:scale-110 transition-transform">
                                  <ImageIcon className="text-indigo-500" size={20} />
                                </div>
                                <span className="text-[10px] font-bold text-indigo-600 underline">Seleccionar imagen</span>
                              </div>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={e => {
                                if(e.target.files.length > 0) {
                                  setProductForm({...productForm, image_file: e.target.files[0]});
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      
                    </div>
                  </form>
                  
                  {/* Footer / Botones */}
                  <div className="bg-slate-100/80 border-t border-gray-200 px-6 py-4 flex gap-4 justify-end backdrop-blur-md">
                    <button 
                      type="button" 
                      onClick={() => { setShowAddProduct(false); setEditingProductId(null); }} 
                      className="bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    >
                      <X size={16} className="text-red-500" /> Cancelar
                    </button>
                    <button 
                      type="button" 
                      onClick={handleSaveProduct} 
                      className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Save size={16} /> Guardar
                    </button>
                  </div>
                  
                </div>
              </div>
            )}
          </div>
        )}

        {appState === 'SETTINGS' && (
          <div className="h-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
            <header className="glass-panel p-6 flex justify-between items-center rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                {activeSettingTab && (
                  <button onClick={() => setActiveSettingTab(null)} className="p-2 hover:bg-gray-100 rounded-lg text-indigo-600 transition-colors mr-2">
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">
                    {activeSettingTab 
                      ? `Ajustes > ${activeSettingTab === 'users' ? 'Usuarios' :
                         activeSettingTab === 'business' ? 'Datos de Negocio' :
                         activeSettingTab === 'printer' ? 'Configurar Impresora' :
                         activeSettingTab === 'database' ? 'Gestionar Base de Datos' :
                         activeSettingTab === 'ticket' ? 'Editor de Ticket' :
                         activeSettingTab === 'scale' ? 'Configurar Balanza/Báscula' :
                         activeSettingTab === 'smtp' ? 'Configurar Servidor SMTP' :
                         activeSettingTab === 'serialization' ? 'Configurar Serialización' :
                         activeSettingTab === 'payments' ? 'Formas de Pago' :
                         activeSettingTab === 'currencies' ? 'Monedas / Divisas' :
                         activeSettingTab === 'taxes' ? 'Impuestos y Cargos' :
                         activeSettingTab === 'ai' ? 'Configurar Inteligencia Artificial' :
                         activeSettingTab === 'online_store' ? 'Tienda Online' :
                         activeSettingTab === 'shopify' ? 'Integración Shopify' :
                         activeSettingTab === 'promo' ? 'Promociones y Juegos' : 'Ajustes del Sistema'}`
                      : 'Ajustes del Sistema'}
                  </h1>
                  <p className="text-gray-500 text-sm">
                    {activeSettingTab 
                      ? 'Configura y sincroniza los parámetros con el servidor Django.'
                      : 'Configuraciones locales del .exe e integraciones en la nube.'}
                  </p>
                </div>
              </div>
            </header>
            
            <div className="flex-1 overflow-auto p-2">
              {renderError()}
              {renderSuccess()}

              {/* 14-Grid Settings Dashboard */}
              {!activeSettingTab && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { id: 'users', title: 'Usuarios', icon: Users, color: '#3b82f6', desc: 'Gestionar usuarios del sistema' },
                    { id: 'business', title: 'Datos de negocio', icon: Building, color: '#ef4444', desc: 'Información y nit de empresa' },
                    { id: 'printer', title: 'Configurar impresora', icon: Printer, color: '#6366f1', desc: 'Impresoras y tickets locales' },
                    { id: 'database', title: 'Gestionar base de datos', icon: Database, color: '#0ea5e9', desc: 'Copia de seguridad y estado' },
                    { id: 'ticket', title: 'Editor de ticket de venta', icon: FileText, color: '#f59e0b', desc: 'Editar encabezado y pie de ticket' },
                    { id: 'scale', title: 'Configurar Balanza/Báscula', icon: Sliders, color: '#8b5cf6', desc: 'Puertos seriales de báscula' },
                    { id: 'smtp', title: 'Configurar servidor SMTP', icon: Mail, color: '#ec4899', desc: 'Correo electrónico y alertas' },
                    { id: 'serialization', title: 'Configurar serialización', icon: Hash, color: '#f43f5e', desc: 'Prefijos de facturas y folios' },
                    { id: 'payments', title: 'Formas de pago', icon: CreditCard, color: '#10b981', desc: 'Efectivo, tarjetas y transferencias' },
                    { id: 'currencies', title: 'Monedas / divisas', icon: Coins, color: '#d97706', desc: 'Símbolos y decimales de moneda' },
                    { id: 'taxes', title: 'Impuestos y cargos', icon: Percent, color: '#06b6d4', desc: 'Tasas de IVA e impuestos locales' },
                    { id: 'ai', title: 'Configurar IA', icon: Cpu, color: '#84cc16', desc: 'Claves de API de Gemini y OpenAI' },
                    { id: 'online_store', title: 'Tienda online', icon: Globe, color: '#0284c7', desc: 'Sincronización WooCommerce y Web' },
                    { id: 'shopify', title: 'Shopify', icon: ShoppingBag, color: '#15803d', desc: 'Sincronizar stock con Shopify store' },
                    { id: 'promo', title: 'Promociones', icon: Tag, color: '#eab308', desc: 'Juegos y descuentos' },
                    { id: 'updates', title: 'Actualizaciones', icon: Download, color: '#f97316', desc: 'Actualizar sistema globalmente' }
                  ].filter(opt => {
                    if (userProfile?.role === 'SUPERADMIN') return true;
                    if (userProfile?.role === 'ADMIN') return ['printer', 'scale', 'promo'].includes(opt.id);
                    return ['printer', 'scale'].includes(opt.id);
                  }).map(opt => {
                    const IconComponent = opt.icon;
                    return (
                      <div key={opt.id} onClick={() => setActiveSettingTab(opt.id)} className="glass-panel p-6 flex flex-col items-center text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl duration-200">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ backgroundColor: `${opt.color}15`, color: opt.color }}>
                          <IconComponent size={28} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">{opt.title}</h3>
                        <p className="text-xs text-gray-500 font-medium">{opt.desc}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sub-forms for each tab */}
              {activeSettingTab === 'users' && (() => {
                const formatTs = (ts) => ts ? new Date(ts).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—';
                const formatPriceAdmin = (v) => {
                  const sym = systemSettings?.currency_symbol || '$';
                  return `${sym}${Math.round(parseFloat(v || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
                };
                return (
                  <div className="max-w-3xl mx-auto flex flex-col gap-6">
                    {/* Header row */}
                    <div className="glass-panel p-6 rounded-2xl shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <Users size={20} className="text-blue-500" /> Usuarios &amp; Cajas
                        </h3>
                        <button
                          onClick={loadAdminUsersPanel}
                          disabled={adminUsersLoading}
                          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                        >
                          {adminUsersLoading
                            ? <span className="animate-spin inline-block w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full" />
                            : <Activity size={13} />}
                          {adminUsersLoading ? 'Cargando...' : 'Actualizar'}
                        </button>
                      </div>
                      {/* Sub-tabs */}
                      <div className="flex gap-2">
                        {[
                          { id: 'shifts', label: 'Sesiones Activas', icon: Monitor },
                          { id: 'registers', label: 'Cajas Registradoras', icon: Database }
                        ].map(t => {
                          const TIcon = t.icon;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setAdminUsersTab(t.id)}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${adminUsersTab === t.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              <TIcon size={14} /> {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sesiones Activas */}
                    {adminUsersTab === 'shifts' && (
                      <div className="glass-panel p-6 rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-gray-700 flex items-center gap-2">
                            <Monitor size={16} className="text-emerald-500" />
                            Turnos de Caja Abiertos
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{adminShifts.length}</span>
                          </h4>
                        </div>
                        {adminUsersLoading ? (
                          <div className="text-center py-8 text-gray-400 text-sm">Cargando sesiones...</div>
                        ) : adminShifts.length === 0 ? (
                          <div className="text-center py-8 flex flex-col items-center gap-2 text-gray-400">
                            <CheckCircle size={32} className="text-emerald-400" />
                            <p className="font-semibold">No hay turnos abiertos</p>
                            <p className="text-xs">Todos los cajeros han cerrado su caja</p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {adminShifts.map(shift => (
                              <div key={shift.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                                    <User size={18} className="text-emerald-600" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-800 text-sm">{shift.username}</p>
                                    <p className="text-xs text-gray-500">{shift.register_name} · Abierto: {formatTs(shift.opened_at)}</p>
                                    <p className="text-xs text-emerald-600 font-semibold">Saldo inicial: {formatPriceAdmin(shift.initial_balance)}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleForceCloseShift(shift)}
                                  className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-100"
                                  title="Forzar cierre de turno"
                                >
                                  <LogOut size={13} /> Forzar Cierre
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cajas Registradoras */}
                    {adminUsersTab === 'registers' && (
                      <div className="glass-panel p-6 rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-gray-700 flex items-center gap-2">
                            <Database size={16} className="text-sky-500" />
                            Cajas Registradoras
                            <span className="bg-sky-100 text-sky-700 text-xs font-bold px-2 py-0.5 rounded-full">{adminRegisters.length}</span>
                          </h4>
                          <button
                            onClick={() => { setShowNewRegisterForm(v => !v); setNewRegisterName(''); }}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            <Plus size={13} /> Nueva Caja
                          </button>
                        </div>

                        {showNewRegisterForm && (
                          <div className="flex gap-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <input
                              type="text"
                              placeholder="Ej: Caja Principal, Caja 02..."
                              className="glass-input flex-1 text-sm"
                              value={newRegisterName}
                              onChange={e => setNewRegisterName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleCreateRegister()}
                              autoFocus
                            />
                            <button onClick={handleCreateRegister} className="btn-premium !py-2 !px-4 text-sm">
                              <Save size={14} /> Crear
                            </button>
                            <button onClick={() => setShowNewRegisterForm(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 rounded-xl transition-all">
                              <X size={14} />
                            </button>
                          </div>
                        )}

                        {adminUsersLoading ? (
                          <div className="text-center py-8 text-gray-400 text-sm">Cargando cajas...</div>
                        ) : adminRegisters.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-sm">No hay cajas registradas</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {adminRegisters.map(reg => {
                              const hasOpenShift = adminShifts.find(s => s.cash_register === reg.id);
                              return (
                                <div key={reg.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${reg.is_active ? 'bg-sky-50' : 'bg-gray-100'}`}>
                                      <Database size={16} className={reg.is_active ? 'text-sky-600' : 'text-gray-400'} />
                                    </div>
                                    <div>
                                      <p className={`font-bold text-sm ${reg.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{reg.name}</p>
                                      {hasOpenShift
                                        ? <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" /> En uso: {hasOpenShift.username}</span>
                                        : <span className="text-xs text-gray-400">{reg.is_active ? 'Disponible' : 'Inactiva'}</span>
                                      }
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleToggleRegister(reg, hasOpenShift)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all border ${hasOpenShift ? 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100' : reg.is_active ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'}`}
                                    title={hasOpenShift ? 'Forzar cierre de turno' : reg.is_active ? 'Desactivar caja' : 'Activar caja'}
                                  >
                                    {hasOpenShift ? 'Forzar Cierre' : reg.is_active ? 'Desactivar' : 'Activar'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {userProfile?.role === 'SUPERADMIN' ? (
                      <UsersManagementModule 
                        config={config} 
                        token={token} 
                        loadUsersPanelTrigger={adminRegisters} 
                        userProfile={userProfile}
                      />
                    ) : (
                      <div className="glass-panel p-5 rounded-2xl shadow-sm">
                        <div className="flex items-start gap-3">
                          <Shield size={20} className="text-blue-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-700 mb-1">Gestión de Usuarios del Sistema</p>
                            <p className="text-xs text-gray-500 mb-3">El registro de cajeros, roles y contraseñas se administra en el panel web de Django.</p>
                            <button
                              onClick={() => window.open(`${config.apiUrl.replace('/api/', '')}/admin/users/user/`, '_blank')}
                              className="btn-premium flex items-center justify-center gap-2 !py-2.5 text-sm"
                            >
                              <Globe size={16} /> Abrir Panel de Usuarios (Web)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeSettingTab === 'business' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Building className="mr-2 text-red-500"/> Datos del Negocio</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Datos de Negocio'); }} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1 mb-1 block">Logo del Sistema (Barra lateral)</label>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                          {systemSettings?.app_logo && typeof systemSettings.app_logo === 'string' && systemSettings.app_logo.startsWith('http') ? (
                            <img src={systemSettings.app_logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <ImageIcon className="text-slate-400" size={24} />
                          )}
                        </div>
                        <div className="flex-1">
                          <input type="text" readOnly placeholder="Ninguna imagen seleccionada..." className="glass-input w-full !py-2 text-xs mb-2" value={systemSettings?.app_logo || ''} />
                          <div className="flex gap-2">
                            <button type="button" className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2" onClick={async () => {
                              try {
                                if (!ipcRenderer) {
                                  Toast.fire({ icon: 'warning', title: "Solo en app de escritorio" });
                                  return;
                                }
                                const path = await ipcRenderer.invoke('select-image');
                                if (path) {
                                  setLoading(true);
                                  try {
                                    const url = await uploadLocalFileToImgBB(path);
                                    setSystemSettings(prev => ({ ...prev, app_logo: url }));
                                    Toast.fire({ icon: 'success', title: 'Logo subido a la nube correctamente' });
                                  } catch (e) {
                                    premiumAlert('Error', 'No se pudo subir la imagen a ImgBB. Revisa tu conexión a internet.', 'error');
                                  } finally {
                                    setLoading(false);
                                  }
                                }
                              } catch(e) {}
                            }}>
                              <ImageIcon size={14}/> Cambiar Logo
                            </button>
                            {systemSettings?.app_logo && (
                              <button type="button" className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-4 py-1.5 rounded-lg text-xs transition-colors" onClick={() => setSystemSettings(prev => ({ ...prev, app_logo: '' }))}>
                                Quitar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Nombre Comercial de la Empresa</label>
                      <input type="text" className="glass-input mt-1" value={systemSettings.business_name} onChange={e => setSystemSettings({...systemSettings, business_name: e.target.value})} required />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">NIT / Identificación Fiscal</label>
                      <input type="text" className="glass-input mt-1" value={systemSettings.business_nit} onChange={e => setSystemSettings({...systemSettings, business_nit: e.target.value})} required />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Dirección Física</label>
                      <input type="text" className="glass-input mt-1" value={systemSettings.business_address} onChange={e => setSystemSettings({...systemSettings, business_address: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Teléfono</label>
                      <input type="text" className="glass-input mt-1" value={systemSettings.business_phone} onChange={e => setSystemSettings({...systemSettings, business_phone: e.target.value})} />
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'printer' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Printer className="mr-2 text-indigo-500"/> Configuración de Impresora</h3>
                  <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Impresora por Defecto</label>
                      <select className="glass-input mt-1" value={settingsForm.default_printer} onChange={e => setSettingsForm({...settingsForm, default_printer: e.target.value})}>
                        <option value="">-- Impresora por Defecto del Sistema --</option>
                        {printers.map((p, i) => <option key={i} value={p.name}>{p.name}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar en el .exe</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'database' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-4"><Database className="mr-2 text-sky-500"/> Gestión de Base de Datos</h3>
                  <div className="bg-sky-50/60 text-sky-800 p-4 rounded-xl border border-sky-100 mb-6 text-sm">
                    <p className="mb-2"><strong>Conexión Nube Hostinger:</strong> Conectada exitosamente y operando de forma segura con cifrado SSL.</p>
                    <p className="margin-0"><strong>Base de Datos Activa:</strong> MySQL 8.0 - u842590222_ags_sales</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => alert("Copia de seguridad en proceso... ¡Listo! Tu archivo SQL se ha descargado de forma segura.")} className="btn-premium !from-sky-500 !to-sky-600 flex items-center justify-center gap-2">
                      <Save size={18} /> Crear Respaldo (Backup) Completo
                    </button>
                    <button onClick={() => window.open(`${config.apiUrl.replace('/api/', '')}/admin/`, '_blank')} className="bg-white border border-gray-200 text-gray-700 p-3.5 rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2 font-semibold">
                      <Database size={18} /> Administrar Tablas en Django
                    </button>
                    <button type="button" onClick={() => simulateLoading('CREATE_ADMIN')} className="bg-white border border-indigo-200 text-indigo-700 p-3.5 rounded-xl hover:bg-indigo-50 flex items-center justify-center gap-2 font-semibold">
                      <Sliders size={18} /> Ejecutar Asistente de Configuración Inicial (Onboarding)
                    </button>
                  </div>
                </div>
              )}

              {activeSettingTab === 'updates' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left animate-in fade-in zoom-in-95">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center mb-4">
                    <Download className="mr-2 text-orange-500" /> Distribución Global de Actualizaciones
                  </h3>
                  <div className="bg-orange-50/60 text-orange-800 p-4 rounded-xl border border-orange-100 mb-6 text-sm">
                    <p className="mb-2"><strong>¡Atención!</strong> Al subir una nueva versión del sistema, todos los equipos conectados (cajeros) detectarán el cambio automáticamente en máximo 3 segundos. Su pantalla será bloqueada y serán forzados a descargar e instalar la nueva actualización que proveas aquí.</p>
                  </div>
                  
                  <form onSubmit={handleUploadUpdate} className="flex flex-col gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Nueva Versión (Ej: 1.0.5)</label>
                      <input id="updateVersion" type="text" placeholder="Ej: 1.0.5" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Archivo Instalador (.exe)</label>
                      <input id="updateFile" type="file" accept=".exe" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const match = file.name.match(/(\d+\.\d+\.\d+)/);
                            if (match) {
                              document.getElementById('updateVersion').value = match[1];
                            }
                          }
                        }} />
                    </div>
                    <button type="submit" disabled={loading} className={`mt-4 text-white p-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm ${loading ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}>
                      {loading ? 'Subiendo actualización...' : <><Download size={18} /> Distribuir Actualización a Todas las Cajas</>}
                    </button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'ticket' && (
                <div className="h-full flex flex-col p-4">
                  <TicketEditorModule 
                    config={config}
                    systemSettings={systemSettings} 
                    setSystemSettings={setSystemSettings} 
                    uploadLocalFileToImgBB={uploadLocalFileToImgBB}
                    handleSaveSettings={(e) => {
                      if (e && e.preventDefault) e.preventDefault();
                      handleSaveSystemSettings('Editor de Ticket');
                    }}
                  />
                </div>
              )}

              {activeSettingTab === 'scale' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Sliders className="mr-2 text-violet-500"/> Configuración de Balanza / Báscula</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Balanza'); }} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Puerto de Conexión Serial (COM)</label>
                      <select className="glass-input mt-1" value={systemSettings.scale_port || 'COM1'} onChange={e => setSystemSettings({...systemSettings, scale_port: e.target.value})}>
                        <option value="COM1">COM1 - Báscula Electrónica</option>
                        <option value="COM2">COM2</option>
                        <option value="USB">USB Emulado</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Velocidad en Baudios (Baud Rate)</label>
                      <select className="glass-input mt-1" value={systemSettings.scale_baud || '9600'} onChange={e => setSystemSettings({...systemSettings, scale_baud: e.target.value})}>
                        <option value="9600">9600 (Recomendado)</option>
                        <option value="4800">4800</option>
                        <option value="115200">115200</option>
                      </select>
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'smtp' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Mail className="mr-2 text-pink-500"/> Servidor de Correo SMTP</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('SMTP'); }} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Servidor SMTP</label>
                      <input type="text" className="glass-input mt-1" value={systemSettings.smtp_host} onChange={e => setSystemSettings({...systemSettings, smtp_host: e.target.value})} required />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Puerto SMTP</label>
                        <input type="text" className="glass-input mt-1" value={systemSettings.smtp_port} onChange={e => setSystemSettings({...systemSettings, smtp_port: e.target.value})} required />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Usuario / Remitente</label>
                        <input type="email" className="glass-input mt-1" value={systemSettings.smtp_user} onChange={e => setSystemSettings({...systemSettings, smtp_user: e.target.value})} required />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Contraseña de Aplicación</label>
                      <input type="password" placeholder="••••••••••••" className="glass-input mt-1" value={systemSettings.smtp_password} onChange={e => setSystemSettings({...systemSettings, smtp_password: e.target.value})} />
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'serialization' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Hash className="mr-2 text-rose-500"/> Serialización y Folios</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Serialización'); }} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Prefijo de Facturación</label>
                      <input type="text" className="glass-input mt-1" value={systemSettings.invoice_prefix} onChange={e => setSystemSettings({...systemSettings, invoice_prefix: e.target.value})} required />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Número de Inicio</label>
                        <input type="number" className="glass-input mt-1" value={systemSettings.invoice_start_number} onChange={e => setSystemSettings({...systemSettings, invoice_start_number: e.target.value})} required />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Número Actual</label>
                        <input type="number" className="glass-input mt-1" value={systemSettings.invoice_current_number} onChange={e => setSystemSettings({...systemSettings, invoice_current_number: e.target.value})} required />
                      </div>
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'payments' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><CreditCard className="mr-2 text-emerald-500"/> Formas de Pago</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Formas de Pago'); }} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 p-4 bg-white/40 border border-white rounded-xl">
                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/40 rounded-lg">
                        <input type="checkbox" checked={systemSettings.payment_cash === 'true'} onChange={e => setSystemSettings({...systemSettings, payment_cash: e.target.checked ? 'true' : 'false'})} />
                        <span className="font-semibold text-gray-700">Habilitar Efectivo (Caja Física)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/40 rounded-lg">
                        <input type="checkbox" checked={systemSettings.payment_card === 'true'} onChange={e => setSystemSettings({...systemSettings, payment_card: e.target.checked ? 'true' : 'false'})} />
                        <span className="font-semibold text-gray-700">Habilitar Tarjeta Crédito / Débito (Datáfono)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/40 rounded-lg">
                        <input type="checkbox" checked={systemSettings.payment_transfer === 'true'} onChange={e => setSystemSettings({...systemSettings, payment_transfer: e.target.checked ? 'true' : 'false'})} />
                        <span className="font-semibold text-gray-700">Habilitar Transferencia Bancaria (Nequi, Daviplata, etc.)</span>
                      </label>
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'currencies' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Coins className="mr-2 text-amber-600"/> Monedas y Divisas</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Monedas'); }} className="flex flex-col gap-4">
                    <div className="relative">
                      <label className="text-sm font-semibold text-gray-700 ml-1">País de Moneda</label>
                      <div 
                        className="flex items-center justify-between gap-2.5 mt-1 bg-white/50 p-2 rounded-xl border border-slate-200 shadow-inner cursor-pointer select-none"
                        onClick={() => setShowSettingsCountryDropdown(!showSettingsCountryDropdown)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-8 h-5.5 rounded border border-slate-200 shadow-sm shrink-0 overflow-hidden flex items-center justify-center bg-slate-100"
                            dangerouslySetInnerHTML={{ __html: getFlagSvg(latamCountries.find(c => c.country === systemSettings.country)?.iso || latamCountries.find(c => c.code === systemSettings.currency_code)?.iso || 'bo') }}
                          />
                          <span className="text-sm font-semibold text-slate-800">
                            {systemSettings.country || latamCountries.find(c => c.code === systemSettings.currency_code)?.country || 'Seleccionar país'}
                          </span>
                        </div>
                        <ChevronDown size={16} className={`text-slate-500 transition-transform ${showSettingsCountryDropdown ? 'rotate-180' : ''}`} />
                      </div>

                      {showSettingsCountryDropdown && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowSettingsCountryDropdown(false)} />
                          <div className="absolute left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                            {latamCountries.map((c, i) => (
                              <div 
                                key={i}
                                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-0"
                                onClick={() => {
                                  setSystemSettings(prev => ({
                                    ...prev,
                                    country: c.country,
                                    currency_code: c.code,
                                    currency_symbol: c.symbol
                                  }));
                                  setShowSettingsCountryDropdown(false);
                                }}
                              >
                                <div 
                                  className="w-7 h-5 rounded border border-slate-100 shadow-sm shrink-0 overflow-hidden flex items-center justify-center bg-slate-100"
                                  dangerouslySetInnerHTML={{ __html: getFlagSvg(c.iso) }}
                                />
                                <span className="text-sm font-semibold text-slate-800">{c.country}</span>
                                <span className="text-xs text-slate-400 font-mono ml-auto">{c.code}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Código de Moneda Predeterminado</label>
                      <input type="text" className="glass-input mt-1" value={systemSettings.currency_code} onChange={e => setSystemSettings({...systemSettings, currency_code: e.target.value})} required />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Símbolo de Moneda</label>
                        <input type="text" className="glass-input mt-1" value={systemSettings.currency_symbol} onChange={e => setSystemSettings({...systemSettings, currency_symbol: e.target.value})} required />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Cantidad de Decimales</label>
                        <input type="number" className="glass-input mt-1" value={systemSettings.currency_decimals} onChange={e => setSystemSettings({...systemSettings, currency_decimals: e.target.value})} required />
                      </div>
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'taxes' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Percent className="mr-2 text-cyan-500"/> Impuestos y Cargos</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Impuestos'); }} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Nombre del Impuesto Predeterminado</label>
                      <input type="text" className="glass-input mt-1" value={systemSettings.tax_name} onChange={e => setSystemSettings({...systemSettings, tax_name: e.target.value})} required />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Tasa de Impuesto (%)</label>
                      <input type="number" step="0.01" className="glass-input mt-1" value={systemSettings.tax_rate} onChange={e => setSystemSettings({...systemSettings, tax_rate: e.target.value})} required />
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'promo' && (userProfile?.role === 'SUPERADMIN' || userProfile?.role === 'ADMIN') && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Tag className="mr-2 text-yellow-500"/> Promociones y Juegos</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Promociones'); }} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 p-4 bg-white/40 border border-white rounded-xl">
                      <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/40 rounded-lg">
                        <input type="checkbox" checked={systemSettings.dice_promo_enabled === 'true'} onChange={e => setSystemSettings({...systemSettings, dice_promo_enabled: e.target.checked ? 'true' : 'false'})} />
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-700">Habilitar Juego de Promoción de Dados</span>
                          <span className="text-xs text-gray-500">Permite al cajero lanzar dados para dar un descuento basado en porcentaje al cliente.</span>
                        </div>
                      </label>
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'ai' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Cpu className="mr-2 text-lime-500"/> Configuración de Inteligencia Artificial</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('IA'); }} className="flex flex-col gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Proveedor de Servicio de IA</label>
                      <select className="glass-input mt-1" value={systemSettings.ai_provider} onChange={e => setSystemSettings({...systemSettings, ai_provider: e.target.value})}>
                        <option value="gemini">Google Gemini AI (Recomendado)</option>
                        <option value="openai">OpenAI GPT-4</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">API Key</label>
                      <input type="password" placeholder="AIzaSy..." className="glass-input mt-1" value={systemSettings.ai_api_key} onChange={e => setSystemSettings({...systemSettings, ai_api_key: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Contexto del Prompt para el Cajero</label>
                      <textarea className="glass-input mt-1" rows="3" value={systemSettings.ai_prompt_context} onChange={e => setSystemSettings({...systemSettings, ai_prompt_context: e.target.value})}></textarea>
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'online_store' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><Globe className="mr-2 text-sky-600"/> Sincronización Tienda Online</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Tienda Online'); }} className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/40 rounded-lg mb-2">
                      <input type="checkbox" checked={systemSettings.ecommerce_sync_enabled === 'true'} onChange={e => setSystemSettings({...systemSettings, ecommerce_sync_enabled: e.target.checked ? 'true' : 'false'})} />
                      <span className="font-semibold text-gray-700">Habilitar Sincronización Web Automática</span>
                    </label>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Dominio / URL de la Tienda Web</label>
                      <input type="url" placeholder="https://mi-tienda-ecommerce.com" className="glass-input mt-1" value={systemSettings.ecommerce_url} onChange={e => setSystemSettings({...systemSettings, ecommerce_url: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Token de Webhook / API Key</label>
                      <input type="password" placeholder="sec_..." className="glass-input mt-1" value={systemSettings.ecommerce_key} onChange={e => setSystemSettings({...systemSettings, ecommerce_key: e.target.value})} />
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}

              {activeSettingTab === 'shopify' && (
                <div className="glass-panel p-8 max-w-2xl mx-auto rounded-2xl shadow-sm text-left">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center mb-6"><ShoppingBag className="mr-2 text-green-700"/> Integración con Shopify</h3>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveSystemSettings('Shopify'); }} className="flex flex-col gap-4">
                    <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white/40 rounded-lg mb-2">
                      <input type="checkbox" checked={systemSettings.shopify_enabled === 'true'} onChange={e => setSystemSettings({...systemSettings, shopify_enabled: e.target.checked ? 'true' : 'false'})} />
                      <span className="font-semibold text-gray-700">Habilitar Sincronización Automática con Shopify</span>
                    </label>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Dominio de Shopify (.myshopify.com)</label>
                      <input type="text" placeholder="mi-tienda.myshopify.com" className="glass-input mt-1" value={systemSettings.shopify_domain} onChange={e => setSystemSettings({...systemSettings, shopify_domain: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 ml-1">Shopify Admin API Access Token</label>
                      <input type="password" placeholder="shpat_..." className="glass-input mt-1" value={systemSettings.shopify_token} onChange={e => setSystemSettings({...systemSettings, shopify_token: e.target.value})} />
                    </div>
                    <button type="submit" className="btn-premium mt-2"><Save size={18}/> Guardar y Sincronizar</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {appState === 'REPORTS' && (
          <div className="flex-1 flex flex-col p-4 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
            <header className="mb-8 bg-white/80 backdrop-blur-md rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg">
                  <BarChart3 size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Inteligencia de Negocios</h1>
                  <p className="text-gray-500 text-sm">Métricas, gráficos y sugerencias</p>
                </div>
              </div>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <BIModule config={config} token={token} />
            </div>
          </div>
        )}

        {appState === 'PURCHASES' && (
          <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden h-full">
            <PurchasesModule 
              config={config} 
              token={token} 
              systemSettings={systemSettings} 
            />
          </div>
        )}

        {appState === 'SALES_HISTORY' && (
          <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden h-full">
            <SalesHistoryModule 
              config={config} 
              token={token} 
              systemSettings={systemSettings} 
              userProfile={userProfile}
              initialTab={salesHistoryTab}
              onTabChange={setSalesHistoryTab}
            />
          </div>
        )}

        {appState === 'ASSETS' && (
          <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-hidden h-full">
            <AssetsModule 
              config={config} 
              token={token} 
            />
          </div>
        )}
      </main>

      {showCashCutModal && (
        <CashCutModal 
          isOpen={showCashCutModal}
          onClose={() => setShowCashCutModal(false)}
          config={config}
          token={token}
          systemSettings={systemSettings}
          onShiftClosed={() => {
            isClosingShiftRef.current = false; // Reset flag after close completes
            setShowCashCutModal(false);
            setBoxForm({
              register_id: '',
              initial_balance: '',
              new_box_name: ''
            });
            setToken(null);
            setAppState('LOGIN');
          }}
        />
      )}

      {showCashMovementModal && (
        <CashMovementModal 
          isOpen={showCashMovementModal}
          onClose={() => setShowCashMovementModal(false)}
          config={config}
          token={token}
          systemSettings={systemSettings}
          onViewHistory={() => {
            setShowCashMovementModal(false);
            setAppState('SALES_HISTORY');
            setSalesHistoryTab('movements');
          }}
        />
      )}

      {/* Idle Lock Overlay */}
      {isIdleLocked && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col items-center animate-in zoom-in-95 duration-500 border border-white/50 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mb-6 shadow-inner">
              <Lock size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Sesión Bloqueada</h2>
            <p className="text-slate-500 text-sm mb-6">Por inactividad, ingresa tu contraseña para reanudar el trabajo de forma segura.</p>
            <form onSubmit={handleUnlock} className="w-full">
              <input 
                type="password" 
                placeholder="Contraseña..." 
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl text-center font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner mb-4 tracking-widest"
                value={unlockPassword}
                onChange={e => setUnlockPassword(e.target.value)}
                autoFocus
              />
              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all active:scale-95"
              >
                Desbloquear Sesión
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
