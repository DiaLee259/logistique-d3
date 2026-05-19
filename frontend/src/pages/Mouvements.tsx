import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, X, Trash2, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { mouvementsApi, articlesApi, entrepotsApi } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { Mouvement, Article, Entrepot } from '@/lib/types';

const PROD_SAV = ['PROD', 'SAV', 'MALFACON', 'AUTRE'];

// Combobox article avec saisie texte
function ArticleCombobox({ articles, value, onChange }: { articles: any[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = articles.find(a => a.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    return a.nom.toLowerCase().includes(q) || a.reference.toLowerCase().includes(q);
  });

  return (
    <div ref={ref} className="relative w-full">
      <div onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg cursor-pointer hover:border-primary/50 bg-card">
        {open ? (
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom ou référence…"
            className="flex-1 bg-transparent outline-none text-sm"
            onClick={e => e.stopPropagation()} />
        ) : (
          <span className={cn('flex-1 truncate text-sm', !selected && 'text-muted-foreground')}>
            {selected ? `${selected.nom} (${selected.reference})` : '— Choisir un article —'}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Aucun article trouvé</p>
          ) : filtered.map(a => (
            <div key={a.id} onMouseDown={() => { onChange(a.id); setOpen(false); setSearch(''); }}
              className={cn('px-3 py-2 text-sm cursor-pointer hover:bg-muted/50', a.id === value && 'bg-primary/10 text-primary font-medium')}>
              <span className="font-mono text-xs text-muted-foreground mr-2">{a.reference}</span>{a.nom}
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

export default function Mouvements() {
  const qc = useQueryClient();
  const importRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ type: '', entrepotId: '', departement: '', dateDebut: '', dateFin: '', mois: '', manager: '', transfert: '' });
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transfertDialogOpen, setTransfertDialogOpen] = useState(false);
  const [transfertEntrepots, setTransfertEntrepots] = useState({ sourceId: '', destinationId: '', commentaire: '' });
  const [transfertLignes, setTransfertLignes] = useState([{ articleId: '', quantite: 1 }]);
  // Multi-lignes pour création batch
  const [lignes, setLignes] = useState([{ articleId: '', entrepotId: '', type: 'SORTIE', quantiteDemandee: 1, quantiteFournie: 1, departement: '', manager: '', numeroOperation: '', commentaire: '', prodSav: 'PROD' }]);

  const queryParams = { ...filters, search, page: String(page), limit: '20' } as Record<string, string>;
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

  const transfertMut = useMutation({
    mutationFn: () => mouvementsApi.transfert({
      entrepotSourceId: transfertEntrepots.sourceId,
      entrepotDestinationId: transfertEntrepots.destinationId,
      lignes: transfertLignes.filter(l => l.articleId && l.quantite > 0),
      commentaire: transfertEntrepots.commentaire || undefined,
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['mouvements'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success(`Transfert ${res.numeroOperation} : ${res.from} → ${res.to} (${res.lignes?.length} article(s))`);
      setTransfertDialogOpen(false);
      setTransfertEntrepots({ sourceId: '', destinationId: '', commentaire: '' });
      setTransfertLignes([{ articleId: '', quantite: 1 }]);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erreur lors du transfert'),
  });

  const deleteMut = useMutation({
    mutationFn: mouvementsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mouvements'] }); qc.invalidateQueries({ queryKey: ['articles'] }); toast.success('Mouvement supprimé'); },
  });

  const importMut = useMutation({
    mutationFn: mouvementsApi.import,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['mouvements'] });
      qc.invalidateQueries({ queryKey: ['articles'] });
      toast.success(`Import terminé : ${data.created} ajoutés, ${data.skipped} ignorés`);
    },
    onError: () => toast.error("Erreur lors de l'import"),
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
    const headers = ['Date', 'Référence', 'Désignation', 'Entrepôt', 'Type', 'Demandé', 'Validé', 'Fourni', 'Département', 'Manager', 'N° Opération', 'Source/Destination'];
    const rows = mouvements.map(m => [
      formatDate(m.date), m.article?.reference, m.article?.nom, m.entrepot?.code,
      m.type, m.quantiteDemandee, m.quantiteValidee ?? '', m.quantiteFournie, m.departement, m.manager,
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
        <select value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value, transfert: '' }))}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none">
          <option value="">Tous types</option>
          <option value="ENTREE">Entrée</option>
          <option value="SORTIE">Sortie</option>
        </select>
        <button
          onClick={() => setFilters(p => ({ ...p, transfert: p.transfert === 'true' ? '' : 'true', type: '' }))}
          className={cn('flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors', filters.transfert === 'true' ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-card border-border text-muted-foreground hover:border-violet-300')}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> Transferts
        </button>
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
        <div className="relative">
          <input value={filters.manager} onChange={e => setFilters(p => ({ ...p, manager: e.target.value }))} placeholder="Filtrer manager…"
            className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 min-w-36" />
          {filters.manager && (
            <button onClick={() => setFilters(p => ({ ...p, manager: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 text-sm bg-card border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground">
          <Download className="w-4 h-4" /> Export CSV
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => mouvementsApi.template().then(b => downloadBlob(b, 'template-mouvements.xlsx'))} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            Modèle Excel
          </button>
          <button onClick={() => importRef.current?.click()} className="px-2 py-1.5 text-xs border border-border rounded-lg hover:border-primary transition-colors text-muted-foreground hover:text-foreground bg-card">
            Importer
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ''; }} />
        </div>
        <button onClick={() => setTransfertDialogOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
          <ArrowLeftRight className="w-4 h-4" /> Transfert
        </button>
        <button onClick={() => setDialogOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Date', 'Référence', 'Désignation', 'Entrepôt', 'Type', 'Demandé', 'Validé', 'Fourni', 'Dép.', 'Manager', 'N° Op.', 'Source', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
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
                  <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap text-xs">{formatDate(m.date)}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{m.article?.reference}</td>
                  <td className="px-3 py-1.5 text-xs font-medium text-foreground whitespace-nowrap max-w-[220px] truncate" title={m.article?.nom}>{m.article?.nom}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{m.entrepot?.code}</td>
                  <td className="px-3 py-1.5">
                    {m.transfertId ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap bg-violet-100 text-violet-700">
                        ⇄ {m.type === 'SORTIE' ? 'Transfert (départ)' : 'Transfert (arrivée)'}
                      </span>
                    ) : (
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', m.type === 'ENTREE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                        {m.type === 'ENTREE' ? '↑ Entrée' : '↓ Sortie'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{formatNumber(m.quantiteDemandee)}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-blue-600">{m.quantiteValidee != null ? formatNumber(m.quantiteValidee) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-1.5 text-right text-xs font-medium">{formatNumber(m.quantiteFournie)}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{m.departement ?? '—'}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{m.manager ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{m.numeroOperation ?? '—'}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{m.sourceDestination ?? '—'}</td>
                  <td className="px-3 py-1.5">
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

      {/* ── Dialog TRANSFERT ────────────────────────────────────────────────── */}
      {transfertDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-violet-600" /> Transfert inter-entrepôt</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Un numéro TRF-YYYY-XXXX est généré automatiquement</p>
              </div>
              <button onClick={() => { setTransfertDialogOpen(false); setTransfertEntrepots({ sourceId: '', destinationId: '', commentaire: '' }); setTransfertLignes([{ articleId: '', quantite: 1 }]); }} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Entrepôts */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Entrepôt source *</label>
                  <select value={transfertEntrepots.sourceId} onChange={e => setTransfertEntrepots(p => ({ ...p, sourceId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-card">
                    <option value="">— Source —</option>
                    {entrepots.map(e => <option key={e.id} value={e.id} disabled={e.id === transfertEntrepots.destinationId}>{e.code} — {e.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Entrepôt destination *</label>
                  <select value={transfertEntrepots.destinationId} onChange={e => setTransfertEntrepots(p => ({ ...p, destinationId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-card">
                    <option value="">— Destination —</option>
                    {entrepots.map(e => <option key={e.id} value={e.id} disabled={e.id === transfertEntrepots.sourceId}>{e.code} — {e.nom}</option>)}
                  </select>
                </div>
              </div>

              {/* Flèche visuelle */}
              {transfertEntrepots.sourceId && transfertEntrepots.destinationId && (
                <div className="flex items-center justify-center gap-3">
                  <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-lg text-sm font-bold border border-violet-200">
                    {entrepots.find(e => e.id === transfertEntrepots.sourceId)?.code}
                  </span>
                  <ArrowLeftRight className="w-5 h-5 text-violet-500" />
                  <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-lg text-sm font-bold border border-violet-200">
                    {entrepots.find(e => e.id === transfertEntrepots.destinationId)?.code}
                  </span>
                </div>
              )}

              {/* Lignes articles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Articles à transférer *</label>
                  <button type="button"
                    onClick={() => setTransfertLignes(p => [...p, { articleId: '', quantite: 1 }])}
                    className="text-xs text-violet-600 hover:underline font-medium">+ Ajouter un article</button>
                </div>
                {transfertLignes.map((ligne, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <ArticleCombobox
                        articles={articles}
                        value={ligne.articleId}
                        onChange={id => setTransfertLignes(p => p.map((l, j) => j === i ? { ...l, articleId: id } : l))}
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input type="number" min={1} value={ligne.quantite}
                        onChange={e => setTransfertLignes(p => p.map((l, j) => j === i ? { ...l, quantite: parseInt(e.target.value) || 1 } : l))}
                        className="w-20 px-2 py-2 text-sm border border-border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-violet-300" />
                      {transfertLignes.length > 1 && (
                        <button onClick={() => setTransfertLignes(p => p.filter((_, j) => j !== i))}
                          className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Commentaire */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Commentaire (optionnel)</label>
                <input value={transfertEntrepots.commentaire}
                  onChange={e => setTransfertEntrepots(p => ({ ...p, commentaire: e.target.value }))}
                  placeholder="Raison du transfert, dépannage…"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                <p className="text-xs text-violet-700">ℹ️ Le stock global reste identique. Un numéro <strong>TRF-YYYY-XXXX</strong> est attribué à l'opération.</p>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setTransfertDialogOpen(false); setTransfertEntrepots({ sourceId: '', destinationId: '', commentaire: '' }); setTransfertLignes([{ articleId: '', quantite: 1 }]); }}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button
                  onClick={() => transfertMut.mutate()}
                  disabled={
                    !transfertEntrepots.sourceId || !transfertEntrepots.destinationId ||
                    transfertLignes.filter(l => l.articleId && l.quantite > 0).length === 0 ||
                    transfertMut.isPending
                  }
                  className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-60"
                >
                  {transfertMut.isPending ? 'Transfert…' : `Valider (${transfertLignes.filter(l => l.articleId).length} article(s))`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
