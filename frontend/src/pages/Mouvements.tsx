import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { mouvementsApi, articlesApi, entrepotsApi } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { Mouvement, Article, Entrepot } from '@/lib/types';

const PROD_SAV = ['PROD', 'SAV', 'MALFACON', 'AUTRE'];

export default function Mouvements() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ type: '', entrepotId: '', departement: '', dateDebut: '', dateFin: '', mois: '' });
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Multi-lignes pour création batch
  const [lignes, setLignes] = useState([{ articleId: '', entrepotId: '', type: 'SORTIE', quantiteDemandee: 1, quantiteFournie: 1, departement: '', manager: '', numeroOperation: '', commentaire: '', prodSav: 'PROD' }]);

  const queryParams = { ...filters, search, page: String(page), limit: '20' };
  const { data: result, isLoading } = useQuery({
    queryKey: ['mouvements', queryParams],
    queryFn: () => mouvementsApi.list(queryParams),
  });
  const { data: articles = [] } = useQuery<Article[]>({ queryKey: ['articles'], queryFn: () => articlesApi.list() });
  const { data: entrepots = [] } = useQuery<Entrepot[]>({ queryKey: ['entrepots'], queryFn: () => entrepotsApi.list() });

  const mouvements: Mouvement[] = result?.data ?? [];
  const totalPages = result?.totalPages ?? 1;

  const createMut = useMutation({
    mutationFn: (items: any[]) => items.length === 1 ? mouvementsApi.create(items[0]) : mouvementsApi.createBatch(items),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mouvements'] }); qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Mouvement(s) créé(s)'); closeDialog(); },
  });

  const deleteMut = useMutation({
    mutationFn: mouvementsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mouvements'] }); qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Mouvement supprimé'); },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setLignes([{ articleId: '', entrepotId: '', type: 'SORTIE', quantiteDemandee: 1, quantiteFournie: 1, departement: '', manager: '', numeroOperation: '', commentaire: '', prodSav: 'PROD' }]);
  };

  const handleCreate = () => {
    const valid = lignes.filter(l => l.articleId && l.entrepotId && l.quantiteDemandee > 0);
    if (valid.length === 0) { toast.error('Remplissez au moins une ligne'); return; }
    createMut.mutate(valid);
  };

  const exportCSV = () => {
    if (!mouvements.length) return;
    const headers = ['Date', 'Référence', 'Désignation', 'Entrepôt', 'Type', 'Demandé', 'Fourni', 'Département', 'Manager', 'N° Opération', 'Source/Destination'];
    const rows = mouvements.map(m => [
      formatDate(m.date), m.article?.reference, m.article?.nom, m.entrepot?.code,
      m.type, m.quantiteDemandee, m.quantiteFournie, m.departement, m.manager,
      m.numeroOperation, m.sourceDestination,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `mouvements-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
        <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none">
          <option value="">Tous types</option>
          <option value="ENTREE">Entrée</option>
          <option value="SORTIE">Sortie</option>
        </select>
        <select value={filters.entrepotId} onChange={e => setFilters(p => ({ ...p, entrepotId: e.target.value }))}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none">
          <option value="">Tous entrepôts</option>
          {entrepots.map(e => <option key={e.id} value={e.id}>{e.code} — {e.nom}</option>)}
        </select>
        <input type="month" value={filters.mois} onChange={e => setFilters(p => ({ ...p, mois: e.target.value, dateDebut: '', dateFin: '' }))}
          title="Filtrer par mois"
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none" />
        <input type="date" value={filters.dateDebut} onChange={e => setFilters(p => ({ ...p, dateDebut: e.target.value, mois: '' }))}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none" />
        <input type="date" value={filters.dateFin} onChange={e => setFilters(p => ({ ...p, dateFin: e.target.value, mois: '' }))}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none" />
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 text-sm bg-card border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground">
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <button onClick={() => setDialogOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Date', 'Référence', 'Désignation', 'Entrepôt', 'Type', 'Demandé', 'Fourni', 'Dép.', 'Manager', 'N° Op.', 'Source', ''].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={13} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
              ) : mouvements.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-12 text-muted-foreground">Aucun mouvement</td></tr>
              ) : mouvements.map(m => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">{formatDate(m.date)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{m.article?.reference}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-foreground">{m.article?.nom}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.entrepot?.code}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', m.type === 'ENTREE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                      {m.type === 'ENTREE' ? '↑ Entrée' : '↓ Sortie'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{formatNumber(m.quantiteDemandee)}</td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium">{formatNumber(m.quantiteFournie)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.departement ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.manager ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{m.numeroOperation ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{m.sourceDestination ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => { if (confirm('Supprimer ce mouvement ?')) deleteMut.mutate(m.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {page} / {totalPages} — {result?.total} mouvements</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted disabled:opacity-40">←</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted disabled:opacity-40">→</button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog création */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-3xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold">Nouveau(x) mouvement(s)</h2>
              <button onClick={closeDialog} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-3">
              {lignes.map((ligne, i) => (
                <div key={i} className="p-4 bg-muted/20 rounded-lg border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Ligne {i + 1}</span>
                    {lignes.length > 1 && (
                      <button onClick={() => setLignes(p => p.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:underline">Supprimer</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Article *</label>
                      <select value={ligne.articleId} onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, articleId: e.target.value } : l))}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="">Choisir…</option>
                        {articles.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Entrepôt *</label>
                      <select value={ligne.entrepotId} onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, entrepotId: e.target.value } : l))}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="">Choisir…</option>
                        {entrepots.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Type *</label>
                      <select value={ligne.type} onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, type: e.target.value } : l))}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option value="SORTIE">Sortie</option>
                        <option value="ENTREE">Entrée</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Qté demandée</label>
                      <input type="number" min={1} value={ligne.quantiteDemandee}
                        onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, quantiteDemandee: parseInt(e.target.value) || 1, quantiteFournie: parseInt(e.target.value) || 1 } : l))}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Qté fournie</label>
                      <input type="number" min={0} value={ligne.quantiteFournie}
                        onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, quantiteFournie: parseInt(e.target.value) || 0 } : l))}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Département</label>
                      <input value={ligne.departement} onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, departement: e.target.value } : l))}
                        placeholder="ex: 49" className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Manager</label>
                      <input value={ligne.manager} onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, manager: e.target.value } : l))}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">N° Opération</label>
                      <input value={ligne.numeroOperation} onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, numeroOperation: e.target.value } : l))}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Prod/SAV</label>
                      <select value={ligne.prodSav} onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, prodSav: e.target.value } : l))}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20">
                        {PROD_SAV.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Commentaire</label>
                    <input value={ligne.commentaire} onChange={e => setLignes(p => p.map((l, j) => j === i ? { ...l, commentaire: e.target.value } : l))}
                      className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
              ))}
              <button onClick={() => setLignes(p => [...p, { articleId: '', entrepotId: '', type: 'SORTIE', quantiteDemandee: 1, quantiteFournie: 1, departement: '', manager: '', numeroOperation: '', commentaire: '', prodSav: 'PROD' }])}
                className="text-sm text-primary hover:underline">+ Ajouter une ligne</button>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeDialog} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleCreate} disabled={createMut.isPending} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
