import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck, X, CheckCircle, Info, Search, Upload, ChevronDown, ChevronRight, Trash2, LayoutGrid, List, BarChart2, Eye, FileDown, Loader2, AlertTriangle, Clock, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { livraisonsApi, articlesApi, entrepotsApi, uploadsApi } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { Livraison, Article, Entrepot } from '@/lib/types';

const statutLivraisonLabel: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  EN_COURS: 'En cours',
  LIVREE: 'Livrée',
  INCIDENT: 'Incident',
};

const statutLivraisonColor: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-700',
  EN_COURS: 'bg-blue-100 text-blue-700',
  LIVREE: 'bg-green-100 text-green-700',
  INCIDENT: 'bg-red-100 text-red-700',
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default function Livraisons() {
  const qc = useQueryClient();
  const importRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fournisseur, setFournisseur] = useState('');
  const [entrepotId, setEntrepotId] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [bonLivraisonUrl, setBonLivraisonUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lignes, setLignes] = useState([{ articleId: '', quantiteRecue: 1 }]);
  const [dateLivraison, setDateLivraison] = useState(new Date().toISOString().slice(0, 10));

  const [correctionLigne, setCorrectionLigne] = useState<{
    livraisonId: string; ligneId: string; livraisonNumero: string; livraisonDate: string;
    articleNom: string; articleRef: string; quantiteActuelle: number; newQte: number; commentaire: string;
  } | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [vue, setVue] = useState<'liste' | 'matrice'>('liste');
  const [filterStatut, setFilterStatut] = useState('');

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterMois, setFilterMois] = useState('');
  const [filterEntrepot, setFilterEntrepot] = useState('');
  const [filterArticleId, setFilterArticleId] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [rapportDialog, setRapportDialog] = useState(false);
  const [rapportParams, setRapportParams] = useState({ dateDebut: firstOfMonth, dateFin: today, entrepotId: '', articleId: '' });
  const [rapportData, setRapportData] = useState<any[] | null>(null);
  const [rapportView, setRapportView] = useState<'form' | 'table'>('form');
  const [rapportGroupBy, setRapportGroupBy] = useState<'date' | 'article' | 'entrepot'>('date');
  const [rapportCollapsed, setRapportCollapsed] = useState<Set<string>>(new Set());

  const filterParams: Record<string, string> = {};
  if (filterMois) filterParams.mois = filterMois;
  if (filterEntrepot) filterParams.entrepotId = filterEntrepot;

  const { data: result, isLoading } = useQuery({
    queryKey: ['livraisons', filterParams],
    queryFn: () => livraisonsApi.list(filterParams),
    refetchInterval: 30_000,
  });
  const { data: articles = [] } = useQuery<Article[]>({ queryKey: ['articles'], queryFn: () => articlesApi.list() });
  const { data: entrepots = [] } = useQuery<Entrepot[]>({ queryKey: ['entrepots'], queryFn: () => entrepotsApi.list() });

  const livraisons: Livraison[] = (result?.data ?? result ?? []);

  const filtered = livraisons.filter(l => {
    if (filterSearch && !l.numero.toLowerCase().includes(filterSearch.toLowerCase()) && !l.fournisseur.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    if (filterArticleId && !l.lignes?.some(li => li.articleId === filterArticleId)) return false;
    if (filterStatut && l.statut !== filterStatut) return false;
    return true;
  });

  const createMut = useMutation({
    mutationFn: (data: any) => livraisonsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['livraisons'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
      qc.invalidateQueries({ queryKey: ['mouvements'] });
      toast.success('Livraison enregistrée — stock mis à jour');
      closeDialog();
    },
  });

  const updateStatutMut = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: string }) => livraisonsApi.updateStatut(id, { statut }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['livraisons'] }); toast.success('Statut mis à jour'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => livraisonsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['livraisons'] });
      toast.success('Livraison supprimée');
      setConfirmDeleteId(null);
    },
  });

  const importMut = useMutation({
    mutationFn: livraisonsApi.import,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['livraisons'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
      qc.invalidateQueries({ queryKey: ['mouvements'] });
      toast.success(`Import terminé : ${data.created} ajoutées, ${data.skipped} ignorées`);
    },
    onError: () => toast.error("Erreur lors de l'import"),
  });

  const rapportMut = useMutation({
    mutationFn: () => livraisonsApi.rapportLivraisons({
      dateDebut: rapportParams.dateDebut,
      dateFin: rapportParams.dateFin,
      entrepotId: rapportParams.entrepotId || undefined,
      articleId: rapportParams.articleId || undefined,
    }),
    onSuccess: (blob) => {
      downloadBlob(blob as Blob, `rapport-livraisons-${rapportParams.dateDebut}-au-${rapportParams.dateFin}.xlsx`);
      toast.success('Rapport téléchargé');
    },
    onError: () => toast.error('Erreur lors de la génération du rapport'),
  });

  const rapportJsonMut = useMutation({
    mutationFn: () => livraisonsApi.rapportLivraisonsJson({
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

  const corrigerLigneMut = useMutation({
    mutationFn: ({ livraisonId, ligneId, quantiteNouvelle, commentaire }: { livraisonId: string; ligneId: string; quantiteNouvelle: number; commentaire: string }) =>
      livraisonsApi.corrigerLigne(livraisonId, ligneId, { quantiteNouvelle, commentaire }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['livraisons'] });
      toast.success('Correction enregistrée');
      setCorrectionLigne(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Erreur lors de la correction'),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setFournisseur(''); setEntrepotId(''); setCommentaire(''); setBonLivraisonUrl('');
    setLignes([{ articleId: '', quantiteRecue: 1 }]);
    setDateLivraison(new Date().toISOString().slice(0, 10));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const res = await uploadsApi.uploadFichier(file);
      setBonLivraisonUrl(res.url);
      toast.success('Photo BL uploadée');
    } catch {
      toast.error('Erreur upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreate = () => {
    if (!fournisseur) { toast.error('Fournisseur requis'); return; }
    if (!entrepotId) { toast.error('Entrepôt requis'); return; }
    const validLignes = lignes.filter(l => l.articleId && l.quantiteRecue >= 0).map(l => ({ ...l, quantiteCommandee: l.quantiteRecue }));
    if (!validLignes.length) { toast.error('Au moins un article requis'); return; }
    createMut.mutate({ fournisseur, entrepotId, commentaire, bonLivraisonUrl: bonLivraisonUrl || undefined, lignes: validLignes, dateLivraison });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800">
          <p className="font-semibold mb-0.5">Livraisons fournisseurs (réapprovisionnement)</p>
          <p>Enregistre les livraisons de vos <strong>fournisseurs</strong> vers vos entrepôts. Chaque livraison <strong>met à jour automatiquement le stock</strong>.</p>
        </div>
      </div>

      {/* Barre d'outils + filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
            placeholder="N° livraison, fournisseur…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={filterEntrepot} onChange={e => setFilterEntrepot(e.target.value)}
          className="px-3 py-2 text-xs bg-card border border-border rounded-lg outline-none">
          <option value="">Tous entrepôts</option>
          {entrepots.map(e => <option key={e.id} value={e.id}>{e.code} — {e.nom}</option>)}
        </select>
        <select value={filterArticleId} onChange={e => setFilterArticleId(e.target.value)}
          className="px-3 py-2 text-xs bg-card border border-border rounded-lg outline-none">
          <option value="">Tous articles</option>
          {articles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>
        <input type="month" value={filterMois} onChange={e => setFilterMois(e.target.value)}
          className="px-3 py-2 text-xs bg-card border border-border rounded-lg outline-none" />
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="px-3 py-2 text-xs bg-card border border-border rounded-lg outline-none">
          <option value="">Tous statuts</option>
          {Object.entries(statutLivraisonLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {(filterSearch || filterEntrepot || filterArticleId || filterMois || filterStatut) && (
          <button onClick={() => { setFilterSearch(''); setFilterEntrepot(''); setFilterArticleId(''); setFilterMois(''); setFilterStatut(''); }}
            className="px-2.5 py-2 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted">✕</button>
        )}
        <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
          <button onClick={() => setVue('liste')}
            className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs rounded font-medium transition-colors',
              vue === 'liste' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <List className="w-3.5 h-3.5" /> Liste
          </button>
          <button onClick={() => setVue('matrice')}
            className={cn('flex items-center gap-1 px-2.5 py-1.5 text-xs rounded font-medium transition-colors',
              vue === 'matrice' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutGrid className="w-3.5 h-3.5" /> Matrice
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => livraisonsApi.template().then(b => downloadBlob(b, 'template-livraisons.xlsx'))} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            Modèle Excel
          </button>
          <button onClick={() => importRef.current?.click()} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            Importer
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ''; }} />
          <button onClick={() => { setRapportView('form'); setRapportData(null); setRapportDialog(true); }}
            className="flex items-center gap-1.5 px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            <BarChart2 className="w-3.5 h-3.5" /> Rapport
          </button>
        </div>
        <button onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nouvelle livraison
        </button>
      </div>

      {/* ── Vue Matrice ── */}
      {vue === 'matrice' && (() => {
        const livrSorted = [...filtered].sort((a, b) => new Date(a.dateLivraison).getTime() - new Date(b.dateLivraison).getTime());
        const artMap = new Map<string, string>();
        livrSorted.forEach(l => l.lignes?.forEach(li => { if (li.article && !artMap.has(li.articleId)) artMap.set(li.articleId, li.article.nom ?? li.articleId); }));
        const artsMatrice = [...artMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));
        const lookup = new Map<string, number>();
        livrSorted.forEach(l => l.lignes?.forEach(li => { lookup.set(`${li.articleId}_${l.id}`, li.quantiteRecue); }));

        return (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {artsMatrice.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Aucune donnée pour ce filtre.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide sticky left-0 bg-muted/30 min-w-[200px]">Article</th>
                      {livrSorted.map(l => {
                        const ent = entrepots.find(e => e.id === l.entrepotId);
                        return (
                          <th key={l.id} className="text-center px-2 py-2.5 font-semibold text-muted-foreground min-w-[120px]">
                            <div className="text-primary font-bold">{formatDate(l.dateLivraison)}</div>
                            <div className="text-muted-foreground/70 font-normal truncate max-w-[120px]" title={l.fournisseur}>{l.fournisseur}</div>
                            <div className="text-muted-foreground/60 font-normal">{ent?.code ?? '?'}</div>
                          </th>
                        );
                      })}
                      <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide min-w-[80px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artsMatrice.map(([artId, nom]) => {
                      const total = livrSorted.reduce((s, l) => s + (lookup.get(`${artId}_${l.id}`) ?? 0), 0);
                      return (
                        <tr key={artId} className="border-t border-border/30 hover:bg-muted/10">
                          <td className="px-3 py-2 sticky left-0 bg-card border-r border-border/30">
                            <p className="font-medium">{nom}</p>
                            <p className="font-mono text-muted-foreground">{articles.find(a => a.id === artId)?.reference ?? ''}</p>
                          </td>
                          {livrSorted.map(l => {
                            const qte = lookup.get(`${artId}_${l.id}`);
                            return (
                              <td key={l.id} className="px-2 py-2 text-center">
                                {qte !== undefined && qte > 0
                                  ? <span className="font-bold text-green-700">{qte}</span>
                                  : <span className="text-muted-foreground/30">—</span>}
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 text-center font-bold text-primary">{total > 0 ? total : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Tableau Liste */}
      {vue === 'liste' && <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['N° Livraison', 'Date', 'Fournisseur', 'Entrepôt', 'Articles', 'Qté reçue', 'BL', 'Statut', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10">
                    <Truck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Aucune livraison trouvée</p>
                  </td>
                </tr>
              ) : filtered.map(l => (
                <>
                  <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}>
                    <td className="px-3 py-2.5 font-mono font-semibold text-primary flex items-center gap-1.5">
                      {expandedId === l.id ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                      {l.numero}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(l.dateLivraison)}</td>
                    <td className="px-3 py-2.5 font-medium">{l.fournisseur}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.entrepot?.code}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.lignes?.length ?? 0} art.</td>
                    <td className="px-3 py-2.5 font-medium text-green-700">
                      +{l.lignes?.reduce((s, li) => s + (li.quantiteRecue ?? 0), 0) ?? 0}
                    </td>
                    <td className="px-3 py-2.5">
                      {l.bonLivraisonUrl ? (
                        <a href={l.bonLivraisonUrl} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs" onClick={e => e.stopPropagation()}>Voir BL</a>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statutLivraisonColor[l.statut] ?? 'bg-gray-100 text-gray-700')}>
                        {statutLivraisonLabel[l.statut] ?? l.statut}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {l.statut !== 'LIVREE' && (
                          <button onClick={e => { e.stopPropagation(); updateStatutMut.mutate({ id: l.id, statut: 'LIVREE' }); }}
                            className="flex items-center gap-1 text-xs text-green-700 hover:underline">
                            <CheckCircle className="w-3 h-3" /> Confirmer
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(l.id); }}
                          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === l.id && (
                    <tr key={l.id + '-detail'}>
                      <td colSpan={9} className="px-0 py-0 bg-muted/10">
                        <div className="px-6 py-3 border-t border-border/40">
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Articles reçus</p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="text-left py-1 font-semibold text-muted-foreground">Article</th>
                                <th className="text-left py-1 font-semibold text-muted-foreground">Référence</th>
                                <th className="text-right py-1 font-semibold text-green-600">Qté reçue</th>
                                <th className="w-8"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {l.lignes?.map(li => (
                                <tr key={li.id} className="border-t border-border/20">
                                  <td className="py-1.5 font-medium">{li.article?.nom}</td>
                                  <td className="py-1.5 font-mono text-muted-foreground">{li.article?.reference}</td>
                                  <td className="py-1.5 text-right font-bold text-green-600">+{li.quantiteRecue}</td>
                                  <td className="py-1.5 pl-2">
                                    <button
                                      onClick={e => { e.stopPropagation(); setCorrectionLigne({ livraisonId: l.id, ligneId: li.id, livraisonNumero: l.numero, livraisonDate: l.dateLivraison as string, articleNom: li.article?.nom ?? '', articleRef: li.article?.reference ?? '', quantiteActuelle: li.quantiteRecue, newQte: li.quantiteRecue, commentaire: '' }); }}
                                      className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Corriger la quantité">
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {l.commentaire && <p className="text-xs text-muted-foreground mt-2">💬 {l.commentaire}</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>}

      {/* Dialog confirmation suppression */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Supprimer la livraison ?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filtered.find(l => l.id === confirmDeleteId)?.numero} — Cette action est irréversible.
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

      {/* Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="bg-card rounded-xl shadow-2xl border border-border flex flex-col w-[96vw] h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold">Nouvelle livraison fournisseur</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Le stock sera mis à jour automatiquement</p>
              </div>
              <button onClick={closeDialog} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fournisseur *</label>
                  <input value={fournisseur} onChange={e => setFournisseur(e.target.value)}
                    placeholder="Nexans, Prysmian, Corning…"
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Entrepôt de destination *</label>
                  <select value={entrepotId} onChange={e => setEntrepotId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">Choisir…</option>
                    {entrepots.map(e => <option key={e.id} value={e.id}>{e.code} — {e.nom}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date de réception *</label>
                <input type="date" value={dateLivraison} onChange={e => setDateLivraison(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Commentaire / Référence BL</label>
                <input value={commentaire} onChange={e => setCommentaire(e.target.value)}
                  placeholder="N° bon de livraison, remarques…"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              {/* Photo BL */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Photo du bon de livraison</label>
                <div className="flex items-center gap-3">
                  <label className={cn('flex items-center gap-2 px-3 py-2 text-xs border border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors', uploadingPhoto && 'opacity-60 pointer-events-none')}>
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingPhoto ? 'Upload en cours…' : bonLivraisonUrl ? 'Changer la photo' : 'Charger une photo'}
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  {bonLivraisonUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-medium">✓ Photo chargée</span>
                      <button onClick={() => setBonLivraisonUrl('')} className="text-xs text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Articles reçus *</label>
                  <button onClick={() => setLignes(p => [...p, { articleId: '', quantiteRecue: 1 }])}
                    className="text-xs text-primary hover:underline">+ Ajouter article</button>
                </div>
                <div className="space-y-1.5">
                  {lignes.map((l, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={l.articleId}
                        onChange={e => setLignes(p => p.map((line, j) => j === i ? { ...line, articleId: e.target.value } : line))}
                        className="flex-1 px-2.5 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="">Choisir article…</option>
                        {articles.map(a => <option key={a.id} value={a.id}>{a.nom} ({a.reference})</option>)}
                      </select>
                      <input type="number" min={0} value={l.quantiteRecue}
                        onChange={e => setLignes(p => p.map((line, j) => j === i ? { ...line, quantiteRecue: parseInt(e.target.value) || 0 } : line))}
                        className="w-20 px-2 py-2 text-xs border border-green-300 bg-green-50 rounded-lg text-center font-semibold"
                        title="Quantité reçue" placeholder="Qté" />
                      {lignes.length > 1 && (
                        <button onClick={() => setLignes(p => p.filter((_, j) => j !== i))}
                          className="p-1.5 text-muted-foreground hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
              <button onClick={closeDialog} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
              <button onClick={handleCreate} disabled={createMut.isPending}
                className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Dialog correction ligne ────────────────────────────────────────── */}
      {correctionLigne && (() => {
        const livDate = new Date(correctionLigne.livraisonDate);
        const joursEcoules = Math.floor((Date.now() - livDate.getTime()) / (24 * 60 * 60 * 1000));
        const joursRestants = 3 - joursEcoules;
        const delaiDepasse = joursRestants < 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Corriger une quantité</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{correctionLigne.articleNom} — <span className="font-mono">{correctionLigne.articleRef}</span></p>
                  <p className="text-xs text-muted-foreground">{correctionLigne.livraisonNumero}</p>
                </div>
                <button onClick={() => setCorrectionLigne(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              {delaiDepasse ? (
                <div className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p>Le délai de correction de 3 jours est dépassé (livraison du {formatDate(correctionLigne.livraisonDate)}).</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs bg-primary/5 border border-primary/20 text-primary rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <p>Livraison du {formatDate(correctionLigne.livraisonDate)} — <strong>{joursRestants === 0 ? 'dernier jour' : `encore ${joursRestants} jour(s)`}</strong> pour corriger</p>
                </div>
              )}
              {!delaiDepasse && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nouvelle quantité reçue</label>
                    <input type="number" min={0} value={correctionLigne.newQte}
                      onChange={e => setCorrectionLigne(d => d ? { ...d, newQte: parseInt(e.target.value) || 0 } : d)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    {correctionLigne.quantiteActuelle !== correctionLigne.newQte && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Avant : <span className="font-semibold">{correctionLigne.quantiteActuelle}</span>
                        {' → '}
                        Après : <span className={cn('font-semibold', correctionLigne.newQte > correctionLigne.quantiteActuelle ? 'text-green-600' : 'text-red-600')}>{correctionLigne.newQte}</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Motif de la correction <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Ex. : erreur de saisie, recoupage…"
                      value={correctionLigne.commentaire}
                      onChange={e => setCorrectionLigne(d => d ? { ...d, commentaire: e.target.value } : d)}
                      className={cn('w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30',
                        !correctionLigne.commentaire.trim() ? 'border-amber-300' : 'border-border')} />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setCorrectionLigne(null)} className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground">Annuler</button>
                {!delaiDepasse && (
                  <button
                    onClick={() => {
                      if (!correctionLigne.commentaire.trim()) { toast.error('Le motif est obligatoire'); return; }
                      corrigerLigneMut.mutate({ livraisonId: correctionLigne.livraisonId, ligneId: correctionLigne.ligneId, quantiteNouvelle: correctionLigne.newQte, commentaire: correctionLigne.commentaire });
                    }}
                    disabled={corrigerLigneMut.isPending || !correctionLigne.commentaire.trim()}
                    className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                    {corrigerLigneMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Dialog rapport livraisons ──────────────────────────────────────── */}
      {rapportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
          <div className="bg-card rounded-xl shadow-2xl border border-border flex flex-col w-[96vw] h-[92vh]">

            {/* Header fixe */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" /> Rapport de livraisons</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rapportView === 'table'
                    ? `${rapportData?.length ?? 0} ligne(s) — ${rapportParams.dateDebut} → ${rapportParams.dateFin}`
                    : 'Détail des réceptions par article sur une période'}
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
              <div className="max-w-sm space-y-3">
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
                      {articles.map(a => <option key={a.id} value={a.id}>{a.reference} — {a.nom}</option>)}
                    </select>
                  </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => { setRapportDialog(false); setRapportView('form'); setRapportData(null); }}
                    className="px-4 py-2 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground">
                    Annuler
                  </button>
                  <button
                    onClick={() => rapportJsonMut.mutate()}
                    disabled={rapportJsonMut.isPending || !rapportParams.dateDebut || !rapportParams.dateFin}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg border border-primary text-primary font-medium hover:bg-primary/10 disabled:opacity-50">
                    {rapportJsonMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement…</> : <><Eye className="w-3.5 h-3.5" /> Visualiser</>}
                  </button>
                  <button
                    onClick={() => rapportMut.mutate()}
                    disabled={rapportMut.isPending || !rapportParams.dateDebut || !rapportParams.dateFin}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                    {rapportMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…</> : <><FileDown className="w-3.5 h-3.5" /> Télécharger Excel</>}
                  </button>
                </div>
              </div>
            )}

            {rapportView === 'table' && rapportData && (() => {
              const grandTotal = rapportData.reduce((s, r) => s + r.quantiteRecue, 0);

              const groupKey = (r: any) => rapportGroupBy === 'date' ? r.date : rapportGroupBy === 'article' ? r.reference : r.entrepot;
              const groupLabel = (r: any) => rapportGroupBy === 'date' ? r.date : rapportGroupBy === 'article' ? `${r.reference} — ${r.article}` : r.entrepot;
              const groups = new Map<string, any[]>();
              for (const r of rapportData) {
                const k = groupKey(r);
                if (!groups.has(k)) groups.set(k, []);
                groups.get(k)!.push(r);
              }

              const toggleCollapse = (key: string) => {
                setRapportCollapsed(prev => {
                  const next = new Set(prev);
                  next.has(key) ? next.delete(key) : next.add(key);
                  return next;
                });
              };

              const COLS = rapportGroupBy === 'date'
                ? ['Date', 'N° Livraison', 'Entrepôt', 'Fournisseur', 'Article', 'Référence', 'Unité', 'Qté reçue', 'Commentaire']
                : rapportGroupBy === 'article'
                ? ['Article', 'Référence', 'Date', 'N° Livraison', 'Entrepôt', 'Fournisseur', 'Unité', 'Qté reçue', 'Commentaire']
                : ['Entrepôt', 'Date', 'N° Livraison', 'Fournisseur', 'Article', 'Référence', 'Unité', 'Qté reçue', 'Commentaire'];

              const detailCells = (row: any) => {
                if (rapportGroupBy === 'date') return <>
                  <td className="px-3 py-1.5 pl-7 whitespace-nowrap text-muted-foreground">{row.date}</td>
                  <td className="px-3 py-1.5 font-mono">{row.numero}</td>
                  <td className="px-3 py-1.5 font-mono">{row.entrepot}</td>
                  <td className="px-3 py-1.5 max-w-[130px] truncate">{row.fournisseur}</td>
                  <td className="px-3 py-1.5 max-w-[160px] truncate">{row.article}</td>
                  <td className="px-3 py-1.5 font-mono">{row.reference}</td>
                  <td className="px-3 py-1.5 text-center">{row.unite}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-600 font-medium">+{formatNumber(row.quantiteRecue)}</td>
                  <td className="px-3 py-1.5 max-w-[160px] truncate text-muted-foreground italic">{row.commentaire}</td>
                </>;
                if (rapportGroupBy === 'article') return <>
                  <td className="px-3 py-1.5 pl-7 max-w-[140px] truncate text-muted-foreground">{row.article}</td>
                  <td className="px-3 py-1.5 font-mono">{row.reference}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{row.date}</td>
                  <td className="px-3 py-1.5 font-mono">{row.numero}</td>
                  <td className="px-3 py-1.5 font-mono">{row.entrepot}</td>
                  <td className="px-3 py-1.5 max-w-[130px] truncate">{row.fournisseur}</td>
                  <td className="px-3 py-1.5 text-center">{row.unite}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-600 font-medium">+{formatNumber(row.quantiteRecue)}</td>
                  <td className="px-3 py-1.5 max-w-[160px] truncate text-muted-foreground italic">{row.commentaire}</td>
                </>;
                return <>
                  <td className="px-3 py-1.5 pl-7 font-mono text-muted-foreground">{row.entrepot}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{row.date}</td>
                  <td className="px-3 py-1.5 font-mono">{row.numero}</td>
                  <td className="px-3 py-1.5 max-w-[130px] truncate">{row.fournisseur}</td>
                  <td className="px-3 py-1.5 max-w-[160px] truncate">{row.article}</td>
                  <td className="px-3 py-1.5 font-mono">{row.reference}</td>
                  <td className="px-3 py-1.5 text-center">{row.unite}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-600 font-medium">+{formatNumber(row.quantiteRecue)}</td>
                  <td className="px-3 py-1.5 max-w-[160px] truncate text-muted-foreground italic">{row.commentaire}</td>
                </>;
              };

              return (
                <div className="flex flex-col h-full gap-3">
                  <div className="flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                      {(['date', 'article', 'entrepot'] as const).map(g => (
                        <button key={g} onClick={() => { setRapportGroupBy(g); setRapportCollapsed(new Set()); }}
                          className={cn('px-3 py-1 text-xs rounded font-medium transition-colors', rapportGroupBy === g ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                          {g === 'date' ? 'Par date' : g === 'article' ? 'Par article' : 'Par entrepôt'}
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
                          {COLS.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {[...groups.entries()].map(([key, rows]) => {
                          const collapsed = rapportCollapsed.has(key);
                          const subTotal = rows.reduce((s, r) => s + r.quantiteRecue, 0);
                          return (
                            <>
                              <tr key={`g-${key}`} className="bg-primary/8 border-t border-border cursor-pointer hover:bg-primary/10 select-none"
                                onClick={() => toggleCollapse(key)}>
                                <td className="px-3 py-1.5 font-semibold text-primary flex items-center gap-1.5">
                                  <span className="text-muted-foreground w-3">{collapsed ? '▶' : '▼'}</span>
                                  {groupLabel(rows[0])}
                                  <span className="text-muted-foreground font-normal ml-1">({rows.length} ligne{rows.length > 1 ? 's' : ''})</span>
                                </td>
                                {COLS.slice(1, -1).map(h => <td key={h} />)}
                                <td className="px-3 py-1.5 text-right font-bold text-primary whitespace-nowrap">{formatNumber(subTotal)}</td>
                              </tr>
                              {!collapsed && rows.map((row: any, i: number) => (
                                <tr key={`${key}-${i}`} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                                  {detailCells(row)}
                                </tr>
                              ))}
                            </>
                          );
                        })}
                        <tr className="border-t-2 border-primary/40 bg-primary/5">
                          <td colSpan={8} className="px-3 py-2 text-xs font-bold text-foreground">TOTAL</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-primary">+{formatNumber(grandTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
            </div>{/* flex-1 overflow-auto */}
          </div>{/* bg-card flex flex-col */}
        </div>{/* fixed overlay */}
      )}
    </div>
  );
}
