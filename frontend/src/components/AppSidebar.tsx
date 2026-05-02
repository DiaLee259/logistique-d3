import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ArrowLeftRight, ClipboardList,
  Truck, ChevronLeft, ChevronRight, Settings, CalendarRange,
  ClipboardCheck, BookOpen, Trash2, UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';

const navItems = [
  {
    path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true,
    iconBg: 'bg-blue-500/15 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    activeBg: 'bg-blue-500/20 dark:bg-blue-500/25',
  },
  {
    path: '/articles', icon: Package, label: 'Articles & Stock',
    iconBg: 'bg-amber-500/15 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    activeBg: 'bg-amber-500/20 dark:bg-amber-500/25',
  },
  {
    path: '/mouvements', icon: ArrowLeftRight, label: 'Mouvements',
    iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    activeBg: 'bg-emerald-500/20 dark:bg-emerald-500/25',
  },
  {
    path: '/commandes', icon: ClipboardList, label: 'Commandes',
    iconBg: 'bg-violet-500/15 dark:bg-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    activeBg: 'bg-violet-500/20 dark:bg-violet-500/25',
  },
  {
    path: '/livraisons', icon: Truck, label: 'Livraisons',
    iconBg: 'bg-cyan-500/15 dark:bg-cyan-500/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    activeBg: 'bg-cyan-500/20 dark:bg-cyan-500/25',
  },
  {
    path: '/commandes-ts', icon: CalendarRange, label: 'Commandes TS',
    iconBg: 'bg-rose-500/15 dark:bg-rose-500/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    activeBg: 'bg-rose-500/20 dark:bg-rose-500/25',
  },
  {
    path: '/inventaire', icon: ClipboardCheck, label: 'Inventaire',
    iconBg: 'bg-orange-500/15 dark:bg-orange-500/20',
    iconColor: 'text-orange-600 dark:text-orange-400',
    activeBg: 'bg-orange-500/20 dark:bg-orange-500/25',
  },
  {
    path: '/intervenants', icon: UserRound, label: 'Intervenants',
    iconBg: 'bg-purple-500/15 dark:bg-purple-500/20',
    iconColor: 'text-purple-600 dark:text-purple-400',
    activeBg: 'bg-purple-500/20 dark:bg-purple-500/25',
  },
  {
    path: '/guide', icon: BookOpen, label: 'Guide',
    iconBg: 'bg-sky-500/15 dark:bg-sky-500/20',
    iconColor: 'text-sky-600 dark:text-sky-400',
    activeBg: 'bg-sky-500/20 dark:bg-sky-500/25',
  },
  {
    path: '/corbeille', icon: Trash2, label: 'Corbeille',
    iconBg: 'bg-red-500/15 dark:bg-red-500/20',
    iconColor: 'text-red-600 dark:text-red-400',
    activeBg: 'bg-red-500/20 dark:bg-red-500/25',
  },
  {
    path: '/parametres', icon: Settings, label: 'Paramètres',
    iconBg: 'bg-slate-500/15 dark:bg-slate-500/20',
    iconColor: 'text-slate-600 dark:text-slate-400',
    activeBg: 'bg-slate-500/20 dark:bg-slate-500/25',
  },
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
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-sidebar-border/50 py-4" style={{ minHeight: 76 }}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-black text-primary tracking-tight">TS</span>
          </div>
        ) : (
          <Logo variant="full" height={64} style={{ mixBlendMode: 'screen', filter: 'drop-shadow(0 0 10px rgba(99,102,241,0.3))' }} />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-1.5 py-3 space-y-0.5">
        {navItems.map(({ path, icon: Icon, label, exact, iconBg, iconColor, activeBg }) => {
          const active = isActive(path, exact);
          return (
            <NavLink
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors duration-150',
                active
                  ? cn(activeBg, 'font-semibold text-sidebar-foreground')
                  : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
              )}
            >
              {/* Icône dans sa bulle colorée */}
              <span className={cn(
                'flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 transition-colors',
                iconBg,
              )}>
                <Icon className={cn('w-3.5 h-3.5', iconColor)} />
              </span>
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
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
