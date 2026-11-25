import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, ShoppingCart, Package, Wallet, Users, Truck,
  ChartNoAxesCombined, Settings, Bell, RefreshCw, Download, Building2,
  Sparkles, AlertTriangle, CheckCircle2, MoreHorizontal, Trash2, Menu, X,
  Upload, FileText, Plus, ShieldCheck, ClipboardList, Receipt, TrendingUp,
  CircleDollarSign, FileSpreadsheet, HandCoins, ArrowUpRight, ArrowDownLeft,
  Calendar, Eye, ExternalLink, HelpCircle, Layers, Check, Search, LogOut,
  User, Phone, MapPin, Briefcase, Lock, Globe, KeyRound, UserPlus
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import './style.css';

const API = 'http://localhost:4000/api';
const money = (n) => 'NPR ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

async function request(path, options = {}) {
  const token = localStorage.getItem('bo_token');
  const r = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers
    }
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) {
    localStorage.removeItem('bo_token');
    localStorage.removeItem('bo_user');
  }
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRILINGUAL LOCALIZATION (English, Nepali, Hindi)
// ─────────────────────────────────────────────────────────────────────────────
const I18N = {
  en: {
    welcome: 'Welcome to Khata AI',
    tagline: "Let's make today a productive business day.",
    loginTab: 'Log In',
    signupTab: 'Sign Up',
    loginSubtitle: 'Log in with your phone number and password',
    signupSubtitle: 'Register your business workspace with Khata AI',
    phone: 'Phone Number',
    password: 'Password',
    userName: 'User Name',
    businessName: 'Name of the Business',
    address: 'Address',
    loginBtn: 'Log In to Khata AI',
    signupBtn: 'Create Khata AI Account',
    alreadyHaveAcc: 'Already have an account? Log In',
    dontHaveAcc: "Don't have an account? Sign Up",
    langPrompt: 'Available in 3 languages:',
    secureNote: 'Encrypted Session · Auto-syncs with SQLite & Excel',
    todaysSales: "Today's sales",
    monthlyRevenue: 'Monthly revenue',
    totalExpenses: 'Total expenses',
    netProfit: 'Net profit',
    toReceive: 'To receive',
    toPay: 'To pay',
    quickActions: 'Quick actions',
    quickTagline: 'A little less admin. A lot more business.',
    uploadInvoice: 'Upload invoice',
    addSale: 'Add sale',
    addProduct: 'Add product',
    purchaseOrder: 'Purchase order',
    recordPayment: 'Record payment',
    addExpense: 'Add expense',
    revExpenses: 'Revenue & expenses',
    businessInsights: 'Business insights',
    recentSales: 'Recent sales',
    stockOverview: 'Stock overview',
    signOut: 'Sign Out',
    excelSheets: 'In-App Excel Sheets',
    dataDriven: 'Data-driven',
    viewAll: 'View all',
    inventory: 'Inventory'
  },
  ne: {
    welcome: 'खाता AI मा स्वागत छ',
    tagline: 'आजको दिनलाई व्यावसायिक रूपमा सफल बनाऔं।',
    loginTab: 'लगइन गर्नुहोस्',
    signupTab: 'साइन अप (नयाँ खाता)',
    loginSubtitle: 'लगइन गर्न आफ्नो फोन नम्बर र पासवर्ड प्रविष्ट गर्नुहोस्',
    signupSubtitle: 'खाता AI मा आफ्नो नयाँ व्यवसाय दर्ता गर्नुहोस्',
    phone: 'फोन नम्बर',
    password: 'पासवर्ड',
    userName: 'प्रयोगकर्ताको नाम',
    businessName: 'व्यवसायको नाम',
    address: 'ठेगाना',
    loginBtn: 'खाता AI मा लगइन गर्नुहोस्',
    signupBtn: 'खाता AI दर्ता गर्नुहोस्',
    alreadyHaveAcc: 'पहिले नै खाता छ? लगइन गर्नुहोस्',
    dontHaveAcc: 'खाता छैन? यहाँ नयाँ खाता बनाउनुहोस्',
    langPrompt: '३ भाषामा उपलब्ध छ:',
    secureNote: 'सुरक्षित सत्र · SQLite र Excel सँग प्रत्यक्ष सिङ्क',
    todaysSales: 'आजको बिक्री',
    monthlyRevenue: 'मासिक आम्दानी',
    totalExpenses: 'कुल खर्च',
    netProfit: 'खुद नाफा',
    toReceive: 'उठ्न बाँकी रकम',
    toPay: 'तिर्न बाँकी रकम',
    quickActions: 'द्रुत कार्यहरू',
    quickTagline: 'कम झन्झट, बढी व्यापार।',
    uploadInvoice: 'बिल अपलोड',
    addSale: 'बिक्री थप्नुहोस्',
    addProduct: 'सामान थप्नुहोस्',
    purchaseOrder: 'खरिद अर्डर',
    recordPayment: 'भुक्तानी दर्ता',
    addExpense: 'खर्च थप्नुहोस्',
    revExpenses: 'आम्दानी र खर्च',
    businessInsights: 'व्यापारिक विश्लेषण',
    recentSales: 'हालको बिक्री',
    stockOverview: 'स्टक विवरण',
    signOut: 'लगआउट',
    excelSheets: 'एक्सेल पानाहरू',
    dataDriven: 'तथ्यांक-आधारित',
    viewAll: 'सबै हेर्नुहोस्',
    inventory: 'सामान स्टक'
  },
  hi: {
    welcome: 'खाता AI में आपका स्वागत है',
    tagline: 'आइए आज के दिन को व्यापारिक दृष्टि से सफल बनाएं।',
    loginTab: 'लॉग इन करें',
    signupTab: 'साइन अप (नया खाता)',
    loginSubtitle: 'लॉग इन करने के लिए अपना फोन नंबर और पासवर्ड दर्ज करें',
    signupSubtitle: 'खाता AI पर अपने नए व्यवसाय का पंजीकरण करें',
    phone: 'फ़ोन नंबर',
    password: 'पासवर्ड',
    userName: 'उपयोगकर्ता का नाम',
    businessName: 'व्यवसाय का नाम',
    address: 'पता',
    loginBtn: 'खाता AI में लॉग इन करें',
    signupBtn: 'खाता AI खाता बनाएं',
    alreadyHaveAcc: 'पहले से खाता है? लॉग इन करें',
    dontHaveAcc: 'खाता नहीं है? नया खाता बनाएं',
    langPrompt: '३ भाषाओं में उपलब्ध:',
    secureNote: 'सुरक्षित सत्र · SQLite और Excel के साथ लाइव सिंक',
    todaysSales: 'आज की बिक्री',
    monthlyRevenue: 'मासिक राजस्व',
    totalExpenses: 'कुल खर्च',
    netProfit: 'शुद्ध लाभ',
    toReceive: 'लेने योग्य राशि',
    toPay: 'देय राशि',
    quickActions: 'त्वरित कार्य',
    quickTagline: 'कम कागजी काम, अधिक व्यापार।',
    uploadInvoice: 'बिल अपलोड',
    addSale: 'बिक्री जोड़ें',
    addProduct: 'उत्पाद जोड़ें',
    purchaseOrder: 'खरीद आदेश',
    recordPayment: 'भुगतान दर्ज करें',
    addExpense: 'खर्च जोड़ें',
    revExpenses: 'राजस्व और खर्च',
    businessInsights: 'व्यापारिक अंतर्दृष्टि',
    recentSales: 'हाल की बिक्री',
    stockOverview: 'स्टॉक अवलोकन',
    signOut: 'लॉग आउट',
    excelSheets: 'एक्सेल शीट्स',
    dataDriven: 'डेटा-संचालित',
    viewAll: 'सभी देखें',
    inventory: 'इन्वेंट्री'
  }
};

