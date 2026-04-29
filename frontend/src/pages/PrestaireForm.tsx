import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, CheckCircle, AlertCircle, Search, Package } from 'lucide-react';
import Logo from '@/components/Logo';
import { toast } from 'sonner';
import { commandesApi } from '@/lib/api';

const statutLabel: Record<string, { label: string; color: string; icon: string }> = {
  EN_ATTENTE:      { label: 'En attente de traitement', color: 'text-amber-700 bg-amber-50 border-amber-200',   icon: '⏳' },
  EN_ATTENTE_LOG2: { label: 'En cours de préparation',  color: 'text-blue-700 bg-blue-50 border-blue-200',     icon: '🔧' },
  VALIDEE:         { label: 'Validée — en préparation', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: '✅' },
  EXPEDIEE:        { label: 'Expédiée — en transit',    color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: '🚚' },
  LIVREE:          { label: 'Livrée',                   color: 'text-green-700 bg-green-50 border-green-200',   icon: '📦' },
  ANNULEE:         { label: 'Annulée',                  color: 'text-red-700 bg-red-50 border-red-200',         icon: '❌' },
};

export default function PrestaireForm() {
  const { token } = useParams<{ token: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [commandeNumero, setCommandeNumero] = useState('');

  // Quantités par article : articleId → quantité (0 = non sélectionné)
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [formData, setFormData] = useState({
    departement: '', demandeur: '', emailDemandeur: '',
    societe: '', manager: '', nombreGrilles: '', typeGrille: '',
    telephoneDestinataire: '', adresseLivraison: '', commentaire: '',
  });

  // Tracking
  const [trackingNumero, setTrackingNumero] = useState('');
  const [trackingResult, setTrackingResult] = useState<any>(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-commande', token],
    queryFn: () => commandesApi.getPublic(token!),
    enabled: !!token,
    retry: false,
  });

  const submitMut = useMutation({
    mutationFn: (payload: any) => commandesApi.createPublique(token!, payload),
    onSuccess: (commande: any) => {
      setCommandeNumero(commande.numero);
      setTrackingNumero(commande.numero);
      setSubmitted(true);
    },
    onError: () => toast.error('Erreur lors de la soumission'),
  });

  const handleSubmit = () => {
    if (!formData.departement) { toast.error('Département requis'); return; }
    if (!formData.demandeur)   { toast.error('Nom du demandeur requis'); return; }
    const lignes = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([articleId, quantiteDemandee]) => ({ articleId, quantiteDemandee }));
    if (lignes.length === 0) { toast.error('Saisissez une quantité pour au moins un article'); return; }
    submitMut.mutate({
      ...formData,
      nombreGrilles: formData.nombreGrilles ? parseInt(formData.nombreGrilles) : undefined,
      lignes,
    });
  };

  const handleTracking = async () => {
    if (!trackingNumero.trim()) { toast.error('Numéro de commande requis'); return; }
    setTrackingLoading(true);
    setTrackingError('');
    setTrackingResult(null);
    try {
      const result = await commandesApi.suiviPublic(trackingNumero.trim());
      setTrackingResult(result);
    } catch {
      setTrackingError('Commande introuvable. Vérifiez le numéro (ex: CMD-2024-0001).');
    } finally {
      setTrackingLoading(false);
    }
  };

  const articles = data?.articles ?? [];
  const lien = data?.lien;
  const selectedCount = Object.values(quantities).filter(q => q > 0).length;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isError) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">Lien invalide</h2>
        <p className="text-sm text-gray-500">Ce lien est invalide ou a expiré. Contactez votre responsable logistique.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-4" style={{ background: '#181d2e' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Logo height={40} />
          <div>
            <p className="text-gray-400 text-xs">Logistique Fibre Optique</p>
            <h1 className="text-white text-lg font-bold">Commande soumise</h1>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Commande transmise !</h2>
          <p className="text-sm text-gray-600 mb-3">
            Votre commande <strong className="text-blue-700 font-mono">{commandeNumero}</strong> a été transmise à l'équipe logistique D3.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            📋 Conservez ce numéro pour suivre l'avancement de votre commande ci-dessous.
          </div>
        </div>
        <TrackingSection
          numero={trackingNumero}
          setNumero={setTrackingNumero}
          result={trackingResult}
          error={trackingError}
          loading={trackingLoading}
          onSearch={handleTracking}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-4" style={{ background: '#181d2e' }}>
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Logo height={44} />
          <div>
            <p className="text-gray-400 text-xs">Logistique Fibre Optique</p>
            <h1 className="text-white text-lg font-bold">Formulaire de commande matériel</h1>
          {lien && (
            <p className="text-gray-400 text-xs mt-0.5">
              Portail : <span className="text-gray-200 font-semibold">{lien.nom}</span>
              {lien.expiresAt && ` · Expire le ${new Date(lien.expiresAt).toLocaleDateString('fr-FR')}`}
            </p>
          )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* ── 1. Informations demandeur ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Vos informations
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { field: 'demandeur',      label: 'Nom et prénom *',              placeholder: 'Jean Dupont',            type: 'text',  col: '2' },
              { field: 'societe',        label: 'Société / Entreprise',         placeholder: 'BTP Telecom 49',         type: 'text',  col: '1' },
              { field: 'emailDemandeur', label: 'Email',                        placeholder: 'jean@exemple.fr',        type: 'email', col: '1' },
              { field: 'departement',         label: 'Département *',                placeholder: 'Ex: 49, 75, Loire...',        type: 'text',  col: '1' },
              { field: 'manager',             label: 'Responsable / Interlocuteur',  placeholder: 'Nom du responsable',          type: 'text',  col: '1' },
              { field: 'telephoneDestinataire', label: 'Téléphone',                  placeholder: '06 XX XX XX XX',              type: 'tel',   col: '1' },
            ].map(({ field, label, placeholder, type, col }) => (
              <div key={field} className={col === '2' ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                <input type={type} value={(formData as any)[field]}
                  onChange={e => setFormData(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre de grilles</label>
              <input type="number" min={0} value={formData.nombreGrilles}
                onChange={e => setFormData(prev => ({ ...prev, nombreGrilles: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type de grille</label>
              <select value={formData.typeGrille}
                onChange={e => setFormData(prev => ({ ...prev, typeGrille: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all">
                <option value="">— Choisir —</option>
                <option value="PROD">PROD</option>
                <option value="SAV">SAV</option>
                <option value="Mixte">Mixte</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Adresse de livraison</label>
              <input type="text" value={formData.adresseLivraison}
                onChange={e => setFormData(prev => ({ ...prev, adresseLivraison: e.target.value }))}
                placeholder="12 rue de l'industrie, 49000 Angers"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all" />
            </div>
          </div>
        </div>

        {/* ── 2. Catalogue articles ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Articles à commander *
            </h2>
            {selectedCount > 0 && (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                {selectedCount} article{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {articles.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Aucun article disponible</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {/* En-tête */}
              <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Article</span>
                <span className="w-28 text-center">Quantité souhaitée</span>
              </div>

              {/* Lignes articles */}
              {articles.map((a: any, idx: number) => {
                const qty = quantities[a.id] ?? 0;
                const isSelected = qty > 0;
                return (
                  <div key={a.id}
                    className={`grid grid-cols-[1fr_auto] gap-4 items-center px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                    {/* Infos article */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{a.reference}</span>
                        <span className="text-sm font-semibold text-gray-800">{a.nom}</span>
                        <span className="text-xs text-gray-400">({a.unite})</span>
                      </div>
                      {a.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{a.description}</p>
                      )}
                      {a.regleConsommation && (
                        <p className="text-xs text-blue-500 mt-0.5">💡 {a.regleConsommation}</p>
                      )}
                    </div>

                    {/* Input quantité */}
                    <div className="w-28 flex-shrink-0">
                      <input
                        type="number"
                        min={0}
                        value={qty === 0 ? '' : qty}
                        placeholder="0"
                        onChange={e => {
                          const v = parseInt(e.target.value) || 0;
                          setQuantities(prev => ({ ...prev, [a.id]: v }));
                        }}
                        className={`w-full px-3 py-2.5 text-sm text-center border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                          isSelected
                            ? 'border-blue-400 bg-blue-50 text-blue-800 font-semibold focus:ring-blue-400/30'
                            : 'border-gray-200 bg-white focus:ring-blue-500/30 focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Récapitulatif */}
          {selectedCount > 0 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Récapitulatif de votre commande
              </p>
              {articles
                .filter((a: any) => (quantities[a.id] ?? 0) > 0)
                .map((a: any) => (
                  <div key={a.id} className="flex justify-between text-xs text-blue-900 py-0.5">
                    <span>{a.nom} <span className="text-blue-500">({a.unite})</span></span>
                    <span className="font-semibold">× {quantities[a.id]}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ── 3. Commentaire ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Commentaire (optionnel)
          </h2>
          <textarea value={formData.commentaire}
            onChange={e => setFormData(prev => ({ ...prev, commentaire: e.target.value }))}
            rows={3} placeholder="Informations complémentaires, urgence, instructions particulières…"
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-gray-50 focus:bg-white transition-all resize-none" />
        </div>

        {/* ── Bouton soumettre ── */}
        <button onClick={handleSubmit} disabled={submitMut.isPending}
          className="w-full py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
          {submitMut.isPending
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi en cours…</>
            : <><Send className="w-4 h-4" /> Soumettre la commande {selectedCount > 0 && `(${selectedCount} article${selectedCount > 1 ? 's' : ''})`}</>
          }
        </button>

        {/* ── Suivi commande existante ── */}
        <TrackingSection
          numero={trackingNumero}
          setNumero={setTrackingNumero}
          result={trackingResult}
          error={trackingError}
          loading={trackingLoading}
          onSearch={handleTracking}
        />

        <p className="text-xs text-center text-gray-400 pb-4">
          Logistique D3 — Cette commande sera transmise à l'équipe logistique pour traitement.
        </p>
      </div>
    </div>
  );
}

function TrackingSection({ numero, setNumero, result, error, loading, onSearch }: {
  numero: string; setNumero: (v: string) => void;
  result: any; error: string; loading: boolean; onSearch: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-blue-600" /> Suivre une commande existante
      </h2>
      <div className="flex gap-2 mb-3">
        <input value={numero} onChange={e => setNumero(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
          placeholder="CMD-2024-0001"
          className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-gray-50 focus:bg-white font-mono" />
        <button onClick={onSearch} disabled={loading}
          className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">{error}</p>}
      {result && <TrackingResult commande={result} />}
    </div>
  );
}

function TrackingResult({ commande }: { commande: any }) {
  const info = statutLabel[commande.statut] ?? { label: commande.statut, color: 'text-gray-700 bg-gray-50 border-gray-200', icon: '❓' };
  return (
    <div className="space-y-3">
      <div className={`border rounded-xl p-3 ${info.color}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{info.icon}</span>
          <div>
            <p className="text-xs font-mono font-bold">{commande.numero}</p>
            <p className="text-sm font-semibold">{info.label}</p>
            {commande.demandeur && <p className="text-xs mt-0.5">Demandeur : <strong>{commande.demandeur}</strong></p>}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs px-1">
        {[
          { label: 'Reçue',            date: commande.dateReception,  done: true },
          { label: 'Traitée (Log1)',   date: commande.dateTraitement, done: !!commande.dateTraitement },
          { label: 'Expédiée (Log2)',  date: commande.dateExpedition, done: !!commande.dateExpedition },
          { label: 'Livrée',           date: commande.dateLivraison,  done: !!commande.dateLivraison },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
              {step.done ? '✓' : i + 1}
            </div>
            <span className={step.done ? 'text-gray-800 font-medium' : 'text-gray-400'}>{step.label}</span>
            {step.date && <span className="text-gray-400 ml-auto">{new Date(step.date).toLocaleDateString('fr-FR')}</span>}
          </div>
        ))}
      </div>

      {commande.lignes?.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-600 mb-1.5">Articles commandés</p>
          {commande.lignes.map((l: any, i: number) => (
            <div key={i} className="flex justify-between text-xs py-0.5 border-b border-gray-100 last:border-0">
              <span className="text-gray-700">{l.article?.nom ?? '—'}</span>
              <span className="text-gray-500">
                {l.quantiteValidee != null
                  ? <>{l.quantiteValidee} <span className="text-gray-400">/ {l.quantiteDemandee} dem.</span></>
                  : <>{l.quantiteDemandee} dem.</>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
