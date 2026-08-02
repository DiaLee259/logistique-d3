import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, RotateCcw, Package, Truck, CalendarRange, AlertTriangle, X } from 'lucide-react';
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

type ConfirmDialog = {
  titre: string;
  message: string;
  onConfirm: () => void;
};

const typeConfig = {
  COMMANDE: { icon: Package, label: 'Commande', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  LIVRAISON: { icon: Truck, label: 'Livraison', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  COMMANDE_TS: { icon: CalendarRange, label: 'Commande TS', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

export default function Corbeille() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmDialog | null>(null);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['corbeille-commandes'] });
    qc.invalidateQueries({ queryKey: ['corbeille-livraisons'] });
    qc.invalidateQueries({ queryKey: ['corbeille-commandes-ts'] });
  };

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

  // ── Restauration ──────────────────────────────────────────────────────────

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

  // ── Suppression définitive ────────────────────────────────────────────────

  const supprimerItemMut = useMutation({
    mutationFn: ({ type, id }: { type: CorbeilleItem['type']; id: string }) => {
      if (type === 'COMMANDE') return commandesApi.supprimerDefinitivement(id);
      if (type === 'LIVRAISON') return livraisonsApi.supprimerDefinitivement(id);
      return commandesTSApi.supprimerDefinitivement(id);
    },
    onSuccess: () => {
      invalidateAll();
      setSelected(new Set());
    },
  });

  const viderMut = useMutation({
    mutationFn: () => Promise.all([
      commandesApi.viderCorbeille(),
      livraisonsApi.viderCorbeille(),
      commandesTSApi.viderCorbeille(),
    ]),
    onSuccess: () => {
      invalidateAll();
      setSelected(new Set());
      toast.success('Corbeille vidée');
    },
  });

  const isLoading = l1 || l2 || l3;
  const isBusy = restaurerCmdMut.isPending || restaurerLivMut.isPending || restaurerTSMut.isPending
    || supprimerItemMut.isPending || viderMut.isPending;

  // ── Fusion et tri ─────────────────────────────────────────────────────────

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

  // ── Helpers sélection ─────────────────────────────────────────────────────

  const itemKey = (item: CorbeilleItem) => `${item.type}-${item.id}`;
  const allSelected = items.length > 0 && items.every(i => selected.has(itemKey(i)));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(itemKey)));
    }
  };

  const toggleItem = (item: CorbeilleItem) => {
    const key = itemKey(item);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRestaurer = (item: CorbeilleItem) => {
    if (item.type === 'COMMANDE') restaurerCmdMut.mutate(item.id);
    else if (item.type === 'LIVRAISON') restaurerLivMut.mutate(item.id);
    else restaurerTSMut.mutate(item.id);
  };

  const handleSupprimerItem = (item: CorbeilleItem) => {
    setConfirm({
      titre: 'Supprimer définitivement',
      message: `"${item.numero}" sera supprimé définitivement et ne pourra plus être restauré.`,
      onConfirm: () => {
        supprimerItemMut.mutate({ type: item.type, id: item.id }, {
          onSuccess: () => toast.success(`${item.numero} supprimé définitivement`),
        });
        setConfirm(null);
      },
    });
  };

  const handleSupprimerSelection = () => {
    const selectedItems = items.filter(i => selected.has(itemKey(i)));
    setConfirm({
      titre: 'Supprimer la sélection',
      message: `${selectedItems.length} élément(s) seront supprimés définitivement et ne pourront plus être restaurés.`,
      onConfirm: async () => {
        setConfirm(null);
        let ok = 0;
        for (const item of selectedItems) {
          await supprimerItemMut.mutateAsync({ type: item.type, id: item.id }).catch(() => {});
          ok++;
        }
        invalidateAll();
        setSelected(new Set());
        toast.success(`${ok} élément(s) supprimé(s) définitivement`);
      },
    });
  };

  const handleVider = () => {
    setConfirm({
      titre: 'Vider la corbeille',
      message: `Tous les ${items.length} éléments seront supprimés définitivement. Cette action est irréversible.`,
      onConfirm: () => {
        viderMut.mutate();
        setConfirm(null);
      },
    });
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center dark:bg-red-900/30">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-bold">Corbeille</h1>
            <p className="text-xs text-muted-foreground">
              {items.length} élément{items.length !== 1 ? 's' : ''} — restauration ou suppression définitive
            </p>
          </div>
        </div>

        {/* Actions globales */}
        <div className="flex items-center gap-2">
          {someSelected && (
            <button
              onClick={handleSupprimerSelection}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Supprimer la sélection ({selected.size})
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={handleVider}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-60 transition-colors dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-3 h-3" />
              Vider la corbeille
            </button>
          )}
        </div>
      </div>

      {/* Table */}
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
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-border cursor-pointer"
                  />
                </th>
                {['Type', 'Référence', 'Détail', 'Supprimé par', 'Supprimé le', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const conf = typeConfig[item.type];
                const Icon = conf.icon;
                const isSelected = selected.has(itemKey(item));
                return (
                  <tr
                    key={itemKey(item)}
                    className={cn(
                      'border-b border-border/50 hover:bg-muted/20 transition-colors',
                      isSelected && 'bg-red-50/50 dark:bg-red-900/10',
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(item)}
                        className="rounded border-border cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', conf.color)}>
                        <Icon className="w-3 h-3" />
                        {conf.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-primary">{item.numero}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-foreground truncate max-w-[180px]">{item.label}</p>
                      <p className="text-muted-foreground">{item.sublabel}</p>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.deletedByName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(item.deletedAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRestaurer(item)}
                          disabled={isBusy}
                          title="Restaurer"
                          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restaurer
                        </button>
                        <button
                          onClick={() => handleSupprimerItem(item)}
                          disabled={isBusy}
                          title="Supprimer définitivement"
                          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-60 transition-colors dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                        >
                          <Trash2 className="w-3 h-3" />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog de confirmation */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 dark:bg-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{confirm.titre}</h3>
                <p className="text-xs text-muted-foreground mt-1">{confirm.message}</p>
              </div>
              <button
                onClick={() => setConfirm(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirm.onConfirm}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
