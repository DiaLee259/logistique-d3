import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Eye, X,
  Link2, Copy, Check, ChevronDown, ChevronUp, Calendar, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { commandesApi, articlesApi } from '@/lib/api';
import { cn, formatDate, statutCommandeLabel, statutCommandeColor } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import type { Commande, Article } from '@/lib/types';

// ── Combobox article avec recherche ──────────────────────────────────────────
function ArticleCombobox({
  articles,
  value,
  onChange,
}: {
  articles: Article[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = articles.find(a => a.id === value);

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    return a.nom.toLowerCase().includes(q) || a.reference.toLowerCase().includes(q);
  });

  return (
    <div ref={ref} className="relative flex-1">
      <div
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-lg cursor-pointer hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 bg-card"
      >
        {open ? (
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou référence…"
            className="flex-1 bg-transparent outline-none text-xs"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={cn('flex-1 truncate', !selected && 'text-muted-foreground')}>
            {selected ? `${selected.nom} (${selected.reference})` : 'Choisir article…'}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Aucun article trouvé</p>
          ) : filtered.map(a => (
            <div
              key={a.id}
              onMouseDown={() => { onChange(a.id); setOpen(false); setSearch(''); }}
              className={cn(
                'px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors',
                a.id === value && 'bg-primary/10 text-primary font-medium',
              )}
            >
              <span className="font-mono text-muted-foreground mr-2">{a.reference}</span>
              {a.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function Commandes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const importRef = useRef<HTMLInputElement>(null);

  // Filtres
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterMois, setFilterMois] = useState('');
  const [filterDateDebut, setFilterDateDebut] = useState('');
  const [filterDateFin, setFilterDateFin] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Dialogs
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [liensOpen, setLiensOpen] = useState(false);
  const [nomLien, setNomLien] = useState('');
  const [expireDays, setExpireDays] = useState('30');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form nouvelle commande
  const [formData, setFormData] = useState({
    departement: '', demandeur: '', emailDemandeur: '', societe: '',
    manager: '', nombreGrilles: '', typeGrille: '', telephoneDestinataire: '',
    adresseLivraison: '', commentaire: '',
  });
  const [lignes, setLignes] = useState<{ articleId: string; quantiteDemandee: number; commentaire: string }[]>([
    { articleId: '', quantiteDemandee: 1, commentaire: '' },
  ]);

  const buildParams = () => {
    const p: Record<string, string> = {};
    if (search) p.search = search;
    if (filterStatut) p.statut = filterStatut;
    if (filterMois) p.mois = filterMois;
    if (filterDateDebut) p.dateDebut = filterDateDebut;
    if (filterDateFin) p.dateFin = filterDateFin;
    return p;
  };

  const { data: result, isLoading } = useQuery({
    queryKey: ['commandes', search, filterStatut, filterMois, filterDateDebut, filterDateFin],
    queryFn: () => commandesApi.list(buildParams()),
    refetchInterval: 15_000, // sync auto toutes les 15s
  });

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ['articles'],
    queryFn: () => articlesApi.list(),
  });

  const { data: liens = [] } = useQuery<any[]>({
    queryKey: ['liens-prestataire'],
    queryFn: () => commandesApi.listLiens(),
    enabled: liensOpen,
  });

  const commandes: Commande[] = result?.data ?? [];

  const createMut = useMutation({
    mutationFn: commandesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Commande créée');
      setNewDialogOpen(false);
      resetForm();
    },
  });

  const genererLienMut = useMutation({
    mutationFn: () => commandesApi.genererLien(nomLien, parseInt(expireDays) || 30),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['liens-prestataire'] });
      toast.success('Lien généré !');
      setNomLien('');
    },
  });

  const desactiverLienMut = useMutation({
    mutationFn: (id: string) => commandesApi.desactiverLien(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['liens-prestataire'] });
      toast.success('Lien désactivé');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commandesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Commande supprimée');
      setConfirmDeleteId(null);
    },
  });

  const importMut = useMutation({
    mutationFn: commandesApi.import,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['commandes'] });
      toast.success(`Import terminé : ${data.created} ajoutées, ${data.skipped} ignorées`);
    },
    onError: () => toast.error("Erreur lors de l'import"),
  });

  const resetForm = () => {
    setFormData({ departement: '', demandeur: '', emailDemandeur: '', societe: '', manager: '', nombreGrilles: '', typeGrille: '', telephoneDestinataire: '', adresseLivraison: '', commentaire: '' });
    setLignes([{ articleId: '', quantiteDemandee: 1, commentaire: '' }]);
  };

  const handleCreateManuel = () => {
    if (!formData.departement) { toast.error('Département requis'); return; }
    const validLignes = lignes.filter(l => l.articleId && l.quantiteDemandee > 0);
    if (validLignes.length === 0) { toast.error('Au moins un article requis'); return; }
    createMut.mutate({
      ...formData,
      nombreGrilles: formData.nombreGrilles ? parseInt(formData.nombreGrilles) : undefined,
      lignes: validLignes,
    });
  };

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/commande-publique/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Lien copié !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statuts = ['EN_ATTENTE', 'EN_ATTENTE_LOG2', 'VALIDEE', 'EXPEDIEE', 'LIVREE', 'ANNULEE'];

  const hasActiveFilters = filterMois || filterDateDebut || filterDateFin;

  return (
    <div className="space-y-3">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>

        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="px-3 py-2 text-xs bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Tous statuts</option>
          {statuts.map(s => <option key={s} value={s}>{statutCommandeLabel(s)}</option>)}
        </select>

        <button onClick={() => setShowFilters(v => !v)}
          className={cn('flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition-colors',
            hasActiveFilters ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:border-primary')}>
          <Calendar className="w-3.5 h-3.5" />
          Filtres {hasActiveFilters && '●'}
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Import lot template */}
        {hasRole('ADMIN', 'LOGISTICIEN_1') && (
          <div className="flex items-center gap-2">
            <button onClick={() => commandesApi.template().then(b => downloadBlob(b, 'template-commandes.xlsx'))} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
              Modèle Excel
            </button>
            <button onClick={() => importRef.current?.click()} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
              Import lot
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ''; }} />
          </div>
        )}

        {/* Lien prestataire */}
        {hasRole('ADMIN', 'LOGISTICIEN_1') && (
          <button onClick={() => setLiensOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors">
            <Link2 className="w-3.5 h-3.5" /> Liens prestataire
          </button>
        )}

        <button onClick={() => setNewDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nouvelle commande
        </button>
      </div>

      {/* Filtres date */}
      {showFilters && (
        <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Mois (YYYY-MM)</label>
            <input type="month" value={filterMois} onChange={e => setFilterMois(e.target.value)}
              className="px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Du</label>
            <input type="date" value={filterDateDebut} onChange={e => setFilterDateDebut(e.target.value)}
              className="px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Au</label>
            <input type="date" value={filterDateFin} onChange={e => setFilterDateFin(e.target.value)}
              className="px-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setFilterMois(''); setFilterDateDebut(''); setFilterDateFin(''); }}
              className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              Réinitialiser
            </button>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['N° Commande', 'Date réception', 'Date traitement', 'Département', 'Demandeur', 'Société', 'Articles', 'Statut', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
              ) : commandes.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Aucune commande</td></tr>
              ) : commandes.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/commandes/${c.id}`)}>
                  <td className="px-3 py-2.5 font-mono font-semibold text-primary whitespace-nowrap">{c.numero}</td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    <span className="font-medium text-foreground">{formatDate(c.dateReception)}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {(c as any).dateTraitement ? (
                      <span className="text-green-700 font-medium">{formatDate((c as any).dateTraitement)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{c.departement}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.demandeur ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{(c as any).societe ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.lignes?.length ?? 0} art.</td>
                  <td className="px-3 py-2.5"><StatusBadge statut={c.statut} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); navigate(`/commandes/${c.id}`); }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                        className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result && (
          <div className="px-3 py-2 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{result.total} commande(s) — page {result.page}/{result.totalPages}</p>
          </div>
        )}
      </div>

      {/* Dialog confirmation suppression */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Supprimer la commande ?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {commandes.find(c => c.id === confirmDeleteId)?.numero} — Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                Annuler
              </button>
              <button onClick={() => deleteMut.mutate(confirmDeleteId)} disabled={deleteMut.isPending}
                className="px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleteMut.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog nouvelle commande manuelle */}
      {newDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Nouvelle commande</h2>
              <button onClick={() => { setNewDialogOpen(false); resetForm(); }} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: 'departement', label: 'Département *', placeholder: 'ex: 49' },
                  { field: 'demandeur', label: 'Demandeur', placeholder: 'Nom du technicien' },
                  { field: 'societe', label: 'Société', placeholder: 'Nom société' },
                  { field: 'emailDemandeur', label: 'Email', placeholder: 'email@domain.fr' },
                  { field: 'manager', label: 'Manager / Interlocuteur', placeholder: 'Responsable' },
                  { field: 'nombreGrilles', label: 'Nombre de grilles', placeholder: '0' },
                  { field: 'telephoneDestinataire', label: 'Téléphone destinataire', placeholder: '06 XX XX XX XX' },
                ].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                    <input
                      value={(formData as any)[field]}
                      onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Type de grille</label>
                  <select value={formData.typeGrille} onChange={e => setFormData(p => ({ ...p, typeGrille: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-card">
                    <option value="">— Choisir —</option>
                    <option value="PROD">PROD</option>
                    <option value="SAV">SAV</option>
                    <option value="Mixte">Mixte</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Adresse de livraison</label>
                <input value={formData.adresseLivraison}
                  onChange={e => setFormData(p => ({ ...p, adresseLivraison: e.target.value }))}
                  placeholder="12 rue de l'industrie, 49000 Angers"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Commentaire</label>
                <textarea value={formData.commentaire} onChange={e => setFormData(prev => ({ ...prev, commentaire: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>

              {/* Lignes articles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Articles *</label>
                  <button type="button" onClick={() => setLignes(prev => [...prev, { articleId: '', quantiteDemandee: 1, commentaire: '' }])}
                    className="text-xs text-primary hover:underline">+ Ajouter</button>
                </div>
                <div className="space-y-1.5">
                  {lignes.map((ligne, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <ArticleCombobox
                        articles={articles}
                        value={ligne.articleId}
                        onChange={id => setLignes(prev => prev.map((l, j) => j === i ? { ...l, articleId: id } : l))}
                      />
                      <input type="number" min={1} value={ligne.quantiteDemandee}
                        onChange={e => setLignes(prev => prev.map((l, j) => j === i ? { ...l, quantiteDemandee: parseInt(e.target.value) || 1 } : l))}
                        className="w-16 px-2 py-2 text-xs border border-border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
                      {lignes.length > 1 && (
                        <button onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))}
                          className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setNewDialogOpen(false); resetForm(); }} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleCreateManuel} disabled={createMut.isPending}
                  className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  Créer commande
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog liens prestataire */}
      {liensOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" /> Liens prestataire</h2>
              <button onClick={() => setLiensOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Générez un lien à envoyer à un prestataire. Il pourra soumettre une commande sans compte.
              </p>

              {/* Générer nouveau lien */}
              <div className="bg-muted/20 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold">Nouveau lien</p>
                <div className="flex gap-2">
                  <input value={nomLien} onChange={e => setNomLien(e.target.value)}
                    placeholder="Nom du prestataire"
                    className="flex-1 px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <select value={expireDays} onChange={e => setExpireDays(e.target.value)}
                    className="px-2 py-2 text-xs border border-border rounded-lg focus:outline-none">
                    <option value="7">7 jours</option>
                    <option value="30">30 jours</option>
                    <option value="90">90 jours</option>
                    <option value="365">1 an</option>
                  </select>
                  <button onClick={() => genererLienMut.mutate()} disabled={!nomLien || genererLienMut.isPending}
                    className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                    Générer
                  </button>
                </div>
              </div>

              {/* Liste des liens */}
              <div className="space-y-2">
                {liens.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucun lien généré</p>
                ) : liens.map((lien: any) => (
                  <div key={lien.id} className={cn('border rounded-lg p-3 text-xs', lien.actif ? 'border-border' : 'border-border/30 opacity-50')}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold">{lien.nom}</p>
                        <p className="text-muted-foreground mt-0.5">
                          {lien.utilisations} utilisation(s)
                          {lien.expiresAt && ` · Expire le ${formatDate(lien.expiresAt)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {lien.actif && (
                          <button onClick={() => copyLink(lien.token, lien.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            {copiedId === lien.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedId === lien.id ? 'Copié !' : 'Copier lien'}
                          </button>
                        )}
                        {lien.actif && (
                          <button onClick={() => desactiverLienMut.mutate(lien.id)}
                            className="px-2.5 py-1.5 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                            Désactiver
                          </button>
                        )}
                        {!lien.actif && <span className="text-muted-foreground italic">Désactivé</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
