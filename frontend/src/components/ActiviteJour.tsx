import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ChevronLeft, ChevronRight, CalendarDays, Users } from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { cn, formatDate, formatNumber, statutCommandeLabel, statutCommandeColor } from '@/lib/utils';

type CommandeJour = {
  numero: string;
  demandeur: string | null;
  departement: string;
  statut: string;
  evenements: string[];
  dateReception: string | null;
  dateTraitement: string | null;
  dateExpedition: string | null;
  dateLivraison: string | null;
  dureeJours: number | null;
  ageJours: number | null;
};

type ActiviteJourData = {
  jour: string;
  compteurs: {
    recues: number; valideesLog1: number; expediees: number;
    livrees: number; refusees: number; annulees: number;
  };
  parLogisticien: { nom: string; validees: number; expediees: number; total: number }[];
  commandes: CommandeJour[];
};

/** Libellé + couleur des badges d'événements du jour. */
const EVENEMENTS: Record<string, { label: string; classe: string }> = {
  RECUE:    { label: 'Reçue',       classe: 'bg-sky-100 text-sky-800 border-sky-200' },
  VALIDEE:  { label: 'Validée Log1', classe: 'bg-blue-100 text-blue-800 border-blue-200' },
  EXPEDIEE: { label: 'Expédiée',    classe: 'bg-purple-100 text-purple-800 border-purple-200' },
  LIVREE:   { label: 'Livrée',      classe: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  REFUSEE:  { label: 'Refusée',     classe: 'bg-red-100 text-red-800 border-red-300' },
  ANNULEE:  { label: 'Annulée',     classe: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/** Date locale au format YYYY-MM-DD (toISOString serait en UTC : faux avant 2h du matin). */
function dateLocale(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function decaleJour(jour: string, delta: number) {
  const d = new Date(jour + 'T12:00:00'); // midi : à l'abri des bascules DST
  d.setDate(d.getDate() + delta);
  return dateLocale(d);
}

export default function ActiviteJour({ params }: { params: Record<string, string> }) {
  const aujourdHui = dateLocale(new Date());
  const [jour, setJour] = useState(aujourdHui);

  const { data, isLoading } = useQuery<ActiviteJourData>({
    queryKey: ['dashboard-activite-jour', jour, JSON.stringify(params)],
    queryFn: () => dashboardApi.activiteJour({ ...params, date: jour }),
    refetchInterval: 60_000,
  });

  const c = data?.compteurs;

  return (
    <div className="space-y-4">
      {/* Sélecteur de jour */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 w-fit">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <button
          onClick={() => setJour(j => decaleJour(j, -1))}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          title="Jour précédent">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          type="date"
          value={jour}
          max={aujourdHui}
          onChange={e => e.target.value && setJour(e.target.value)}
          className="px-3 py-1 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          onClick={() => setJour(j => decaleJour(j, 1))}
          disabled={jour >= aujourdHui}
          className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
          title="Jour suivant">
          <ChevronRight className="w-4 h-4" />
        </button>
        {jour !== aujourdHui && (
          <button
            onClick={() => setJour(aujourdHui)}
            className="px-2 py-1 text-xs rounded-lg border border-border hover:bg-muted text-muted-foreground">
            Aujourd'hui
          </button>
        )}
      </div>

      {isLoading || !data ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement de l'activité…
        </div>
      ) : (
        <>
          {/* Compteurs d'événements du jour */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Reçues', valeur: c!.recues, couleur: 'text-sky-600 dark:text-sky-400' },
              { label: 'Validées Log1', valeur: c!.valideesLog1, couleur: 'text-blue-600 dark:text-blue-400' },
              { label: 'Expédiées', valeur: c!.expediees, couleur: 'text-purple-600 dark:text-purple-400' },
              { label: 'Livrées', valeur: c!.livrees, couleur: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Refusées', valeur: c!.refusees, couleur: 'text-red-600 dark:text-red-400' },
              {
                label: 'Annulées', valeur: c!.annulees, couleur: 'text-muted-foreground',
                titre: "Approximation : l'annulation n'enregistre pas de date propre (basée sur la dernière modification de la commande)",
              },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3" title={(k as any).titre}>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  {k.label}{(k as any).titre ? ' *' : ''}
                </p>
                <p className={cn('text-xl font-bold mt-0.5 tabular-nums', k.couleur)}>{formatNumber(k.valeur)}</p>
              </div>
            ))}
          </div>

          {/* Activité par logisticien */}
          {data.parLogisticien.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <Users className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activité par logisticien</p>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Logisticien</th>
                    <th className="px-4 py-2 text-right font-medium">Validées Log1</th>
                    <th className="px-4 py-2 text-right font-medium">Expédiées</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parLogisticien.map((l, i) => (
                    <tr key={l.nom} className={cn('border-t border-border', i % 2 === 1 && 'bg-muted/20')}>
                      <td className="px-4 py-2 font-medium">{l.nom}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{l.validees || '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-purple-600 dark:text-purple-400">{l.expediees || '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{l.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
                Les refus et les confirmations de livraison ne sont pas attribués : l'application n'enregistre pas leur auteur.
              </p>
            </div>
          )}

          {/* Détail des commandes touchées dans la journée */}
          {data.commandes.length === 0 ? (
            <div className="bg-card border border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
              Aucune activité commande sur cette journée.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">N° Commande</th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Demandeur</th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Dép.</th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Statut</th>
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Événements du jour</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Réception</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Validé Log1</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Expédié</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Livré</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap" title="Durée réception → livraison ; pour une commande non livrée, ancienneté depuis la réception">Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commandes.map((cmd, i) => (
                      <tr key={cmd.numero} className={cn('border-t border-border', i % 2 === 1 && 'bg-muted/20')}>
                        <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">{cmd.numero}</td>
                        <td className="px-3 py-2 max-w-[160px] truncate" title={cmd.demandeur ?? ''}>{cmd.demandeur || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{cmd.departement}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={cn('px-1.5 py-0.5 rounded border text-[11px] font-medium', statutCommandeColor(cmd.statut))}>
                            {statutCommandeLabel(cmd.statut)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {cmd.evenements.map(ev => (
                              <span key={ev} className={cn('px-1.5 py-0.5 rounded border text-[11px] font-medium whitespace-nowrap', EVENEMENTS[ev]?.classe)}>
                                {EVENEMENTS[ev]?.label ?? ev}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{cmd.dateReception ? formatDate(cmd.dateReception) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{cmd.dateTraitement ? formatDate(cmd.dateTraitement) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{cmd.dateExpedition ? formatDate(cmd.dateExpedition) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{cmd.dateLivraison ? formatDate(cmd.dateLivraison) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {cmd.dureeJours != null ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{cmd.dureeJours} j</span>
                          ) : cmd.ageJours != null ? (
                            <span className={cn('font-medium', cmd.ageJours > 7 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
                              en cours · {cmd.ageJours} j
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
