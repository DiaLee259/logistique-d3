import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, X, Check, ClipboardCheck, History, ChevronDown, ChevronRight, LayoutGrid, List, Trash2, Loader2, Pencil, BarChart2, Clock, FileDown, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { inventairesApi, entrepotsApi, articlesApi } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { Entrepot } from '@/lib/types';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function Inventaire() {
  const qc = useQueryClient();
  const importRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'etat' | 'historique'>('etat');
  const [selectedEntrepot, setSelectedEntrepot] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEntrepotId, setDialogEntrepotId] = useState('');
  const [lignes, setLignes] = useState<{ articleId: string; quantite: number; commentaire: string; nom: string; reference: string; stockTheorique: number }[]>([]);

  // Historique : vues
  const [histView, setHistView] = useState<'sessions' | 'matrice'>('sessions');
  const [histEntrepotFilter, setHistEntrepotFilter] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const { data: entrepots = [] } = useQuery<Entrepot[]>({
    queryKey: ['entrepots'],
    queryFn: () => entrepotsApi.list(),
  });

  const { data: articles = [] } = useQuery<{ id: string; nom: string; reference: string }[]>({
    queryKey: ['articles-list'],
    queryFn: () => articlesApi.list(),
  });

  const { data: alertes = [] } = useQuery<{ entrepot: Entrepot; dernierInventaire: string | null; enAlerte: boolean }[]>({
    queryKey: ['inventaires-alertes'],
    queryFn: inventairesApi.alertes,
  });

  const { data: historique = [] } = useQuery<any[]>({
    queryKey: ['inventaires-historique'],
    queryFn: () => inventairesApi.list(),
    enabled: tab === 'historique',
  });

  const { data: etat = [], isLoading: etatLoading } = useQuery<any[]>({
    queryKey: ['inventaire-etat', selectedEntrepot],
    queryFn: () => inventairesApi.etatEntrepot(selectedEntrepot),
    enabled: !!selectedEntrepot,
  });

  const createMut = useMutation({
    mutationFn: inventairesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventaire-etat'] });
      qc.invalidateQueries({ queryKey: ['inventaires-alertes'] });
      qc.invalidateQueries({ queryKey: ['inventaires-historique'] });
      toast.success('Inventaire enregistré');
      closeDialog();
    },
  });

  const [confirmDeleteSession, setConfirmDeleteSession] = useState<{ key: string; ids: string[] } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [correctionDialog, setCorrectionDialog] = useState<{
    inventaireId: string | null;
    inventaireDate: string | null;
    articleId: string;
    entrepotId: string;
    nom: string;
    reference: string;
    stockActuel: number;
    newQte: number;
    commentaire: string;
  } | null>(null);

  const [rapportDialog, setRapportDialog] = useState(false);
  const [rapportParams, setRapportParams] = useState({ dateDebut: firstOfMonth, dateFin: today, entrepotId: '', articleId: '' });
  const [rapportData, setRapportData] = useState<any[] | null>(null);
  const [rapportView, setRapportView] = useState<'form' | 'table'>('form');
  const [rapportGroupBy, setRapportGroupBy] = useState<'entrepot' | 'article'>('entrepot');
  const [rapportCollapsed, setRapportCollapsed] = useState<Set<string>>(new Set());

  const corrigerMut = useMutation({
    mutationFn: ({ inventaireId, quantiteNouvelle, commentaire }: { inventaireId: string; quantiteNouvelle: number; commentaire: string }) =>
      inventairesApi.corriger(inventaireId, { quantiteNouvelle, commentaire }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventaire-etat'] });
      qc.invalidateQueries({ queryKey: ['inventaires-historique'] });
      toast.success('Correction enregistrée');
      setCorrectionDialog(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erreur lors de la correction'),
  });

  const rapportMut = useMutation({
    mutationFn: () => inventairesApi.rapportStock({
      dateDebut: rapportParams.dateDebut,
      dateFin: rapportParams.dateFin,
      entrepotId: rapportParams.entrepotId || undefined,
      articleId: rapportParams.articleId || undefined,
    }),
    onSuccess: (blob) => {
      downloadBlob(blob as Blob, `rapport-stock-${rapportParams.dateDebut}-au-${rapportParams.dateFin}.xlsx`);
      toast.success('Rapport téléchargé');
    },
    onError: () => toast.error('Erreur lors de la génération du rapport'),
  });

  const rapportJsonMut = useMutation({
    mutationFn: () => inventairesApi.rapportStockJson({
      dateDebut: rapportParams.dateDebut,
      dateFin: rapportParams.dateFin,
      entrepotId: rapportParams.entrepotId || undefined,
      articleId: rapportParams.articleId || undefined,
    }),
    onSuccess: (data) => {
      setRapportData(data);
      setRapportView('table');
    },
    onError: () => toast.error('Erreur lors de la visualisation'),
  });

  const updateArticleMut = useMutation({
    mutationFn: inventairesApi.updateArticle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventaire-etat'] });
      qc.invalidateQueries({ queryKey: ['inventaires-historique'] });
      toast.success('Article mis à jour');
      setCorrectionDialog(null);
    },
    onError: () => toast.error('Erreur lors de la correction'),
  });

  const deleteBulkMut = useMutation({
    mutationFn: (ids: string[]) => inventairesApi.deleteBulk(ids),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['inventaires-historique'] });
      qc.invalidateQueries({ queryKey: ['inventaire-etat'] });
      qc.invalidateQueries({ queryKey: ['inventaires-alertes'] });
      toast.success(`${data.deleted} enregistrement(s) supprimé(s)`);
      setConfirmDeleteSession(null);
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const importMut = useMutation({
    mutationFn: inventairesApi.import,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['inventaire-etat'] });
      qc.invalidateQueries({ queryKey: ['inventaires-alertes'] });
      qc.invalidateQueries({ queryKey: ['inventaires-historique'] });
      toast.success(`Import terminé : ${data.created} ajoutés, ${data.skipped} ignorés`);
    },
    onError: () => toast.error("Erreur lors de l'import"),
  });

  const alertesActives = alertes.filter(a => a.enAlerte);

  const openDialog = (entrepotId: string) => {
    setDialogEntrepotId(entrepotId);
    if (etat.length > 0) {
      // On utilise les données de l'état (qui contient tous les articles actifs), triés par nom
      setLignes([...etat].sort((a: any, b: any) => (a.article?.nom ?? '').localeCompare(b.article?.nom ?? '', 'fr')).map((e: any) => ({
        articleId: e.articleId,
        quantite: e.stockTheorique,
        commentaire: '',
        nom: e.article?.nom ?? '—',
        reference: e.article?.reference ?? '',
        stockTheorique: e.stockTheorique,
      })));
    } else {
      setLignes([]);
    }
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setLignes([]); setDialogEntrepotId(''); };

  const handleCreate = () => {
    const valid = lignes.filter(l => l.articleId && l.quantite >= 0);
    if (!dialogEntrepotId || valid.length === 0) { toast.error('Entrepôt et articles requis'); return; }
    createMut.mutate({ entrepotId: dialogEntrepotId, lignes: valid.map(l => ({ articleId: l.articleId, quantite: l.quantite, commentaire: l.commentaire })) });
  };

  const entrepotSelectionne = entrepots.find(e => e.id === selectedEntrepot);

  // ── Historique : sessions groupées ─────────────────────────────────────────
  const historiqueFiltre = histEntrepotFilter
    ? historique.filter((inv: any) => inv.entrepotId === histEntrepotFilter)
    : historique;

  const sessions = historiqueFiltre.reduce((acc: any[], inv: any) => {
    const key = `${inv.entrepotId}_${new Date(inv.date).toISOString().slice(0, 16)}`;
    const existing = acc.find(s => s.key === key);
    if (existing) existing.lignes.push(inv);
    else acc.push({ key, entrepotId: inv.entrepotId, date: inv.date, lignes: [inv] });
    return acc;
  }, []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Historique : matrice article × session ─────────────────────────────────
  // Sessions triées par date asc pour les colonnes
  const sessionsCols = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Articles distincts dans l'historique filtré
  const articlesMap = new Map<string, { id: string; nom: string; reference: string }>();
  historiqueFiltre.forEach((inv: any) => {
    if (inv.article && !articlesMap.has(inv.articleId)) {
      articlesMap.set(inv.articleId, { id: inv.articleId, nom: inv.article.nom, reference: inv.article.reference });
    }
  });
  const articlesMatrice = [...articlesMap.values()].sort((a, b) => a.nom.localeCompare(b.nom));

  // Lookup : articleId_sessionKey → quantite
  const matriceLookup = new Map<string, number>();
  historiqueFiltre.forEach((inv: any) => {
    const sessionKey = `${inv.entrepotId}_${new Date(inv.date).toISOString().slice(0, 16)}`;
    matriceLookup.set(`${inv.articleId}_${sessionKey}`, inv.quantite);
  });

  const toggleSession = (key: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Overlay import en cours */}
      {importMut.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-2xl shadow-2xl border border-border px-8 py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-semibold">Import en cours…</p>
            <p className="text-xs text-muted-foreground">Traitement du fichier, veuillez patienter.</p>
          </div>
        </div>
      )}

      {/* Onglets + boutons import */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit">
          <button onClick={() => setTab('etat')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
              tab === 'etat' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <ClipboardCheck className="w-3.5 h-3.5" /> État des stocks
          </button>
          <button onClick={() => setTab('historique')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
              tab === 'historique' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <History className="w-3.5 h-3.5" /> Historique
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setRapportDialog(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            <BarChart2 className="w-3.5 h-3.5" /> Rapport de stock
          </button>
          <button onClick={() => inventairesApi.template().then(b => downloadBlob(b, 'template-inventaire.xlsx'))} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            Modèle Excel
          </button>
          <button
            onClick={() => importRef.current?.click()}
            disabled={importMut.isPending}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {importMut.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Import en cours…</>
              : 'Importer'}
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ''; }} />
        </div>
      </div>

      {/* ─── VUE HISTORIQUE ─────────────────────────────────────────────────── */}
      {tab === 'historique' && (
        <div className="space-y-3">
          {/* Filtres + toggle vue */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={histEntrepotFilter} onChange={e => setHistEntrepotFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Tous les entrepôts</option>
              {entrepots.map(e => <option key={e.id} value={e.id}>{e.code} — {e.nom}</option>)}
            </select>

            <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5 ml-auto">
              <button onClick={() => setHistView('sessions')}
                className={cn('flex items-center gap-1 px-3 py-1 text-xs rounded font-medium transition-colors',
                  histView === 'sessions' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <List className="w-3 h-3" /> Par session
              </button>
              <button onClick={() => setHistView('matrice')}
                className={cn('flex items-center gap-1 px-3 py-1 text-xs rounded font-medium transition-colors',
                  histView === 'matrice' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <LayoutGrid className="w-3 h-3" /> Matrice articles
              </button>
            </div>
          </div>

          {/* ── Vue sessions (liste collapsible) ── */}
          {histView === 'sessions' && (
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <History className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Aucun inventaire enregistré.</p>
                </div>
              ) : sessions.map(session => {
                const entrepot = entrepots.find(e => e.id === session.entrepotId);
                const isExpanded = expandedSessions.has(session.key);
                return (
                  <div key={session.key} className="bg-card rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleSession(session.key)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/10 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ClipboardCheck className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold">{entrepot?.code ?? '—'} — {entrepot?.nom}</p>
                          <p className="text-xs text-muted-foreground">{session.lignes.length} article(s) comptés</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs font-semibold text-primary">{formatDate(session.date)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteSession({ key: session.key, ids: session.lignes.map((l: any) => l.id) }); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Supprimer cette session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="overflow-x-auto border-t border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border/40 bg-muted/10">
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Article</th>
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Référence</th>
                              <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Qté comptée</th>
                              <th className="text-left px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Commentaire</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.lignes.map((ligne: any) => (
                              <tr key={ligne.id} className="border-t border-border/20 hover:bg-muted/10">
                                <td className="px-4 py-2 font-medium">{ligne.article?.nom ?? '—'}</td>
                                <td className="px-4 py-2 font-mono text-muted-foreground">{ligne.article?.reference}</td>
                                <td className="px-4 py-2 text-right font-bold text-primary">{formatNumber(ligne.quantite)}</td>
                                <td className="px-4 py-2 text-muted-foreground">{ligne.commentaire || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Vue matrice article × session ── */}
          {histView === 'matrice' && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {articlesMatrice.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Aucune donnée pour ce filtre.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/30 min-w-[200px]">Article</th>
                        {sessionsCols.map(s => {
                          const ent = entrepots.find(e => e.id === s.entrepotId);
                          return (
                            <th key={s.key} className="text-center px-3 py-2.5 font-semibold text-muted-foreground min-w-[110px]">
                              <div className="text-primary font-bold">{formatDate(s.date)}</div>
                              <div className="text-muted-foreground/70 font-normal">{ent?.code ?? '?'}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {articlesMatrice.map(art => (
                        <tr key={art.id} className="border-t border-border/30 hover:bg-muted/10">
                          <td className="px-3 py-2 sticky left-0 bg-card border-r border-border/30">
                            <p className="font-medium">{art.nom}</p>
                            <p className="font-mono text-muted-foreground">{art.reference}</p>
                          </td>
                          {sessionsCols.map(s => {
                            const qte = matriceLookup.get(`${art.id}_${s.key}`);
                            return (
                              <td key={s.key} className="px-3 py-2 text-center">
                                {qte !== undefined
                                  ? <span className="font-bold text-primary">{formatNumber(qte)}</span>
                                  : <span className="text-muted-foreground/40">—</span>}
                              </td>
                            );
                          })}
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

      {/* ─── VUE ÉTAT STOCKS ────────────────────────────────────────────────── */}
      {tab === 'etat' && (
        <>
          {/* Alertes */}
          {alertesActives.length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-800">
                <p className="font-semibold mb-1">{alertesActives.length} entrepôt(s) sans inventaire depuis plus de 3 mois</p>
                <div className="flex flex-wrap gap-2">
                  {alertesActives.map(a => (
                    <span key={a.entrepot.id} className="bg-red-100 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                      {a.entrepot.code} — {a.dernierInventaire ? `dernier : ${formatDate(a.dernierInventaire)}` : 'jamais réalisé'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sélection entrepôt */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedEntrepot} onChange={e => setSelectedEntrepot(e.target.value)}
              className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              <option value="">Sélectionner un entrepôt…</option>
              {entrepots.map(e => {
                const alerte = alertes.find(a => a.entrepot.id === e.id);
                return <option key={e.id} value={e.id}>{alerte?.enAlerte ? '⚠ ' : ''}{e.code} — {e.nom}</option>;
              })}
            </select>
            {selectedEntrepot && (
              <button
                onClick={() => openDialog(selectedEntrepot)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> Saisir un inventaire
              </button>
            )}
          </div>

          {/* Statut par entrepôt */}
          {!selectedEntrepot && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {entrepots.map(e => {
                const alerte = alertes.find(a => a.entrepot.id === e.id);
                return (
                  <div key={e.id} onClick={() => setSelectedEntrepot(e.id)}
                    className={cn('bg-card border rounded-xl p-4 cursor-pointer hover:border-primary transition-colors', alerte?.enAlerte ? 'border-red-300' : 'border-border')}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm">{e.code}</p>
                        <p className="text-xs text-muted-foreground">{e.nom}</p>
                      </div>
                      {alerte?.enAlerte ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Alerte
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> OK
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {alerte?.dernierInventaire
                        ? `Dernier inventaire : ${formatDate(alerte.dernierInventaire)}`
                        : 'Aucun inventaire enregistré'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Vue détaillée entrepôt sélectionné */}
          {selectedEntrepot && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedEntrepot('')} className="text-xs text-muted-foreground hover:text-foreground">← Tous les entrepôts</button>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-xs font-semibold">{entrepotSelectionne?.code} — {entrepotSelectionne?.nom}</span>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Article</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Stock théorique</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Qté comptée</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Écart</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Date inventaire</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {etatLoading ? (
                        <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Chargement…</td></tr>
                      ) : etat.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Aucun article actif</td></tr>
                      ) : etat.map((ligne: any) => {
                        const ecart = ligne.ecart;
                        return (
                          <tr key={ligne.articleId} className="border-t border-border/40 hover:bg-muted/10">
                            <td className="px-3 py-2.5">
                              <p className="font-medium">{ligne.article?.nom}</p>
                              <p className="text-muted-foreground font-mono">{ligne.article?.reference}</p>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium">{formatNumber(ligne.stockTheorique)}</td>
                            <td className="px-3 py-2.5 text-right">
                              {ligne.dernierInventaire
                                ? <span className="font-semibold">{formatNumber(ligne.dernierInventaire.quantite)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {ecart !== null ? (
                                <span className={cn('font-semibold', ecart > 0 ? 'text-green-600' : ecart < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                                  {ecart > 0 ? '+' : ''}{formatNumber(ecart)}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {ligne.dernierInventaire ? formatDate(ligne.dernierInventaire.date) : '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                onClick={() => setCorrectionDialog({
                                  inventaireId: ligne.dernierInventaire?.id ?? null,
                                  inventaireDate: ligne.dernierInventaire?.date ?? null,
                                  articleId: ligne.articleId,
                                  entrepotId: selectedEntrepot,
                                  nom: ligne.article?.nom ?? '',
                                  reference: ligne.article?.reference ?? '',
                                  stockActuel: ligne.dernierInventaire?.quantite ?? ligne.stockTheorique,
                                  newQte: ligne.dernierInventaire?.quantite ?? ligne.stockTheorique,
                                  commentaire: '',
                                })}
                                className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Corriger cet article">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Dialog correction article ─────────────────────────────────────── */}
      {correctionDialog && (() => {
        const invDate = correctionDialog.inventaireDate ? new Date(correctionDialog.inventaireDate) : null;
        const joursEcoules = invDate ? Math.floor((Date.now() - invDate.getTime()) / (24 * 60 * 60 * 1000)) : null;
        const joursRestants = joursEcoules !== null ? 3 - joursEcoules : null;
        const delaiDepasse = joursRestants !== null && joursRestants < 0;
        const peutCorrection = !!correctionDialog.inventaireId && !delaiDepasse;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Corriger un article</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{correctionDialog.nom} — <span className="font-mono">{correctionDialog.reference}</span></p>
                </div>
                <button onClick={() => setCorrectionDialog(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Statut délai */}
              {!correctionDialog.inventaireId ? (
                <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p>Aucun inventaire enregistré pour cet article. Utilisez <strong>Saisir un inventaire</strong> pour créer un premier inventaire.</p>
                </div>
              ) : delaiDepasse ? (
                <div className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p>Le délai de correction de 3 jours est dépassé (inventaire du {invDate ? formatDate(invDate.toISOString()) : '—'}). Créez un nouvel inventaire via <strong>Saisir un inventaire</strong>.</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 text-primary rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <p>Inventaire du {invDate ? formatDate(invDate.toISOString()) : '—'} — <strong>{joursRestants === 0 ? 'dernier jour' : `encore ${joursRestants} jour(s)`}</strong> pour corriger</p>
                </div>
              )}

              {peutCorrection && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nouvelle quantité comptée</label>
                    <input
                      type="number" min={0}
                      value={correctionDialog.newQte}
                      onChange={e => setCorrectionDialog(d => d ? { ...d, newQte: parseInt(e.target.value) || 0 } : d)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {correctionDialog.stockActuel !== correctionDialog.newQte && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Avant : <span className="font-semibold">{correctionDialog.stockActuel}</span>
                        {' → '}
                        Après : <span className={cn('font-semibold', correctionDialog.newQte > correctionDialog.stockActuel ? 'text-green-600' : 'text-red-600')}>
                          {correctionDialog.newQte}
                        </span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      Motif de la correction <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex. : erreur de saisie, comptage manuel…"
                      value={correctionDialog.commentaire}
                      onChange={e => setCorrectionDialog(d => d ? { ...d, commentaire: e.target.value } : d)}
                      className={cn(
                        'w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30',
                        !correctionDialog.commentaire.trim() ? 'border-amber-300 focus:ring-amber-300/30' : 'border-border',
                      )}
                    />
                    {!correctionDialog.commentaire.trim() && (
                      <p className="text-xs text-amber-600 mt-1">Le motif est obligatoire pour tracer la correction.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setCorrectionDialog(null)}
                  className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground">
                  Annuler
                </button>
                {peutCorrection && (
                  <button
                    onClick={() => {
                      if (!correctionDialog.commentaire.trim()) { toast.error('Le motif de correction est obligatoire'); return; }
                      corrigerMut.mutate({
                        inventaireId: correctionDialog.inventaireId!,
                        quantiteNouvelle: correctionDialog.newQte,
                        commentaire: correctionDialog.commentaire,
                      });
                    }}
                    disabled={corrigerMut.isPending || !correctionDialog.commentaire.trim()}
                    className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                    {corrigerMut.isPending ? 'Enregistrement…' : 'Enregistrer la correction'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Dialog rapport de stock ────────────────────────────────────────── */}
      {rapportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="bg-card rounded-xl shadow-2xl border border-border flex flex-col w-[96vw] h-[92vh]">

            {/* Header fixe */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" /> Rapport de stock</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rapportView === 'table'
                    ? `${rapportData?.length ?? 0} ligne(s) — ${rapportParams.dateDebut} → ${rapportParams.dateFin}`
                    : 'Export de l\'état du stock sur une période'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {rapportView === 'table' && (
                  <button onClick={() => setRapportView('form')} className="px-3 py-1 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground">
                    ← Filtres
                  </button>
                )}
                <button onClick={() => { setRapportDialog(false); setRapportView('form'); setRapportData(null); setRapportCollapsed(new Set()); }} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-auto p-6">

              {rapportView === 'form' && (
                <div className="max-w-sm space-y-4">
                  <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2 space-y-0.5">
                    <p>• Stock réel à la date de début</p>
                    <p>• Entrées et sorties sur la période</p>
                    <p>• Stock final à la date de fin</p>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Date de début</label>
                        <input type="date" value={rapportParams.dateDebut}
                          onChange={e => setRapportParams(p => ({ ...p, dateDebut: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Date de fin</label>
                        <input type="date" value={rapportParams.dateFin}
                          onChange={e => setRapportParams(p => ({ ...p, dateFin: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrepôt (optionnel)</label>
                      <select value={rapportParams.entrepotId}
                        onChange={e => setRapportParams(p => ({ ...p, entrepotId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">Tous les entrepôts</option>
                        {entrepots.map(e => <option key={e.id} value={e.id}>{e.code} — {e.nom}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Article (optionnel)</label>
                      <select value={rapportParams.articleId}
                        onChange={e => setRapportParams(p => ({ ...p, articleId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                        <option value="">Tous les articles</option>
                        {articles.map((a: any) => <option key={a.id} value={a.id}>{a.reference} — {a.nom}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setRapportDialog(false); setRapportView('form'); setRapportData(null); setRapportCollapsed(new Set()); }}
                      className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground">
                      Annuler
                    </button>
                    <button onClick={() => rapportJsonMut.mutate()}
                      disabled={rapportJsonMut.isPending || !rapportParams.dateDebut || !rapportParams.dateFin}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg border border-primary text-primary font-medium hover:bg-primary/10 disabled:opacity-50">
                      {rapportJsonMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement…</> : <><Eye className="w-3.5 h-3.5" /> Visualiser</>}
                    </button>
                    <button onClick={() => rapportMut.mutate()}
                      disabled={rapportMut.isPending || !rapportParams.dateDebut || !rapportParams.dateFin}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                      {rapportMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…</> : <><FileDown className="w-3.5 h-3.5" /> Télécharger Excel</>}
                    </button>
                  </div>
                </div>
              )}

              {rapportView === 'table' && rapportData && (() => {
                const totalEntrees = rapportData.reduce((s, r) => s + r.entrees, 0);
                const totalSorties = rapportData.reduce((s, r) => s + r.sorties, 0);

                const groupKey = (r: any) => rapportGroupBy === 'entrepot' ? r.entrepot : r.reference;
                const groupLabel = (r: any) => rapportGroupBy === 'entrepot' ? r.entrepot : `${r.reference} — ${r.article}`;
                const groups = new Map<string, any[]>();
                for (const r of rapportData) {
                  const k = groupKey(r);
                  if (!groups.has(k)) groups.set(k, []);
                  groups.get(k)!.push(r);
                }
                const toggleCollapse = (key: string) => setRapportCollapsed(prev => {
                  const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
                });

                return (
                  <div className="flex flex-col h-full gap-3">
                    <div className="flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                        {(['entrepot', 'article'] as const).map(g => (
                          <button key={g} onClick={() => { setRapportGroupBy(g); setRapportCollapsed(new Set()); }}
                            className={cn('px-3 py-1 text-xs rounded font-medium transition-colors', rapportGroupBy === g ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                            {g === 'entrepot' ? 'Par entrepôt' : 'Par article'}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => rapportMut.mutate()} disabled={rapportMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                        {rapportMut.isPending ? <><Loader2 className="w-3 h-3 animate-spin" /> Export…</> : <><FileDown className="w-3 h-3" /> Télécharger Excel</>}
                      </button>
                    </div>
                    <div className="overflow-auto flex-1 rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted z-10">
                          <tr>
                            {['Entrepôt', 'Référence', 'Article', 'Unité', 'Stock début', 'Entrées', 'Sorties', 'Stock fin'].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...groups.entries()].map(([key, rows]) => {
                            const collapsed = rapportCollapsed.has(key);
                            const subEntrees = rows.reduce((s, r) => s + r.entrees, 0);
                            const subSorties = rows.reduce((s, r) => s + r.sorties, 0);
                            return (
                              <>
                                <tr key={`g-${key}`} className="bg-primary/5 border-t border-border cursor-pointer hover:bg-primary/10 select-none"
                                  onClick={() => toggleCollapse(key)}>
                                  <td className="px-3 py-1.5 font-semibold text-primary" colSpan={4}>
                                    <span className="text-muted-foreground w-3 inline-block mr-1">{collapsed ? '▶' : '▼'}</span>
                                    {groupLabel(rows[0])}
                                    <span className="text-muted-foreground font-normal ml-2 text-xs">({rows.length} ligne{rows.length > 1 ? 's' : ''})</span>
                                  </td>
                                  <td className="px-3 py-1.5" />
                                  <td className="px-3 py-1.5 text-right font-bold text-emerald-600">{subEntrees > 0 ? `+${formatNumber(subEntrees)}` : '—'}</td>
                                  <td className="px-3 py-1.5 text-right font-bold text-red-500">{subSorties > 0 ? `-${formatNumber(subSorties)}` : '—'}</td>
                                  <td className="px-3 py-1.5" />
                                </tr>
                                {!collapsed && rows.map((row: any, i: number) => (
                                  <tr key={`${key}-${i}`} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                    <td className="px-3 py-1.5 pl-7 font-mono">{row.entrepot}</td>
                                    <td className="px-3 py-1.5 font-mono">{row.reference}</td>
                                    <td className="px-3 py-1.5 max-w-[200px] truncate">{row.article}</td>
                                    <td className="px-3 py-1.5 text-center">{row.unite}</td>
                                    <td className={`px-3 py-1.5 text-right font-medium ${row.stockDebut < 0 ? 'text-red-500' : ''}`}>{formatNumber(row.stockDebut)}</td>
                                    <td className="px-3 py-1.5 text-right text-emerald-600">{row.entrees > 0 ? `+${formatNumber(row.entrees)}` : '—'}</td>
                                    <td className="px-3 py-1.5 text-right text-red-500">{row.sorties > 0 ? `-${formatNumber(row.sorties)}` : '—'}</td>
                                    <td className={`px-3 py-1.5 text-right font-semibold ${row.stockFin < 0 ? 'text-red-500' : 'text-primary'}`}>{formatNumber(row.stockFin)}</td>
                                  </tr>
                                ))}
                              </>
                            );
                          })}
                          <tr className="border-t-2 border-primary/40 bg-primary/5">
                            <td colSpan={4} className="px-3 py-2 font-bold text-xs text-foreground">TOTAL</td>
                            <td />
                            <td className="px-3 py-2 text-right font-bold text-emerald-600">{totalEntrees > 0 ? `+${formatNumber(totalEntrees)}` : '—'}</td>
                            <td className="px-3 py-2 text-right font-bold text-red-500">{totalSorties > 0 ? `-${formatNumber(totalSorties)}` : '—'}</td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Dialog confirmation suppression session ────────────────────────── */}
      {confirmDeleteSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Supprimer cette session ?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {confirmDeleteSession.ids.length} enregistrement(s) seront supprimés définitivement.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteSession(null)}
                className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                Annuler
              </button>
              <button
                onClick={() => deleteBulkMut.mutate(confirmDeleteSession.ids)}
                disabled={deleteBulkMut.isPending}
                className="px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleteBulkMut.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dialog saisie inventaire ────────────────────────────────────────── */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  Inventaire physique — {entrepots.find(e => e.id === dialogEntrepotId)?.code}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Saisissez les quantités réellement comptées</p>
              </div>
              <button onClick={closeDialog} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-1.5">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Article</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase w-20 text-right">Théorique</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase w-20 text-right">Compté</span>
              </div>
              {lignes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Chargement des articles…</p>
              ) : lignes.map((l, i) => (
                <div key={l.articleId} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-muted/10 rounded-lg px-2 py-1.5">
                  <div>
                    <p className="text-xs font-medium">{l.nom}</p>
                    <p className="text-xs text-muted-foreground font-mono">{l.reference}</p>
                  </div>
                  <span className="text-xs text-muted-foreground w-20 text-right">{formatNumber(l.stockTheorique)}</span>
                  <input
                    type="number" min={0} value={l.quantite}
                    onChange={e => setLignes(p => p.map((line, j) => j === i ? { ...line, quantite: parseInt(e.target.value) || 0 } : line))}
                    className="w-20 text-right px-2 py-1 text-xs border border-primary/40 bg-primary/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-border flex-shrink-0">
              <button onClick={closeDialog} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
              <button onClick={handleCreate} disabled={createMut.isPending}
                className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Valider l'inventaire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
