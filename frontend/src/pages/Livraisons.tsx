import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck, X, CheckCircle, Info, Search, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { livraisonsApi, articlesApi, entrepotsApi, uploadsApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
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

export default function Livraisons() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fournisseur, setFournisseur] = useState('');
  const [entrepotId, setEntrepotId] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [bonLivraisonUrl, setBonLivraisonUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lignes, setLignes] = useState([{ articleId: '', quantiteRecue: 1 }]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterMois, setFilterMois] = useState('');
  const [filterEntrepot, setFilterEntrepot] = useState('');
  const [filterArticleId, setFilterArticleId] = useState('');

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

  const closeDialog = () => {
    setDialogOpen(false);
    setFournisseur(''); setEntrepotId(''); setCommentaire(''); setBonLivraisonUrl('');
    setLignes([{ articleId: '', quantiteRecue: 1 }]);
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
    createMut.mutate({ fournisseur, entrepotId, commentaire, bonLivraisonUrl: bonLivraisonUrl || undefined, lignes: validLignes });
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
        <button onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors ml-auto">
          <Plus className="w-3.5 h-3.5" /> Nouvelle livraison
        </button>
      </div>

      {/* Tableau */}
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
                      {l.statut !== 'LIVREE' && (
                        <button onClick={e => { e.stopPropagation(); updateStatutMut.mutate({ id: l.id, statut: 'LIVREE' }); }}
                          className="flex items-center gap-1 text-xs text-green-700 hover:underline">
                          <CheckCircle className="w-3 h-3" /> Confirmer
                        </button>
                      )}
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
                              </tr>
                            </thead>
                            <tbody>
                              {l.lignes?.map(li => (
                                <tr key={li.id} className="border-t border-border/20">
                                  <td className="py-1.5 font-medium">{li.article?.nom}</td>
                                  <td className="py-1.5 font-mono text-muted-foreground">{li.article?.reference}</td>
                                  <td className="py-1.5 text-right font-bold text-green-600">+{li.quantiteRecue}</td>
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

      {/* Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold">Nouvelle livraison fournisseur</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Le stock sera mis à jour automatiquement</p>
              </div>
              <button onClick={closeDialog} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
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

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={closeDialog} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleCreate} disabled={createMut.isPending}
                  className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
