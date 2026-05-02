import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Users, Building2, User } from 'lucide-react';
import { repertoireApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface IntervenantWithStats {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  societeId?: string;
  actif: boolean;
  autoEntrepreneur: boolean;
  societe?: { id: string; nom: string; code?: string };
  nbCommandes: number;
  totalArticles: number;
}

interface ArticleStat {
  articleId: string;
  nom: string;
  reference: string;
  unite: string;
  quantiteEnvoyee: number;
}

interface IntervenantDetail {
  intervenant: {
    id: string;
    nom: string;
    prenom: string;
    societe?: { nom: string } | null;
    autoEntrepreneur: boolean;
  };
  stats: {
    nbCommandes: number;
    articles: ArticleStat[];
  };
}

interface PrestataireStat {
  key: string;
  type: 'societe' | 'demandeur';
  nbCommandes: number;
  totalDemande: number;
  totalValide: number;
  totalFourni: number;
  articles: {
    articleId: string;
    nom: string;
    reference: string;
    unite: string;
    quantiteDemandee: number;
    quantiteValidee: number;
    quantiteFournie: number;
  }[];
}

// ── Composants ─────────────────────────────────────────────────────────────────

function TypeBadge({ autoEntrepreneur }: { autoEntrepreneur: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      autoEntrepreneur
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    )}>
      {autoEntrepreneur ? 'Auto-entrepreneur' : 'Prestataire'}
    </span>
  );
}

function SourceBadge({ type }: { type: 'societe' | 'demandeur' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      type === 'societe'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    )}>
      {type === 'societe'
        ? <><Building2 className="w-2.5 h-2.5" /> Société</>
        : <><User className="w-2.5 h-2.5" /> Demandeur</>}
    </span>
  );
}

// ── Onglet Par intervenant ─────────────────────────────────────────────────────

