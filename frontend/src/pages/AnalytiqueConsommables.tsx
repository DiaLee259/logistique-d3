import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, Package2, BarChart3, Calendar, ShoppingCart,
  ChevronDown, ChevronRight, RotateCcw, Users,
} from 'lucide-react';
import { consommablesApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalyseRow {
  nomProduit: string;
  codeArticle: string;
  categorie: string | null;
  dimension: string;
  quantiteEstimee: number;
}

interface FormuleInfo {
  id: string;
  nomProduit: string;
  codeArticle: string;
  categorie: string | null;
}

interface AnalyseData {
  rows: AnalyseRow[];
  formules: FormuleInfo[];
  dimensions: string[];
}

type GroupByKey = 'departement' | 'mois' | 'semaine' | 'operateur' | 'typezone' | 'infrastructure' | 'typeAbonne' | 'activite';
type ActiveTab  = 'analyse' | 'intervenant';

// ── Constantes ────────────────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#14b8a6', '#f97316', '#3b82f6', '#ec4899', '#84cc16',
  '#a855f7', '#06b6d4',
];

const GROUP_BY_LABELS: Record<GroupByKey, string> = {
  departement:    'Département',
  mois:           'Mois',
  semaine:        'Semaine',
  operateur:      'Opérateur',
  typezone:       'Type Zone',
  infrastructure: 'Infrastructure',
  typeAbonne:     'Type Abonné',
  activite:       'Activité',
};

const OPERATEURS = ['ORANGE', 'XPFIBRE', 'ALTITUDE', 'AXIONE', 'TDF', 'SFR', 'FREE', 'FIBRAGGLO'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />;
}

function KCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 min-w-0">
      <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className={cn('text-base font-bold mt-0.5 truncate', color ?? 'text-foreground')}>
          {typeof value === 'number' ? fmt(value) : value}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// Barre de progression compact
