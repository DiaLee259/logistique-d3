import { useState } from 'react';
import {
  BookOpen, LogIn, LayoutDashboard, ClipboardList, Truck,
  Package, ArrowLeftRight, ClipboardCheck, RefreshCw, Link2,
  ChevronDown, ChevronRight, Printer, AlertTriangle, CheckCircle, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Section = {
  id: string;
  icon: React.ElementType;
  color: string;
  title: string;
  content: React.ReactNode;
};

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-semibold', colors[color] ?? colors.gray)}>
      {children}
    </span>
  );
}

function Box({ type = 'blue', title, children }: { type?: 'blue' | 'green' | 'amber' | 'red'; title: string; children: React.ReactNode }) {
  const styles = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  const icons = { blue: Info, green: CheckCircle, amber: AlertTriangle, red: AlertTriangle };
  const Icon = icons[type];
  return (
    <div className={cn('border rounded-lg p-3 my-3 text-xs', styles[type])}>
      <div className="flex items-center gap-1.5 font-semibold mb-1">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Step({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-2.5 bg-muted/20 rounded-lg border border-border/40 mb-2 text-xs">
      <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0 text-[10px] mt-0.5">{num}</span>
      <span>{children}</span>
    </div>
  );
}

function StepFlow({ steps }: { steps: string[] }) {
  return (
    <div className="my-3 space-y-1.5">
      {steps.map((s, i) => <Step key={i} num={i + 1}>{s}</Step>)}
    </div>
  );
}

function StatusFlow() {
  const statuts = [
    { label: 'En attente', color: 'gray' },
    { label: 'Validée', color: 'green' },
    { label: 'Expédiée', color: 'purple' },
    { label: 'Livrée', color: 'green' },
    { label: 'Annulée', color: 'red' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5 my-3">
      {statuts.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Badge color={s.color}>{s.label}</Badge>
          {i < statuts.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
        </div>
      ))}
    </div>
  );
}

const sections: Section[] = [
  {
    id: 'connexion',
    icon: LogIn,
    color: 'bg-blue-500',
    title: 'Connexion',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">Ouvrez votre navigateur et accédez à l'adresse ci-dessous :</p>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center font-mono font-bold text-sm text-primary">
          logistique-d3-frontend.vercel.app
        </div>
        <p className="text-muted-foreground">
          Saisissez votre adresse email et votre mot de passe, puis cliquez sur <strong>Se connecter</strong>.
          Contactez l'administrateur si vous n'avez pas encore de compte.
        </p>
        <Box type="amber" title="Mot de passe">
          Changez votre mot de passe dès la première connexion via <strong>Paramètres</strong>.
        </Box>
      </div>
    ),
  },
  {
    id: 'interface',
    icon: LayoutDashboard,
    color: 'bg-indigo-500',
    title: 'Interface générale',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">L'application est divisée en deux zones principales :</p>
        <div className="space-y-2">
          {[
            { title: 'Menu latéral gauche', desc: 'Navigation entre les différents modules (Commandes, Livraisons, Stock…)' },
            { title: 'Zone centrale', desc: 'Contenu du module sélectionné' },
            { title: 'Barre supérieure', desc: 'Notifications, mode sombre/clair, déconnexion' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-2.5 p-2.5 bg-muted/20 rounded-lg border border-border/40">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground">
          Les données se rafraîchissent automatiquement toutes les 15 secondes. Vous pouvez aussi actualiser manuellement avec le bouton dédié.
        </p>
      </div>
    ),
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    color: 'bg-violet-500',
    title: 'Tableau de bord',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">Le tableau de bord affiche un résumé en temps réel de l'activité logistique.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-3 py-2">Indicateur</th>
                <th className="text-left px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Commandes en attente', 'Commandes reçues non encore traitées'],
                ['Alertes stock', 'Articles en-dessous du seuil minimum'],
                ['Expédiées (non livrées)', 'En attente de confirmation de réception'],
                ['Livrées ce mois', 'Commandes confirmées reçues sur le mois en cours'],
              ].map(([label, desc]) => (
                <tr key={label} className="border-t border-border/40">
                  <td className="px-3 py-2 font-semibold">{label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Box type="blue" title="Filtres">
          Utilisez les menus en haut du dashboard pour filtrer par <strong>mois</strong>, <strong>département</strong> ou <strong>entrepôt</strong>.
        </Box>
      </div>
    ),
  },
  {
    id: 'commandes',
    icon: ClipboardList,
    color: 'bg-emerald-500',
    title: 'Commandes prestataires',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">Cycle de vie d'une commande :</p>
        <StatusFlow />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="font-semibold mb-2">Validation (Logisticien 1)</p>
            <StepFlow steps={[
              'Aller dans le menu Commandes',
              'Cliquer sur une commande "En attente"',
              'Vérifier les articles et le stock disponible',
              'Saisir les quantités validées',
              'Cliquer sur "Valider la commande"',
            ]} />
          </div>
          <div>
            <p className="font-semibold mb-2">Expédition (Logisticien 2)</p>
            <StepFlow steps={[
              'Filtrer par statut "Validée"',
              'Cliquer sur la commande à expédier',
              'Vérifier les quantités à fournir',
              'Cliquer sur "Expédier" — le stock est décrémenté',
              'À réception : cliquer sur "Marquer comme livrée"',
            ]} />
          </div>
        </div>

        <Box type="blue" title="Import Excel">
          Importez un bon de commande (.xlsx) via le bouton <strong>Import Excel</strong>. Les articles sont associés automatiquement par référence.
        </Box>

        <Box type="amber" title="Supprimer une commande">
          L'icône de suppression efface définitivement la commande (une confirmation est demandée). À utiliser uniquement en cas d'erreur de saisie.
        </Box>
      </div>
    ),
  },
  {
    id: 'livraisons',
    icon: Truck,
    color: 'bg-orange-500',
    title: 'Livraisons fournisseurs',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">
          Enregistrez les réapprovisionnements reçus de vos fournisseurs. Chaque livraison met le stock à jour automatiquement.
        </p>
        <StepFlow steps={[
          'Aller dans le menu Livraisons',
          'Cliquer sur "+ Nouvelle livraison"',
          'Renseigner le fournisseur et l\'entrepôt de réception',
          'Ajouter les articles et les quantités réellement reçues',
          'Optionnel : uploader le bon de livraison (PDF ou image)',
          'Cliquer sur "Enregistrer" — le stock est mis à jour',
        ]} />
        <Box type="green" title="Mise à jour automatique">
          Les quantités en stock des articles reçus sont incrémentées immédiatement dans l'entrepôt sélectionné.
        </Box>
      </div>
    ),
  },
  {
    id: 'stock',
    icon: Package,
    color: 'bg-cyan-500',
    title: 'Stock & Articles',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">Consultez les quantités disponibles par article et par entrepôt.</p>
        <StepFlow steps={[
          'Aller dans Articles & Stock',
          'Sélectionner un entrepôt (ou laisser "Tous les entrepôts")',
          'Le tableau affiche : référence, article, stock théorique, seuil, statut',
        ]} />
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { color: 'bg-green-500', label: 'Vert', desc: 'Stock au-dessus du seuil' },
            { color: 'bg-red-500', label: 'Rouge', desc: 'Sous le seuil — réapprovisionnement requis' },
            { color: 'bg-gray-400', label: 'Gris', desc: 'Aucun stock enregistré' },
          ].map(item => (
            <div key={item.label} className="p-2.5 bg-muted/20 rounded-lg border border-border/40 text-center">
              <div className={cn('w-4 h-4 rounded-full mx-auto mb-1', item.color)} />
              <p className="font-semibold">{item.label}</p>
              <p className="text-muted-foreground text-[10px] mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'mouvements',
    icon: ArrowLeftRight,
    color: 'bg-pink-500',
    title: 'Mouvements de stock',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">Retrace tous les flux d'articles : entrées (fournisseurs) et sorties (prestataires).</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <Badge color="green">ENTRÉE</Badge>
            <p className="mt-1.5 text-green-800">Réception d'articles — stock augmente</p>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <Badge color="red">SORTIE</Badge>
            <p className="mt-1.5 text-red-800">Envoi d'articles — stock diminue</p>
          </div>
        </div>
        <StepFlow steps={[
          'Cliquer sur "+ Nouveau mouvement"',
          'Choisir le type (Entrée ou Sortie)',
          'Sélectionner l\'article, l\'entrepôt et la quantité',
          'Renseigner le département et le manager si applicable',
          'Valider — le stock est mis à jour immédiatement',
        ]} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-3 py-2">Champ</th>
                <th className="text-left px-3 py-2">Signification</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Envoyé', 'L\'article a été expédié'],
                ['Reçu', 'Le destinataire a confirmé la réception'],
              ].map(([col, sig]) => (
                <tr key={col} className="border-t border-border/40">
                  <td className="px-3 py-2 font-semibold">{col}</td>
                  <td className="px-3 py-2 text-muted-foreground">{sig}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: 'inventaire',
    icon: ClipboardCheck,
    color: 'bg-teal-500',
    title: 'Inventaires physiques',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">Réalisez des comptages physiques et comparez avec le stock théorique.</p>
        <StepFlow steps={[
          'Aller dans le menu Inventaire',
          'Sélectionner l\'entrepôt à inventorier',
          'Cliquer sur "Saisir un inventaire"',
          'Pour chaque article, saisir la quantité physiquement comptée',
          'Valider — l\'écart est calculé automatiquement',
        ]} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-3 py-2">Colonne</th>
                <th className="text-left px-3 py-2">Signification</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Stock théorique', 'Quantité calculée par le système'],
                ['Qté comptée', 'Résultat du comptage physique'],
                ['Écart', 'Différence (+ = surplus, − = manque)'],
                ['Date inventaire', 'Date et heure du dernier comptage'],
              ].map(([col, sig]) => (
                <tr key={col} className="border-t border-border/40">
                  <td className="px-3 py-2 font-semibold">{col}</td>
                  <td className="px-3 py-2 text-muted-foreground">{sig}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">L'onglet <strong>Historique</strong> liste toutes les sessions d'inventaire passées.</p>
      </div>
    ),
  },
  {
    id: 'commandes-ts',
    icon: RefreshCw,
    color: 'bg-amber-500',
    title: 'Commandes TS',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">Les Commandes TS (Tranche Successive) planifient l'approvisionnement périodique de plusieurs entrepôts.</p>
        <StepFlow steps={[
          'Aller dans Commandes TS → "+ Nouvelle commande TS"',
          'Renseigner le titre, la date de début et de fin',
          'Sélectionner les articles concernés',
          'Saisir les quantités PROD, SAV et Malfaçon par article',
          'Définir le taux de répartition par entrepôt (total = 100 %)',
          'Valider',
        ]} />
        <div className="flex gap-2 items-center flex-wrap">
          <Badge color="blue">EN COURS</Badge>
          <span className="text-muted-foreground">→</span>
          <Badge color="gray">CLÔTURÉE</Badge>
        </div>
        <p className="text-muted-foreground">Cliquer sur <strong>Clôturer</strong> quand toutes les livraisons sont reçues.</p>
        <Box type="amber" title="Suppression">
          Une commande TS peut être supprimée via l'icône de suppression (confirmation requise). Action réservée à la phase de test ou à une erreur de saisie.
        </Box>
      </div>
    ),
  },
  {
    id: 'liens',
    icon: Link2,
    color: 'bg-rose-500',
    title: 'Liens prestataires',
    content: (
      <div className="space-y-3 text-xs">
        <p className="text-muted-foreground">Permettez à vos prestataires de soumettre des commandes via un formulaire en ligne, sans nécessiter de compte.</p>
        <StepFlow steps={[
          'Aller dans Commandes → onglet "Liens prestataire"',
          'Saisir un nom pour le lien (ex : "Formulaire Dept 49")',
          'Définir la durée de validité (en jours)',
          'Cliquer sur "Générer"',
          'Copier le lien et l\'envoyer par email au prestataire',
        ]} />
        <Box type="green" title="Côté prestataire">
          Le prestataire ouvre le lien, remplit le formulaire et soumet. La commande apparaît immédiatement dans l'application avec le statut <Badge color="gray">En attente</Badge>.
        </Box>
        <Box type="amber" title="Expiration">
          Un lien expiré ne peut plus être utilisé. Désactivez-le depuis la liste et générez-en un nouveau si nécessaire.
        </Box>
      </div>
    ),
  },
];

export default function Guide() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* En-tête */}
      <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold">Guide utilisateur</h1>
            <p className="text-xs text-muted-foreground">Logistique D3 — Manuel d'utilisation</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted/40 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" /> Imprimer
        </button>
      </div>

      {/* URL d'accès */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Adresse de l'application</p>
          <p className="font-mono font-bold text-primary text-sm">logistique-d3-frontend.vercel.app</p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText('https://logistique-d3-frontend.vercel.app')}
          className="px-3 py-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors"
        >
          Copier
        </button>
      </div>

      {/* Sections accordéon */}
      <div className="space-y-2">
        {sections.map((section, idx) => {
          const isOpen = openId === section.id;
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : section.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors"
              >
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white', section.color)}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-xs font-semibold">{idx + 1}. {section.title}</span>
                </div>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                }
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-border/40">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pied de page */}
      <div className="border border-border rounded-xl p-4 text-center text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-0.5">Logistique D3 — Gestion de stock fibre optique</p>
        <p>logistique-d3-frontend.vercel.app</p>
        <p className="mt-1 text-[10px]">Document interne — Version 1.0 — 2026</p>
      </div>
    </div>
  );
}
