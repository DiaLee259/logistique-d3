import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Users } from 'lucide-react';
import { repertoireApi } from '@/lib/api';
import { cn } from '@/lib/utils';

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

export default function Intervenants() {
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
    const matchSearch =
      !q ||
      i.nom.toLowerCase().includes(q) ||
      i.prenom.toLowerCase().includes(q) ||
      (i.societe?.nom ?? '').toLowerCase().includes(q);
    const matchType =
      filterType === 'tous' ||
      (filterType === 'auto' && i.autoEntrepreneur) ||
      (filterType === 'prestataire' && !i.autoEntrepreneur);
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-40">
          <h1 className="text-sm font-semibold text-foreground whitespace-nowrap">
            Intervenants
            {intervenants.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                {intervenants.length}
              </span>
            )}
          </h1>
        </div>

        <div className="relative min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, société…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-card">
          {(['tous', 'auto', 'prestataire'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-colors',
                filterType === t
                  ? 'bg-primary text-white font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'tous' ? 'Tous' : t === 'auto' ? 'Auto-entrepreneur' : 'Prestataire'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Nom', 'Prénom', 'Société', 'Type', 'Nb commandes', 'Articles envoyés', 'Consommation', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">Chargement…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucun intervenant trouvé
                  </td>
                </tr>
              ) : filtered.map(i => (
                <tr key={i.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{i.nom}</td>
                  <td className="px-3 py-2.5">{i.prenom}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{i.societe?.nom ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <TypeBadge autoEntrepreneur={i.autoEntrepreneur} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn(
                      'font-medium',
                      i.nbCommandes > 0 ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {i.nbCommandes}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn(
                      'font-medium',
                      i.totalArticles > 0 ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {i.totalArticles}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground italic">— (bientôt disponible)</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setSelectedId(i.id)}
                      className="px-2.5 py-1.5 text-xs border border-border rounded-lg hover:border-primary hover:text-primary transition-colors bg-card"
                    >
                      Voir le détail
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

      {/* Dialog détail */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
            {/* Header dialog */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div>
                {detailLoading ? (
                  <p className="text-sm font-semibold text-muted-foreground">Chargement…</p>
                ) : detail ? (
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">
                      {detail.intervenant.prenom} {detail.intervenant.nom}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      {detail.intervenant.societe && (
                        <span className="text-xs text-muted-foreground">{detail.intervenant.societe.nom}</span>
                      )}
                      <TypeBadge autoEntrepreneur={detail.intervenant.autoEntrepreneur} />
                      <span className="text-xs text-muted-foreground">
                        · {detail.stats.nbCommandes} commande(s)
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="p-1 hover:bg-muted rounded transition-colors ml-4 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps dialog */}
            {detail && !detailLoading && (
              <div className="p-5 space-y-4">
                {/* Articles envoyés */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Articles envoyés
                  </h3>
                  {detail.stats.articles.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">Aucun article envoyé pour cet intervenant</p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Référence</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Désignation</th>
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Unité</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Qté envoyée</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.stats.articles.map(a => (
                            <tr key={a.articleId} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                              <td className="px-3 py-2 font-mono text-muted-foreground">{a.reference}</td>
                              <td className="px-3 py-2 font-medium">{a.nom}</td>
                              <td className="px-3 py-2 text-muted-foreground">{a.unite}</td>
                              <td className="px-3 py-2 text-right font-semibold text-primary">{a.quantiteEnvoyee}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section consommation */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Consommation
                  </h3>
                  <div className="bg-muted/20 border border-border/50 rounded-lg px-4 py-3">
                    <p className="text-xs text-muted-foreground italic">
                      Données de consommation non disponibles — fonctionnalité prévue
                    </p>
                  </div>
                </div>
              </div>
            )}

            {detailLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