function MiniBar({ pct, color, height = 'h-1.5' }: { pct: number; color: string; height?: string }) {
  return (
    <div className={cn('w-20 bg-muted rounded-full overflow-hidden', height)}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AnalytiqueConsommables() {
  // Filtres
  const [groupBy,    setGroupBy]    = useState<GroupByKey>('departement');
  const [produitId,  setProduitId]  = useState('');
  const [moisDebut,  setMoisDebut]  = useState('');
  const [moisFin,    setMoisFin]    = useState('');
  const [codeDept,   setCodeDept]   = useState('');
  const [operateur,  setOperateur]  = useState('');

  // UI
  const [hiddenProduits,  setHiddenProduits]  = useState<Set<string>>(new Set());
  const [activeTab,       setActiveTab]       = useState<ActiveTab>('analyse');
  const [expandedRows,    setExpandedRows]    = useState<Set<string>>(new Set());

  // ── Params queries ─────────────────────────────────────────────────────────

  const baseFilters = useMemo(() => {
    const p: Record<string, string> = {};
    if (produitId) p.produitId  = produitId;
    if (moisDebut) p.moisDebut  = moisDebut + '-01';
    if (moisFin)   p.moisFin    = moisFin   + '-01';
    if (codeDept)  p.codeDepartement = codeDept;
    if (operateur) p.operateur  = operateur;
    return p;
  }, [produitId, moisDebut, moisFin, codeDept, operateur]);

  const analyseParams    = useMemo(() => ({ ...baseFilters, groupBy }), [baseFilters, groupBy]);
  const operateurParams  = useMemo(() => ({ ...baseFilters, groupBy: 'operateur' }), [baseFilters]);
  const commandesParams  = useMemo(() => {
    const p: Record<string, string> = {};
    if (moisDebut) p.moisDebut = moisDebut + '-01';
    if (moisFin)   p.moisFin   = moisFin   + '-01';
    return p;
  }, [moisDebut, moisFin]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: analyseData, isLoading } = useQuery<AnalyseData>({
    queryKey: ['consommables-analyse', analyseParams],
    queryFn:  () => consommablesApi.analyse(analyseParams),
  });

  const { data: operateurData, isLoading: isLoadingOp } = useQuery<AnalyseData>({
    queryKey: ['consommables-operateur', operateurParams],
    queryFn:  () => consommablesApi.analyse(operateurParams),
    enabled:  activeTab === 'intervenant',
  });

  const { data: commandesData = [] } = useQuery<{ codeArticle: string; mois: string; quantiteCommandee: number }[]>({
    queryKey: ['consommables-commandes-articles', commandesParams],
    queryFn:  () => consommablesApi.commandesArticles(Object.keys(commandesParams).length ? commandesParams : undefined),
  });

  const { data: filtersData } = useQuery({
    queryKey: ['consommables-filters'],
    queryFn:  () => consommablesApi.getFilters(),
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  const resetFilters = () => {
    setProduitId(''); setMoisDebut(''); setMoisFin('');
    setCodeDept(''); setOperateur(''); setGroupBy('departement');
    setHiddenProduits(new Set()); setExpandedRows(new Set());
  };

  const toggleRow = (key: string) =>
    setExpandedRows(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleAllRows = (keys: string[]) => {
    const allOpen = keys.every(k => expandedRows.has(k));
    setExpandedRows(allOpen ? new Set() : new Set(keys));
  };

  // ── Données derivées ───────────────────────────────────────────────────────

  const produits = useMemo(() => analyseData?.formules ?? [], [analyseData]);

  const articleGroups = useMemo(() => {
    if (!analyseData) return [];
    const grandTotal = analyseData.rows.reduce((s, r) => s + r.quantiteEstimee, 0) || 1;
    return produits
      .map((p, idx) => {
        const subRows = analyseData.rows
          .filter(r => r.codeArticle === p.codeArticle)
          .sort((a, b) => b.quantiteEstimee - a.quantiteEstimee);
        const total = subRows.reduce((s, r) => s + r.quantiteEstimee, 0);
        return { ...p, colorIdx: idx, total, subRows, pct: Math.round((total / grandTotal) * 100) };
      })
      .filter(g => g.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [analyseData, produits]);

  const intervenantGroups = useMemo(() => {
    if (!operateurData) return [];
    const grandTotal = operateurData.rows.reduce((s, r) => s + r.quantiteEstimee, 0) || 1;
    return operateurData.formules
      .map((p, idx) => {
        const subRows = operateurData.rows
          .filter(r => r.codeArticle === p.codeArticle)
          .sort((a, b) => b.quantiteEstimee - a.quantiteEstimee);
        const total = subRows.reduce((s, r) => s + r.quantiteEstimee, 0);
        return {
          ...p, colorIdx: idx, total, pct: Math.round((total / grandTotal) * 100),
          subRows: subRows.map(r => ({ ...r, pct: total > 0 ? Math.round((r.quantiteEstimee / total) * 100) : 0 })),
        };
      })
      .filter(g => g.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [operateurData]);

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const rows = analyseData?.rows ?? [];
    const totalEstime   = rows.reduce((s, r) => s + r.quantiteEstimee, 0);
    const totalCommande = commandesData.reduce((s, c) => s + c.quantiteCommandee, 0);

    const dimTotals = new Map<string, number>();
    for (const r of rows) dimTotals.set(r.dimension, (dimTotals.get(r.dimension) ?? 0) + r.quantiteEstimee);
    let topDim = '', topVal = 0;
    for (const [d, v] of dimTotals) { if (v > topVal) { topVal = v; topDim = d; } }

    let periode = 'Toutes périodes';
    if (moisDebut || moisFin) {
      const fmtM = (s: string) => new Date(s + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      if (moisDebut && moisFin) periode = `${fmtM(moisDebut)} → ${fmtM(moisFin)}`;
      else if (moisDebut)       periode = `≥ ${fmtM(moisDebut)}`;
      else                      periode = `≤ ${fmtM(moisFin!)}`;
    } else if (filtersData?.mois?.length) {
      const dates: Date[] = filtersData.mois.map((m: { mois: string }) => new Date(m.mois));
      const min = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
      const max = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
      const fmtD = (d: Date) => d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      periode = `${fmtD(min)} → ${fmtD(max)}`;
    }

    return { totalEstime, totalCommande, topDim, topVal, nbFormules: produits.length, periode };
  }, [analyseData, commandesData, produits, moisDebut, moisFin, filtersData]);

  // ── Chart ──────────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (!analyseData) return [];
    return analyseData.dimensions.map(dim => {
      const entry: Record<string, string | number> = { dimension: dim };
      for (const f of produits) {
        const r = analyseData.rows.find(x => x.dimension === dim && x.codeArticle === f.codeArticle);
        entry[f.nomProduit] = r?.quantiteEstimee ?? 0;
      }
      return entry;
    });
  }, [analyseData, produits]);

  const nbDims    = analyseData?.dimensions.length ?? 0;
  const nbVisible = produits.filter(p => !hiddenProduits.has(p.nomProduit)).length;
  const chartMinW = nbDims > 15 ? nbDims * Math.max(nbVisible * 14 + 16, 40) : undefined;

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Analytique Consommables</h2>
          <p className="text-sm text-muted-foreground">Consommation estimée × données terrain</p>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-end gap-2.5">

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Consommable</label>
          <select value={produitId} onChange={e => setProduitId(e.target.value)}
            className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground min-w-[130px]">
            <option value="">Tous</option>
            {analyseData?.formules.map(f => <option key={f.id} value={f.id}>{f.nomProduit}</option>)}
          </select>
        </div>

        {activeTab === 'analyse' && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Grouper par</label>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupByKey)}
              className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground">
              {(Object.entries(GROUP_BY_LABELS) as [GroupByKey, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">De</label>
            <input type="month" value={moisDebut} onChange={e => setMoisDebut(e.target.value)}
              className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">À</label>
            <input type="month" value={moisFin} onChange={e => setMoisFin(e.target.value)}
              className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Département</label>
          <input type="text" placeholder="Ex : 69" value={codeDept} onChange={e => setCodeDept(e.target.value)}
            className="h-7 w-20 px-2 text-xs border border-border rounded-md bg-background text-foreground" />
        </div>

        {activeTab === 'analyse' && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Opérateur</label>
            <select value={operateur} onChange={e => setOperateur(e.target.value)}
              className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground">
              <option value="">Tous</option>
              {OPERATEURS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
        )}

        <button onClick={resetFilters}
          className="h-7 px-2.5 text-xs border border-border rounded-md bg-background hover:bg-muted transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground mt-auto">
          <RotateCcw className="w-3 h-3" /> Réinitialiser
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KCard label="Total estimé"   value={kpis.totalEstime}   icon={TrendingUp} />
        <KCard
          label={`Top ${GROUP_BY_LABELS[groupBy].toLowerCase()}`}
          value={kpis.topDim || '—'}
          sub={kpis.topVal > 0 ? `${fmt(kpis.topVal)} unités` : undefined}
          icon={BarChart3}
        />
        <KCard label="Produits actifs" value={kpis.nbFormules}   sub="formules actives" icon={Package2} />
        <KCard label="Période"         value={kpis.periode}      icon={Calendar} />
        <KCard label="Commandé total"  value={kpis.totalCommande} sub="qté sur commandes" icon={ShoppingCart} />
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          Quantités estimées par {GROUP_BY_LABELS[groupBy].toLowerCase()}
        </h3>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-44 w-full" /></div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Aucune donnée</div>
        ) : (
          <div className="overflow-x-auto">
            <div style={chartMinW ? { minWidth: chartMinW } : {}}>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 72 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="dimension" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} height={72} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={44} />
                  <Tooltip formatter={(v: number, name: string) => [fmt(v), name]} contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6, cursor: 'pointer' }}
                    onClick={(e: { value: string }) => {
                      setHiddenProduits(prev => { const n = new Set(prev); n.has(e.value) ? n.delete(e.value) : n.add(e.value); return n; })
                    }} />
                  {produits.map((f, i) => !hiddenProduits.has(f.nomProduit) && (
                    <Bar key={f.codeArticle} dataKey={f.nomProduit} fill={COLORS[i % COLORS.length]}
                      radius={[2, 2, 0, 0]} maxBarSize={28} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border bg-muted/20">
          {([
            { id: 'analyse',     label: `Par ${GROUP_BY_LABELS[groupBy]}`, icon: BarChart3 },
            { id: 'intervenant', label: 'Par Opérateur',                   icon: Users },
          ] as { id: ActiveTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-primary text-primary bg-card'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30',
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}

          <div className="ml-auto px-3 flex items-center">
            <button
              onClick={() => {
                const groups = activeTab === 'analyse' ? articleGroups : intervenantGroups;
                const keys = groups.map(g => g.codeArticle + (activeTab === 'intervenant' ? '_op' : ''));
                toggleAllRows(keys);
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              {(() => {
                const groups = activeTab === 'analyse' ? articleGroups : intervenantGroups;
                const keys = groups.map(g => g.codeArticle + (activeTab === 'intervenant' ? '_op' : ''));
                return keys.every(k => expandedRows.has(k)) ? 'Tout réduire' : 'Tout développer';
              })()}
            </button>
          </div>
        </div>

        {/* ── TAB Analyse dimensionnelle ───────────────────────────────────── */}
        {activeTab === 'analyse' && (
          <div className="overflow-x-auto">
            <div className="px-4 py-2 border-b border-border bg-muted/10">
              <p className="text-xs text-muted-foreground">
                {articleGroups.length} produit{articleGroups.length !== 1 ? 's' : ''} —
                Cliquer sur une ligne pour voir le détail par {GROUP_BY_LABELS[groupBy].toLowerCase()}
              </p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Produit</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Catégorie</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Total estimé</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-right">
                    Nb {GROUP_BY_LABELS[groupBy].toLowerCase()}
                  </th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-40">Répartition</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-3 py-2.5"><Skeleton className="h-3 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : articleGroups.map(g => {
                      const key = g.codeArticle;
                      const expanded = expandedRows.has(key);
                      const color = COLORS[g.colorIdx % COLORS.length];
                      return [
                        // Ligne article (résumé)
                        <tr
                          key={key}
                          className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => toggleRow(key)}
                        >
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {expanded
                              ? <ChevronDown className="w-3.5 h-3.5" style={{ color }} />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-foreground">{g.nomProduit}</td>
                          <td className="px-3 py-2.5 text-muted-foreground text-[11px]">{g.categorie ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color }}>
                            {fmt(g.total)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {g.subRows.length}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-2">
                              <MiniBar pct={g.pct} color={color} />
                              <span className="tabular-nums text-muted-foreground w-7 text-right">{g.pct}%</span>
                            </div>
                          </td>
                        </tr>,
                        // Sous-lignes dimension
                        ...(expanded ? g.subRows.map(r => {
                          const maxVal = g.subRows[0]?.quantiteEstimee ?? 1;
                          const dimPct = maxVal > 0 ? Math.round((r.quantiteEstimee / maxVal) * 100) : 0;
                          return (
                            <tr
                              key={`${key}::${r.dimension}`}
                              className="border-b border-border/40 bg-muted/5 hover:bg-muted/15"
                            >
                              <td className="px-3 py-1.5" />
                              <td className="px-3 py-1.5 pl-7 text-muted-foreground">{r.dimension}</td>
                              <td className="px-3 py-1.5 text-muted-foreground/50 text-[11px]">{g.categorie ?? '—'}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{fmt(r.quantiteEstimee)}</td>
                              <td className="px-3 py-1.5" />
                              <td className="px-3 py-1.5">
                                <div className="flex items-center justify-end gap-2">
                                  <MiniBar pct={dimPct} color={color} height="h-1" />
                                  <span className="tabular-nums text-muted-foreground/70 w-7 text-right">{dimPct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        }) : []),
                      ];
                    })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TAB Intervenant (Opérateur) ─────────────────────────────────── */}
        {activeTab === 'intervenant' && (
          <div className="overflow-x-auto">
            <div className="px-4 py-2 border-b border-border bg-amber-50/50 dark:bg-amber-900/10">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Données technicien et société non disponibles dans l'import actuel — affichage par opérateur réseau
              </p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 font-semibold text-muted-foreground">Produit</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Total estimé</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-right">Nb opérateurs</th>
                  <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-40">Part du total</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingOp
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-3 py-2.5"><Skeleton className="h-3 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : intervenantGroups.map(g => {
                      const key = g.codeArticle + '_op';
                      const expanded = expandedRows.has(key);
                      const color = COLORS[g.colorIdx % COLORS.length];
                      return [
                        <tr
                          key={key}
                          className="border-b border-border hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => toggleRow(key)}
                        >
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {expanded
                              ? <ChevronDown className="w-3.5 h-3.5" style={{ color }} />
                              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-foreground">{g.nomProduit}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color }}>
                            {fmt(g.total)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {g.subRows.length}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-2">
                              <MiniBar pct={g.pct} color={color} />
                              <span className="tabular-nums text-muted-foreground w-7 text-right">{g.pct}%</span>
                            </div>
                          </td>
                        </tr>,
                        ...(expanded ? g.subRows.map(r => {
                          const maxVal = g.subRows[0]?.quantiteEstimee ?? 1;
                          const opPct = maxVal > 0 ? Math.round((r.quantiteEstimee / maxVal) * 100) : 0;
                          return (
                            <tr
                              key={`${g.codeArticle}::${r.dimension}`}
                              className="border-b border-border/40 bg-muted/5 hover:bg-muted/15"
                            >
                              <td className="px-3 py-1.5" />
                              <td className="px-3 py-1.5 pl-7 text-muted-foreground flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
                                {r.dimension}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-foreground">{fmt(r.quantiteEstimee)}</td>
                              <td className="px-3 py-1.5 text-right text-muted-foreground">{r.pct}% du produit</td>
                              <td className="px-3 py-1.5">
                                <div className="flex items-center justify-end gap-2">
                                  <MiniBar pct={opPct} color={color} height="h-1" />
                                  <span className="tabular-nums text-muted-foreground/70 w-7 text-right">{opPct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        }) : []),
                      ];
                    })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
