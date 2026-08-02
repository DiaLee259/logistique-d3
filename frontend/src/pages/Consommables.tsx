import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { consommablesApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BarChart3, Upload, RefreshCw, CheckCircle2, XCircle,
  Settings2, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  countTotal: number; countOk: number; countNok: number;
  countProd: number; countSav: number; tauxOk: number;
  dernierImport: { dateImport: string; nomFichier: string; nbLignesImportees: number } | null;
}
interface Formule {
  id: string; codeArticle: string; nomProduit: string; categorie: string | null;
  descriptionFormule: string; multiplicateur: number; multiplicateurNok: number;
  minimumQte: number | null; actif: boolean;
}
interface ResultCalcul {
  codeArticle: string; nomProduit: string; categorie: string | null;
  descriptionFormule: string; multiplicateur: number; multiplicateurNok: number;
  quantite: number;
}
interface LigneRepartition {
  dimension: string; countOk: number; countNok: number; countTotal: number;
}
interface Filters {
  departements: { code: string; nom: string }[];
  mois: { mois: string }[];
  semaines: { semaine: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('fr-FR');

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-foreground'}`}>{typeof value === 'number' ? fmt(value) : value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Consommables() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'calcul' | 'repartition' | 'formules'>('calcul');
  const [groupBy, setGroupBy] = useState<'mois' | 'semaine' | 'departement'>('mois');
  const [filtDept, setFiltDept] = useState('');
  const [filtMoisDebut, setFiltMoisDebut] = useState('');
  const [filtMoisFin, setFiltMoisFin] = useState('');
  const [editFormule, setEditFormule] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ multiplicateur: number; multiplicateurNok: number }>({ multiplicateur: 1, multiplicateurNok: 0 });
  const [showImports, setShowImports] = useState(false);

  const params: Record<string, string> = {};
  if (filtDept) params.codeDepartement = filtDept;
  if (filtMoisDebut) params.moisDebut = filtMoisDebut + '-01';
  if (filtMoisFin) params.moisFin = filtMoisFin + '-01';

  const { data: summary, isLoading: loadingSummary } = useQuery<Summary>({
    queryKey: ['consommables-summary'],
    queryFn: () => consommablesApi.summary(),
  });

  const { data: filters } = useQuery<Filters>({
    queryKey: ['consommables-filters'],
    queryFn: () => consommablesApi.getFilters(),
  });

  const { data: calcul = [], isFetching: fetchingCalcul } = useQuery<ResultCalcul[]>({
    queryKey: ['consommables-calcul', params],
    queryFn: () => consommablesApi.calcul(params),
    enabled: tab === 'calcul',
  });

  const { data: repartition = [], isFetching: fetchingRep } = useQuery<LigneRepartition[]>({
    queryKey: ['consommables-repartition', params, groupBy],
    queryFn: () => consommablesApi.repartition({ ...params, groupBy }),
    enabled: tab === 'repartition',
  });

  const { data: formules = [] } = useQuery<Formule[]>({
    queryKey: ['consommables-formules'],
    queryFn: () => consommablesApi.listFormules(),
    enabled: tab === 'formules',
  });

  const { data: imports = [] } = useQuery<any[]>({
    queryKey: ['consommables-imports'],
    queryFn: () => consommablesApi.listImports(),
    enabled: showImports,
  });