function Field({ label, value, onChange, type = 'text', placeholder = '', required = false, icon: Icon }) {
  return (
    <label className="field">
      <span>{label}{required && <em style={{ color: '#ef4444' }}> *</em>}</span>
      <div className="input-with-icon">
        {Icon && <Icon size={16} className="field-icon" />}
        <input
          type={type}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          required={required}
        />
      </div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION & LOGIN/SIGNUP PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LoginPage({ onLoginSuccess, lang, setLang }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({
    userName: '',
    businessName: '',
    address: '',
    phone: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = I18N[lang] || I18N.en;
  const fset = k => v => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (!form.userName.trim() || !form.businessName.trim() || !form.phone.trim() || !form.password.trim()) {
        setError('Please fill in User name, Business name, Phone number, and Password.');
        return;
      }
    } else {
      if (!form.phone.trim() || !form.password.trim()) {
        setError('Please enter your Phone number and Password.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/auth/khata-signup' : '/auth/khata-login';
      const body = mode === 'signup'
        ? form
        : { phone: form.phone, password: form.password };

      const res = await fetch(API + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      localStorage.setItem('bo_token', data.token);
      localStorage.setItem('bo_user', JSON.stringify({
        ...data.user,
        businessName: data.business?.name || form.businessName,
        address: data.business?.address || form.address
      }));

      onLoginSuccess(data.user, data.business);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-card-container">
        {/* Language Selection Header */}
        <div className="lang-selector-header">
          <div className="lang-prompt-wrap">
            <Globe size={14} />
            <span>{t.langPrompt}</span>
          </div>
          <div className="lang-options-group">
            <button
              type="button"
              className={'lang-pill ' + (lang === 'en' ? 'active' : '')}
              onClick={() => setLang('en')}
            >
              English
            </button>
            <button
              type="button"
              className={'lang-pill ' + (lang === 'ne' ? 'active' : '')}
              onClick={() => setLang('ne')}
            >
              नेपाली
            </button>
            <button
              type="button"
              className={'lang-pill ' + (lang === 'hi' ? 'active' : '')}
              onClick={() => setLang('hi')}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* Brand Header */}
        <div className="login-brand">
          <div className="login-logo-badge">
            <Sparkles size={24} />
          </div>
          <h1>{t.welcome}</h1>
          <p>{mode === 'login' ? t.loginSubtitle : t.signupSubtitle}</p>
        </div>

        {/* Mode Switcher Tabs (Login vs Sign Up) */}
        <div className="auth-mode-tabs">
          <button
            type="button"
            className={'auth-mode-tab ' + (mode === 'login' ? 'active' : '')}
            onClick={() => { setMode('login'); setError(''); }}
          >
            <KeyRound size={15} />
            <span>{t.loginTab}</span>
          </button>
          <button
            type="button"
            className={'auth-mode-tab ' + (mode === 'signup' ? 'active' : '')}
            onClick={() => { setMode('signup'); setError(''); }}
          >
            <UserPlus size={15} />
            <span>{t.signupTab}</span>
          </button>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <Field
                label={t.userName}
                icon={User}
                value={form.userName}
                onChange={fset('userName')}
                placeholder="e.g. Ramesh Sharma"
                required
              />

              <Field
                label={t.businessName}
                icon={Briefcase}
                value={form.businessName}
                onChange={fset('businessName')}
                placeholder="e.g. Sharma Grocery & Traders"
                required
              />

              <Field
                label={t.address}
                icon={MapPin}
                value={form.address}
                onChange={fset('address')}
                placeholder="e.g. New Road, Kathmandu"
              />
            </>
          )}

          <Field
            label={t.phone}
            icon={Phone}
            value={form.phone}
            onChange={fset('phone')}
            type="tel"
            placeholder="e.g. 9841234567"
            required
          />

          <Field
            label={t.password}
            icon={Lock}
            value={form.password}
            onChange={fset('password')}
            type="password"
            placeholder="••••••••"
            required
          />

          <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? t.loginBtn : t.signupBtn}</span>
                <ArrowUpRight size={18} />
              </>
            )}
          </button>

          {/* Toggle Helper Link */}
          <div
            className="auth-toggle-link"
            onClick={() => {
              setMode(m => (m === 'login' ? 'signup' : 'login'));
              setError('');
            }}
          >
            {mode === 'login' ? t.dontHaveAcc : t.alreadyHaveAcc}
          </div>
        </form>

        <div className="login-card-footer">
          <ShieldCheck size={16} className="shield-icon" />
          <span>{t.secureNote}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('bo_lang') || 'en');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem('bo_user');
      const t = localStorage.getItem('bo_token');
      return (u && t) ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  });

  const [page, setPage] = useState('Overview');
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState('');
  const [toast, setToast] = useState({ msg: '', ok: true });
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [reports, setReports] = useState(null);
  const [settings, setSettings] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [form, setForm] = useState({});
  const [excelModal, setExcelModal] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('This month');
  const fileRef = useRef(null);

  const t = I18N[lang] || I18N.en;

  const handleSetLang = (l) => {
    setLang(l);
    localStorage.setItem('bo_lang', l);
  };

  const notify = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: '', ok: true }), 3500);
  };

  const load = async () => {
    if (!localStorage.getItem('bo_token')) return;
    setLoading(true);
    try {
      const [d, p, c, s, sa, po, e, pa, re, no, se, inv] = await Promise.all([
        '/dashboard', '/products', '/customers', '/suppliers', '/sales', '/purchases',
        '/expenses', '/payments', '/reports', '/notifications', '/settings', '/invoices'
      ].map(x => request(x)));
      setDashboard(d); setProducts(p); setCustomers(c); setSuppliers(s); setSales(sa);
      setPurchases(po); setExpenses(e); setPayments(pa); setReports(re);
      setNotifications(no); setSettings(se); setInvoices(inv);
    } catch (e) {
      if (e.message.includes('Unauthorized') || e.message.includes('session')) {
        setCurrentUser(null);
      }
      notify(e.message, false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      load();
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('bo_token');
    localStorage.removeItem('bo_user');
    setCurrentUser(null);
    setDashboard(null);
    notify('Signed out of Khata AI');
  };

  const handleLoginSuccess = (user, business) => {
    setCurrentUser(user);
    if (business) {
      setSettings(business);
    }
    notify(`Welcome to Khata AI, ${user.name}! ✓`);
  };

  // If not authenticated, show the Login / Signup Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} lang={lang} setLang={handleSetLang} />;
  }

  const nav = [
    {
      label: 'WORKSPACE',
      items: [
        ['Overview', LayoutDashboard],
        ['Sales & Invoices', ShoppingCart],
        ['Inventory', Package],
        ['Finance', Wallet],
        ['Excel Sheets', FileSpreadsheet]
      ]
    },
    {
      label: 'BUSINESS MANAGEMENT',
      items: [
        ['Purchase Orders', ClipboardList],
        ['Suppliers', Truck],
        ['Customers', Users],
        ['Invoices', FileText],
        ['Reports', ChartNoAxesCombined]
      ]
    },
    {
      label: 'SETTINGS & HELP',
      items: [
        ['Settings', Settings],
        ['Notifications', Bell]
      ]
    }
  ];

  const fset = k => v => setForm(f => ({ ...f, [k]: v }));

  // ─── Save Handlers ──────────────────────────────────────────────────────────
  const save = async () => {
    try {
      if (modal === 'Sale') {
        await request('/sales', {
          method: 'POST',
          body: JSON.stringify({
            customer_name: form.customer_name || '',
            product_name: form.product_name,
            price: form.price,
            discount: form.discount || 0,
            purchase_price: form.purchase_price || 0,
            remarks: form.remarks || '',
            quantity: form.quantity || 1,
          })
        });
        notify('Sale recorded and saved to sales.csv ✓');
      } else if (modal === 'Purchase') {
        await request('/purchases', {
          method: 'POST',
          body: JSON.stringify({
            supplier: form.supplier,
            product: form.product,
            quantity: form.quantity,
            unit_cost: form.unit_cost,
            expected_date: form.expected_date || '',
          })
        });
        notify('Purchase order recorded and saved to purchases.csv ✓');
      } else if (modal === 'Payment') {
        await request('/payments', {
          method: 'POST',
          body: JSON.stringify({
            type: form.type || 'expense',
            amount: form.amount,
            method: form.method || 'Cash',
            note: form.note || '',
          })
        });
        notify('Payment recorded and saved to payments.csv ✓');
      } else if (modal === 'Product') {
        await request('/products', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            sku: form.sku || '',
            category: form.category || 'General',
            unit: form.unit || 'pcs',
            purchase_price: form.purchase_price || 0,
            selling_price: form.selling_price || 0,
            stock: form.stock || 0,
            min_stock: form.min_stock || 0,
          })
        });
        notify('Product added to inventory ✓');
      } else if (modal === 'Customer') {
        await request('/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            phone: form.phone || '',
            email: form.email || '',
            address: form.address || ''
          })
        });
        notify('Customer added ✓');
      } else if (modal === 'Supplier') {
        await request('/suppliers', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            contact: form.contact || '',
            phone: form.phone || '',
            email: form.email || ''
          })
        });
        notify('Supplier added ✓');
      } else if (modal === 'Expense') {
        await request('/expenses', {
          method: 'POST',
          body: JSON.stringify({
            category: form.category,
            description: form.description || '',
            amount: form.amount,
            date: form.date || ''
          })
        });
        notify('Expense recorded and saved to expenses.csv ✓');
      } else if (modal === 'Settings') {
        await request('/settings', {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            currency: form.currency,
            address: form.address
          })
        });
        notify('Workspace settings updated ✓');
      }
      setModal('');
      load();
    } catch (e) {
      notify(e.message, false);
    }
  };

  // ─── Invoice Upload with Automated Sales Recording ──────────────────────────
  const uploadInvoice = async () => {
    if (!form._file) {
      notify('Please select an invoice file first', false);
      return;
    }
    const fd = new FormData();
    fd.append('invoice', form._file);
    fd.append('customer_name', form.customer_name || '');
    fd.append('product_name', form.product_name || form._file.name);
    fd.append('amount', form.amount || 0);
    fd.append('notes', form.inv_notes || '');

    try {
      const token = localStorage.getItem('bo_token');
      const r = await fetch(API + '/invoices/upload', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Upload failed');
      notify('Invoice uploaded! Recorded into Invoices and Sales Excel sheets ✓');
      setModal('');
      load();
    } catch (e) {
      notify(e.message, false);
    }
  };

  // ─── Direct CSV Export ──────────────────────────────────────────────────────
  const exportCSV = (rows, filename, cols) => {
    if (!rows?.length) {
      notify('No records to export in this sheet', false);
      return;
    }
    const hdr = cols.map(c => c[0]);
    const csv = [
      hdr.join(','),
      ...rows.map(r => cols.map(c => `"${String(r[c[1]] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    notify(`Downloaded ${filename} ✓`);
  };

  const exportSales = () => exportCSV(sales, 'sales.csv', [
    ['Invoice No', 'invoice_no'], ['Customer', 'customer_name'], ['Product', 'product_name'],
    ['Price', 'price'], ['Discount', 'discount'], ['Purchase Price', 'purchase_price'],
    ['Total', 'total'], ['Remarks', 'remarks'], ['Date', 'created_at']
  ]);
  const exportPurchases = () => exportCSV(purchases, 'purchases.csv', [
    ['Supplier', 'supplier'], ['Product', 'product'], ['Quantity', 'quantity'],
    ['Unit Cost', 'unit_cost'], ['Total', 'total'], ['Status', 'status'], ['Expected Date', 'expected_date'], ['Date', 'created_at']
  ]);
  const exportInvoices = () => exportCSV(invoices, 'invoices.csv', [
    ['ID', 'id'], ['File Name', 'filename'], ['Original Name', 'original_name'],
    ['Type', 'mime_type'], ['Size (bytes)', 'size'], ['Notes', 'notes'], ['Status', 'status'], ['Date', 'created_at']
  ]);
  const exportExpenses = () => exportCSV(expenses, 'expenses.csv', [
    ['Category', 'category'], ['Description', 'description'], ['Amount', 'amount'], ['Date', 'date']
  ]);
  const exportPayments = () => exportCSV(payments, 'payments.csv', [
    ['Type', 'type'], ['Amount', 'amount'], ['Method', 'method'], ['Note', 'note'], ['Date', 'created_at']
  ]);

  const del = async (endpoint, id, cb) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await request('/' + endpoint + '/' + id, { method: 'DELETE' });
      cb();
      notify('Record deleted successfully ✓');
    } catch (e) {
      notify(e.message, false);
    }
  };

  const todayStr = new Date().toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="app-container">
      {/* ─── DESKTOP SIDEBAR (Blue Color with White Text) ─────────────────── */}
      <aside className={'sidebar blue-sidebar ' + (mobile ? 'open' : '')}>
        <div className="brand blue-brand">
          <span className="brand-icon"><Sparkles size={18} /></span>
          <div>
            <b>Khata <em>AI</em></b>
            <small>INTELLIGENT BUSINESS SAAS</small>
          </div>
          <button className="close-mobile" onClick={() => setMobile(false)}><X size={18} /></button>
        </div>

        <div className="sidebar-scroll">
          {nav.map(group => (
            <div className="nav-group" key={group.label}>
              <label className="nav-group-label">{group.label}</label>
              {group.items.map(([name, Icon]) => (
                <button
                  key={name}
                  className={'nav-item blue-nav-item ' + (page === name ? 'active' : '')}
                  onClick={() => { setPage(name); setMobile(false); }}
                >
                  <Icon size={16} />
                  <span>{name}</span>
                  {name === 'Notifications' && notifications.filter(n => !n.read).length > 0 && (
                    <i className="nav-count">{notifications.filter(n => !n.read).length}</i>
                  )}
                  {name === 'Excel Sheets' && (
                    <span className="excel-tag">LIVE</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom blue-sidebar-bottom">
          <div className="secure"><ShieldCheck size={14} /> Your business, securely connected</div>
          <small>KHATA AI · PRODUCTION V1.0</small>
        </div>
      </aside>

      {/* ─── MAIN CONTENT WRAPPER ────────────────────────────────────────── */}
      <div className="main-wrapper">
        {/* ─── TOP BAR (Blue Header with White Text) ────────────────────────── */}
        <header className="topbar">
          <div className="top-left">
            <button className="mobile-menu" onClick={() => setMobile(true)}><Menu size={20} /></button>
            <div className="biz-avatar"><Building2 size={18} /></div>
            <div>
              <b className="biz-title">{settings?.name || currentUser?.businessName || 'Khata AI Workspace'}</b>
              <small className="biz-meta">
                <i className="status-dot" /> {currentUser?.name || 'Owner'} · {settings?.currency || 'NPR'} · Secure Workspace
              </small>
            </div>
          </div>

          <div className="top-right">
            {/* Language Switcher in Top Bar */}
            <div className="topbar-lang-toggle">
              <button className={lang === 'en' ? 'active' : ''} onClick={() => handleSetLang('en')}>EN</button>
              <button className={lang === 'ne' ? 'active' : ''} onClick={() => handleSetLang('ne')}>नेपाली</button>
              <button className={lang === 'hi' ? 'active' : ''} onClick={() => handleSetLang('hi')}>हिन्दी</button>
            </div>

            <button
              className="excel-top-btn"
              onClick={() => { setPage('Excel Sheets'); setExcelModal('sales'); }}
              title="Open In-App Spreadsheets"
            >
              <FileSpreadsheet size={15} />
              <span>{t.excelSheets}</span>
            </button>

            <span className="connected-badge">
              <i className="status-dot" /> Connected
            </span>

            <button className="icon-action" onClick={() => setPage('Notifications')} title="Notifications">
              <Bell size={18} />
              {notifications.filter(n => !n.read).length > 0 && <i className="red-dot" />}
            </button>

            <button className="icon-action" onClick={load} title="Refresh workspace">
              <RefreshCw size={17} />
            </button>

            <button className="signout-btn" onClick={handleLogout} title="Sign Out">
              <LogOut size={15} />
              <span>{t.signOut}</span>
            </button>
          </div>
        </header>

        {/* ─── PAGE BODY (Sky Blue Background) ─────────────────────────────── */}
        <main className="content-area">
          {loading && (
            <div className="loading-banner">
              <RefreshCw size={14} className="spin" /> Syncing business data…
            </div>
          )}

          {page === 'Overview' && (
            <LandingDashboard
              d={dashboard}
              sales={sales}
              products={products}
              settings={settings}
              userName={currentUser?.name}
              todayStr={todayStr}
              period={chartPeriod}
              setPeriod={setChartPeriod}
              money={money}
              t={t}
              onQuickAction={(action) => {
                if (action === 'invoice') { setForm({}); setModal('InvoiceUpload'); }
                else if (action === 'sale') { setForm({ quantity: 1 }); setModal('Sale'); }
                else if (action === 'product') { setForm({}); setModal('Product'); }
                else if (action === 'purchase') { setForm({ quantity: 1 }); setModal('Purchase'); }
                else if (action === 'payment') { setForm({ type: 'expense', method: 'Cash' }); setModal('Payment'); }
                else if (action === 'expense') { setForm({}); setModal('Expense'); }
              }}
              onViewAllSales={() => setPage('Sales & Invoices')}
              onViewInventory={() => setPage('Inventory')}
              onOpenExcel={(tab) => { setPage('Excel Sheets'); setExcelModal(tab); }}
            />
          )}

          {page === 'Sales & Invoices' && (
            <PageSales
              sales={sales}
              onAdd={() => { setForm({ quantity: 1 }); setModal('Sale'); }}
              onExport={exportSales}
              onDel={(id) => del('sales', id, () => setSales(s => s.filter(x => x.id !== id)))}
              money={money}
              onViewExcel={() => { setPage('Excel Sheets'); setExcelModal('sales'); }}
            />
          )}

          {page === 'Inventory' && (
            <PageInventory
              products={products}
              onAdd={() => { setForm({}); setModal('Product'); }}
              onDel={(id) => del('products', id, () => setProducts(p => p.filter(x => x.id !== id)))}
              money={money}
            />
          )}

          {page === 'Finance' && (
            <PageFinance
              expenses={expenses}
              payments={payments}
              onAddExp={() => { setForm({}); setModal('Expense'); }}
              onAddPay={() => { setForm({ type: 'expense', method: 'Cash' }); setModal('Payment'); }}
              onDelExp={(id) => del('expenses', id, () => setExpenses(e => e.filter(x => x.id !== id)))}
              onDelPay={(id) => del('payments', id, () => setPayments(p => p.filter(x => x.id !== id)))}
              money={money}
              onExportExpenses={exportExpenses}
              onExportPayments={exportPayments}
              onViewExcel={(tab) => { setPage('Excel Sheets'); setExcelModal(tab); }}
            />
          )}

          {page === 'Excel Sheets' && (
            <InAppExcelViewer
              initialTab={excelModal || 'sales'}
              sales={sales}
              purchases={purchases}
              invoices={invoices}
              expenses={expenses}
              payments={payments}
              exportSales={exportSales}
              exportPurchases={exportPurchases}
              exportInvoices={exportInvoices}
              exportExpenses={exportExpenses}
              exportPayments={exportPayments}
              money={money}
            />
          )}

          {page === 'Purchase Orders' && (
            <PagePurchases
              purchases={purchases}
              onAdd={() => { setForm({ quantity: 1 }); setModal('Purchase'); }}
              onExport={exportPurchases}
              onDel={(id) => del('purchases', id, () => setPurchases(p => p.filter(x => x.id !== id)))}
              money={money}
              onViewExcel={() => { setPage('Excel Sheets'); setExcelModal('purchases'); }}
            />
          )}

          {page === 'Suppliers' && (
            <PageList
              title="Suppliers"
              items={suppliers}
              cols={[['Name', 'name'], ['Contact', 'contact'], ['Phone', 'phone'], ['Email', 'email']]}
              onAdd={() => { setForm({}); setModal('Supplier'); }}
              onDel={(id) => del('suppliers', id, () => setSuppliers(s => s.filter(x => x.id !== id)))}
            />
          )}

          {page === 'Customers' && (
            <PageList
              title="Customers"
              items={customers}
              cols={[['Name', 'name'], ['Phone', 'phone'], ['Email', 'email'], ['Address', 'address']]}
              onAdd={() => { setForm({}); setModal('Customer'); }}
              onDel={(id) => del('customers', id, () => setCustomers(c => c.filter(x => x.id !== id)))}
            />
          )}

          {page === 'Invoices' && (
            <PageInvoices
              invoices={invoices}
              onUpload={() => { setForm({}); setModal('InvoiceUpload'); }}
              onDel={(id) => del('invoices', id, () => setInvoices(i => i.filter(x => x.id !== id)))}
              onExport={exportInvoices}
              onViewExcel={() => { setPage('Excel Sheets'); setExcelModal('invoices'); }}
            />
          )}

          {page === 'Reports' && <PageReports reports={reports} money={money} />}

          {page === 'Notifications' && (
            <PageNotifications
              notifications={notifications}
              onRead={async (id) => { await request('/notifications/' + id + '/read', { method: 'PUT' }); load(); }}
            />
          )}

          {page === 'Settings' && (
            <PageSettings
              settings={settings}
              currentUser={currentUser}
              onEdit={() => {
                setForm({
                  name: settings?.name || currentUser?.businessName,
                  category: settings?.category || 'Retail',
                  currency: settings?.currency || 'NPR',
                  address: settings?.address || currentUser?.address
                });
                setModal('Settings');
              }}
            />
          )}

          {/* ─── FOOTER ──────────────────────────────────────────────────── */}
          <footer className="page-footer">
            <span>© 2026 Khata AI. Built for better business days.</span>
            <span>English · नेपाली · हिन्दी Supported · Encrypted SQLite & live Excel sheets</span>
          </footer>
        </main>
      </div>

      {/* ─── MOBILE BOTTOM NAVIGATION ──────────────────────────────────────── */}
      <nav className="mobile-bottom-nav">
        <button className={page === 'Overview' ? 'active' : ''} onClick={() => setPage('Overview')}>
          <LayoutDashboard size={18} />
          <span>Home</span>
        </button>
        <button className={page === 'Sales & Invoices' ? 'active' : ''} onClick={() => setPage('Sales & Invoices')}>
          <ShoppingCart size={18} />
          <span>Sales</span>
        </button>
        <button className={page === 'Inventory' ? 'active' : ''} onClick={() => setPage('Inventory')}>
          <Package size={18} />
          <span>Stock</span>
        </button>
        <button className={page === 'Finance' ? 'active' : ''} onClick={() => setPage('Finance')}>
          <Wallet size={18} />
          <span>Finance</span>
        </button>
        <button className={page === 'Excel Sheets' ? 'active' : ''} onClick={() => { setPage('Excel Sheets'); setExcelModal('sales'); }}>
          <FileSpreadsheet size={18} />
          <span>Excel</span>
        </button>
      </nav>

      {/* ─── MODALS ────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && setModal('')}>
          <div className="modal">
            <div className="modal-head">
              <div>
                <h2>
                  {modal === 'Sale' && 'Create Sale (Manual Entry)'}
                  {modal === 'Purchase' && 'Create Purchase Order'}
                  {modal === 'Payment' && 'Record Payment'}
                  {modal === 'InvoiceUpload' && 'Upload Invoice & Auto-Record to Excel'}
                  {modal === 'Product' && 'Add Inventory Product'}
                  {modal === 'Customer' && 'Add Customer'}
                  {modal === 'Supplier' && 'Add Supplier'}
                  {modal === 'Expense' && 'Record Business Expense'}
                  {modal === 'Settings' && 'Workspace Settings'}
                </h2>
                <p>Fill in the information below. New entries are instantly saved to both the database and Excel sheet.</p>
              </div>
              <button className="icon-action-dark" onClick={() => setModal('')}><X size={18} /></button>
            </div>

            <div className="modal-form">
              {modal === 'Sale' && (
                <>
                  <Field label="Customer Name (optional)" value={form.customer_name} onChange={fset('customer_name')} placeholder="e.g. Ramesh Sharma" />
                  <Field label="Product Name" value={form.product_name} onChange={fset('product_name')} placeholder="e.g. Premium Rice 5kg" required />
                  <Field label="Selling Price (NPR)" value={form.price} onChange={fset('price')} type="number" placeholder="0.00" required />
                  <Field label="Discount (NPR)" value={form.discount} onChange={fset('discount')} type="number" placeholder="0.00" />
                  <Field label="Cost / Purchase Price (NPR)" value={form.purchase_price} onChange={fset('purchase_price')} type="number" placeholder="0.00" />
                  <Field label="Quantity" value={form.quantity} onChange={fset('quantity')} type="number" placeholder="1" required />
                  <Field label="Remarks" value={form.remarks} onChange={fset('remarks')} placeholder="Optional note or reference…" />
                </>
              )}

              {modal === 'Purchase' && (
                <>
                  <Field label="Supplier" value={form.supplier} onChange={fset('supplier')} placeholder="Supplier or vendor name" required />
                  <Field label="Product" value={form.product} onChange={fset('product')} placeholder="Product ordered" required />
                  <Field label="Quantity" value={form.quantity} onChange={fset('quantity')} type="number" placeholder="1" required />
                  <Field label="Unit Cost (NPR)" value={form.unit_cost} onChange={fset('unit_cost')} type="number" placeholder="0.00" required />
                  <Field label="Expected Date" value={form.expected_date} onChange={fset('expected_date')} type="date" />
                </>
              )}

              {modal === 'Payment' && (
                <>
                  <label className="field">
                    <span>Payment Type <em style={{ color: '#ef4444' }}>*</em></span>
                    <select
                      value={form.type || 'expense'}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="select-input"
                    >
                      <option value="expense">Operating Expense</option>
                      <option value="supplier_payment">Supplier Payment</option>
                      <option value="customer_payment">Customer Payment</option>
                    </select>
                  </label>
                  <Field label="Amount (NPR)" value={form.amount} onChange={fset('amount')} type="number" placeholder="0.00" required />
                  <Field label="Method" value={form.method} onChange={fset('method')} placeholder="Cash / Bank Transfer / FonePay" />
                  <Field label="Note" value={form.note} onChange={fset('note')} placeholder="Optional reference note" />
                </>
              )}

              {modal === 'Product' && (
                <>
                  <Field label="Product Name" value={form.name} onChange={fset('name')} placeholder="e.g. Basmati Rice" required />
                  <Field label="SKU / Item Code" value={form.sku} onChange={fset('sku')} placeholder="SKU-1001" />
                  <Field label="Category" value={form.category} onChange={fset('category')} placeholder="Food & Grocery" />
                  <Field label="Unit" value={form.unit} onChange={fset('unit')} placeholder="pcs / kg / box" />
                  <Field label="Purchase Price (NPR)" value={form.purchase_price} onChange={fset('purchase_price')} type="number" placeholder="0.00" />
                  <Field label="Selling Price (NPR)" value={form.selling_price} onChange={fset('selling_price')} type="number" placeholder="0.00" />
                  <Field label="Current Stock" value={form.stock} onChange={fset('stock')} type="number" placeholder="0" />
                  <Field label="Min Stock Alert Level" value={form.min_stock} onChange={fset('min_stock')} type="number" placeholder="5" />
                </>
              )}

              {modal === 'Customer' && (
                <>
                  <Field label="Customer Full Name" value={form.name} onChange={fset('name')} placeholder="Customer name" required />
                  <Field label="Phone Number" value={form.phone} onChange={fset('phone')} placeholder="+977 98..." />
                  <Field label="Email" value={form.email} onChange={fset('email')} type="email" placeholder="customer@gmail.com" />
                  <Field label="Address" value={form.address} onChange={fset('address')} placeholder="City, Address" />
                </>
              )}

              {modal === 'Supplier' && (
                <>
                  <Field label="Supplier Company / Name" value={form.name} onChange={fset('name')} placeholder="Supplier name" required />
                  <Field label="Contact Person" value={form.contact} onChange={fset('contact')} placeholder="Representative" />
                  <Field label="Phone Number" value={form.phone} onChange={fset('phone')} placeholder="Phone" />
                  <Field label="Email" value={form.email} onChange={fset('email')} type="email" placeholder="supplier@domain.com" />
                </>
              )}

              {modal === 'Expense' && (
                <>
                  <Field label="Category" value={form.category} onChange={fset('category')} placeholder="Rent / Utilities / Salary / Transport" required />
                  <Field label="Description" value={form.description} onChange={fset('description')} placeholder="Expense details…" />
                  <Field label="Amount (NPR)" value={form.amount} onChange={fset('amount')} type="number" placeholder="0.00" required />
                  <Field label="Date" value={form.date} onChange={fset('date')} type="date" />
                </>
              )}

              {modal === 'InvoiceUpload' && (
                <>
                  <div className="upload-dropzone" onClick={() => fileRef.current?.click()}>
                    <Upload size={36} className="upload-icon" />
                    <p className="upload-title">Click to select invoice file</p>
                    <p className="upload-subtitle">JPG, PNG, JPEG, or PDF — up to 10 MB</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) setForm(x => ({ ...x, _file: f, _fileName: f.name }));
                      }}
                    />
                  </div>
                  {form._fileName && (
                    <div className="file-selected-pill">
                      <Check size={14} /> Selected: {form._fileName}
                    </div>
                  )}
                  <Field label="Customer Name (optional)" value={form.customer_name} onChange={fset('customer_name')} placeholder="e.g. Global Tech Pvt" />
                  <Field label="Product / Service Description" value={form.product_name} onChange={fset('product_name')} placeholder="e.g. IT Consulting / Supplies" />
                  <Field label="Invoice Amount / Total (NPR)" value={form.amount} onChange={fset('amount')} type="number" placeholder="0.00" />
                  <Field label="Invoice Notes / Reference" value={form.inv_notes} onChange={fset('inv_notes')} placeholder="Order #, bill # or remarks…" />
                  <div className="excel-sync-notice">
                    <FileSpreadsheet size={16} />
                    <span>Saving this invoice will automatically record the transaction into your <b>Invoices Excel Sheet</b> and <b>Sales Excel Sheet</b> simultaneously.</span>
                  </div>
                </>
              )}

              {modal === 'Settings' && (
                <>
                  <Field label="Business Name" value={form.name} onChange={fset('name')} required />
                  <Field label="Category / Industry" value={form.category} onChange={fset('category')} placeholder="Retail / Wholesale / Services" />
                  <Field label="Currency" value={form.currency} onChange={fset('currency')} placeholder="NPR" />
                  <Field label="Business Address" value={form.address} onChange={fset('address')} placeholder="Kathmandu, Nepal" />
                </>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setModal('')}>Cancel</button>
              {modal === 'InvoiceUpload' ? (
                <button className="btn-primary" onClick={uploadInvoice}>
                  <Upload size={14} /> Upload & Save to Excel
                </button>
              ) : (
                <button className="btn-primary" onClick={save}>Save Record</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST NOTIFICATION ────────────────────────────────────────────── */}
      {toast.msg && (
        <div className={'toast-bar ' + (toast.ok ? 'toast-success' : 'toast-error')}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LANDING DASHBOARD COMPONENT (Khata AI)
// ─────────────────────────────────────────────────────────────────────────────
function LandingDashboard({
  d, sales, products, settings, userName, todayStr, period, setPeriod, money, t,
  onQuickAction, onViewAllSales, onViewInventory, onOpenExcel
}) {
  const defaultSalesChart = [
    { day: 'Nov 2', revenue: 0, expenses: 0 },
    { day: 'Nov 5', revenue: 0, expenses: 0 },
    { day: 'Nov 8', revenue: 0, expenses: 0 },
    { day: 'Nov 11', revenue: 0, expenses: 0 },
    { day: 'Nov 14', revenue: 0, expenses: 0 },
    { day: 'Nov 17', revenue: 0, expenses: 0 },
    { day: 'Nov 20', revenue: 0, expenses: 0 },
    { day: 'Nov 23', revenue: 0, expenses: 0 },
  ];

  const chartData = (d?.sales && d.sales.length > 0)
    ? d.sales.map(s => ({ day: s.day, revenue: Number(s.revenue || 0), expenses: 0 }))
    : defaultSalesChart;

  return (
    <div className="landing-page">
      {/* ─── 1. WELCOME HEADER (Khata AI with Blue Background & White Text) ─── */}
      <section className="welcome-banner">
        <div className="welcome-text">
          <h1>{t.welcome}{userName ? `, ${userName}` : ''}</h1>
          <p>{t.tagline}</p>
        </div>
        <div className="date-chip">
          <Calendar size={14} />
          <span>{todayStr}</span>
        </div>
      </section>

      {/* ─── 2. GETTING-STARTED BANNER ───────────────────────────────────────── */}
      <section className="getting-started-banner">
        <div className="banner-message">
          <HelpCircle size={18} className="info-icon" />
          <span>Start your own workspace to record your first transaction.</span>
        </div>
        <button className="create-business-btn" onClick={() => onQuickAction('sale')}>
          <span>Record a transaction</span>
          <ArrowUpRight size={16} />
        </button>
      </section>

      {/* ─── 3. BUSINESS METRIC CARDS (6 Cards, all in NPR) ──────────────────── */}
      <section className="metric-cards-grid">
        {/* Card 1: Today's sales */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">{t.todaysSales}</span>
            <div className="metric-icon-wrap icon-teal">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="metric-value">{money(d?.today)}</div>
          <div className="metric-footer">
            <CheckCircle2 size={13} className="text-teal" />
            <span>Sales recorded today</span>
          </div>
        </div>

        {/* Card 2: Monthly revenue */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">{t.monthlyRevenue}</span>
            <div className="metric-icon-wrap icon-purple">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="metric-value">{money(d?.month)}</div>
          <div className="metric-footer">
            <CheckCircle2 size={13} className="text-teal" />
            <span>Net sales this month</span>
          </div>
        </div>

        {/* Card 3: Total expenses */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">{t.totalExpenses}</span>
            <div className="metric-icon-wrap icon-amber">
              <Receipt size={18} />
            </div>
          </div>
          <div className="metric-value">{money(d?.expenses)}</div>
          <div className="metric-footer">
            <CheckCircle2 size={13} className="text-teal" />
            <span>Operating expenses</span>
          </div>
        </div>

        {/* Card 4: Net profit */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">{t.netProfit}</span>
            <div className="metric-icon-wrap icon-emerald">
              <Wallet size={18} />
            </div>
          </div>
          <div className="metric-value">{money(d?.netProfit)}</div>
          <div className="metric-footer">
            <CheckCircle2 size={13} className="text-teal" />
            <span>Revenue - cost - expenses</span>
          </div>
        </div>

        {/* Card 5: To receive */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">{t.toReceive}</span>
            <div className="metric-icon-wrap icon-blue">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="metric-value">{money(d?.receivables || 0)}</div>
          <div className="metric-footer">
            <CheckCircle2 size={13} className="text-teal" />
            <span>Outstanding customer payments</span>
          </div>
        </div>

        {/* Card 6: To pay */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">{t.toPay}</span>
            <div className="metric-icon-wrap icon-violet">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="metric-value">{money(d?.payables || 0)}</div>
          <div className="metric-footer">
            <CheckCircle2 size={13} className="text-teal" />
            <span>Outstanding supplier payments</span>
          </div>
        </div>
      </section>

      {/* ─── 4. QUICK ACTIONS (6 Shortcut Buttons + Tagline) ────────────────── */}
      <section className="quick-actions-section">
        <div className="quick-actions-header">
          <h2>{t.quickActions}</h2>
          <span className="quick-tagline">{t.quickTagline}</span>
        </div>

        <div className="quick-actions-grid">
          <button className="quick-btn" onClick={() => onQuickAction('invoice')}>
            <div className="quick-icon icon-purple-subtle">
              <Upload size={18} />
            </div>
            <span>{t.uploadInvoice}</span>
          </button>

          <button className="quick-btn" onClick={() => onQuickAction('sale')}>
            <div className="quick-icon icon-teal-subtle">
              <ShoppingCart size={18} />
            </div>
            <span>{t.addSale}</span>
          </button>

          <button className="quick-btn" onClick={() => onQuickAction('product')}>
            <div className="quick-icon icon-blue-subtle">
              <Package size={18} />
            </div>
            <span>{t.addProduct}</span>
          </button>

          <button className="quick-btn" onClick={() => onQuickAction('purchase')}>
            <div className="quick-icon icon-amber-subtle">
              <Truck size={18} />
            </div>
            <span>{t.purchaseOrder}</span>
          </button>

          <button className="quick-btn" onClick={() => onQuickAction('payment')}>
            <div className="quick-icon icon-emerald-subtle">
              <Wallet size={18} />
            </div>
            <span>{t.recordPayment}</span>
          </button>

          <button className="quick-btn" onClick={() => onQuickAction('expense')}>
            <div className="quick-icon icon-purple-subtle">
              <Receipt size={18} />
            </div>
            <span>{t.addExpense}</span>
          </button>
        </div>
      </section>

      {/* ─── 5 & 6. REVENUE CHART + BUSINESS INSIGHTS PANEL (2 Columns) ─────── */}
      <section className="dashboard-mid-grid">
        {/* Left Column: Revenue & Expenses Chart */}
        <div className="card-panel chart-panel">
          <div className="chart-header">
            <div>
              <h3>{t.revExpenses}</h3>
              <p>Your performance over time</p>
            </div>
            <select
              className="period-dropdown"
              value={period}
              onChange={e => setPeriod(e.target.value)}
            >
              <option value="This month">This month</option>
              <option value="Last 7 days">Last 7 days</option>
            </select>
          </div>

          <div className="chart-legend">
            <span className="legend-item"><i className="dot dot-teal" /> Revenue</span>
            <span className="legend-item"><i className="dot dot-violet" /> Expenses</span>
          </div>

          <div className="chart-canvas-wrapper">
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(val) => [money(val), '']}
                  contentStyle={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3, fill: '#0d9488' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="expenses" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-bottom-note">
            <span>No transactions in this period. Your chart will update as you record them.</span>
          </div>
        </div>

        {/* Right Column: Business Insights Panel */}
        <div className="card-panel insights-panel">
          <div className="insights-header">
            <div className="insights-title">
              <Sparkles size={18} className="sparkle-icon" />
              <h3>{t.businessInsights}</h3>
            </div>
            <span className="data-driven-badge">{t.dataDriven}</span>
          </div>

          <div className="insights-content">
            <div className="insight-illustration">
              <div className="illus-box">
                <FileText size={38} className="illus-icon-doc" />
                <Wallet size={24} className="illus-icon-wallet" />
              </div>
            </div>

            <h4>Good decisions start with good data</h4>
            <p>Insights will appear as you add sales, products, and payments.</p>

            <button className="add-first-product-link" onClick={() => onQuickAction('product')}>
              <span>Add your first product</span>
              <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── 7 & 8. RECENT SALES + STOCK OVERVIEW (2 Columns) ────────────────── */}
      <section className="dashboard-bottom-grid">
        {/* Left Column: Recent Sales Table */}
        <div className="card-panel table-panel">
          <div className="panel-title-bar">
            <h3>{t.recentSales}</h3>
            <button className="link-action" onClick={onViewAllSales}>
              <span>{t.viewAll}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {d?.recent && d.recent.length > 0 ? (
            <div className="table-responsive">
              <table className="clean-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map(s => (
                    <tr key={s.id}>
                      <td className="font-mono">{s.invoice_no}</td>
                      <td>{s.customer_name || 'Walk-in'}</td>
                      <td>{s.product_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(s.total)}</td>
                      <td>
                        <span className="status-badge paid">Paid</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state-box">
              <div className="empty-icon-circle">
                <ShoppingCart size={22} />
              </div>
              <h4>Your first sale starts here</h4>
              <p>Recorded invoices and customer payments will appear here.</p>
            </div>
          )}
        </div>

        {/* Right Column: Stock Overview Panel */}
        <div className="card-panel stock-panel">
          <div className="panel-title-bar">
            <h3>{t.stockOverview}</h3>
            <button className="link-action" onClick={onViewInventory}>
              <span>{t.inventory}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {products && products.length > 0 ? (
            <div className="stock-stats-grid">
              <div className="stock-stat-box">
                <span className="stat-label">Total Products</span>
                <b className="stat-num">{products.length}</b>
              </div>
              <div className="stock-stat-box">
                <span className="stat-label">Low Stock Items</span>
                <b className="stat-num text-amber">{products.filter(p => p.stock <= p.min_stock).length}</b>
              </div>
              <div className="stock-stat-box">
                <span className="stat-label">Units in Stock</span>
                <b className="stat-num">{products.reduce((acc, p) => acc + (p.stock || 0), 0)}</b>
              </div>
              <div className="stock-stat-box">
                <span className="stat-label">Stock Value</span>
                <b className="stat-num text-teal">{money(products.reduce((acc, p) => acc + (p.stock * p.purchase_price || 0), 0))}</b>
              </div>
            </div>
          ) : (
            <div className="empty-state-box">
              <div className="empty-icon-circle">
                <Package size={22} />
              </div>
              <h4>A clear view of your stock</h4>
              <p>Add products to track stock levels and know when to restock.</p>
            </div>
          )}
        </div>
      </section>

      {/* ─── LIVE EXCEL SYNC BANNER (In-App Excel Sheet Callout) ────────────── */}
      <section className="excel-callout-card">
        <div className="excel-callout-left">
          <div className="excel-icon-large">
            <FileSpreadsheet size={28} />
          </div>
          <div>
            <h3>Live In-App Excel Synchronization</h3>
            <p>Every invoice upload, sale, purchase order, payment, and expense is automatically saved to its own separate Excel sheet and viewable inside this web app.</p>
          </div>
        </div>
        <div className="excel-callout-right">
          <button className="open-sheet-btn" onClick={() => onOpenExcel('sales')}>
            <FileSpreadsheet size={16} />
            <span>Open Sales Sheet</span>
          </button>
          <button className="open-sheet-btn outline" onClick={() => onOpenExcel('invoices')}>
            <FileText size={16} />
            <span>Open Invoices Sheet</span>
          </button>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. IN-APP EXCEL SHEET VIEWER (Real Interactive Spreadsheet View)
// ─────────────────────────────────────────────────────────────────────────────
function InAppExcelViewer({
  initialTab = 'sales', sales, purchases, invoices, expenses, payments,
  exportSales, exportPurchases, exportInvoices, exportExpenses, exportPayments, money
}) {
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');

  const sheets = [
    { id: 'sales', label: 'Sales Sheet (sales.csv)', count: sales.length, exportFn: exportSales },
    { id: 'purchases', label: 'Purchases Sheet (purchases.csv)', count: purchases.length, exportFn: exportPurchases },
    { id: 'invoices', label: 'Invoices Sheet (invoices.csv)', count: invoices.length, exportFn: exportInvoices },
    { id: 'expenses', label: 'Expenses Sheet (expenses.csv)', count: expenses.length, exportFn: exportExpenses },
    { id: 'payments', label: 'Payments Sheet (payments.csv)', count: payments.length, exportFn: exportPayments },
  ];

  let currentRows = [];
  let currentCols = [];

  if (tab === 'sales') {
    currentCols = ['A: Invoice No', 'B: Customer', 'C: Product', 'D: Price', 'E: Discount', 'F: Cost', 'G: Total', 'H: Remarks', 'I: Date'];
    currentRows = sales.map(s => [s.invoice_no, s.customer_name || 'Walk-in', s.product_name, money(s.price), money(s.discount), money(s.purchase_price), money(s.total), s.remarks || '-', s.created_at?.slice(0, 16)]);
  } else if (tab === 'purchases') {
    currentCols = ['A: Supplier', 'B: Product', 'C: Quantity', 'D: Unit Cost', 'E: Total Cost', 'F: Status', 'G: Expected Date', 'H: Date'];
    currentRows = purchases.map(p => [p.supplier, p.product, p.quantity, money(p.unit_cost), money(p.total), p.status, p.expected_date || '-', p.created_at?.slice(0, 16)]);
  } else if (tab === 'invoices') {
    currentCols = ['A: ID', 'B: Original Filename', 'C: Storage File', 'D: MIME Type', 'E: Size', 'F: Notes', 'G: Status', 'H: Upload Date'];
    currentRows = invoices.map(i => [i.id, i.original_name, i.filename, i.mime_type, (i.size ? Math.round(i.size / 1024) + ' KB' : '-'), i.notes || '-', i.status, i.created_at?.slice(0, 16)]);
  } else if (tab === 'expenses') {
    currentCols = ['A: Category', 'B: Description', 'C: Amount', 'D: Expense Date'];
    currentRows = expenses.map(e => [e.category, e.description || '-', money(e.amount), e.date || '-']);
  } else if (tab === 'payments') {
    currentCols = ['A: Type', 'B: Amount', 'C: Payment Method', 'D: Note', 'E: Date'];
    currentRows = payments.map(p => [p.type, money(p.amount), p.method, p.note || '-', p.created_at?.slice(0, 16)]);
  }

  const filteredRows = search
    ? currentRows.filter(row => row.some(cell => String(cell).toLowerCase().includes(search.toLowerCase())))
    : currentRows;

  const currentSheet = sheets.find(s => s.id === tab);

  return (
    <div className="excel-viewer-page">
      <div className="excel-viewer-head">
        <div>
          <h1>In-App Excel Sheets & Live Spreadsheets</h1>
          <p>Every transaction recorded in Khata AI is synchronized live with its dedicated Excel sheet.</p>
        </div>
        <button className="download-excel-btn" onClick={currentSheet?.exportFn}>
          <Download size={16} />
          <span>Export {currentSheet?.id}.csv</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="sheet-tabs-bar">
        {sheets.map(s => (
          <button
            key={s.id}
            className={'sheet-tab ' + (tab === s.id ? 'active' : '')}
            onClick={() => { setTab(s.id); setSearch(''); }}
          >
            <FileSpreadsheet size={15} />
            <span>{s.label}</span>
            <span className="row-count-badge">{s.count}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="excel-toolbar">
        <div className="excel-formula-bar">
          <span className="fx-label">fx</span>
          <span className="formula-text">SELECT * FROM {tab} WHERE business_id = 1</span>
        </div>
        <div className="search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search spreadsheet rows…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="spreadsheet-container">
        <table className="excel-grid">
          <thead>
            <tr>
              <th className="excel-row-num-header">#</th>
              {currentCols.map((col, idx) => (
                <th key={idx}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length > 0 ? (
              filteredRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  <td className="excel-row-num">{rIdx + 1}</td>
                  {row.map((val, cIdx) => (
                    <td key={cIdx}>{val}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={currentCols.length + 1} className="excel-empty-cell">
                  No records yet in {currentSheet?.label}. Add new entries through the dashboard or upload an invoice to populate this sheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="spreadsheet-footer-bar">
        <span>Ready · {filteredRows.length} rows loaded</span>
        <span>Auto-sync enabled: backend/uploads/{tab}.csv</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. OTHER SUB-PAGES (Sales, Inventory, Finance, Purchases, Invoices, etc.)
// ─────────────────────────────────────────────────────────────────────────────
function PageSales({ sales, onAdd, onExport, onDel, money, onViewExcel }) {
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>Sales & Invoices</h1>
          <p>Manual sales entry without dropdowns, auto-synced to Excel</p>
        </div>
        <div className="action-btns-group">
          <button className="btn-secondary" onClick={onViewExcel}>
            <FileSpreadsheet size={15} />
            <span>View Sales Sheet</span>
          </button>
          <button className="btn-secondary" onClick={onExport}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn-primary" onClick={onAdd}>
            <Plus size={15} />
            <span>+ Create Sale</span>
          </button>
        </div>
      </div>

      <div className="card-panel">
        <table className="clean-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>Discount</th>
              <th style={{ textAlign: 'right' }}>Cost</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Remarks</th>
              <th>Date</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {sales.length > 0 ? (
              sales.map(s => (
                <tr key={s.id}>
                  <td className="font-mono">{s.invoice_no}</td>
                  <td>{s.customer_name || 'Walk-in'}</td>
                  <td>{s.product_name}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.price)}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.discount)}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.purchase_price)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(s.total)}</td>
                  <td>{s.remarks || '-'}</td>
                  <td>{s.created_at?.slice(0, 10)}</td>
                  <td>
                    <button className="icon-del" onClick={() => onDel(s.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No sales recorded yet. Click "+ Create Sale" to add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageInventory({ products, onAdd, onDel, money }) {
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>Inventory & Stock</h1>
          <p>Real-time stock tracking and low-stock alerts</p>
        </div>
        <button className="btn-primary" onClick={onAdd}>
          <Plus size={15} />
          <span>+ Add Product</span>
        </button>
      </div>

      <div className="card-panel">
        <table className="clean-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Current Stock</th>
              <th style={{ textAlign: 'right' }}>Min Stock</th>
              <th style={{ textAlign: 'right' }}>Buy Price</th>
              <th style={{ textAlign: 'right' }}>Sell Price</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map(p => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td className="font-mono">{p.sku || '-'}</td>
                  <td>{p.category}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    <span className={p.stock <= p.min_stock ? 'text-amber' : ''}>{p.stock} {p.unit}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{p.min_stock}</td>
                  <td style={{ textAlign: 'right' }}>{money(p.purchase_price)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(p.selling_price)}</td>
                  <td>
                    <button className="icon-del" onClick={() => onDel(p.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No products in inventory yet. Click "+ Add Product".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageFinance({
  expenses, payments, onAddExp, onAddPay, onDelExp, onDelPay, money,
  onExportExpenses, onExportPayments, onViewExcel
}) {
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>Finance & Cash Flow</h1>
          <p>Operating expenses and recorded payments</p>
        </div>
        <div className="action-btns-group">
          <button className="btn-secondary" onClick={() => onViewExcel('expenses')}>
            <FileSpreadsheet size={15} />
            <span>Finance Excel Sheets</span>
          </button>
          <button className="btn-secondary" onClick={onAddPay}>+ Record Payment</button>
          <button className="btn-primary" onClick={onAddExp}>+ Add Expense</button>
        </div>
      </div>

      <div className="dashboard-mid-grid">
        <div className="card-panel">
          <div className="panel-title-bar">
            <h3>Expenses</h3>
            <button className="link-action" onClick={onExportExpenses}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <table className="clean-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.length > 0 ? (
                expenses.map(e => (
                  <tr key={e.id}>
                    <td><b>{e.category}</b></td>
                    <td>{e.description || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>{money(e.amount)}</td>
                    <td>{e.date || '-'}</td>
                    <td><button className="icon-del" onClick={() => onDelExp(e.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>No expenses recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card-panel">
          <div className="panel-title-bar">
            <h3>Payments</h3>
            <button className="link-action" onClick={onExportPayments}>
              <Download size={14} /> Export CSV
            </button>
          </div>
          <table className="clean-table">
            <thead>
              <tr>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Method</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.length > 0 ? (
                payments.map(p => (
                  <tr key={p.id}>
                    <td><span className="status-badge paid">{p.type}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(p.amount)}</td>
                    <td>{p.method}</td>
                    <td>{p.note || '-'}</td>
                    <td><button className="icon-del" onClick={() => onDelPay(p.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>No payments recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PagePurchases({ purchases, onAdd, onExport, onDel, money, onViewExcel }) {
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>Purchase Orders</h1>
          <p>Supplier orders with free-text input (no dropdowns required)</p>
        </div>
        <div className="action-btns-group">
          <button className="btn-secondary" onClick={onViewExcel}>
            <FileSpreadsheet size={15} />
            <span>Purchases Sheet</span>
          </button>
          <button className="btn-secondary" onClick={onExport}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn-primary" onClick={onAdd}>
            <Plus size={15} />
            <span>+ Create Purchase</span>
          </button>
        </div>
      </div>

      <div className="card-panel">
        <table className="clean-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>Quantity</th>
              <th style={{ textAlign: 'right' }}>Unit Cost</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Status</th>
              <th>Expected Date</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {purchases.length > 0 ? (
              purchases.map(p => (
                <tr key={p.id}>
                  <td><b>{p.supplier}</b></td>
                  <td>{p.product}</td>
                  <td style={{ textAlign: 'right' }}>{p.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{money(p.unit_cost)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(p.total)}</td>
                  <td><span className="status-badge pending">{p.status}</span></td>
                  <td>{p.expected_date || '-'}</td>
                  <td><button className="icon-del" onClick={() => onDel(p.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No purchase orders recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageInvoices({ invoices, onUpload, onDel, onExport, onViewExcel }) {
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>Invoice Uploads</h1>
          <p>Upload invoices to automatically record sales into the database and Excel sheet</p>
        </div>
        <div className="action-btns-group">
          <button className="btn-secondary" onClick={onViewExcel}>
            <FileSpreadsheet size={15} />
            <span>Invoices Sheet</span>
          </button>
          <button className="btn-secondary" onClick={onExport}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button className="btn-primary" onClick={onUpload}>
            <Upload size={15} />
            <span>+ Upload Invoice</span>
          </button>
        </div>
      </div>

      <div className="card-panel">
        <table className="clean-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Notes / Remarks</th>
              <th>Status</th>
              <th>Date</th>
              <th>View File</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length > 0 ? (
              invoices.map(inv => (
                <tr key={inv.id}>
                  <td><b>{inv.original_name || inv.filename}</b></td>
                  <td>{inv.notes || '-'}</td>
                  <td><span className="status-badge paid">{inv.status}</span></td>
                  <td>{inv.created_at?.slice(0, 10)}</td>
                  <td>
                    <a
                      href={`http://localhost:4000/uploads/${inv.filename}`}
                      target="_blank"
                      rel="noreferrer"
                      className="view-link"
                    >
                      <Eye size={14} /> View Document
                    </a>
                  </td>
                  <td><button className="icon-del" onClick={() => onDel(inv.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <Upload size={36} style={{ color: '#93c5fd', margin: '0 auto 8px', display: 'block' }} />
                  <p style={{ color: '#6b7280' }}>No invoices uploaded yet. Click "+ Upload Invoice" to record one.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageList({ title, items, cols, onAdd, onDel }) {
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>{title}</h1>
          <p>Manage your business {title.toLowerCase()}</p>
        </div>
        <button className="btn-primary" onClick={onAdd}>+ Add {title.slice(0, -1)}</button>
      </div>

      <div className="card-panel">
        <table className="clean-table">
          <thead>
            <tr>
              {cols.map(c => <th key={c[0]}>{c[0]}</th>)}
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map(item => (
                <tr key={item.id}>
                  {cols.map(c => <td key={c[0]}>{item[c[1]] || '-'}</td>)}
                  <td><button className="icon-del" onClick={() => onDel(item.id)}><Trash2 size={14} /></button></td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={cols.length + 1} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>No {title.toLowerCase()} recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageReports({ reports, money }) {
  const r = reports;
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>Reports & Analytics</h1>
          <p>Comprehensive financial and inventory summary</p>
        </div>
      </div>

      <div className="metric-cards-grid">
        <div className="metric-card">
          <div className="metric-header"><span className="metric-label">Sales Revenue</span></div>
          <div className="metric-value">{money(r?.sales?.revenue)}</div>
          <div className="metric-footer"><span>{r?.sales?.count || 0} transactions</span></div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><span className="metric-label">Cost of Goods Sold</span></div>
          <div className="metric-value">{money(r?.sales?.cogs)}</div>
          <div className="metric-footer"><span>Estimated purchase costs</span></div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><span className="metric-label">Total Expenses</span></div>
          <div className="metric-value">{money(r?.expenses)}</div>
          <div className="metric-footer"><span>Operating expenditures</span></div>
        </div>
        <div className="metric-card">
          <div className="metric-header"><span className="metric-label">Inventory Value</span></div>
          <div className="metric-value">{money(r?.inventory?.value)}</div>
          <div className="metric-footer"><span>{r?.inventory?.products || 0} active products</span></div>
        </div>
      </div>
    </div>
  );
}

function PageNotifications({ notifications, onRead }) {
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>Notifications</h1>
          <p>System alerts and workspace updates</p>
        </div>
      </div>

      <div className="card-panel">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div key={n.id} className="notification-row">
              <Bell size={18} className="notification-icon" />
              <div className="notification-text">
                <b>{n.title}</b>
                <p>{n.body}</p>
              </div>
              {!n.read && (
                <button className="btn-secondary small" onClick={() => onRead(n.id)}>Mark read</button>
              )}
            </div>
          ))
        ) : (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>No notifications at this time.</p>
        )}
      </div>
    </div>
  );
}

function PageSettings({ settings, currentUser, onEdit }) {
  return (
    <div className="page-wrapper">
      <div className="page-head-bar">
        <div>
          <h1>Workspace Settings</h1>
          <p>Configure business name, currency, and address</p>
        </div>
        <button className="btn-primary" onClick={onEdit}>Edit Settings</button>
      </div>

      <div className="card-panel settings-panel">
        <div className="settings-row">
          <span>User Name</span>
          <b>{currentUser?.name || 'Owner'}</b>
        </div>
        <div className="settings-row">
          <span>Business Name</span>
          <b>{settings?.name || currentUser?.businessName || 'My Business'}</b>
        </div>
        <div className="settings-row">
          <span>Phone Number</span>
          <b>{currentUser?.phone || settings?.phone || '—'}</b>
        </div>
        <div className="settings-row">
          <span>Address</span>
          <b>{settings?.address || currentUser?.address || '—'}</b>
        </div>
        <div className="settings-row">
          <span>Currency</span>
          <b>{settings?.currency || 'NPR'}</b>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
