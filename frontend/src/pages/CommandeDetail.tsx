import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Mail, CheckCircle, Truck, Download, X, Package, Edit2, XCircle, Plus, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { commandesApi, entrepotsApi, stockApi, articlesApi } from '@/lib/api';
import { cn, formatDate, downloadBlob } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import type { Commande, Entrepot, Article } from '@/lib/types';

// ── Combobox article réutilisable ─────────────────────────────────────────────
function ArticleCombobox({ articles, value, onChange, placeholder = 'Choisir article…' }: {
  articles: Article[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = articles.find(a => a.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    return a.nom.toLowerCase().includes(q) || a.reference.toLowerCase().includes(q);
  });

  return (
    <div ref={ref} className="relative flex-1">
      <div
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-lg cursor-pointer hover:border-primary/50 bg-card"
      >
        {open ? (
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou référence…"
            className="flex-1 bg-transparent outline-none text-xs"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={cn('flex-1 truncate', !selected && 'text-muted-foreground')}>
            {selected ? `${selected.nom} (${selected.reference})` : placeholder}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Aucun article trouvé</p>
          ) : filtered.map(a => (
            <div
              key={a.id}
              onMouseDown={() => { onChange(a.id); setOpen(false); setSearch(''); }}
              className={cn('px-3 py-2 text-xs cursor-pointer hover:bg-muted/50', a.id === value && 'bg-primary/10 text-primary font-medium')}
            >
              <span className="font-mono text-muted-foreground mr-2">{a.reference}</span>
              {a.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommandeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasRole } = useAuth();

  // Dialogs
  const [validDialogOpen, setValidDialogOpen] = useState(false);
  const [expedierDialogOpen, setExpedierDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [refuserDialogOpen, setRefuserDialogOpen] = useState(false);
  const [annulerDialogOpen, setAnnulerDialogOpen] = useState(false);

  // Validation (Log1)
  const [quantitesValidees, setQuantitesValidees] = useState<Record<string, number>>({});
  const [entrepotSourceCommande, setEntrepotSourceCommande] = useState<string>('');
  const [commentaireValid, setCommentaireValid] = useState('');
  const [nouvelleLignesValid, setNouvelleLignesValid] = useState<{ articleId: string; quantiteValidee: number; commentaire: string }[]>([]);

  // Expédition (Log2)
  const [quantitesExpedition, setQuantitesExpedition] = useState<Record<string, number>>({});
  const [commentaireLog2, setCommentaireLog2] = useState('');
  const [nouvelleLignesExp, setNouvelleLignesExp] = useState<{ articleId: string; quantite: number; commentaire: string }[]>([]);

  // Refus (Log1)
  const [motifRefus, setMotifRefus] = useState('');
  // Annulation
  const [motifAnnulation, setMotifAnnulation] = useState('');

  // Divers
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  const { data: commande, isLoading } = useQuery<Commande>({
    queryKey: ['commande', id],
    queryFn: () => commandesApi.get(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const { data: entrepots = [] } = useQuery<Entrepot[]>({
    queryKey: ['entrepots-actifs'],
    queryFn: () => entrepotsApi.list(),
  });

  const { data: articles = [] } = useQuery<Article[]>({
    queryKey: ['articles-all'],
    queryFn: () => articlesApi.list(),
    staleTime: 5 * 60 * 1000, // garder en cache 5 min
  });

  const { data: stocksEntrepot = [] } = useQuery<any[]>({
    queryKey: ['stocks-entrepot', entrepotSourceCommande],
    queryFn: () => stockApi.complet(entrepotSourceCommande),
    enabled: validDialogOpen && !!entrepotSourceCommande,
  });
  const stockByArticle = Object.fromEntries(stocksEntrepot.map((s: any) => [s.articleId, s.quantite]));

  const invalider = () => {
    qc.invalidateQueries({ queryKey: ['commande', id] });
    qc.invalidateQueries({ queryKey: ['commandes'] });
  };

  const validerMut = useMutation({
    mutationFn: (data: any) => commandesApi.valider(id!, data),
    onSuccess: () => { invalider(); toast.success('Commande transmise au Logisticien 2'); setValidDialogOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erreur lors de la validation'),
  });

  const expedierMut = useMutation({
    mutationFn: (data: any) => commandesApi.expedier(id!, data),
    onSuccess: () => { invalider(); toast.success('Commande expédiée'); setExpedierDialogOpen(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erreur lors de l\'expédition'),
  });

  const modifierMut = useMutation({
    mutationFn: (data: any) => commandesApi.modifier(id!, data),
    onSuccess: () => { invalider(); toast.success('Commande modifiée'); setEditDialogOpen(false); },
  });

  const refuserMut = useMutation({
    mutationFn: (motif: string) => commandesApi.refuser(id!, motif),
    onSuccess: () => {
      invalider();
      toast.success('Commande refusée — le prestataire pourra voir le motif');
      setRefuserDialogOpen(false);
      setMotifRefus('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erreur lors du refus'),
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
    mutationFn: (motif: string) => commandesApi.annuler(id!, motif || undefined),
    onSuccess: () => {
      invalider();
      toast.success('Commande annulée');
      setAnnulerDialogOpen(false);
      setMotifAnnulation('');
    },
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
    setEntrepotSourceCommande(commande.entrepotSource ?? '');
    setCommentaireValid('');
    setNouvelleLignesValid([]);
    setValidDialogOpen(true);
  };

  const openExpedierDialog = () => {
    if (!commande?.lignes) return;
    const qtes: Record<string, number> = {};
    commande.lignes.forEach(l => { qtes[l.id] = l.quantiteValidee ?? l.quantiteDemandee; });
    setQuantitesExpedition(qtes);
    setCommentaireLog2('');
    setNouvelleLignesExp([]);
    setExpedierDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!commande) return;
    setEditData({
      departement: commande.departement ?? '',
      demandeur: commande.demandeur ?? '',
      emailDemandeur: commande.emailDemandeur ?? '',
      societe: commande.societe ?? '',
      manager: commande.manager ?? '',
      telephoneDestinataire: commande.telephoneDestinataire ?? '',
      adresseLivraison: commande.adresseLivraison ?? '',
      commentaire: commande.commentaire ?? '',
      nombreGrilles: commande.nombreGrilles ?? '',
      typeGrille: commande.typeGrille ?? '',
    });
    setEditDialogOpen(true);
  };

  const handleValider = () => {
    validerMut.mutate({
      lignes: Object.entries(quantitesValidees).map(([lid, qte]) => ({ id: lid, quantiteValidee: qte })),
      nouvelleLignes: nouvelleLignesValid.filter(l => l.articleId && l.quantiteValidee > 0),
      entrepotSource: entrepotSourceCommande || null,
      commentaire: commentaireValid,
    });
  };

  const handleExpedier = () => {
    expedierMut.mutate({
      commentaire: commentaireLog2,
      lignes: Object.entries(quantitesExpedition).map(([ligneId, quantite]) => ({ ligneId, quantite })),
      nouvelleLignes: nouvelleLignesExp.filter(l => l.articleId && l.quantite > 0),
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!commande) return <div className="text-center py-12 text-muted-foreground">Commande introuvable</div>;

  const timelineSteps = [
    { key: 'EN_ATTENTE', label: 'Reçue', done: true, date: commande.dateReception, icon: '📥' },
    { key: 'EN_ATTENTE_LOG2', label: 'Validée', done: ['EN_ATTENTE_LOG2', 'VALIDEE', 'EXPEDIEE', 'LIVREE'].includes(commande.statut), date: commande.dateTraitement, icon: '✅' },
    { key: 'EXPEDIEE', label: 'Expédiée', done: ['EXPEDIEE', 'LIVREE'].includes(commande.statut), date: commande.dateExpedition, icon: '🚚' },
    { key: 'LIVREE', label: 'Livrée', done: commande.statut === 'LIVREE', date: commande.dateLivraison, icon: '📦' },
  ];

  const isAnnulee = commande.statut === 'ANNULEE';
  const isRefusee = commande.statut === 'REFUSEE';

  return (
    <div className="space-y-4 max-w-6xl">
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
          {!isAnnulee && !isRefusee && hasRole('ADMIN') && !['EXPEDIEE', 'LIVREE'].includes(commande.statut) && (
            <button onClick={() => { setMotifAnnulation(''); setAnnulerDialogOpen(true); }}
              className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              Annuler commande
            </button>
          )}
        </div>
      </div>

      {/* Bandeau refus */}
      {isRefusee && (commande as any).commentaireRefus && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Commande refusée</p>
            <p className="text-xs text-red-600 mt-1">Motif : {(commande as any).commentaireRefus}</p>
          </div>
        </div>
      )}

      {/* Dates */}
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
          { label: 'Entrepôt expéd.', value: commande.entrepotSource ? (entrepots.find(e => e.id === commande.entrepotSource)?.code ?? commande.entrepotSource) : '—' },
          { label: 'Type prestataire', value: (commande as any).typePrestataire === 'SOCIETE' ? 'Société' : (commande as any).typePrestataire === 'AUTO' ? 'Auto-entrepreneur' : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card rounded-lg border border-border p-2.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xs font-medium mt-0.5 truncate" title={String(value)}>{value}</p>
          </div>
        ))}
      </div>

      {(commande.adresseLivraison || commande.telephoneDestinataire) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5 text-xs text-blue-700">
            <span className="font-semibold">📍 Adresse de livraison :</span>
            <span>{commande.adresseLivraison ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-700">
            <span className="font-semibold">📞 Téléphone :</span>
            <span>{commande.telephoneDestinataire ?? '—'}</span>
          </div>
        </div>
      )}

      {/* Lien prestataire */}
      {(commande as any).lienId && (commande as any).lien && (
        <div className="bg-muted/20 border border-border rounded-xl p-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Lien prestataire :</span>
            <span>{(commande as any).lien?.nom ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-semibold">URL :</span>
            <span className="font-mono text-xs text-primary break-all">
              {window.location.origin}/commande-publique/{(commande as any).lien?.token}
            </span>
          </div>
        </div>
      )}

      {/* Timeline */}
      {!isRefusee && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Parcours de la commande</h3>
          <div className="flex items-start gap-0">
            {timelineSteps.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center min-w-[60px]">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2', step.done ? 'bg-primary border-primary text-white' : 'bg-background border-border text-muted-foreground')}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <p className="text-xs text-center mt-1 font-medium text-foreground leading-tight">{step.label}</p>
                  {step.date && <p className="text-xs text-center text-muted-foreground/70 mt-0.5 leading-tight">{formatDate(step.date)}</p>}
                </div>
                {i < timelineSteps.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mx-1 mt-[-22px]', step.done ? 'bg-primary' : 'bg-border')} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lignes */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Articles commandés</h3>
          <span className="text-xs text-muted-foreground">{commande.lignes?.length ?? 0} article(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Référence', 'Désignation', 'Unité', 'Demandé', 'Validé Log1', 'Livré Log2', 'Stock dispo'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-xs">{h}</th>
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
                  <td className="px-4 py-2.5">
                    <span className={cn('font-semibold', l.quantiteFournie != null && l.quantiteFournie < (l.quantiteValidee ?? l.quantiteDemandee) ? 'text-red-600' : 'text-green-700')}>
                      {l.quantiteFournie ?? '—'}
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
      {(commande.commentaire || commande.commentaireLog2 || (commande as any).commentaireRefus) && (
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
          {(commande as any).commentaireRefus && !isRefusee && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">❌ Motif de refus</p>
              <p className="text-xs text-red-900">{(commande as any).commentaireRefus}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button onClick={handleTelechargerPDF} disabled={pdfLoading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:border-primary hover:text-primary transition-colors disabled:opacity-60">
          <Download className="w-3.5 h-3.5" />
          {pdfLoading ? 'Génération…' : 'Fiche perception PDF'}
        </button>

        {/* Refuser — Log1 uniquement, commande en attente */}
        {hasRole('ADMIN', 'LOGISTICIEN_1') && commande.statut === 'EN_ATTENTE' && (
          <button onClick={() => { setMotifRefus(''); setRefuserDialogOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            <XCircle className="w-3.5 h-3.5" /> Refuser
          </button>
        )}

        {/* Valider — Log1 */}
        {hasRole('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2') && commande.statut === 'EN_ATTENTE' && (
          <button onClick={openValidDialog}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <CheckCircle className="w-3.5 h-3.5" /> Valider → Log2
          </button>
        )}

        {hasRole('ADMIN', 'LOGISTICIEN_1') && ['EN_ATTENTE_LOG2', 'VALIDEE'].includes(commande.statut) && !commande.emailEnvoye && (
          <button onClick={() => emailMut.mutate()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Mail className="w-3.5 h-3.5" /> Email envoyé
          </button>
        )}

        {hasRole('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2') && !['EXPEDIEE', 'LIVREE', 'ANNULEE', 'REFUSEE'].includes(commande.statut) && (
          <button onClick={openEditDialog}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:border-primary hover:text-primary transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Modifier
          </button>
        )}

        {hasRole('ADMIN', 'LOGISTICIEN_1', 'LOGISTICIEN_2') && commande.statut === 'EN_ATTENTE_LOG2' && (
          <button onClick={openExpedierDialog}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Truck className="w-3.5 h-3.5" /> Marquer expédiée
          </button>
        )}

        {commande.statut === 'EXPEDIEE' && (
          <button onClick={() => { if (confirm('Confirmer la livraison ?')) livreeMut.mutate(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors">
            <Package className="w-3.5 h-3.5" /> Marquer livrée
          </button>
        )}

        {commande.emailEnvoye && !commande.bonRetourRecu && (
          <button onClick={() => bonRetourMut.mutate()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
            <FileText className="w-3.5 h-3.5" /> Bon retour reçu
          </button>
        )}
      </div>

      {/* ── Dialog ANNULATION ────────────────────────────────────────────────── */}
      {annulerDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-red-600">Annuler la commande</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{commande.numero}</p>
              </div>
              <button onClick={() => setAnnulerDialogOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Motif d'annulation <span className="text-muted-foreground">(optionnel)</span>
                </label>
                <textarea
                  value={motifAnnulation}
                  onChange={e => setMotifAnnulation(e.target.value)}
                  rows={3}
                  placeholder="Ex : Doublon avec une commande précédente, commande passée par erreur…"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  autoFocus
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">⚠️ Cette action est irréversible. La commande passera en statut <strong>Annulée</strong>.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAnnulerDialogOpen(false)} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Retour</button>
                <button
                  onClick={() => annulerMut.mutate(motifAnnulation)}
                  disabled={annulerMut.isPending}
                  className="px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                >
                  {annulerMut.isPending ? 'Annulation…' : 'Confirmer l\'annulation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog REFUS ─────────────────────────────────────────────────────── */}
      {refuserDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md border border-border">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Refuser la commande
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{commande.numero} — le prestataire verra ce motif</p>
              </div>
              <button onClick={() => setRefuserDialogOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Motif du refus <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={motifRefus}
                  onChange={e => setMotifRefus(e.target.value)}
                  rows={4}
                  placeholder="Ex : Commande déjà passée cette semaine. Merci de patienter avant la prochaine commande…"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">{motifRefus.length} / 500 caractères</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">⚠️ La commande sera marquée comme <strong>Refusée</strong>. Le prestataire pourra voir le motif via son lien de suivi.</p>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setRefuserDialogOpen(false)} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button
                  onClick={() => refuserMut.mutate(motifRefus)}
                  disabled={!motifRefus.trim() || refuserMut.isPending}
                  className="px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                >
                  {refuserMut.isPending ? 'Refus en cours…' : 'Confirmer le refus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog VALIDATION Log1 ────────────────────────────────────────────── */}
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
            <div className="p-5 space-y-4">
              {/* Entrepôt source */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
                <label className="block text-xs font-semibold text-blue-800">Entrepôt d'expédition *</label>
                <select
                  value={entrepotSourceCommande}
                  onChange={e => setEntrepotSourceCommande(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                >
                  <option value="">— Sélectionner un entrepôt —</option>
                  {entrepots.map(e => <option key={e.id} value={e.id}>{e.code} — {e.nom}</option>)}
                </select>
              </div>

              {/* Lignes existantes */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                  <span className="flex-1 min-w-0">Article</span>
                  <span className="w-20 text-center">Demandé</span>
                  <span className="w-20 text-center">Stock</span>
                  <span className="w-20 text-center">Validé</span>
                </div>
                {commande.lignes?.map(l => {
                  const unit = l.article?.unite ?? 'u';
                  const stockDispo = entrepotSourceCommande ? (stockByArticle[l.articleId] ?? 0) : null;
                  const qteVal = quantitesValidees[l.id] ?? l.quantiteDemandee;
                  const stockInsuffisant = stockDispo !== null && qteVal > stockDispo;
                  return (
                    <div key={l.id} className={cn('flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs', stockInsuffisant ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : 'bg-muted/30 border-transparent')}>
                      <span className="flex-1 min-w-0 font-medium truncate" title={l.article?.nom}>{l.article?.nom}</span>
                      <span className="w-20 text-center text-muted-foreground whitespace-nowrap">{l.quantiteDemandee} {unit}</span>
                      {stockDispo !== null
                        ? <span className={cn('w-20 text-center font-semibold whitespace-nowrap', stockInsuffisant ? 'text-red-600' : 'text-green-700')}>{stockDispo} {unit}{stockInsuffisant && ' ⚠'}</span>
                        : <span className="w-20 text-center text-muted-foreground">—</span>
                      }
                      <input type="number" min={0}
                        value={qteVal}
                        onChange={e => setQuantitesValidees(prev => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))}
                        className={cn('w-20 px-2 py-1 text-xs text-center border rounded-lg focus:outline-none focus:ring-2', stockInsuffisant ? 'border-red-300 focus:ring-red-200' : 'border-border focus:ring-primary/20')} />
                      {stockDispo !== null && (() => {
                        const restant = stockDispo - qteVal;
                        return (
                          <span className={cn('text-xs font-medium', restant < 0 ? 'text-red-600' : 'text-green-600')}>
                            → {restant} restant{restant < 0 ? ' ⚠️' : ''}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* Ajout de nouveaux articles (substitution) */}
              <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">Articles substitués / ajoutés</p>
                  <button
                    type="button"
                    onClick={() => setNouvelleLignesValid(prev => [...prev, { articleId: '', quantiteValidee: 1, commentaire: '' }])}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Ajouter un article
                  </button>
                </div>
                {nouvelleLignesValid.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-1">Aucun article ajouté</p>
                )}
                {nouvelleLignesValid.map((nl, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <ArticleCombobox
                      articles={articles}
                      value={nl.articleId}
                      onChange={id => setNouvelleLignesValid(prev => prev.map((l, j) => j === i ? { ...l, articleId: id } : l))}
                    />
                    <input type="number" min={1} value={nl.quantiteValidee}
                      onChange={e => setNouvelleLignesValid(prev => prev.map((l, j) => j === i ? { ...l, quantiteValidee: parseInt(e.target.value) || 1 } : l))}
                      className="w-16 px-2 py-2 text-xs border border-border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    <button onClick={() => setNouvelleLignesValid(prev => prev.filter((_, j) => j !== i))}
                      className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
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
                <button onClick={handleValider} disabled={validerMut.isPending || !entrepotSourceCommande}
                  className="px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
                  Valider → Transmettre au Log2
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog EXPÉDITION Log2 ────────────────────────────────────────────── */}
      {expedierDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold">Expédier — {commande.numero}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Ajustez les quantités réellement envoyées</p>
              </div>
              <button onClick={() => setExpedierDialogOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Lignes existantes */}
              <div className="space-y-1.5">
                {commande.lignes?.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{l.article?.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        Validé: <span className="font-medium text-foreground">{l.quantiteValidee ?? l.quantiteDemandee}</span> {l.article?.unite ?? 'u'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <label className="text-xs text-muted-foreground">À envoyer</label>
                      <input type="number" min={0}
                        value={quantitesExpedition[l.id] ?? l.quantiteValidee ?? l.quantiteDemandee}
                        onChange={e => setQuantitesExpedition(prev => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-2 py-1.5 text-xs text-center border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Ajout articles substitués */}
              <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">Articles substitués / ajoutés</p>
                  <button
                    type="button"
                    onClick={() => setNouvelleLignesExp(prev => [...prev, { articleId: '', quantite: 1, commentaire: '' }])}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Ajouter un article
                  </button>
                </div>
                {nouvelleLignesExp.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 text-center py-1">Aucun article ajouté</p>
                )}
                {nouvelleLignesExp.map((nl, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <ArticleCombobox
                      articles={articles}
                      value={nl.articleId}
                      onChange={id => setNouvelleLignesExp(prev => prev.map((l, j) => j === i ? { ...l, articleId: id } : l))}
                    />
                    <input type="number" min={1} value={nl.quantite}
                      onChange={e => setNouvelleLignesExp(prev => prev.map((l, j) => j === i ? { ...l, quantite: parseInt(e.target.value) || 1 } : l))}
                      className="w-16 px-2 py-2 text-xs border border-border rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    <button onClick={() => setNouvelleLignesExp(prev => prev.filter((_, j) => j !== i))}
                      className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Commentaire Log2 (optionnel)</label>
                <textarea value={commentaireLog2} onChange={e => setCommentaireLog2(e.target.value)} rows={2}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setExpedierDialogOpen(false)} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={handleExpedier} disabled={expedierMut.isPending}
                  className="px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
                  Confirmer expédition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog MODIFICATION ────────────────────────────────────────────────── */}
      {editDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Modifier la commande — {commande.numero}</h2>
              <button onClick={() => setEditDialogOpen(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: 'departement', label: 'Département *' },
                  { field: 'demandeur', label: 'Demandeur' },
                  { field: 'emailDemandeur', label: 'Email' },
                  { field: 'societe', label: 'Société' },
                  { field: 'manager', label: 'Manager' },
                  { field: 'nombreGrilles', label: 'Nb. grilles' },
                  { field: 'telephoneDestinataire', label: 'Téléphone' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                    <input value={editData[field] ?? ''}
                      onChange={e => setEditData(p => ({ ...p, [field]: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Type de grille</label>
                  <select value={editData.typeGrille ?? ''} onChange={e => setEditData(p => ({ ...p, typeGrille: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-card">
                    <option value="">— Choisir —</option>
                    <option value="PROD">PROD</option>
                    <option value="SAV">SAV</option>
                    <option value="Mixte">Mixte</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Adresse de livraison</label>
                <input value={editData.adresseLivraison ?? ''}
                  onChange={e => setEditData(p => ({ ...p, adresseLivraison: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Commentaire</label>
                <textarea value={editData.commentaire ?? ''} onChange={e => setEditData(p => ({ ...p, commentaire: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditDialogOpen(false)} className="px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted">Annuler</button>
                <button onClick={() => modifierMut.mutate(editData)} disabled={modifierMut.isPending}
                  className="px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
