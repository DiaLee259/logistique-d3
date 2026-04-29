import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, Package, Truck, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { commandesApi, livraisonsApi, commandesTSApi } from '@/lib/api';
import { cn, formatDate, formatDateTime } from '@/lib/utils';

type CorbeilleItem = {
  id: string;
  type: 'COMMANDE' | 'LIVRAISON' | 'COMMANDE_TS';
  numero: string;
  label: string;
  sublabel: string;
  deletedAt: string;
  deletedByName: string;
};

export default function Corbeille() {
  const qc = useQueryClient();

  const { data: commandes = [], isLoading: l1 } = useQuery({
    queryKey: ['corbeille-commandes'],
    queryFn: commandesApi.corbeille,
  });

  const { data: livraisons = [], isLoading: l2 } = useQuery({
    queryKey: ['corbeille-livraisons'],
    queryFn: livraisonsApi.corbeille,
  });

  const { data: commandesTS = [], isLoading: l3 } = useQuery({
    queryKey: ['corbeille-commandes-ts'],
    queryFn: commandesTSApi.corbeille,
  });

  const restaurerCmdMut = useMutation({
    mutationFn: (id: string) => commandesApi.restaurer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corbeille-commandes'] });
      qc.invalidateQueries({ queryKey: ['commandes'] });
      toast.success('Commande restaurée');
    },
  });

  const restaurerLivMut = useMutation({
    mutationFn: (id: string) => livraisonsApi.restaurer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corbeille-livraisons'] });
      qc.invalidateQueries({ queryKey: ['livraisons'] });
      toast.success('Livraison restaurée');
    },
  });

  const restaurerTSMut = useMutation({
    mutationFn: (id: string) => commandesTSApi.restaurer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['corbeille-commandes-ts'] });
      qc.invalidateQueries({ queryKey: ['commandes-ts'] });
      toast.success('Commande TS restaurée');
    },
  });

  const isLoading = l1 || l2 || l3;

  // Fusionner et trier par date suppression
  const items: CorbeilleItem[] = [
    ...(commandes as any[]).map(c => ({
      id: c.id,
      type: 'COMMANDE' as const,
      numero: c.numero,
      label: `Dept. ${c.departement}${c.demandeur ? ` — ${c.demandeur}` : ''}${c.societe ? ` (${c.societe})` : ''}`,
      sublabel: `${c.lignes?.length ?? 0} article(s)`,
      deletedAt: c.deletedAt,
      deletedByName: c.deletedByName ?? 'Inconnu',
    })),
    ...(livraisons as any[]).map(l => ({
      id: l.id,
      type: 'LIVRAISON' as const,
      numero: l.numero,
      label: l.fournisseur,
      sublabel: formatDate(l.dateLivraison),
      deletedAt: l.deletedAt,
      deletedByName: l.deletedByName ?? 'Inconnu',
    })),
    ...(commandesTS as any[]).map(c => ({
      id: c.id,
      type: 'COMMANDE_TS' as const,
      numero: c.numero,
      label: c.titre,
      sublabel: `${formatDate(c.dateDebut)} → ${formatDate(c.dateFin)}`,
      deletedAt: c.deletedAt,
      deletedByName: c.deletedByName ?? 'Inconnu',
    })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const typeConfig = {
    COMMANDE: { icon: Package, label: 'Commande', color: 'bg-blue-100 text-blue-700' },
    LIVRAISON: { icon: Truck, label: 'Livraison', color: 'bg-orange-100 text-orange-700' },
    COMMANDE_TS: { icon: CalendarRange, label: 'Commande TS', color: 'bg-purple-100 text-purple-700' },
  };

  const handleRestaurer = (item: CorbeilleItem) => {
    if (item.type === 'COMMANDE') restaurerCmdMut.mutate(item.id);
    else if (item.type === 'LIVRAISON') restaurerLivMut.mutate(item.id);
    else restaurerTSMut.mutate(item.id);
  };

  const isPending = restaurerCmdMut.isPending || restaurerLivMut.isPending || restaurerTSMut.isPending;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-base font-bold">Corbeille</h1>
          <p className="text-xs text-muted-foreground">
            {items.length} élément{items.length !== 1 ? 's' : ''} supprimé{items.length !== 1 ? 's' : ''} — restauration possible
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Trash2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">La corbeille est vide</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Les éléments supprimés apparaîtront ici</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Type', 'Référence', 'Détail', 'Supprimé par', 'Supprimé le', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const conf = typeConfig[item.type];
                const Icon = conf.icon;
                return (
                  <tr key={`${item.type}-${item.id}`} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', conf.color)}>
                        <Icon className="w-3 h-3" />
                        {conf.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-primary">{item.numero}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground truncate max-w-[200px]">{item.label}</p>
                      <p className="text-muted-foreground">{item.sublabel}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.deletedByName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(item.deletedAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => handleRestaurer(item)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restaurer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
