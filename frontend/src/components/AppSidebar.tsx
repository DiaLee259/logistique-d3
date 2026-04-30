import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ArrowLeftRight, ClipboardList,
  Truck, ChevronLeft, ChevronRight, Settings, CalendarRange, ClipboardCheck, BookOpen, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/articles', icon: Package, label: 'Articles & Stock' },
  { path: '/mouvements', icon: ArrowLeftRight, label: 'Mouvements' },
  { path: '/commandes', icon: ClipboardList, label: 'Commandes' },
  { path: '/livraisons', icon: Truck, label: 'Livraisons' },
  { path: '/commandes-ts', icon: CalendarRange, label: 'Commandes TS' },
  { path: '/inventaire', icon: ClipboardCheck, label: 'Inventaire' },
  { path: '/guide', icon: BookOpen, label: 'Guide' },
  { path: '/corbeille', icon: Trash2, label: 'Corbeille' },
  { path: '/parametres', icon: Settings, label: 'Paramètres' },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <aside className={cn(
      'flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out',
      collapsed ? 'w-14' : 'w-56',
    )}>
      {/* Logo TechnoSmart */}
      <div className="flex items-center border-b border-sidebar-border overflow-hidden bg-sidebar" style={{ minHeight: 68 }}>
        {collapsed ? (
          <div className="w-14 flex items-center justify-center py-3">
            <Logo variant="icon" height={40} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-4 py-3">
            <Logo variant="full" height={52} />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-1.5 py-3 space-y-0.5">
        {navItems.map(({ path, icon: Icon, label, exact }) => (
          <NavLink
            key={path}
            to={path}
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors duration-150',
              isActive(path, exact)
                ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      {!collapsed && user && (
        <div className="px-2.5 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">
                {user.prenom[0]}{user.nom[0]}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user.prenom} {user.nom}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">
                {user.role === 'LOGISTICIEN_1' ? 'Log. Backoffice' :
                 user.role === 'LOGISTICIEN_2' ? 'Log. Terrain' :
                 user.role === 'CHEF_PROJET' ? 'Chef de projet' : 'Admin'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-2.5 border-t border-sidebar-border text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