  const updateFormuleMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => consommablesApi.updateFormule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consommables-formules'] });
      qc.invalidateQueries({ queryKey: ['consommables-calcul'] });
      setEditFormule(null);
      toast.success('Formule mise à jour');
    },
  });

  const maxRep = Math.max(...repartition.map(r => r.countTotal), 1);

  return (
    <div className="flex flex-col gap-6 p-6 h-full">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/15">
            <BarChart3 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Consommables Terrain</h1>
            <p className="text-xs text-muted-foreground">Analyse de consommation — TECHNO SMART</p>
          </div>
        </div>
        <button
          onClick={() => setShowImports(v => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          Historique imports
          {showImports ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── KPI cards ── */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Total interventions" value={summary.countTotal} />
          <KpiCard label="OK" value={summary.countOk} color="text-green-600 dark:text-green-400" />
          <KpiCard label="NOK" value={summary.countNok} color="text-red-500 dark:text-red-400" />
          <KpiCard label="Taux OK" value={`${summary.tauxOk} %`} color={summary.tauxOk >= 80 ? 'text-green-600 dark:text-green-400' : 'text-amber-600'} />
          <KpiCard
            label="Dernier import"
            value={summary.dernierImport ? formatDate(summary.dernierImport.dateImport) : '—'}
            sub={summary.dernierImport ? summary.dernierImport.nomFichier : 'Aucun import'}
          />
        </div>
      ) : null}

      {/* ── Historique imports ── */}
      {showImports && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Historique des imports Excel
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fichier</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Lignes</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Durée</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody>
                {imports.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Aucun import</td></tr>
                )}
                {imports.map((imp: any) => (
                  <tr key={imp.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-xs">{imp.nomFichier}</td>
                    <td className="px-4 py-2.5 text-xs">{formatDate(imp.dateImport)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(imp.nbLignesImportees)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">{imp.dureeSecondes ? `${imp.dureeSecondes.toFixed(1)} s` : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        imp.statut === 'SUCCES' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        imp.statut === 'ECHEC'  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        {imp.statut === 'SUCCES' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {imp.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filtDept}
          onChange={e => setFiltDept(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground h-8"
        >
          <option value="">Tous les départements</option>
          {(filters?.departements ?? []).map(d => (
            <option key={d.code} value={d.code}>{d.nom ?? d.code}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 text-sm">
          <label className="text-muted-foreground text-xs">De</label>
          <input
            type="month" value={filtMoisDebut}
            onChange={e => setFiltMoisDebut(e.target.value)}
            className="border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm h-8"
          />
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <label className="text-muted-foreground text-xs">À</label>
          <input
            type="month" value={filtMoisFin}
            onChange={e => setFiltMoisFin(e.target.value)}
            className="border border-border rounded-lg px-2 py-1 bg-background text-foreground text-sm h-8"
          />
        </div>

        {(filtDept || filtMoisDebut || filtMoisFin) && (
          <button
            onClick={() => { setFiltDept(''); setFiltMoisDebut(''); setFiltMoisFin(''); }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Réinitialiser
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {(fetchingCalcul || fetchingRep) && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
        </div>
      </div>

      {/* ── Onglets ── */}
      <div className="flex gap-1 border-b border-border">
        {(['calcul', 'repartition', 'formules'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'calcul' ? 'Calcul consommation' : t === 'repartition' ? 'Répartition interventions' : 'Formules & coefficients'}
          </button>
        ))}
      </div>

      {/* ── Tab : Calcul ── */}
      {tab === 'calcul' && (
        <div className="flex-1 overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Produit</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Catégorie</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Formule</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Coeff.</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-base font-semibold">Qté estimée</th>
              </tr>
            </thead>
            <tbody>
              {calcul.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  {fetchingCalcul ? 'Calcul en cours…' : 'Aucun résultat'}
                </td></tr>
              )}
              {calcul.map((r, i) => (
                <tr key={r.codeArticle} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-4 py-2.5 font-medium">{r.nomProduit}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.categorie ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate" title={r.descriptionFormule}>
                    {r.descriptionFormule}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    ×{r.multiplicateur}{r.multiplicateurNok > 0 ? ` / NOK ×${r.multiplicateurNok}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-foreground text-base">
                    {fmt(r.quantite)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab : Répartition ── */}
      {tab === 'repartition' && (
        <div className="flex flex-col gap-4 flex-1 overflow-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Grouper par :</span>
            {(['mois', 'semaine', 'departement'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  groupBy === g
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {g === 'mois' ? 'Mois' : g === 'semaine' ? 'Semaine' : 'Département'}
              </button>
            ))}
          </div>

          <div className="overflow-auto rounded-xl border border-border flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                    {groupBy === 'mois' ? 'Mois' : groupBy === 'semaine' ? 'Semaine' : 'Département'}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-green-600 dark:text-green-400">OK</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-red-500">NOK</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground w-48">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {repartition.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    {fetchingRep ? 'Chargement…' : 'Aucune donnée'}
                  </td></tr>
                )}
                {repartition.map((r, i) => {
                  const pctOk = r.countTotal > 0 ? Math.round(r.countOk / r.countTotal * 100) : 0;
                  const barW = Math.round(r.countTotal / maxRep * 100);
                  const dim = r.dimension;
                  const label = groupBy === 'mois' && dim
                    ? new Date(dim).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
                    : dim ?? '—';

                  return (
                    <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-2.5 font-medium">{label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmt(r.countTotal)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-green-600 dark:text-green-400">{fmt(r.countOk)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-500">{fmt(r.countNok)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary/60" style={{ width: `${barW}%` }} />
                          </div>
                          <span className={`text-xs tabular-nums font-medium w-8 text-right ${pctOk >= 80 ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}`}>
                            {pctOk}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab : Formules ── */}
      {tab === 'formules' && (
        <div className="flex-1 overflow-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Produit</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">Formule</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Coeff. OK</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Coeff. NOK</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Actif</th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Éditer</th>
              </tr>
            </thead>
            <tbody>
              {formules.map((f, i) => (
                <tr key={f.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{f.nomProduit}</div>
                    {f.categorie && <div className="text-xs text-muted-foreground">{f.categorie}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell max-w-sm truncate" title={f.descriptionFormule}>
                    {f.descriptionFormule}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {editFormule === f.id
                      ? <input
                          type="number" step="0.01" min="0"
                          value={editValues.multiplicateur}
                          onChange={e => setEditValues(v => ({ ...v, multiplicateur: parseFloat(e.target.value) }))}
                          className="w-20 border border-border rounded px-2 py-0.5 text-right text-sm bg-background"
                        />
                      : <span className="font-mono">×{f.multiplicateur}</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {editFormule === f.id
                      ? <input
                          type="number" step="0.01" min="0"
                          value={editValues.multiplicateurNok}
                          onChange={e => setEditValues(v => ({ ...v, multiplicateurNok: parseFloat(e.target.value) }))}
                          className="w-20 border border-border rounded px-2 py-0.5 text-right text-sm bg-background"
                        />
                      : <span className="font-mono text-muted-foreground">×{f.multiplicateurNok}</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${f.actif ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {editFormule === f.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => updateFormuleMut.mutate({ id: f.id, data: editValues })}
                          className="text-xs text-primary hover:underline font-medium"
                        >Sauver</button>
                        <button onClick={() => setEditFormule(null)} className="text-xs text-muted-foreground hover:underline">Annuler</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditFormule(f.id); setEditValues({ multiplicateur: f.multiplicateur, multiplicateurNok: f.multiplicateurNok }); }}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Modifier les coefficients"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
