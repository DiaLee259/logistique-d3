import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Package, AlertTriangle,
  ClipboardList, Truck, CheckCircle, Activity, Calendar, Clock,
} from 'lucide-react';
import { dashboardApi, entrepotsApi, articlesApi, inventairesApi } from '@/lib/api';
import KpiCard from '@/components/KpiCard';
import { formatDate, formatNumber, statutCommandeLabel } from '@/lib/utils';
import type { DashboardKpis, Entrepot, Article } from '@/lib/types';

const PIE_COLORS = ['#f59e0b', '#f97316', '#10b981', '#1a56db', '#8b5cf6', '#ef4444'];

export default function Dashboard() {
  const [filterMois, setFilterMois] = useState('');
  const [filterEntrepot, setFilterEntrepot] = useState('');
  const [filterArticle, setFilterArticle] = useState('');

  const params: Record<string, string> = {};
  if (filterMois) params.mois = filterMois;
  if (filterEntrepot) params.entrepotId = filterEntrepot;
  if (filterArticle) params.articleId = filterArticle;

  const { data: kpis } = useQuery<DashboardKpis>({
    queryKey: ['dashboard-kpis', filterMois, filterEntrepot, filterArticle],
    queryFn: () => dashboardApi.kpis(params),
    refetchInterval: 30_000,
  });

  const { data: evolution = [] } = useQuery<{ date: string; entrees: number; sorties: number }[]>({
    queryKey: ['dashboard-evolution', filterMois, filterEntrepot, filterArticle],
    queryFn: () => dashboardApi.evolution(params),
  });

  const { data: departements = [] } = useQuery<{ departement: string; volume: number }[]>({
    queryKey: ['dashboard-departements', filterMois, filterEntrepot],
    queryFn: () => dashboardApi.departements(params),
  });

  const { data: demandeurs = [] } = useQuery<{ demandeur: string; commandes: number }[]>({
    queryKey: ['dashboard-demandeurs', filterMois],
    queryFn: () => dashboardApi.demandeurs(filterMois ? { mois: filterMois } : {}),
  });

  const { data: delais } = useQuery<{
    receptionToTraitement: number | null;
    traitementToExpedition: number | null;
    expeditionToLivraison: number | null;
  }>({
    queryKey: ['dashboard-delais'],
    queryFn: dashboardApi.delais,
    refetchInterval: 60_000,
  });

  const { data: topArticles = [] } = useQuery<{ nom: string; reference: string; volume: number }[]>({
    queryKey: ['dashboard-top-articles'],
    queryFn: () => dashboardApi.topArticles(),
  });

  const { data: commandesStats = [] } = useQuery<{ statut: string; count: number }[]>({
    queryKey: ['dashboard-commandes'],
    queryFn: () => dashboardApi.commandes(),
    refetchInterval: 15_000,
  });

  const { data: entrepots = [] } = useQuery<Entrepot[]>({
    queryKey: ['entrepots'],
    queryFn: () => entrepotsApi.list(),
  });

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ['articles'],
    queryFn: () => articlesApi.list(),
  });

  const { data: alertesInventaire = [] } = useQuery<any[]>({
    queryKey: ['inventaires-alertes'],
    queryFn: inventairesApi.alertes,
    refetchInterval: 60_000,
  });
  const alertesInvActives = alertesInventaire.filter((a: any) => a.enAlerte);

  const delaiLabel = (d: number | null | undefined) =>
    d == null ? '—' : d < 1 ? `${Math.round(d * 24)}h` : `${d}j`;

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Filtrer :</span>
        <input type="month" value={filterMois} onChange={e => setFilterMois(e.target.value)}
          className="px-3 py-1 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
        <select value={filterEntrepot} onChange={e => setFilterEntrepot(e.target.value)}
          className="px-3 py-1 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Tous entrepôts</option>
          {entrepots.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <select value={filterArticle} onChange={e => setFilterArticle(e.target.value)}
          className="px-3 py-1 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">Tous articles</option>
          {articles.filter(a => a.actif).map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </select>
        {(filterMois || filterEntrepot || filterArticle) && (
          <button onClick={() => { setFilterMois(''); setFilterEntrepot(''); setFilterArticle(''); }}
            className="px-2.5 py-1 text-xs text-muted-foreground border border-border rounded-lg hover:bg-muted">
            ✕ Réinitialiser
          </button>
        )}
        {filterMois && (
          <span className="text-xs text-primary font-medium ml-1">
            {new Date(filterMois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </span>
        )}
        {filterArticle && (
          <span className="text-xs text-orange-600 font-medium ml-1">
            📦 {articles.find(a => a.id === filterArticle)?.nom ?? 'Article'}
          </span>
        )}
      </div>

      {alertesInvActives.length > 0 && (
        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-800 dark:text-red-300">
            <p className="font-semibold">{alertesInvActives.length} entrepôt(s) sans inventaire depuis +3 mois</p>
            <p className="mt-0.5 text-red-600 dark:text-red-400">
              {alertesInvActives.map((a: any) => a.entrepot.code).join(', ')} — Aller dans <strong>Inventaire</strong> pour régulariser.
            </p>
          </div>
        </div>
      )}

      {/* KPIs stock */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Entrées stock" value={kpis?.totalEntrees ?? 0} icon={TrendingUp} variant="success" />
        <KpiCard title="Sorties stock" value={kpis?.totalSorties ?? 0} icon={TrendingDown} variant="info" />
        <KpiCard title="Solde net" value={kpis?.soldeNet ?? 0} icon={Activity} variant={kpis?.soldeNet != null && kpis.soldeNet < 0 ? 'danger' : 'default'} />
        <KpiCard title="Alertes stock" value={kpis?.stocksEnAlerte ?? 0} icon={AlertTriangle} variant={kpis?.stocksEnAlerte && kpis.stocksEnAlerte > 0 ? 'warning' : 'success'} />
      </div>

      {/* KPIs commandes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Cmd en attente" value={kpis?.commandesEnAttente ?? 0} icon={ClipboardList} variant={kpis?.commandesEnAttente && kpis.commandesEnAttente > 0 ? 'warning' : 'success'} />
        <KpiCard title="Cmd expédiées" value={kpis?.commandesExpediees ?? 0} icon={Truck} variant="info" />
        <KpiCard title="Cmd livrées" value={kpis?.commandesLivrees ?? 0} icon={CheckCircle} variant="success" />
        <KpiCard
          title="Taux de traitement"
          value={kpis?.commandesTotal ? `${Math.round(((kpis.commandesTraitees ?? 0) / kpis.commandesTotal) * 100)}%` : '—'}
          icon={Activity}
          variant="success"
        />
      </div>

      {/* KPIs délais */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Délai moyen réception → traitement', value: delaiLabel(delais?.receptionToTraitement), desc: 'Log1 validation', color: 'text-blue-600' },
          { label: 'Délai moyen traitement → expédition', value: delaiLabel(delais?.traitementToExpedition), desc: 'Log2 préparation', color: 'text-purple-600' },
          { label: 'Délai moyen expédition → livraison', value: delaiLabel(delais?.expeditionToLivraison), desc: 'Transport', color: 'text-green-600' },
        ].map(d => (
          <div key={d.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{d.label}</p>
              <p className={`text-lg font-bold ${d.color}`}>{d.value}</p>
              <p className="text-xs text-muted-foreground">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Graphiques row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Évolution entrées / sorties</h3>
          {evolution.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={evolution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={d => formatDate(d, 'dd/MM')} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatNumber(v)} labelFormatter={d => formatDate(d, 'dd/MM/yyyy')} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="entrees" name="Entrées" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sorties" name="Sorties" stroke="#1a56db" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Statuts commandes</h3>
          {commandesStats.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune commande</p>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={commandesStats} dataKey="count" nameKey="statut" cx="50%" cy="50%" outerRadius={65} label={({ count }) => count}>
                  {commandesStats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, name) => [v, statutCommandeLabel(String(name))]} />
                <Legend formatter={v => statutCommandeLabel(v)} iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Graphiques row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Volume sorties par département</h3>
          {departements.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={departements} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="departement" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Bar dataKey="volume" name="Quantité" fill="#1a56db" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Volume par demandeur */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Commandes par demandeur</h3>
          {demandeurs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune donnée</p>
          ) : (
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={demandeurs} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="demandeur" type="category" tick={{ fontSize: 9 }} width={55} />
                <Tooltip />
                <Bar dataKey="commandes" name="Commandes" fill="#f97316" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top articles */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Top 5 articles les plus demandés</h3>
        {topArticles.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-2">
            {topArticles.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.nom}</p>
                  <p className="text-xs text-muted-foreground">{a.reference}</p>
                </div>
                <span className="text-xs font-bold text-primary">{formatNumber(a.volume)}</span>
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(a.volume / (topArticles[0]?.volume || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