function OngletIntervenants() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'tous' | 'auto' | 'prestataire'>('tous');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: intervenants = [], isLoading } = useQuery<IntervenantWithStats[]>({
    queryKey: ['intervenants-stats'],
    queryFn: () => repertoireApi.statsIntervenants(),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<IntervenantDetail>({
    queryKey: ['intervenant-detail', selectedId],
    queryFn: () => repertoireApi.statsIntervenant(selectedId!),
    enabled: !!selectedId,
  });

  const filtered = intervenants.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.nom.toLowerCase().includes(q) || i.prenom.toLowerCase().includes(q) || (i.societe?.nom ?? '').toLowerCase().includes(q);
    const matchType = filterType === 'tous' || (filterType === 'auto' && i.autoEntrepreneur) || (filterType === 'prestataire' && !i.autoEntrepreneur);
    return matchSearch && matchType;
  });

  return (
    <>
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, société…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
          {(['tous', 'auto', 'prestataire'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', filterType === t ? 'bg-primary text-white font-medium' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'tous' ? 'Tous' : t === 'auto' ? 'Auto-entrepreneur' : 'Prestataire'}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Intervenant', 'Société', 'Type', 'Commandes', 'Articles envoyés', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />Aucun intervenant trouvé
                </td></tr>
              ) : filtered.map(i => (
                <tr key={i.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{i.prenom} {i.nom}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{i.societe?.nom ?? '—'}</td>
                  <td className="px-3 py-2.5"><TypeBadge autoEntrepreneur={i.autoEntrepreneur} /></td>
                  <td className="px-3 py-2.5 text-center font-medium">{i.nbCommandes > 0 ? i.nbCommandes : <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-3 py-2.5 text-center font-medium">{i.totalArticles > 0 ? i.totalArticles : <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setSelectedId(i.id)}
                      className="px-2.5 py-1.5 text-xs border border-border rounded-lg hover:border-primary hover:text-primary transition-colors bg-card">
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-border">
            <p className="text-xs text-muted-foreground">{filtered.length} intervenant(s)</p>
          </div>
        )}
      </div>

      {/* Dialog détail intervenant */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              {detailLoading ? <p className="text-sm font-semibold text-muted-foreground">Chargement…</p> : detail ? (
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">{detail.intervenant.prenom} {detail.intervenant.nom}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {detail.intervenant.societe && <span className="text-xs text-muted-foreground">{detail.intervenant.societe.nom}</span>}
                    <TypeBadge autoEntrepreneur={detail.intervenant.autoEntrepreneur} />
                    <span className="text-xs text-muted-foreground">· {detail.stats.nbCommandes} commande(s)</span>
                  </div>
                </div>
              ) : null}
              <button onClick={() => setSelectedId(null)} className="p-1 hover:bg-muted rounded ml-4 flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
            {detail && !detailLoading && (
              <div className="p-5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Articles envoyés</h3>
                {detail.stats.articles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Aucun article envoyé</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Référence</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Désignation</th>
                          <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Envoyé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.stats.articles.map(a => (
                          <tr key={a.articleId} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{a.reference}</td>
                            <td className="px-3 py-2 font-medium">{a.nom}</td>
                            <td className="px-3 py-2 text-right font-semibold text-primary">{a.quantiteEnvoyee} {a.unite}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {detailLoading && <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
          </div>
        </div>
      )}
    </>
  );
}

// ── Onglet Par prestataire (société / demandeur des commandes) ─────────────────

function OngletPrestataires() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'tous' | 'societe' | 'demandeur'>('tous');
  const [selected, setSelected] = useState<PrestataireStat | null>(null);

  const { data: prestataires = [], isLoading } = useQuery<PrestataireStat[]>({
    queryKey: ['stats-prestataires'],
    queryFn: () => repertoireApi.statsPrestataires(),
  });

  const filtered = prestataires.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.key.toLowerCase().includes(q);
    const matchType = filterType === 'tous' || p.type === filterType;
    return matchSearch && matchType;
  });

  const totalCmds = filtered.reduce((s, p) => s + p.nbCommandes, 0);

  return (
    <>
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher société / demandeur…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
          {(['tous', 'societe', 'demandeur'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn('px-3 py-1.5 text-xs rounded-md transition-colors', filterType === t ? 'bg-primary text-white font-medium' : 'text-muted-foreground hover:text-foreground')}>
              {t === 'tous' ? 'Tous' : t === 'societe' ? 'Sociétés' : 'Demandeurs'}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Prestataire / Demandeur', 'Type', 'Commandes', 'Qté demandée', 'Qté validée', 'Qté livrée', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />Aucun prestataire trouvé
                </td></tr>
              ) : filtered.map(p => (
                <tr key={p.key} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{p.key}</td>
                  <td className="px-3 py-2.5"><SourceBadge type={p.type} /></td>
                  <td className="px-3 py-2.5 text-center font-semibold">{p.nbCommandes}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{p.totalDemande || '—'}</td>
                  <td className="px-3 py-2.5 text-center text-blue-600 dark:text-blue-400 font-medium">{p.totalValide || '—'}</td>
                  <td className="px-3 py-2.5 text-center text-green-700 dark:text-green-400 font-medium">{p.totalFourni || '—'}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setSelected(p)}
                      className="px-2.5 py-1.5 text-xs border border-border rounded-lg hover:border-primary hover:text-primary transition-colors bg-card">
                      Détail articles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-3 py-2 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{filtered.length} prestataire(s) · {totalCmds} commande(s)</p>
          </div>
        )}
      </div>

      {/* Dialog détail prestataire */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">{selected.key}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <SourceBadge type={selected.type} />
                  <span className="text-xs text-muted-foreground">· {selected.nbCommandes} commande(s)</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded ml-4 flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* KPIs résumé */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Qté demandée', value: selected.totalDemande, color: 'text-foreground' },
                  { label: 'Qté validée', value: selected.totalValide, color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Qté livrée', value: selected.totalFourni, color: 'text-green-700 dark:text-green-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className={cn('text-lg font-bold', color)}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tableau articles */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Détail par article</h3>
                {selected.articles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Aucun article</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Réf.</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Désignation</th>
                          <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Dem.</th>
                          <th className="text-right px-3 py-2 font-semibold text-muted-foreground text-blue-600 dark:text-blue-400">Val.</th>
                          <th className="text-right px-3 py-2 font-semibold text-muted-foreground text-green-700 dark:text-green-400">Livré</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.articles.map(a => (
                          <tr key={a.articleId} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                            <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">{a.reference}</td>
                            <td className="px-3 py-2 font-medium">{a.nom}</td>
                            <td className="px-3 py-2 text-right">{a.quantiteDemandee} <span className="text-muted-foreground">{a.unite}</span></td>
                            <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400 font-medium">{a.quantiteValidee || '—'}</td>
                            <td className="px-3 py-2 text-right text-green-700 dark:text-green-400 font-medium">{a.quantiteFournie || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function Intervenants() {
  const [onglet, setOnglet] = useState<'intervenants' | 'prestataires'>('intervenants');

  return (
    <div className="space-y-3">
      {/* Onglets */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setOnglet('intervenants')}
          className={cn(
            'px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
            onglet === 'intervenants'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Par intervenant
        </button>
        <button
          onClick={() => setOnglet('prestataires')}
          className={cn(
            'px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
            onglet === 'prestataires'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Par prestataire / demandeur
        </button>
      </div>

      {onglet === 'intervenants' ? <OngletIntervenants /> : <OngletPrestataires />}
    </div>
  );
}
