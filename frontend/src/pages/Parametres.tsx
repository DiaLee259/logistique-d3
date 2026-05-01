import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, BookOpen, X, Plus, Check, AlertCircle, HelpCircle, Warehouse, Pencil, Building2, UserRound, Phone, Mail, MapPin, Trash2, Upload, Download, FileSpreadsheet, ShieldCheck, Eye, EyeOff, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { usersApi, articlesApi, entrepotsApi, repertoireApi, adminApi } from '@/lib/api';
import { useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn, roleLabel, formatDate } from '@/lib/utils';
import type { User, Article, Entrepot, Societe, Intervenant, UserPrivileges } from '@/lib/types';
import { DEFAULT_PRIVILEGES } from '@/lib/types';

type Tab = 'utilisateurs' | 'entrepots' | 'catalogue' | 'repertoire' | 'workflow' | 'remise-a-zero';

export default function Parametres() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('utilisateurs');

  // ── Utilisateurs ──────────────────────────────────────────────────────────
  const [userDialog, setUserDialog] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ prenom: '', nom: '', email: '', password: '', role: 'LOGISTICIEN_1' });
  const [showUserPass, setShowUserPass] = useState(false);

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

  const closeUserDialog = () => { setUserDialog(false); setEditUser(null); setShowUserPass(false); };

  // ── Privileges ────────────────────────────────────────────────────────────
  const [privilegeDialog, setPrivilegeDialog] = useState(false);
  const [privilegeUser, setPrivilegeUser] = useState<User | null>(null);
  const [privilegeForm, setPrivilegeForm] = useState<UserPrivileges>(DEFAULT_PRIVILEGES);

  const updatePrivilegesMut = useMutation({
    mutationFn: ({ id, privileges }: { id: string; privileges: UserPrivileges }) =>
      usersApi.updatePrivileges(id, privileges),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Privilèges mis à jour');
      setPrivilegeDialog(false);
    },
  });

  const openPrivilegeDialog = (user: User) => {
    setPrivilegeUser(user);
    setPrivilegeForm(user.privileges ?? { ...DEFAULT_PRIVILEGES });
    setPrivilegeDialog(true);
  };

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
    enabled: tab === 'entrepots' || privilegeDialog,
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
  const fileInputArticleRef = useRef<HTMLInputElement>(null);
  const importArticleMut = useMutation({
    mutationFn: (file: File) => articlesApi.import(file),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['articles-all'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success(`Import terminé : ${res.created} ajoutés, ${res.skipped} ignorés`);
    },
    onError: () => toast.error("Erreur lors de l'import"),
  });

  const seedArticlesMut = useMutation({
    mutationFn: () => articlesApi.seed(),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['articles-all'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success(`Catalogue réinitialisé : ${res.upserted} articles injectés, ${res.deactivated} désactivés`);
    },
    onError: () => toast.error('Erreur lors de la réinitialisation'),
  });

  const makeResetMut = (fn: () => Promise<any>, label: string) => ({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocks'] });
      qc.invalidateQueries({ queryKey: ['mouvements'] });
      qc.invalidateQueries({ queryKey: ['commandes'] });
      qc.invalidateQueries({ queryKey: ['inventaires'] });
      qc.invalidateQueries({ queryKey: ['livraisons'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(label);
    },
    onError: () => toast.error('Erreur lors de la remise à zéro'),
  });

  const resetMouvementsMut = useMutation(makeResetMut(adminApi.resetMouvements, 'Mouvements supprimés'));
  const resetInventairesMut = useMutation(makeResetMut(adminApi.resetInventaires, 'Inventaires supprimés'));
  const resetCommandesMut = useMutation(makeResetMut(adminApi.resetCommandes, 'Commandes supprimées'));
  const resetLivraisonsMut = useMutation(makeResetMut(adminApi.resetLivraisons, 'Livraisons supprimées'));
  const resetStocksMut = useMutation(makeResetMut(adminApi.resetStocks, 'Stocks remis à zéro'));
  const resetNotificationsMut = useMutation(makeResetMut(adminApi.resetNotifications, 'Notifications supprimées'));
  const resetCompletMut = useMutation(makeResetMut(adminApi.resetComplet, 'Remise à zéro complète effectuée'));

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

  // ── Répertoire Sociétés / Intervenants ───────────────────────────────────────
  const [repertoireSection, setRepertoireSection] = useState<'societes' | 'intervenants'>('societes');
  const [societeDialog, setSocieteDialog] = useState(false);
  const [editSociete, setEditSociete] = useState<Societe | null>(null);
  const [societeForm, setSocieteForm] = useState({ nom: '', code: '', adresse: '', telephone: '', email: '' });

  const [intervenantDialog, setIntervenantDialog] = useState(false);
  const [editIntervenant, setEditIntervenant] = useState<Intervenant | null>(null);
  const [intervenantForm, setIntervenantForm] = useState({ nom: '', prenom: '', email: '', telephone: '', societeId: '' });

  const { data: societes = [] } = useQuery<Societe[]>({
    queryKey: ['societes'],
    queryFn: repertoireApi.listSocietes,
    enabled: tab === 'repertoire',
  });

  const { data: intervenants = [] } = useQuery<Intervenant[]>({
    queryKey: ['intervenants'],
    queryFn: () => repertoireApi.listIntervenants(),
    enabled: tab === 'repertoire',
  });

  const createSocieteMut = useMutation({
    mutationFn: repertoireApi.createSociete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['societes'] }); toast.success('Société créée'); setSocieteDialog(false); setEditSociete(null); },
    onError: () => toast.error('Erreur — le code existe peut-être déjà'),
  });

  const updateSocieteMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => repertoireApi.updateSociete(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['societes'] }); toast.success('Société mise à jour'); setSocieteDialog(false); setEditSociete(null); },
  });

  const deleteSocieteMut = useMutation({
    mutationFn: repertoireApi.deleteSociete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['societes'] }); qc.invalidateQueries({ queryKey: ['intervenants'] }); toast.success('Société supprimée'); },
  });

  const toggleSocieteMut = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) => repertoireApi.updateSociete(id, { actif }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['societes'] }),
  });

  const createIntervenantMut = useMutation({
    mutationFn: repertoireApi.createIntervenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['intervenants'] }); toast.success('Intervenant ajouté'); setIntervenantDialog(false); setEditIntervenant(null); },
  });

  const updateIntervenantMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => repertoireApi.updateIntervenant(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['intervenants'] }); toast.success('Intervenant mis à jour'); setIntervenantDialog(false); setEditIntervenant(null); },
  });

  const deleteIntervenantMut = useMutation({
    mutationFn: repertoireApi.deleteIntervenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['intervenants'] }); toast.success('Intervenant supprimé'); },
  });

  const toggleIntervenantMut = useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) => repertoireApi.updateIntervenant(id, { actif }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intervenants'] }),
  });

  const importSocieteMut = useMutation({
    mutationFn: (file: File) => repertoireApi.importSocietes(file),
    onSuccess: (res: any) => { qc.invalidateQueries({ queryKey: ['societes'] }); toast.success(`Import terminé : ${res.created} créées, ${res.skipped} ignorées`); },
    onError: () => toast.error('Erreur lors de l\'import'),
  });
  const importIntervenantMut = useMutation({
    mutationFn: (file: File) => repertoireApi.importIntervenants(file),
    onSuccess: (res: any) => { qc.invalidateQueries({ queryKey: ['intervenants'] }); toast.success(`Import terminé : ${res.created} ajoutés, ${res.skipped} ignorés`); },
    onError: () => toast.error('Erreur lors de l\'import'),
  });

  const fileInputSocieteRef = useRef<HTMLInputElement>(null);
  const fileInputIntervenantRef = useRef<HTMLInputElement>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCreateSociete = () => {
    setEditSociete(null);
    setSocieteForm({ nom: '', code: '', adresse: '', telephone: '', email: '' });
    setSocieteDialog(true);
  };

  const openEditSociete = (s: Societe) => {
    setEditSociete(s);
    setSocieteForm({ nom: s.nom, code: s.code ?? '', adresse: s.adresse ?? '', telephone: s.telephone ?? '', email: s.email ?? '' });
    setSocieteDialog(true);
  };

  const handleSaveSociete = () => {
    if (!societeForm.nom) { toast.error('Le nom est obligatoire'); return; }
    const payload = {
      nom: societeForm.nom,
      code: societeForm.code || undefined,
      adresse: societeForm.adresse || undefined,
      telephone: societeForm.telephone || undefined,
      email: societeForm.email || undefined,
    };
    if (editSociete) updateSocieteMut.mutate({ id: editSociete.id, data: payload });
    else createSocieteMut.mutate(payload);
  };

  const openCreateIntervenant = () => {
    setEditIntervenant(null);
    setIntervenantForm({ nom: '', prenom: '', email: '', telephone: '', societeId: '' });
    setIntervenantDialog(true);
  };

  const openEditIntervenant = (i: Intervenant) => {
    setEditIntervenant(i);
    setIntervenantForm({ nom: i.nom, prenom: i.prenom, email: i.email ?? '', telephone: i.telephone ?? '', societeId: i.societeId ?? '' });
    setIntervenantDialog(true);
  };

  const handleSaveIntervenant = () => {
    if (!intervenantForm.nom || !intervenantForm.prenom) { toast.error('Nom et prénom obligatoires'); return; }
    const payload = {
      nom: intervenantForm.nom,
      prenom: intervenantForm.prenom,
      email: intervenantForm.email || undefined,
      telephone: intervenantForm.telephone || undefined,
      societeId: intervenantForm.societeId || undefined,
    };
    if (editIntervenant) updateIntervenantMut.mutate({ id: editIntervenant.id, data: payload });
    else createIntervenantMut.mutate(payload);
  };

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
          { key: 'repertoire' as Tab, label: 'Sociétés & Intervenants', icon: Building2 },
          { key: 'workflow' as Tab, label: 'Guide & Workflow', icon: HelpCircle },
          ...(hasRole('ADMIN') ? [{ key: 'remise-a-zero' as Tab, label: 'Remise à zéro', icon: RotateCcw }] : []),
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        usersApi.export().then(blob => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `export-comptes-${new Date().toISOString().slice(0, 10)}.xlsx`;
                          a.click();
                          URL.revokeObjectURL(url);
                        })
                      }
                      className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg bg-card hover:border-green-500 hover:text-green-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Exporter comptes
                    </button>
                    <button onClick={openCreateUser}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                      <Plus className="w-3.5 h-3.5" /> Nouveau compte
                    </button>
                  </div>
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
                              <button onClick={() => openPrivilegeDialog(u)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                                <ShieldCheck className="w-3 h-3" /> Privilèges
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
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => articlesApi.template().then(b => downloadBlob(b, 'template-articles.xlsx')).catch(() => toast.error('Erreur téléchargement'))}
                className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted">
                <Download className="w-3.5 h-3.5" /> Modèle Excel
              </button>
              <button onClick={() => fileInputArticleRef.current?.click()}
                disabled={importArticleMut.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-xs border border-primary text-primary rounded-lg hover:bg-primary/5 disabled:opacity-60">
                <Upload className="w-3.5 h-3.5" /> {importArticleMut.isPending ? 'Import…' : 'Importer'}
              </button>
              <input ref={fileInputArticleRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { importArticleMut.mutate(f); e.target.value = ''; } }} />
              {hasRole('ADMIN') && (
                <button
                  onClick={() => { if (confirm('Réinitialiser le catalogue avec les 55 articles officiels ? Les articles hors-liste seront désactivés.')) seedArticlesMut.mutate(); }}
                  disabled={seedArticlesMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs border border-orange-400 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-60">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> {seedArticlesMut.isPending ? 'Injection…' : 'Réinjecter catalogue'}
                </button>
              )}
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

      {/* ── TAB RÉPERTOIRE ── */}
      {tab === 'repertoire' && (
        <div className="space-y-4">
          {/* Sous-navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setRepertoireSection('societes')}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-colors',
                repertoireSection === 'societes'
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
              <Building2 className="w-3.5 h-3.5" />
              Sociétés ({societes.length})
            </button>
            <button
              onClick={() => setRepertoireSection('intervenants')}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border transition-colors',
                repertoireSection === 'intervenants'
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted')}>
              <UserRound className="w-3.5 h-3.5" />
              Intervenants ({intervenants.length})
            </button>
          </div>

          {/* ── Sociétés ── */}
          {repertoireSection === 'societes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Répertoire des sociétés</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Prestataires et sous-traitants référencés</p>
                </div>
                {hasRole('ADMIN', 'LOGISTICIEN_1') && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => repertoireApi.templateSocietes().then(blob => downloadBlob(blob, 'template-societes.xlsx')).catch(() => toast.error('Erreur téléchargement'))}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted">
                      <Download className="w-3.5 h-3.5" /> Modèle Excel
                    </button>
                    <button onClick={() => fileInputSocieteRef.current?.click()}
                      disabled={importSocieteMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs border border-primary text-primary rounded-lg hover:bg-primary/5 disabled:opacity-60">
                      <Upload className="w-3.5 h-3.5" /> {importSocieteMut.isPending ? 'Import…' : 'Importer'}
                    </button>
                    <input ref={fileInputSocieteRef} type="file" accept=".xlsx,.xls" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { importSocieteMut.mutate(f); e.target.value = ''; } }} />
                    <button onClick={openCreateSociete}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                      <Plus className="w-3.5 h-3.5" /> Nouvelle société
                    </button>
                  </div>
                )}
              </div>

              {societes.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground text-xs">
                  Aucune société enregistrée. Commencez par en créer une.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {societes.map(s => (
                    <div key={s.id} className={cn('bg-card rounded-xl border border-border p-4 flex items-start gap-4', !s.actif && 'opacity-60')}>
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{s.nom}</span>
                          {s.code && <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-mono text-muted-foreground">{s.code}</span>}
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', s.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                            {s.actif ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {s.adresse && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.adresse}</span>}
                          {s.telephone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.telephone}</span>}
                          {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                        </div>
                        {s.intervenants && s.intervenants.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {s.intervenants.map(i => (
                              <span key={i.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                                {i.prenom} {i.nom}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {hasRole('ADMIN', 'LOGISTICIEN_1') && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => openEditSociete(s)}
                            className="px-2.5 py-1 text-xs rounded border border-border text-muted-foreground hover:bg-muted">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => toggleSocieteMut.mutate({ id: s.id, actif: !s.actif })}
                            className={cn('px-2.5 py-1 text-xs rounded border transition-colors',
                              s.actif ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-green-200 text-green-600 hover:bg-green-50')}>
                            {s.actif ? 'Désactiver' : 'Activer'}
                          </button>
                          {hasRole('ADMIN') && (
                            <button onClick={() => {
                              if (confirm(`Supprimer "${s.nom}" ?`)) deleteSocieteMut.mutate(s.id);
                            }}
                              className="px-2.5 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Intervenants ── */}
          {repertoireSection === 'intervenants' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Répertoire des intervenants</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Techniciens et contacts rattachés aux sociétés</p>
                </div>
                {hasRole('ADMIN', 'LOGISTICIEN_1') && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => repertoireApi.templateIntervenants().then(blob => downloadBlob(blob, 'template-intervenants.xlsx')).catch(() => toast.error('Erreur téléchargement'))}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted">
                      <Download className="w-3.5 h-3.5" /> Modèle Excel
                    </button>
                    <button onClick={() => fileInputIntervenantRef.current?.click()}
                      disabled={importIntervenantMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs border border-primary text-primary rounded-lg hover:bg-primary/5 disabled:opacity-60">
                      <Upload className="w-3.5 h-3.5" /> {importIntervenantMut.isPending ? 'Import…' : 'Importer'}
                    </button>
                    <input ref={fileInputIntervenantRef} type="file" accept=".xlsx,.xls" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { importIntervenantMut.mutate(f); e.target.value = ''; } }} />
                    <button onClick={openCreateIntervenant}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90">
                      <Plus className="w-3.5 h-3.5" /> Nouvel intervenant
                    </button>
                  </div>
                )}
              </div>

              {intervenants.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground text-xs">
                  Aucun intervenant enregistré.
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {['Intervenant', 'Société', 'Téléphone', 'Email', 'Statut', ''].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {intervenants.map(i => (
                        <tr key={i.id} className={cn('border-b border-border/50 hover:bg-muted/10', !i.actif && 'opacity-60')}>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-blue-700">{i.prenom[0]}{i.nom[0]}</span>
                              </div>
                              <div>
                                <p className="font-medium">{i.prenom} {i.nom}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {i.societe ? (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {i.societe.nom}
                                {i.societe.code && <span className="font-mono text-xs">({i.societe.code})</span>}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{i.telephone || '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{i.email || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                              i.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                              {i.actif ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {hasRole('ADMIN', 'LOGISTICIEN_1') && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => openEditIntervenant(i)}
                                  className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:bg-muted">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button onClick={() => toggleIntervenantMut.mutate({ id: i.id, actif: !i.actif })}
                                  className={cn('px-2 py-1 text-xs rounded border transition-colors',
                                    i.actif ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-green-200 text-green-600 hover:bg-green-50')}>
                                  {i.actif ? 'Désactiver' : 'Activer'}
                                </button>
                                {hasRole('ADMIN') && (
                                  <button onClick={() => {
                                    if (confirm(`Supprimer ${i.prenom} ${i.nom} ?`)) deleteIntervenantMut.mutate(i.id);
                                  }}
                                    className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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

      {/* ── TAB REMISE À ZÉRO ── */}
      {tab === 'remise-a-zero' && hasRole('ADMIN') && (
        <div className="space-y-4 max-w-2xl">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Remise à zéro — Administration
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Ces actions sont irréversibles. Utilisez-les uniquement pour repartir de zéro après la phase de test.
            </p>
          </div>

          {/* Actions granulaires */}
          <div className="bg-card rounded-xl border border-border divide-y divide-border">
            {[
              { label: 'Mouvements de stock', desc: 'Supprime tous les mouvements d\'entrée et de sortie. Recalcule les stocks.', mut: resetMouvementsMut, color: 'text-orange-600 border-orange-300 hover:bg-orange-50' },
              { label: 'Inventaires physiques', desc: 'Supprime tous les enregistrements d\'inventaire. Recalcule les stocks.', mut: resetInventairesMut, color: 'text-orange-600 border-orange-300 hover:bg-orange-50' },
              { label: 'Commandes prestataires', desc: 'Supprime toutes les commandes et leurs lignes. Recalcule les stocks.', mut: resetCommandesMut, color: 'text-orange-600 border-orange-300 hover:bg-orange-50' },
              { label: 'Livraisons fournisseurs', desc: 'Supprime toutes les livraisons enregistrées.', mut: resetLivraisonsMut, color: 'text-orange-600 border-orange-300 hover:bg-orange-50' },
              { label: 'Quantités en stock', desc: 'Remet toutes les quantités à 0 sans supprimer les mouvements.', mut: resetStocksMut, color: 'text-orange-600 border-orange-300 hover:bg-orange-50' },
              { label: 'Notifications', desc: 'Supprime toutes les notifications système.', mut: resetNotificationsMut, color: 'text-orange-600 border-orange-300 hover:bg-orange-50' },
            ].map(({ label, desc, mut, color }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
                <div>
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <button
                  onClick={() => { if (confirm(`Supprimer : ${label} ?\nCette action est irréversible.`)) mut.mutate(); }}
                  disabled={mut.isPending}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs border rounded-lg disabled:opacity-60 ${color}`}
                >
                  {mut.isPending ? 'En cours…' : 'Supprimer'}
                </button>
              </div>
            ))}
          </div>

          {/* Remise à zéro complète */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-bold text-red-700 mb-1">Remise à zéro complète</p>
            <p className="text-xs text-red-600 mb-3">
              Supprime mouvements, inventaires, commandes, livraisons, remet les stocks à 0 et vide les notifications.
              Les articles, entrepôts et utilisateurs sont conservés.
            </p>
            <button
              onClick={() => { if (confirm('REMISE À ZÉRO COMPLÈTE ?\n\nToutes les données opérationnelles seront supprimées définitivement.\nLes articles, entrepôts et comptes sont conservés.\n\nConfirmer ?')) resetCompletMut.mutate(); }}
              disabled={resetCompletMut.isPending}
              className="flex items-center gap-2 px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {resetCompletMut.isPending ? 'Remise à zéro en cours…' : 'Tout remettre à zéro'}
            </button>
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
                    placeholder="ENT01"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
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

      {/* Dialog Société */}
      {societeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">{editSociete ? `Modifier — ${editSociete.nom}` : 'Nouvelle société'}</h2>
              <button onClick={() => { setSocieteDialog(false); setEditSociete(null); }} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nom *</label>
                  <input value={societeForm.nom} onChange={e => setSocieteForm(p => ({ ...p, nom: e.target.value }))}
                    placeholder="TechnoSmart SARL"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Code (optionnel)</label>
                  <input value={societeForm.code} onChange={e => setSocieteForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="TS01" disabled={!!editSociete}
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Téléphone</label>
                  <input value={societeForm.telephone} onChange={e => setSocieteForm(p => ({ ...p, telephone: e.target.value }))}
                    placeholder="04 XX XX XX XX"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Adresse</label>
                <input value={societeForm.adresse} onChange={e => setSocieteForm(p => ({ ...p, adresse: e.target.value }))}
                  placeholder="12 rue de l'industrie, 69000 Lyon"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                <input type="email" value={societeForm.email} onChange={e => setSocieteForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="contact@societe.fr"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setSocieteDialog(false); setEditSociete(null); }} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleSaveSociete} disabled={createSocieteMut.isPending || updateSocieteMut.isPending}
                  className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> {editSociete ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Intervenant */}
      {intervenantDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">{editIntervenant ? `Modifier — ${editIntervenant.prenom} ${editIntervenant.nom}` : 'Nouvel intervenant'}</h2>
              <button onClick={() => { setIntervenantDialog(false); setEditIntervenant(null); }} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Prénom *</label>
                  <input value={intervenantForm.prenom} onChange={e => setIntervenantForm(p => ({ ...p, prenom: e.target.value }))}
                    placeholder="Jean"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nom *</label>
                  <input value={intervenantForm.nom} onChange={e => setIntervenantForm(p => ({ ...p, nom: e.target.value }))}
                    placeholder="Dupont"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Société</label>
                <select value={intervenantForm.societeId} onChange={e => setIntervenantForm(p => ({ ...p, societeId: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">— Sans société —</option>
                  {societes.filter(s => s.actif).map(s => (
                    <option key={s.id} value={s.id}>{s.nom}{s.code ? ` (${s.code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Téléphone</label>
                  <input value={intervenantForm.telephone} onChange={e => setIntervenantForm(p => ({ ...p, telephone: e.target.value }))}
                    placeholder="06 XX XX XX XX"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                  <input type="email" value={intervenantForm.email} onChange={e => setIntervenantForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="j.dupont@societe.fr"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setIntervenantDialog(false); setEditIntervenant(null); }} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleSaveIntervenant} disabled={createIntervenantMut.isPending || updateIntervenantMut.isPending}
                  className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> {editIntervenant ? 'Enregistrer' : 'Ajouter'}
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
                <div className="relative">
                  <input
                    type={showUserPass ? 'text' : 'password'}
                    value={userForm.password}
                    onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder={editUser ? 'Laisser vide pour ne pas changer' : 'Minimum 8 caractères'}
                    className="w-full px-3 py-2 pr-9 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserPass(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showUserPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
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

      {/* ── Dialog Privilèges ── */}
      {privilegeDialog && privilegeUser && (() => {
        const MODULE_LABELS: Record<keyof UserPrivileges['modules'], string> = {
          dashboard:   'Tableau de bord',
          commandes:   'Commandes',
          commandesTS: 'Commandes TS',
          livraisons:  'Livraisons',
          inventaire:  'Inventaire',
          mouvements:  'Mouvements',
          parametres:  'Paramètres',
          guide:       'Guide & Workflow',
        };
        const LEVELS = ['NONE', 'LECTURE', 'EDITEUR', 'ADMIN'] as const;
        const levelColor = (l: string) => {
          if (l === 'NONE') return 'bg-gray-100 text-gray-500';
          if (l === 'LECTURE') return 'bg-blue-100 text-blue-700';
          if (l === 'EDITEUR') return 'bg-amber-100 text-amber-700';
          return 'bg-red-100 text-red-700';
        };
        const setModule = (mod: keyof UserPrivileges['modules'], level: string) =>
          setPrivilegeForm(p => ({ ...p, modules: { ...p.modules, [mod]: level as any } }));
        const setAction = (key: keyof UserPrivileges['actions'], val: boolean) =>
          setPrivilegeForm(p => ({ ...p, actions: { ...p.actions, [key]: val } }));
        const toggleEntrepot = (id: string) =>
          setPrivilegeForm(p => ({
            ...p,
            entrepots: p.entrepots.includes(id) ? p.entrepots.filter(e => e !== id) : [...p.entrepots, id],
          }));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Privilèges — {privilegeUser.prenom} {privilegeUser.nom}
                </h2>
                <button onClick={() => setPrivilegeDialog(false)} className="p-1 hover:bg-muted rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Modules */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Accès aux modules</h3>
                  <div className="space-y-2">
                    {(Object.keys(MODULE_LABELS) as Array<keyof UserPrivileges['modules']>).map(mod => (
                      <div key={mod} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium w-36">{MODULE_LABELS[mod]}</span>
                        <div className="flex gap-1">
                          {LEVELS.map(level => (
                            <button
                              key={level}
                              onClick={() => setModule(mod, level)}
                              className={cn(
                                'px-2.5 py-1 text-xs rounded-md font-medium transition-colors border',
                                privilegeForm.modules[mod] === level
                                  ? levelColor(level) + ' border-transparent'
                                  : 'bg-card border-border text-muted-foreground hover:bg-muted',
                              )}
                            >
                              {level === 'NONE' ? 'Aucun' : level === 'LECTURE' ? 'Lecture' : level === 'EDITEUR' ? 'Éditeur' : 'Admin'}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Entrepôts visibles */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Entrepôts visibles</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Si aucun entrepôt sélectionné, l'utilisateur voit tous les entrepôts.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entrepots.map((e: Entrepot) => {
                      const selected = privilegeForm.entrepots.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          onClick={() => toggleEntrepot(e.id)}
                          className={cn(
                            'px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors',
                            selected
                              ? 'bg-primary text-white border-primary'
                              : 'bg-card border-border text-muted-foreground hover:border-primary',
                          )}
                        >
                          {e.code} — {e.nom}
                        </button>
                      );
                    })}
                    {entrepots.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Aucun entrepôt configuré.</p>
                    )}
                  </div>
                  {privilegeForm.entrepots.length === 0 && (
                    <p className="text-xs text-green-700 mt-2">✓ Tous les entrepôts sont visibles</p>
                  )}
                </div>

                {/* Actions */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Permissions d'action</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'importExcel' as const, label: 'Import Excel' },
                      { key: 'exportExcel' as const, label: 'Export Excel' },
                      { key: 'creerArticle' as const, label: 'Créer des articles' },
                      { key: 'supprimerRecord' as const, label: 'Supprimer des enregistrements' },
                      { key: 'gererUtilisateurs' as const, label: 'Gérer les utilisateurs' },
                    ] as { key: keyof UserPrivileges['actions']; label: string }[]).map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2.5 bg-muted/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={privilegeForm.actions[key]}
                          onChange={e => setAction(key, e.target.checked)}
                          className="rounded border-border w-3.5 h-3.5 accent-primary"
                        />
                        <span className="text-xs">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between gap-2 pt-1 border-t border-border">
                  <button
                    onClick={() => setPrivilegeForm({ ...DEFAULT_PRIVILEGES })}
                    className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground"
                  >
                    Réinitialiser
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setPrivilegeDialog(false)} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">
                      Annuler
                    </button>
                    <button
                      onClick={() => updatePrivilegesMut.mutate({ id: privilegeUser.id, privileges: privilegeForm })}
                      disabled={updatePrivilegesMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Check className="w-3.5 h-3.5" /> Enregistrer les privilèges
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
