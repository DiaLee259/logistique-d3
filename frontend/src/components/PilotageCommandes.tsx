import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';

type LignePilotage = {
  libelle: string;
  total: number;
  enAttente: number;
  enCours: number;
  livrees: number;
  refusees: number;
  annulees: number;
  grilles: number;
  tauxLivraison: number | null;
  delaiTraitement: number | null;
  delaiExpedition: number | null;
  delaiLivraison: number | null;
  delaiTotal: number | null;
  attenteMax: number | null;
};

type Pilotage = {
  totaux: {
    total: number; enAttente: number; enCours: number;
    livrees: number; refusees: number; annulees: number; tauxLivraison: number | null;
  };
  parDepartement: LignePilotage[];
  parDemandeur: LignePilotage[];
  parSociete: LignePilotage[];
  parManager: LignePilotage[];
};

const DIMENSIONS = [
  { id: 'parDepartement', label: 'Par département', entete: 'Département' },
  { id: 'parDemandeur', label: 'Par demandeur', entete: 'Demandeur' },
  { id: 'parSociete', label: 'Par société', entete: 'Société' },
  { id: 'parManager', label: 'Par manager', entete: 'Manager' },
] as const;

type DimensionId = typeof DIMENSIONS[number]['id'];

const jour = (v: number | null) => (v == null ? '—' : v < 1 ? `${Math.round(v * 24)}h` : `${v}j`);

/** Vert au-dessus de 90 %, ambre à partir de 70 %, rouge en dessous. */
function couleurTaux(taux: number | null) {
  if (taux == null) return 'text-muted-foreground';
  if (taux >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (taux >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export default function PilotageCommandes({ params }: { params: Record<string, string> }) {
  const [dimension, setDimension] = useState<DimensionId>('parDepartement');
  const [triParAttente, setTriParAttente] = useState(false);

  const { data, isLoading } = useQuery<Pilotage>({
    queryKey: ['dashboard-pilotage', JSON.stringify(params)],
    queryFn: () => dashboardApi.pilotage(params),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement du pilotage…
      </div>
    );
  }

  if (!data || data.totaux.total === 0) {
    return (
      <div className="bg-card border border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
        Aucune commande sur la période sélectionnée.
      </div>
    );
  }

  const config = DIMENSIONS.find(d => d.id === dimension)!;
  const lignes = [...data[dimension]];
  if (triParAttente) {
    // Les dossiers bloqués passent devant : c'est là qu'il faut agir.
    lignes.sort((a, b) => (b.attenteMax ?? -1) - (a.attenteMax ?? -1));
  }

  const t = data.totaux;
  const cellule = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

  return (
    <div className="space-y-4">
      {/* Totaux du périmètre */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', valeur: t.total, couleur: 'text-foreground' },
          { label: 'En attente', valeur: t.enAttente, couleur: 'text-amber-600 dark:text-amber-400' },
          { label: 'En cours', valeur: t.enCours, couleur: 'text-blue-600 dark:text-blue-400' },
          { label: 'Livrées', valeur: t.livrees, couleur: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Refusées', valeur: t.refusees, couleur: 'text-red-600 dark:text-red-400' },
          { label: 'Annulées', valeur: t.annulees, couleur: 'text-muted-foreground' },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
            <p className={cn('text-xl font-bold mt-0.5 tabular-nums', k.couleur)}>{formatNumber(k.valeur)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {DIMENSIONS.map(d => (
            <button
              key={d.id}
              onClick={() => setDimension(d.id)}
              className={cn(
                'px-3 py-1 text-xs rounded font-medium transition-colors',
                dimension === d.id ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}>
              {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setTriParAttente(p => !p)}
          title="Faire remonter les lignes dont le dossier ouvert le plus ancien attend le plus longtemps"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
            triParAttente
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}>
          <AlertTriangle className="w-3.5 h-3.5" />
          Trier par ancienneté du backlog
        </button>

        <span className="ml-auto text-xs text-muted-foreground">
          Taux de livraison global{' '}
          <strong className={couleurTaux(t.tauxLivraison)}>
            {t.tauxLivraison == null ? '—' : `${t.tauxLivraison} %`}
          </strong>
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">{config.entete}</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">En attente</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">En cours</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Livrées</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Refusées</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Annulées</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Grilles</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Taux livr.</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground" title="Réception → Traitement">Récep.→Trait.</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground" title="Traitement → Expédition">Trait.→Expéd.</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground" title="Expédition → Livraison">Expéd.→Livr.</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground" title="Réception → Livraison">Délai total</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground" title="Ancienneté du dossier ouvert le plus ancien">Backlog max</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.libelle} className={cn('border-t border-border', i % 2 === 1 && 'bg-muted/20')}>
                  <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[220px] truncate" title={l.libelle}>{l.libelle}</td>
                  <td className={cn(cellule, 'font-semibold')}>{formatNumber(l.total)}</td>
                  <td className={cn(cellule, l.enAttente > 0 && 'text-amber-600 dark:text-amber-400 font-medium')}>{l.enAttente || '—'}</td>
                  <td className={cn(cellule, l.enCours > 0 && 'text-blue-600 dark:text-blue-400')}>{l.enCours || '—'}</td>
                  <td className={cn(cellule, 'text-emerald-600 dark:text-emerald-400')}>{l.livrees || '—'}</td>
                  <td className={cn(cellule, l.refusees > 0 && 'text-red-600 dark:text-red-400')}>{l.refusees || '—'}</td>
                  <td className={cn(cellule, 'text-muted-foreground')}>{l.annulees || '—'}</td>
                  <td className={cn(cellule, 'text-muted-foreground')}>{l.grilles ? formatNumber(l.grilles) : '—'}</td>
                  <td className={cn(cellule, 'font-semibold', couleurTaux(l.tauxLivraison))}>
                    {l.tauxLivraison == null ? '—' : `${l.tauxLivraison} %`}
                  </td>
                  <td className={cn(cellule, 'text-muted-foreground')}>{jour(l.delaiTraitement)}</td>
                  <td className={cn(cellule, 'text-muted-foreground')}>{jour(l.delaiExpedition)}</td>
                  <td className={cn(cellule, 'text-muted-foreground')}>{jour(l.delaiLivraison)}</td>
                  <td className={cn(cellule, 'font-medium')}>{jour(l.delaiTotal)}</td>
                  <td className={cn(cellule, l.attenteMax != null && l.attenteMax > 15 && 'text-red-600 dark:text-red-400 font-semibold')}>
                    {jour(l.attenteMax)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground px-1">
        <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span>
          Le <strong>taux de livraison</strong> exclut les commandes refusées et annulées, qui n'avaient pas vocation à être livrées.
          Le <strong>backlog max</strong> donne l'ancienneté du dossier encore ouvert le plus ancien : une moyenne masquerait un dossier bloqué.
        </span>
      </p>
    </div>
  );
}
