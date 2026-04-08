import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  FileInput, 
  Wallet, 
  BarChart3, 
  FileText,
  LogOut,
  User,
  Menu,
  X
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', Icon: LayoutDashboard, to: '/dashboard', section: 'PRINCIPAL' },
  { label: 'PDV / Caixa', Icon: ShoppingCart, to: '/pdv', section: null, external: true },
  { label: 'Produtos', Icon: Package, to: '/produtos', section: 'CADASTROS' },
  { label: 'Clientes', Icon: Users, to: '/clientes', section: null },
  { label: 'Compras / NF', Icon: FileInput, to: '/compras', section: 'OPERACIONAL' },
  { label: 'Financeiro', Icon: Wallet, to: '/financeiro', section: null },
  { label: 'Relatórios', Icon: BarChart3, to: '/relatorios', section: null },
  { label: 'Fiscal / NFe', Icon: FileText, to: '/fiscal', section: null },
];

export default function Layout() {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fechar sidebar ao trocar de rota (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  let currentSection = '';

  return (
    <div className="layout">
      {/* Mobile Hamburger */}
      <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
        <Menu size={20} />
      </button>

      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* SIDEBAR */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">
            JR <span>Sacolões</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isNewSection = item.section && item.section !== currentSection;
            if (item.section) currentSection = item.section;

            return (
              <div key={item.to}>
                {isNewSection && <div className="nav-section">{item.section}</div>}
                {item.external ? (
                  <a className="nav-item" href={item.to} target="_blank" rel="noreferrer">
                    <item.Icon className="nav-icon" size={18} />
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <item.Icon className="nav-icon" size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Profile / Logout Footer */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '0 8px' }}>
            <div style={{ 
              width: 32, height: 32, borderRadius: 8, 
              background: 'var(--accent)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center',
              color: 'white'
            }}>
              <User size={18} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.username || 'Usuário'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Operador</div>
            </div>
          </div>
          
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ width: '100%', justifyContent: 'center', gap: 8, border: '1px solid var(--border)' }} 
            onClick={handleLogout}
          >
            <LogOut size={14} />
            Sair
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
