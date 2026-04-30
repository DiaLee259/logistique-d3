import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, X, Check, ClipboardCheck, History, ChevronDown, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { inventairesApi, entrepotsApi } from '@/lib/api';
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
      // On utilise les données de l'état (qui contient tous les articles actifs)
      setLignes(etat.map((e: any) => ({
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
          <button onClick={() => inventairesApi.template().then(b => downloadBlob(b, 'template-inventaire.xlsx'))} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            Modèle Excel
          </button>
          <button onClick={() => importRef.current?.click()} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            Importer
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
                      <div className="text-right">
                        <p className="text-xs font-semibold text-primary">{formatDate(session.date)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {etatLoading ? (
                        <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Chargement…</td></tr>
                      ) : etat.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Aucun article actif</td></tr>
                      ) : etat.map(ligne => {
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
