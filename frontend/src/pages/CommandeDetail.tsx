import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Mail, CheckCircle, Truck, Download, X, Package } from 'lucide-react';
import { toast } from 'sonner';
import { commandesApi } from '@/lib/api';
import { cn, formatDate, downloadBlob } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import type { Commande } from '@/lib/types';

export default function CommandeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();

  const [validDialogOpen, setValidDialogOpen] = useState(false);
  const [quantitesValidees, setQuantitesValidees] = useState<Record<string, number>>({});
  const [commentaireValid, setCommentaireValid] = useState('');
  const [expedierDialogOpen, setExpedierDialogOpen] = useState(false);
  const [commentaireLog2, setCommentaireLog2] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: commande, isLoading } = useQuery<Commande>({
    queryKey: ['commande', id],
    queryFn: () => commandesApi.get(id!),
    enabled: !!id,
    refetchInterval: 15_000, // sync auto toutes les 15s
  });

  const invalider = () => {
    qc.invalidateQueries({ queryKey: ['commande', id] });
    qc.invalidateQueries({ queryKey: ['commandes'] });
  };

  const validerMut = useMutation({
    mutationFn: (data: any) => commandesApi.valider(id!, data),
    onSuccess: () => { invalider(); toast.success('Commande transmise au Logisticien 2'); setValidDialogOpen(false); },
  });

  const expedierMut = useMutation({
    mutationFn: (data: any) => commandesApi.expedier(id!, data),
    onSuccess: () => { invalider(); toast.success('Commande expédiée'); setExpedierDialogOpen(false); },
  });

  const livreeMut = useMutation({
    mutationFn: () => commandesApi.marquerLivree(id!),
    onSuccess: () => { invalider(); toast.success('Commande marquée livrée'); },
  });

  const emailMut = useMutation({
    mutationFn: () => commandesApi.marquerEmailEnvoye(id!),
    onSuccess: () => { invalider(); toast.success('Email marqué comme envoyé'); },
  });

  const bonRetourMut = useMutation({
    mutationFn: () => commandesApi.marquerBonRetourRecu(id!),
    onSuccess: () => { invalider(); toast.success('Bon de retour marqué comme reçu'); },
  });

  const annulerMut = useMutation({
    mutationFn: () => commandesApi.annuler(id!),
    onSuccess: () => { invalider(); toast.success('Commande annulée'); },
  });

  const handleTelechargerPDF = async () => {
    setPdfLoading(true);
    try {
      const blob = await commandesApi.fichePerception(id!);
      downloadBlob(blob, `fiche-perception-${commande?.numero}.pdf`);
    } catch {
      toast.error('Erreur génération PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const openValidDialog = () => {
    if (!commande?.lignes) return;
    const qtes: Record<string, number> = {};
    commande.lignes.forEach(l => { qtes[l.id] = l.quantiteValidee ?? l.quantiteDemandee; });
    setQuantitesValidees(qtes);
    setCommentaireValid('');
    setValidDialogOpen(true);
  };

  const handleValider = () => {
    validerMut.mutate({
      lignes: Object.entries(quantitesValidees).map(([lid, qte]) => ({ id: lid, quantiteValidee: qte })),
      commentaire: commentaireValid,
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!commande) return <div className="text-center py-12 text-muted-foreground">Commande introuvable</div>;

  // Timeline steps
  const timelineSteps = [
    {
      key: 'EN_ATTENTE',
      label: 'Reçue',
      done: true,
      date: commande.dateReception,
      icon: '📥',
    },
    {
      key: 'EN_ATTENTE_LOG2',
      label: 'Log1 validé',
      done: ['EN_ATTENTE_LOG2', 'VALIDEE', 'EXPEDIEE', 'LIVREE'].includes(commande.statut),
      date: commande.dateTraitement,
      icon: '✅',
    },
    {
      key: 'EXPEDIEE',
      label: 'Expédiée',
      done: ['EXPEDIEE', 'LIVREE'].includes(commande.statut),
      date: commande.dateExpedition,
      icon: '🚚',
    },
    {
      key: 'LIVREE',
      label: 'Livrée',
      done: commande.statut === 'LIVREE',
      date: commande.dateLivraison,
      icon: '📦',
    },
  ];

  const isAnnulee = commande.statut === 'ANNULEE';

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/commandes')} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground">{commande.numero}</h1>
            <p className="text-xs text-muted-foreground">Reçue le {formatDate(commande.dateReception)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge statut={commande.statut} />
          {!isAnnulee && hasRole('ADMIN') && commande.statut === 'EN_ATTENTE' && (
            <button onClick={() => { if (confirm('Annuler cette commande ?')) annulerMut.mutate(); }}
              className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* Dates prominentes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-medium">📅 Date réception</p>
          <p className="text-sm font-bold text-blue-900 mt-0.5">{formatDate(commande.dateReception)}</p>
        </div>
        <div className={cn('border rounded-lg p-3', commande.dateTraitement ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border')}>
          <p className={cn('text-xs font-medium', commande.dateTraitement ? 'text-green-600' : 'text-muted-foreground')}>✅ Date traitement Log1</p>
          <p className={cn('text-sm font-bold mt-0.5', commande.dateTraitement ? 'text-green-900' : 'text-muted-foreground')}>
            {commande.dateTraitement ? formatDate(commande.dateTraitement) : '—'}
          </p>
        </div>
        <div className={cn('border rounded-lg p-3', commande.dateExpedition ? 'bg-purple-50 border-purple-200' : 'bg-muted/30 border-border')}>
          <p className={cn('text-xs font-medium', commande.dateExpedition ? 'text-purple-600' : 'text-muted-foreground')}>🚚 Date expédition</p>
          <p className={cn('text-sm font-bold mt-0.5', commande.dateExpedition ? 'text-purple-900' : 'text-muted-foreground')}>
            {commande.dateExpedition ? formatDate(commande.dateExpedition) : '—'}
          </p>
        </div>
        <div className={cn('border rounded-lg p-3', commande.dateLivraison ? 'bg-gray-50 border-gray-300' : 'bg-muted/30 border-border')}>
          <p className={cn('text-xs font-medium', commande.dateLivraison ? 'text-gray-700' : 'text-muted-foreground')}>📦 Date livraison</p>
          <p className={cn('text-sm font-bold mt-0.5', commande.dateLivraison ? 'text-gray-900' : 'text-muted-foreground')}>
            {commande.dateLivraison ? formatDate(commande.dateLivraison) : '—'}
          </p>
        </div>
      </div>

      {/* Infos commande */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Département', value: commande.departement },
          { label: 'Demandeur', value: commande.demandeur ?? '—' },
          { label: 'Société', value: commande.societe ?? '—' },
          { label: 'Manager', value: commande.manager ?? '—' },
          { label: 'Email', value: commande.emailDemandeur ?? '—' },
          { label: 'Nb. grilles', value: commande.nombreGrilles ?? '—' },
          { label: 'Type grille', value: commande.typeGrille ?? '—' },
          { label: 'Validé par', value: commande.valideur ? `${commande.valideur.prenom} ${commande.valideur.nom}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card rounded-lg border border-border p-2.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xs font-medium mt-0.5 truncate" title={String(value)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Parcours de la commande</h3>
        <div className="flex items-start gap-0">
          {timelineSteps.map((step, i) => (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center min-w-[60px]">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all',
                  step.done
                    ? 'bg-primary border-primary text-white'
                    : 'bg-background border-border text-muted-foreground',
                )}>
                  {step.done ? '✓' : i + 1}
                </div>
                <p className="text-xs text-center mt-1 font-medium text-foreground leading-tight">{step.label}</p>
                {step.date && (
                  <p className="text-xs text-center text-muted-foreground/70 mt-0.5 leading-tight">{formatDate(step.date)}</p>
                )}
              </div>
              {i < timelineSteps.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-1 mt-[-22px]', step.done ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lignes commande */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Articles commandés</h3>
          <span className="text-xs text-muted-foreground">{commande.lignes?.length ?? 0} article(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Référence', 'Désignation', 'Unité', 'Demandé', 'Validé', 'Stock dispo'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commande.lignes?.map(l => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{l.article?.reference ?? '—'}</td>
                  <td className="px-4 py-2.5 font-medium">{l.article?.nom ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.article?.unite ?? 'u'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.quantiteDemandee}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('font-semibold', l.quantiteValidee != null && l.quantiteValidee < l.quantiteDemandee ? 'text-orange-600' : 'text-foreground')}>
                      {l.quantiteValidee ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{l.stockDisponible ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commentaires */}
      {(commande.commentaire || commande.commentaireLog2) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {commande.commentaire && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">💬 Commentaire demandeur</p>
              <p className="text-xs text-amber-900">{commande.commentaire}</p>
            </div>
          )}
          {commande.commentaireLog2 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-purple-700 mb-1">💬 Commentaire Log2</p>
              <p className="text-xs text-purple-900">{commande.commentaireLog2}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* PDF */}
        <button onClick={handleTelechargerPDF} disabled={pdfLoading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:border-primary hover:text-primary transition-colors disabled:opacity-60">
          <Download className="w-3.5 h-3.5" />
          {pdfLoading ? 'Génération…' : 'Fiche perception PDF'}
        </button>

        {/* Valider — Log1 OU Log2 */}
        {hasRole('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2') && commande.statut === 'EN_ATTENTE' && (
          <button onClick={openValidDialog}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <CheckCircle className="w-3.5 h-3.5" /> Valider → Log2
          </button>
        )}

        {/* Marquer email envoyé */}
        {hasRole('ADMIN', 'LOGISTICIEN_1') && ['EN_ATTENTE_LOG2', 'VALIDEE'].includes(commande.statut) && !commande.emailEnvoye && (
          <button onClick={() => emailMut.mutate()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Mail className="w-3.5 h-3.5" /> Email envoyé
          </button>
        )}

        {/* Expédier — Log1 OU Log2 */}
        {hasRole('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2') && commande.statut === 'EN_ATTENTE_LOG2' && (
          <button onClick={() => setExpedierDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Truck className="w-3.5 h-3.5" /> Marquer expédiée
          </button>
        )}

        {/* Marquer livrée */}
        {commande.statut === 'EXPEDIEE' && (
          <button onClick={() => { if (confirm('Confirmer la livraison ?')) livreeMut.mutate(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors">
            <Package className="w-3.5 h-3.5" /> Marquer livrée
          </button>
        )}

        {/* Bon de retour */}
        {commande.emailEnvoye && !commande.bonRetourRecu && (
          <button onClick={() => bonRetourMut.mutate()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
            <FileText className="w-3.5 h-3.5" /> Bon retour reçu
          </button>
        )}
      </div>

      {/* Dialog validation Log1 */}
      {validDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold">Valider — {commande.numero}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">La commande sera transmise au Logisticien 2</p>
              </div>
              <button onClick={() => setValidDialogOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">Ajustez les quantités validées selon le stock disponible.</p>
              <div className="space-y-1.5">
                {commande.lignes?.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{l.article?.nom}</p>
                      <p className="text-xs text-muted-foreground">Demandé: {l.quantiteDemandee} {l.article?.unite ?? 'u'}</p>
                    </div>
                    <input type="number" min={0} max={l.quantiteDemandee}
                      value={quantitesValidees[l.id] ?? l.quantiteDemandee}
                      onChange={e => setQuantitesValidees(prev => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))}
                      className="w-20 px-2 py-1.5 text-xs text-center border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Commentaire</label>
                <textarea value={commentaireValid} onChange={e => setCommentaireValid(e.target.value)} rows={2}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setValidDialogOpen(false)} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleValider} disabled={validerMut.isPending}
                  className="px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
                  Valider → Transmettre au Log2
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog expédition Log2 */}
      {expedierDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-sm border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Confirmer l'expédition</h2>
              <button onClick={() => setExpedierDialogOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">Commande <strong>{commande.numero}</strong> sera marquée expédiée.</p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Commentaire Log2 (optionnel)</label>
                <textarea value={commentaireLog2} onChange={e => setCommentaireLog2(e.target.value)} rows={2}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setExpedierDialogOpen(false)} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={() => expedierMut.mutate({ commentaire: commentaireLog2 })} disabled={expedierMut.isPending}
                  className="px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
                  Confirmer expédition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
