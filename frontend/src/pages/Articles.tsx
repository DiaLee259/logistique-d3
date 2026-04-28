import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, AlertTriangle, Edit, Trash2, X, BarChart2, List } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { articlesApi, entrepotsApi } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import type { Article, Entrepot, ArticleStats } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  reference: z.string().min(1),
  nom: z.string().min(1),
  description: z.string().optional(),
  unite: z.string().min(1),
  seuilAlerte: z.coerce.number().int().min(0),
  regleConsommation: z.string().optional(),
  facteurConsommation: z.coerce.number().optional(),
});
type FormData = z.infer<typeof schema>;

export default function Articles() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canEdit = hasRole('ADMIN', 'LOGISTICIEN_1');

  const [view, setView] = useState<'stock' | 'stats'>('stock');
  const [search, setSearch] = useState('');
  const [filterAlerte, setFilterAlerte] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statsFilters, setStatsFilters] = useState({ mois: '', dateDebut: '', dateFin: '', entrepotId: '', departement: '' });

  const { data: articles = [], isLoading } = useQuery<Article[]>({
    queryKey: ['articles'],
    queryFn: () => articlesApi.list(),
  });

  const { data: entrepots = [] } = useQuery<Entrepot[]>({
    queryKey: ['entrepots'],
    queryFn: () => entrepotsApi.list(),
  });

  const statsParams: Record<string, string> = {};
  if (statsFilters.mois) statsParams.mois = statsFilters.mois;
  if (statsFilters.dateDebut) statsParams.dateDebut = statsFilters.dateDebut;
  if (statsFilters.dateFin) statsParams.dateFin = statsFilters.dateFin;
  if (statsFilters.entrepotId) statsParams.entrepotId = statsFilters.entrepotId;
  if (statsFilters.departement) statsParams.departement = statsFilters.departement;

  const { data: stats = [], isLoading: statsLoading } = useQuery<ArticleStats[]>({
    queryKey: ['articles-stats', statsParams],
    queryFn: () => articlesApi.stats(statsParams),
    enabled: view === 'stats',
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { unite: 'unité', seuilAlerte: 10 },
  });

  const createMut = useMutation({
    mutationFn: articlesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Article créé'); closeDialog(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => articlesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Article mis à jour'); closeDialog(); },
  });
  const deleteMut = useMutation({
    mutationFn: articlesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Article supprimé'); },
  });

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.nom.toLowerCase().includes(search.toLowerCase()) || a.reference.toLowerCase().includes(search.toLowerCase());
    const matchAlerte = !filterAlerte || a.enAlerte;
    return matchSearch && matchAlerte;
  });

  const filteredStats = stats.filter(a =>
    !search || a.nom.toLowerCase().includes(search.toLowerCase()) || a.reference.toLowerCase().includes(search.toLowerCase())
  );

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); reset({ unite: 'unité', seuilAlerte: 10 }); };

  const openEdit = (a: Article) => {
    setEditingId(a.id);
    reset({ reference: a.reference, nom: a.nom, description: a.description ?? '', unite: a.unite, seuilAlerte: a.seuilAlerte, regleConsommation: a.regleConsommation ?? '', facteurConsommation: a.facteurConsommation ?? undefined });
    setDialogOpen(true);
  };

  const onSubmit = (data: FormData) => {
    if (editingId) updateMut.mutate({ id: editingId, data });
    else createMut.mutate(data);
  };

  const alerteCount = articles.filter(a => a.enAlerte).length;

  return (
    <div className="space-y-4">
      {alerteCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{alerteCount} article(s)</span> en dessous du seuil d'alerte
          </p>
        </div>
      )}

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher article…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        {/* Vue toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setView('stock')} className={cn('flex items-center gap-1.5 px-3 py-2 text-sm transition-colors', view === 'stock' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-muted')}>
            <List className="w-3.5 h-3.5" /> Stock
          </button>
          <button onClick={() => setView('stats')} className={cn('flex items-center gap-1.5 px-3 py-2 text-sm transition-colors', view === 'stats' ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-muted')}>
            <BarChart2 className="w-3.5 h-3.5" /> Stats
          </button>
        </div>
        {view === 'stock' && (
          <button
            onClick={() => setFilterAlerte(!filterAlerte)}
            className={cn('flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors', filterAlerte ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-card border-border text-muted-foreground hover:border-amber-300')}
          >
            <AlertTriangle className="w-4 h-4" /> Alertes
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      {/* Filtres stats */}
      {view === 'stats' && (
        <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          <input type="month" value={statsFilters.mois}
            onChange={e => setStatsFilters(p => ({ ...p, mois: e.target.value, dateDebut: '', dateFin: '' }))}
            placeholder="Mois"
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" />
          <span className="text-xs text-muted-foreground self-center">ou période :</span>
          <input type="date" value={statsFilters.dateDebut}
            onChange={e => setStatsFilters(p => ({ ...p, dateDebut: e.target.value, mois: '' }))}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg outline-none" />
          <span className="text-xs text-muted-foreground self-center">→</span>
          <input type="date" value={statsFilters.dateFin}
            onChange={e => setStatsFilters(p => ({ ...p, dateFin: e.target.value, mois: '' }))}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg outline-none" />
          <select value={statsFilters.entrepotId}
            onChange={e => setStatsFilters(p => ({ ...p, entrepotId: e.target.value }))}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg outline-none">
            <option value="">Tous entrepôts</option>
            {entrepots.map(e => <option key={e.id} value={e.id}>{e.code} — {e.nom}</option>)}
          </select>
          <input value={statsFilters.departement}
            onChange={e => setStatsFilters(p => ({ ...p, departement: e.target.value }))}
            placeholder="Département…"
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg outline-none" />
          {(statsFilters.mois || statsFilters.dateDebut || statsFilters.dateFin || statsFilters.entrepotId || statsFilters.departement) && (
            <button onClick={() => setStatsFilters({ mois: '', dateDebut: '', dateFin: '', entrepotId: '', departement: '' })}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="w-3 h-3" /> Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Vue Stock */}
      {view === 'stock' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Référence</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Désignation</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unité</th>
                  {entrepots.map(e => (
                    <th key={e.id} className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{e.code}</th>
                  ))}
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seuil</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                  {canEdit && <th className="w-16" />}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={20} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={20} className="text-center py-12 text-muted-foreground">Aucun article trouvé</td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{a.reference}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground text-xs">{a.nom}</p>
                      {a.regleConsommation && <p className="text-xs text-muted-foreground">{a.regleConsommation}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{a.unite}</td>
                    {entrepots.map(e => {
                      const s = a.stocks?.find(st => st.entrepotId === e.id);
                      const qte = s?.quantite ?? 0;
                      return (
                        <td key={e.id} className={cn('px-3 py-2 text-right text-xs font-medium', qte <= a.seuilAlerte ? 'text-amber-600' : 'text-foreground')}>
                          {formatNumber(qte)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right text-xs font-bold text-foreground">{formatNumber(a.stockTotal ?? 0)}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{a.seuilAlerte}</td>
                    <td className="px-3 py-2">
                      {a.enAlerte ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Alerte
                        </span>
                      ) : (
                        <span className="inline-flex text-xs font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">OK</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(a)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (confirm(`Supprimer ${a.nom} ?`)) deleteMut.mutate(a.id); }} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vue Stats */}
      {view === 'stats' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Référence</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Désignation</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-green-600 uppercase tracking-wide">Entrées</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-orange-600 uppercase tracking-wide">Sorties</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stock physique</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stock théorique</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Écart</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seuil</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                </tr>
              </thead>
              <tbody>
                {statsLoading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
                ) : filteredStats.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Aucun article trouvé</td></tr>
                ) : filteredStats.map(a => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{a.reference}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground text-xs">{a.nom}</p>
                      {a.regleConsommation && <p className="text-xs text-muted-foreground">{a.regleConsommation}</p>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-green-600">{formatNumber(a.totalEntrees)}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-orange-600">{formatNumber(a.totalSorties)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-foreground">{formatNumber(a.stockPhysique)}</td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{formatNumber(a.stockTheorique)}</td>
                    <td className={cn('px-3 py-2 text-right text-xs font-semibold', a.ecart > 0 ? 'text-green-600' : a.ecart < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                      {a.ecart > 0 ? '+' : ''}{formatNumber(a.ecart)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">{a.seuilAlerte}</td>
                    <td className="px-3 py-2">
                      {a.enAlerte ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Alerte
                        </span>
                      ) : (
                        <span className="inline-flex text-xs font-medium text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog création/édition */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold">{editingId ? 'Modifier article' : 'Nouvel article'}</h2>
              <button onClick={closeDialog} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Référence *</label>
                  <input {...register('reference')} disabled={!!editingId} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-muted" />
                  {errors.reference && <p className="text-xs text-red-500 mt-1">Requis</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Unité *</label>
                  <input {...register('unite')} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Désignation *</label>
                <input {...register('nom')} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                {errors.nom && <p className="text-xs text-red-500 mt-1">Requis</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea {...register('description')} rows={2} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Seuil d'alerte</label>
                  <input {...register('seuilAlerte')} type="number" min={0} className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Facteur consommation</label>
                  <input {...register('facteurConsommation')} type="number" step="0.01" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Règle de consommation</label>
                <input {...register('regleConsommation')} placeholder="ex: 1 prise = 15m câble" className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeDialog} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">Annuler</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
