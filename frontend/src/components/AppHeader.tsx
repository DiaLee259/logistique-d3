import { useState } from 'react';
import { Bell, LogOut, RefreshCw, Sun, Moon, Check, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { notificationsApi } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import type { Notification } from '@/lib/types';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/articles': 'Articles & Stock',
  '/mouvements': 'Mouvements de stock',
  '/commandes': 'Commandes',
  '/livraisons': 'Livraisons fournisseurs',
  '/parametres': 'Paramètres',
};

export default function AppHeader() {
  const { logout, user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);

  const title = Object.entries(pageTitles)
    .reverse()
    .find(([path]) => location.pathname.startsWith(path))?.[1] ?? 'Logistique D3';

  const { data: notifs = [], refetch } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  });

  const nonLues = notifs.filter(n => !n.lue);

  const marquerLueMut = useMutation({
    mutationFn: (id: string) => notificationsApi.marquerLue(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const marquerToutesLuesMut = useMutation({
    mutationFn: notificationsApi.marquerToutesLues,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <header className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-1.5">

        {/* Dark/Light toggle */}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Refresh global */}
        <button
          onClick={() => qc.invalidateQueries()}
          title="Actualiser les données"
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-4 h-4" />
            {nonLues.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                {nonLues.length > 9 ? '9+' : nonLues.length}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-10 z-50 w-80 bg-card rounded-xl shadow-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-xs font-semibold">
                    Notifications {nonLues.length > 0 && <span className="text-primary">({nonLues.length} non lue{nonLues.length > 1 ? 's' : ''})</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    {nonLues.length > 0 && (
                      <button onClick={() => marquerToutesLuesMut.mutate()}
                        className="px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted transition-colors">
                        Tout marquer lu
                      </button>
                    )}
                    <button onClick={() => refetch()} className="p-1 hover:bg-muted rounded">
                      <RefreshCw className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin">
                  {nonLues.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Aucune notification non lue</p>
                  ) : (
                    nonLues.slice(0, 15).map(n => (
                      <div key={n.id} className="px-4 py-3 border-b border-border last:border-0 bg-primary/5 group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{n.titre}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">{formatDateTime(n.createdAt)}</p>
                          </div>
                          <button
                            onClick={() => marquerLueMut.mutate(n.id)}
                            title="Marquer comme lu"
                            className="flex-shrink-0 p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User + logout */}
        <div className="flex items-center gap-2 ml-1 pl-2 border-l border-border">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-medium text-foreground leading-tight">{user?.prenom} {user?.nom}</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {user?.role === 'LOGISTICIEN_1' ? 'Log. Backoffice' :
               user?.role === 'LOGISTICIEN_2' ? 'Log. Terrain' :
               user?.role === 'CHEF_PROJET' ? 'Chef de projet' : 'Admin'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Déconnexion"
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
