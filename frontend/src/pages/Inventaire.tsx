import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, X, Check, ClipboardCheck, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { inventairesApi, entrepotsApi, articlesApi } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { Entrepot, Article } from '@/lib/types';

export default function Inventaire() {
  const qc = useQueryClient();
  const [selectedEntrepot, setSelectedEntrepot] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEntrepotId, setDialogEntrepotId] = useState('');
  const [lignes, setLignes] = useState<{ articleId: string; quantite: number; commentaire: string }[]>([]);

  const { data: entrepots = [] } = useQuery<Entrepot[]>({
    queryKey: ['entrepots'],
    queryFn: () => entrepotsApi.list(),
  });

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ['articles'],
    queryFn: () => articlesApi.list(),
  });

  const { data: alertes = [] } = useQuery<{ entrepot: Entrepot; dernierInventaire: string | null; enAlerte: boolean }[]>({
    queryKey: ['inventaires-alertes'],
    queryFn: inventairesApi.alertes,
  });

  const { data: etat = [], isLoading: etatLoading } = useQuery<any[]>({
    queryKey: ['inventaire-etat', selectedEntrepot],
    queryFn: () => inventairesApi.etatEntrepot(selectedEntrepot),
    enabled: !!selectedEntrepot,
  });

  const createMut = useMutation({
    mutationFn: inventairesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventaire-etat'] });
      qc.invalidateQueries({ queryKey: ['inventaires-alertes'] });
      toast.success('Inventaire enregistré');
      closeDialog();
    },
  });

  const alertesActives = alertes.filter(a => a.enAlerte);

  const openDialog = (entrepotId: string) => {
    setDialogEntrepotId(entrepotId);
    if (etat.length > 0) {
      setLignes(etat.map((e: any) => ({ articleId: e.articleId, quantite: e.stockTheorique, commentaire: '' })));
    } else {
      setLignes([{ articleId: '', quantite: 0, commentaire: '' }]);
    }
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setLignes([]); setDialogEntrepotId(''); };

  const handleCreate = () => {
    const valid = lignes.filter(l => l.articleId && l.quantite >= 0);
    if (!dialogEntrepotId || valid.length === 0) { toast.error('Entrepôt et articles requis'); return; }
    createMut.mutate({ entrepotId: dialogEntrepotId, lignes: valid });
  };

  const entrepotSelectionne = entrepots.find(e => e.id === selectedEntrepot);

  return (
    <div className="space-y-4">
      {/* Alertes */}
      {alertesActives.length > 0 && (
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-800">
            <p className="font-semibold mb-1">{alertesActives.length} entrepôt(s) sans inventaire depuis plus de 3 mois</p>
            <div className="flex flex-wrap gap-2">
              {alertesActives.map(a => (
                <span key={a.entrepot.id} className="bg-red-100 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                  {a.entrepot.code} — {a.dernierInventaire ? `dernier : ${formatDate(a.dernierInventaire)}` : 'jamais réalisé'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sélection entrepôt */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={selectedEntrepot} onChange={e => setSelectedEntrepot(e.target.value)}
          className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
          <option value="">Sélectionner un entrepôt…</option>
          {entrepots.map(e => {
            const alerte = alertes.find(a => a.entrepot.id === e.id);
            return <option key={e.id} value={e.id}>{alerte?.enAlerte ? '⚠ ' : ''}{e.code} — {e.nom}</option>;
          })}
        </select>
        {selectedEntrepot && (
          <button
            onClick={() => openDialog(selectedEntrepot)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Saisir un inventaire
          </button>
        )}
      </div>

      {/* Statut par entrepôt */}
      {!selectedEntrepot && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entrepots.map(e => {
            const alerte = alertes.find(a => a.entrepot.id === e.id);
            return (
              <div key={e.id}
                onClick={() => setSelectedEntrepot(e.id)}
                className={cn('bg-card border rounded-xl p-4 cursor-pointer hover:border-primary transition-colors', alerte?.enAlerte ? 'border-red-300' : 'border-border')}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm">{e.code}</p>
                    <p className="text-xs text-muted-foreground">{e.nom}</p>
                  </div>
                  {alerte?.enAlerte ? (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Alerte
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> OK
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {alerte?.dernierInventaire
                    ? `Dernier inventaire : ${formatDate(alerte.dernierInventaire)}`
                    : 'Aucun inventaire enregistré'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Vue détaillée entrepôt sélectionné */}
      {selectedEntrepot && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedEntrepot('')} className="text-xs text-muted-foreground hover:text-foreground">← Tous les entrepôts</button>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-semibold">{entrepotSelectionne?.code} — {entrepotSelectionne?.nom}</span>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Article</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Stock théorique</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Dernier inventaire</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Qté comptée</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Écart</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Date inventaire</th>
                  </tr>
                </thead>
                <tbody>
                  {etatLoading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Chargement…</td></tr>
                  ) : etat.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Aucun stock dans cet entrepôt</td></tr>
                  ) : etat.map(ligne => {
                    const ecart = ligne.ecart;
                    return (
                      <tr key={ligne.articleId} className="border-t border-border/40 hover:bg-muted/10">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{ligne.article?.nom}</p>
                          <p className="text-muted-foreground font-mono">{ligne.article?.reference}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium">{formatNumber(ligne.stockTheorique)}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">
                          {ligne.dernierInventaire ? formatNumber(ligne.dernierInventaire.quantite) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {ligne.dernierInventaire ? (
                            <span className="font-semibold">{formatNumber(ligne.dernierInventaire.quantite)}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {ecart !== null ? (
                            <span className={cn('font-semibold', ecart > 0 ? 'text-green-600' : ecart < 0 ? 'text-red-600' : 'text-muted-foreground')}>
                              {ecart > 0 ? '+' : ''}{formatNumber(ecart)}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {ligne.dernierInventaire ? formatDate(ligne.dernierInventaire.date) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dialog saisie inventaire */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  Inventaire physique — {entrepots.find(e => e.id === dialogEntrepotId)?.code}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Saisissez les quantités réellement comptées</p>
              </div>
              <button onClick={closeDialog} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Article</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase w-20 text-right">Théorique</span>
                <span className="text-xs font-semibold text-muted-foreground uppercase w-20 text-right">Compté</span>
              </div>
              {lignes.map((l, i) => {
                const art = articles.find(a => a.id === l.articleId);
                const stock = etat.find(e => e.articleId === l.articleId);
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-muted/10 rounded-lg px-2 py-1.5">
                    <div>
                      <p className="text-xs font-medium">{art?.nom ?? '—'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{art?.reference}</p>
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">{stock?.stockTheorique ?? '—'}</span>
                    <input
                      type="number" min={0} value={l.quantite}
                      onChange={e => setLignes(p => p.map((line, j) => j === i ? { ...line, quantite: parseInt(e.target.value) || 0 } : line))}
                      className="w-20 text-right px-2 py-1 text-xs border border-primary/40 bg-primary/5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold"
                    />
                  </div>
                );
              })}
              {lignes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Sélectionnez d'abord un entrepôt avec du stock</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={closeDialog} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleCreate} disabled={createMut.isPending}
                  className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Valider l'inventaire
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
