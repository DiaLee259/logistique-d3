import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, BookOpen, X, Plus, Check, AlertCircle, HelpCircle, Warehouse, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { usersApi, articlesApi, entrepotsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn, roleLabel, formatDate } from '@/lib/utils';
import type { User, Article, Entrepot } from '@/lib/types';

type Tab = 'utilisateurs' | 'entrepots' | 'catalogue' | 'workflow';

export default function Parametres() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('utilisateurs');

  // ── Utilisateurs ──────────────────────────────────────────────────────────
  const [userDialog, setUserDialog] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ prenom: '', nom: '', email: '', password: '', role: 'LOGISTICIEN_1' });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: tab === 'utilisateurs' && hasRole('ADMIN', 'CHEF_PROJET'),
  });

  const createUserMut = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Compte créé'); closeUserDialog(); },
  });

  const updateUserMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Compte mis à jour'); closeUserDialog(); },
  });

  const toggleActifMut = useMutation({
    mutationFn: usersApi.toggleActif,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const openCreateUser = () => {
    setEditUser(null);
    setUserForm({ prenom: '', nom: '', email: '', password: '', role: 'LOGISTICIEN_1' });
    setUserDialog(true);
  };

  const openEditUser = (user: User) => {
    setEditUser(user);
    setUserForm({ prenom: user.prenom, nom: user.nom, email: user.email, password: '', role: user.role });
    setUserDialog(true);
  };

  const closeUserDialog = () => { setUserDialog(false); setEditUser(null); };

  const handleSaveUser = () => {
    if (!userForm.prenom || !userForm.nom || !userForm.email) { toast.error('Champs obligatoires manquants'); return; }
    if (!editUser && !userForm.password) { toast.error('Mot de passe requis'); return; }
    if (editUser) {
      const updateData: any = { prenom: userForm.prenom, nom: userForm.nom, email: userForm.email, role: userForm.role };
      if (userForm.password) updateData.password = userForm.password;
      updateUserMut.mutate({ id: editUser.id, data: updateData });
    } else {
      createUserMut.mutate(userForm);
    }
  };

  // ── Entrepôts ──────────────────────────────────────────────────────────────
  const [entrepotDialog, setEntrepotDialog] = useState(false);
  const [editEntrepot, setEditEntrepot] = useState<Entrepot | null>(null);
  const [entrepotForm, setEntrepotForm] = useState({ code: '', nom: '', localisation: '', gestionnaire: '', adresse: '', telephone: '', email: '' });

  const { data: entrepots = [] } = useQuery<Entrepot[]>({
    queryKey: ['entrepots-all'],
    queryFn: () => entrepotsApi.list(true),
    enabled: tab === 'entrepots',
  });

  const createEntrepotMut = useMutation({
    mutationFn: entrepotsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entrepots-all'] }); qc.invalidateQueries({ queryKey: ['entrepots'] }); toast.success('Entrepôt créé'); closeEntrepotDialog(); },
  });

  const updateEntrepotMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => entrepotsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entrepots-all'] }); qc.invalidateQueries({ queryKey: ['entrepots'] }); toast.success('Entrepôt mis à jour'); closeEntrepotDialog(); },
  });

  const toggleEntrepotMut = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) => entrepotsApi.update(id, { actif }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entrepots-all'] }); qc.invalidateQueries({ queryKey: ['entrepots'] }); },
  });

  const openCreateEntrepot = () => {
    setEditEntrepot(null);
    setEntrepotForm({ code: '', nom: '', localisation: '', gestionnaire: '', adresse: '', telephone: '', email: '' });
    setEntrepotDialog(true);
  };

  const openEditEntrepot = (e: Entrepot) => {
    setEditEntrepot(e);
    setEntrepotForm({ code: e.code, nom: e.nom, localisation: e.localisation, gestionnaire: e.gestionnaire ?? '', adresse: e.adresse ?? '', telephone: e.telephone ?? '', email: e.email ?? '' });
    setEntrepotDialog(true);
  };

  const closeEntrepotDialog = () => { setEntrepotDialog(false); setEditEntrepot(null); };

  const handleSaveEntrepot = () => {
    if (!entrepotForm.code || !entrepotForm.nom || !entrepotForm.localisation) { toast.error('Code, nom et localisation requis'); return; }
    if (editEntrepot) {
      updateEntrepotMut.mutate({ id: editEntrepot.id, data: entrepotForm });
    } else {
      createEntrepotMut.mutate(entrepotForm);
    }
  };

  // ── Catalogue Articles ────────────────────────────────────────────────────
  const [catalogueFilter, setCatalogueFilter] = useState<'all' | 'actif' | 'inactif'>('all');
  const [editingSeuil, setEditingSeuil] = useState<{ id: string; value: string } | null>(null);

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ['articles-all'],
    queryFn: () => articlesApi.listAll(),
    enabled: tab === 'catalogue',
  });

  const toggleArticleMut = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) => articlesApi.toggleActif(id, actif),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles-all'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success('Article mis à jour');
    },
  });

  const updateSeuilMut = useMutation({
    mutationFn: ({ id, seuilAlerte }: { id: string; seuilAlerte: number }) =>
      articlesApi.update(id, { seuilAlerte }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles-all'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success('Seuil d\'alerte mis à jour');
      setEditingSeuil(null);
    },
    onError: () => toast.error('Erreur lors de la mise à jour'),
  });

  const saveSeuil = () => {
    if (!editingSeuil) return;
    const val = parseInt(editingSeuil.value);
    if (isNaN(val) || val < 0) { toast.error('Valeur invalide'); return; }
    updateSeuilMut.mutate({ id: editingSeuil.id, seuilAlerte: val });
  };

  const articlesFiltres = articles.filter(a => {
    if (catalogueFilter === 'actif') return a.actif;
    if (catalogueFilter === 'inactif') return !a.actif;
    return true;
  });

  const roles = [
    { value: 'ADMIN', label: 'Administrateur', color: 'bg-red-100 text-red-700' },
    { value: 'LOGISTICIEN_1', label: 'Logisticien 1 (Backoffice)', color: 'bg-blue-100 text-blue-700' },
    { value: 'LOGISTICIEN_2', label: 'Logisticien 2 (Terrain)', color: 'bg-purple-100 text-purple-700' },
    { value: 'CHEF_PROJET', label: 'Chef de projet', color: 'bg-green-100 text-green-700' },
  ];

  const roleColor = (r: string) => roles.find(x => x.value === r)?.color ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-xl p-1 w-fit">
        {[
          { key: 'utilisateurs' as Tab, label: 'Utilisateurs', icon: Users },
          { key: 'entrepots' as Tab, label: 'Entrepôts', icon: Warehouse },
          { key: 'catalogue' as Tab, label: 'Catalogue articles', icon: BookOpen },
          { key: 'workflow' as Tab, label: 'Guide & Workflow', icon: HelpCircle },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors',
              tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── TAB UTILISATEURS ── */}
      {tab === 'utilisateurs' && (
        <div className="space-y-3">
          {!hasRole('ADMIN', 'CHEF_PROJET') ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">Accès réservé aux Administrateurs et Chefs de projet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Gestion des comptes</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{users.length} compte(s) enregistré(s)</p>
                </div>
                {hasRole('ADMIN') && (
                  <button onClick={openCreateUser}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                    <Plus className="w-3.5 h-3.5" /> Nouveau compte
                  </button>
                )}
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {['Utilisateur', 'Email', 'Rôle', 'Créé le', 'Statut', ''].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">{u.prenom[0]}{u.nom[0]}</span>
                            </div>
                            <span className="font-medium">{u.prenom} {u.nom}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', roleColor(u.role))}>
                            {roleLabel(u.role)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                            u.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                            {u.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {hasRole('ADMIN') && (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openEditUser(u)}
                                className="px-2.5 py-1 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                                Modifier
                              </button>
                              <button onClick={() => toggleActifMut.mutate(u.id)}
                                className={cn('px-2.5 py-1 text-xs rounded-lg border transition-colors',
                                  u.actif ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50')}>
                                {u.actif ? 'Désactiver' : 'Activer'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Explications des rôles */}
              <div className="grid grid-cols-2 gap-3">
                {roles.map(r => (
                  <div key={r.value} className="bg-card rounded-xl border border-border p-3">
                    <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2', r.color)}>{r.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {r.value === 'ADMIN' && 'Accès complet. Gère les comptes, valide et expédie les commandes, consulte tous les rapports.'}
                      {r.value === 'LOGISTICIEN_1' && 'Backoffice : reçoit les commandes, valide les quantités, gère le stock, génère les fiches.'}
                      {r.value === 'LOGISTICIEN_2' && 'Terrain : prépare et expédie les commandes, saisit les mouvements physiques, confirme les livraisons.'}
                      {r.value === 'CHEF_PROJET' && 'Consultation uniquement. Accède aux KPIs, rapports et statistiques. Gestion des comptes.'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB ENTREPÔTS ── */}
      {tab === 'entrepots' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Gestion des entrepôts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{entrepots.length} entrepôt(s)</p>
            </div>
            {hasRole('ADMIN', 'LOGISTICIEN_1') && (
              <button onClick={openCreateEntrepot}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                <Plus className="w-3.5 h-3.5" /> Nouvel entrepôt
              </button>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Code', 'Nom', 'Localisation', 'Gestionnaire', 'Téléphone', 'Email', 'Statut', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entrepots.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-mono font-bold text-primary">{e.code}</td>
                    <td className="px-3 py-2.5 font-medium">{e.nom}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.localisation}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.gestionnaire ?? '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.telephone ?? '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{e.email ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', e.actif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                        {e.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {hasRole('ADMIN', 'LOGISTICIEN_1') && (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEditEntrepot(e)}
                            className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:bg-muted">
                            Modifier
                          </button>
                          <button onClick={() => toggleEntrepotMut.mutate({ id: e.id, actif: !e.actif })}
                            className={cn('px-2 py-1 text-xs rounded border transition-colors',
                              e.actif ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50')}>
                            {e.actif ? 'Désactiver' : 'Activer'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB CATALOGUE ── */}
      {tab === 'catalogue' && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold">Catalogue des articles</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {articles.filter(a => a.actif).length} actif(s) · {articles.filter(a => !a.actif).length} inactif(s)
              </p>
            </div>
            <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
              {(['all', 'actif', 'inactif'] as const).map(f => (
                <button key={f} onClick={() => setCatalogueFilter(f)}
                  className={cn('px-3 py-1 rounded text-xs font-medium transition-colors',
                    catalogueFilter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {f === 'all' ? 'Tous' : f === 'actif' ? 'Actifs' : 'Inactifs'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Référence', 'Désignation', 'Unité', 'Seuil alerte', 'Statut', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articlesFiltres.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Aucun article</td></tr>
                ) : articlesFiltres.map(a => (
                  <tr key={a.id} className={cn('border-b border-border/50 hover:bg-muted/10', !a.actif && 'opacity-50')}>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{a.reference}</td>
                    <td className="px-3 py-2.5 font-medium">{a.nom}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{a.unite}</td>

                    {/* ── Seuil alerte éditable ── */}
                    <td className="px-3 py-2">
                      {hasRole('ADMIN', 'LOGISTICIEN_1') ? (
                        editingSeuil?.id === a.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={editingSeuil.value}
                              onChange={e => setEditingSeuil(p => p ? { ...p, value: e.target.value } : null)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveSeuil();
                                if (e.key === 'Escape') setEditingSeuil(null);
                              }}
                              autoFocus
                              className="w-16 px-2 py-1 text-xs border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                            />
                            <button
                              onClick={saveSeuil}
                              disabled={updateSeuilMut.isPending}
                              className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-60"
                              title="Valider"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingSeuil(null)}
                              className="p-1 rounded bg-muted text-muted-foreground hover:bg-muted/80"
                              title="Annuler"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingSeuil({ id: a.id, value: String(a.seuilAlerte) })}
                            className="flex items-center gap-1.5 group rounded px-1.5 py-0.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            title="Cliquer pour modifier le seuil"
                          >
                            <span className={cn(
                              'font-mono font-semibold',
                              a.seuilAlerte <= 5 ? 'text-red-600' : a.seuilAlerte <= 15 ? 'text-amber-600' : 'text-foreground'
                            )}>
                              {a.seuilAlerte}
                            </span>
                            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 text-muted-foreground transition-opacity" />
                          </button>
                        )
                      ) : (
                        <span className={cn(
                          'font-mono font-semibold',
                          a.seuilAlerte <= 5 ? 'text-red-600' : a.seuilAlerte <= 15 ? 'text-amber-600' : 'text-foreground'
                        )}>
                          {a.seuilAlerte}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                        a.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {a.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {hasRole('ADMIN', 'LOGISTICIEN_1') && (
                        <button
                          onClick={() => toggleArticleMut.mutate({ id: a.id, actif: !a.actif })}
                          disabled={toggleArticleMut.isPending}
                          className={cn('px-2.5 py-1 text-xs rounded border transition-colors',
                            a.actif
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50')}>
                          {a.actif ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasRole('ADMIN', 'LOGISTICIEN_1') && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Pencil className="w-3 h-3" />
              Cliquez sur un seuil pour le modifier — rouge ≤ 5, orange ≤ 15
            </p>
          )}
        </div>
      )}

      {/* ── TAB WORKFLOW ── */}
      {tab === 'workflow' && (
        <div className="space-y-4 max-w-3xl">
          <div>
            <h2 className="text-sm font-semibold">Guide d'utilisation</h2>
            <p className="text-xs text-muted-foreground">Comprendre les modules et le flux de traitement des commandes.</p>
          </div>

          {/* Différence Mouvements / Commandes */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs">?</span>
              Mouvements vs Commandes — Quelle différence ?
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-bold text-blue-800 mb-1">📦 Mouvements de stock</p>
                <p className="text-xs text-blue-700">Traçabilité physique du stock en entrepôt. Enregistre chaque <strong>entrée</strong> (réception fournisseur) ou <strong>sortie</strong> (matériel distribué). Sert à l'inventaire et au suivi des quantités.</p>
                <p className="text-xs text-blue-600 mt-1 font-medium">Quand l'utiliser : dès qu'un article entre ou sort physiquement de l'entrepôt.</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs font-bold text-orange-800 mb-1">📋 Commandes prestataires</p>
                <p className="text-xs text-orange-700">Workflow complet d'une demande de matériel. Un prestataire soumet une liste, le Log1 valide, le Log2 prépare et expédie, puis le prestataire confirme la réception.</p>
                <p className="text-xs text-orange-600 mt-1 font-medium">Quand l'utiliser : dès qu'un technicien demande du matériel pour une intervention.</p>
              </div>
            </div>
          </div>

          {/* Flux commande */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-bold mb-3">🔄 Parcours d'une commande</h3>
            <div className="space-y-2">
              {[
                { step: '1', titre: 'Réception (EN_ATTENTE)', qui: 'Prestataire / Log1', desc: 'Le prestataire soumet via lien public ou le logisticien crée la commande manuellement / via Excel.', color: 'bg-amber-50 border-amber-200' },
                { step: '2', titre: 'Validation Log1 (EN_ATTENTE_LOG2)', qui: 'Log1 ou Log2', desc: 'Le logisticien vérifie le stock, ajuste les quantités si besoin et transmet au Logisticien 2.', color: 'bg-blue-50 border-blue-200' },
                { step: '3', titre: 'Préparation et expédition (EXPÉDIÉE)', qui: 'Log2 ou Log1', desc: 'Le logisticien prépare le colis, crée les mouvements de sortie stock, et marque la commande expédiée.', color: 'bg-purple-50 border-purple-200' },
                { step: '4', titre: 'Livraison confirmée (LIVRÉE)', qui: 'Tout utilisateur', desc: 'La réception est confirmée par le prestataire ou le logisticien. La commande est archivée.', color: 'bg-green-50 border-green-200' },
              ].map(s => (
                <div key={s.step} className={cn('border rounded-lg p-3 flex gap-3', s.color)}>
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold shadow-sm flex-shrink-0 mt-0.5">{s.step}</div>
                  <div>
                    <p className="text-xs font-bold">{s.titre}</p>
                    <p className="text-xs text-muted-foreground">👤 <em>{s.qui}</em> — {s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Livraisons fournisseurs */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-bold mb-2">🚚 Livraisons fournisseurs</h3>
            <p className="text-xs text-muted-foreground">
              La section <strong>Livraisons</strong> enregistre les livraisons de vos <strong>fournisseurs</strong> (pas les prestataires).
              Quand un fournisseur livre du matériel à votre entrepôt, créez une livraison ici : le stock est automatiquement mis à jour.
              C'est différent des commandes prestataires qui concernent la distribution du matériel existant.
            </p>
          </div>

          {/* Méthode de calcul articles */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-xs font-bold mb-2">🧮 Méthode de calcul des quantités</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Pour chaque article, vous pouvez définir une règle de consommation. Exemple :
            </p>
            <div className="space-y-1.5 text-xs">
              {[
                ['Câble G.657A1', '40m par boîte de jonction + 10m de marge', '50m / intervention'],
                ['Connecteur SC/APC', '2 par soudure + 20% de marge', '~2,4 unités / soudure'],
                ['Kit PTO', '1 par point de terminaison optique', '1 / PTO posé'],
                ['SFP 1G', '1 par port actif à équiper', '1 / port'],
              ].map(([art, regle, exemple]) => (
                <div key={art} className="grid grid-cols-3 gap-2 bg-muted/20 rounded-lg p-2">
                  <span className="font-medium">{art}</span>
                  <span className="text-muted-foreground">{regle}</span>
                  <span className="text-primary font-medium">{exemple}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ces règles sont configurables dans <strong>Articles & Stock → modifier l'article</strong> (champ "Règle de consommation" et "Facteur").
            </p>
          </div>
        </div>
      )}

      {/* Dialog entrepôt */}
      {entrepotDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">{editEntrepot ? `Modifier — ${editEntrepot.nom}` : 'Nouvel entrepôt'}</h2>
              <button onClick={closeEntrepotDialog} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Code *</label>
                  <input value={entrepotForm.code} onChange={e => setEntrepotForm(p => ({ ...p, code: e.target.value }))}
                    disabled={!!editEntrepot} placeholder="ENT01"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nom *</label>
                  <input value={entrepotForm.nom} onChange={e => setEntrepotForm(p => ({ ...p, nom: e.target.value }))}
                    placeholder="Entrepôt Central"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Localisation *</label>
                <input value={entrepotForm.localisation} onChange={e => setEntrepotForm(p => ({ ...p, localisation: e.target.value }))}
                  placeholder="Lyon, Bâtiment A"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Gestionnaire</label>
                <input value={entrepotForm.gestionnaire} onChange={e => setEntrepotForm(p => ({ ...p, gestionnaire: e.target.value }))}
                  placeholder="Nom du responsable"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Adresse</label>
                <input value={entrepotForm.adresse} onChange={e => setEntrepotForm(p => ({ ...p, adresse: e.target.value }))}
                  placeholder="12 rue de l'industrie, 69000 Lyon"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Téléphone</label>
                  <input value={entrepotForm.telephone} onChange={e => setEntrepotForm(p => ({ ...p, telephone: e.target.value }))}
                    placeholder="04 XX XX XX XX"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                  <input type="email" value={entrepotForm.email} onChange={e => setEntrepotForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="entrepot@logistique.fr"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={closeEntrepotDialog} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleSaveEntrepot} disabled={createEntrepotMut.isPending || updateEntrepotMut.isPending}
                  className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> {editEntrepot ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog création compte */}
      {userDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">{editUser ? `Modifier — ${editUser.prenom} ${editUser.nom}` : 'Nouveau compte utilisateur'}</h2>
              <button onClick={closeUserDialog} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { f: 'prenom', l: 'Prénom *', p: 'Jean' },
                  { f: 'nom', l: 'Nom *', p: 'Dupont' },
                ].map(({ f, l, p }) => (
                  <div key={f}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{l}</label>
                    <input value={(userForm as any)[f]} onChange={e => setUserForm(prev => ({ ...prev, [f]: e.target.value }))}
                      placeholder={p} className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="jean.dupont@logistique.fr"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Mot de passe {editUser ? '(laisser vide = inchangé)' : '*'}
                </label>
                <input type="password" value={userForm.password} onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={editUser ? 'Laisser vide pour ne pas changer' : 'Minimum 8 caractères'}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle *</label>
                <select value={userForm.role} onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20">
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={closeUserDialog} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleSaveUser} disabled={createUserMut.isPending || updateUserMut.isPending}
                  className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> {editUser ? 'Enregistrer les modifications' : 'Créer le compte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
