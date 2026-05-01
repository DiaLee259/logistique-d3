export type Role = 'ADMIN' | 'LOGISTICIEN_1' | 'LOGISTICIEN_2' | 'CHEF_PROJET';
export type TypeMouvement = 'ENTREE' | 'SORTIE';
export type ProdSav = 'PROD' | 'SAV' | 'MALFACON' | 'AUTRE';
export type StatutCommande = 'EN_ATTENTE' | 'EN_VALIDATION' | 'VALIDEE' | 'EN_ATTENTE_LOG2' | 'EXPEDIEE' | 'LIVREE' | 'ANNULEE';
export type StatutLivraison = 'EN_ATTENTE' | 'EN_COURS' | 'LIVREE' | 'INCIDENT';

export type PrivilegeLevel = 'NONE' | 'LECTURE' | 'EDITEUR' | 'ADMIN';

export interface UserPrivileges {
  modules: {
    dashboard:   PrivilegeLevel;
    commandes:   PrivilegeLevel;
    commandesTS: PrivilegeLevel;
    livraisons:  PrivilegeLevel;
    inventaire:  PrivilegeLevel;
    mouvements:  PrivilegeLevel;
    parametres:  PrivilegeLevel;
    guide:       PrivilegeLevel;
  };
  entrepots: string[];   // [] = tous visibles, sinon liste d'IDs
  actions: {
    importExcel:       boolean;
    exportExcel:       boolean;
    creerArticle:      boolean;
    supprimerRecord:   boolean;
    gererUtilisateurs: boolean;
  };
}

export const DEFAULT_PRIVILEGES: UserPrivileges = {
  modules: {
    dashboard:   'LECTURE',
    commandes:   'EDITEUR',
    commandesTS: 'LECTURE',
    livraisons:  'LECTURE',
    inventaire:  'LECTURE',
    mouvements:  'LECTURE',
    parametres:  'NONE',
    guide:       'LECTURE',
  },
  entrepots: [],
  actions: {
    importExcel:       true,
    exportExcel:       true,
    creerArticle:      false,
    supprimerRecord:   false,
    gererUtilisateurs: false,
  },
};

export interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  actif: boolean;
  createdAt: string;
  privileges?: UserPrivileges;
}

export interface Entrepot {
  id: string;
  code: string;
  nom: string;
  localisation: string;
  gestionnaire?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  actif: boolean;
}

export interface Article {
  id: string;
  reference: string;
  nom: string;
  description?: string;
  unite: string;
  seuilAlerte: number;
  actif: boolean;
  regleConsommation?: string;
  facteurConsommation?: number;
  stocks?: Stock[];
  stockTotal?: number;
  enAlerte?: boolean;
}

export interface Stock {
  id: string;
  articleId: string;
  entrepotId: string;
  quantite: number;
  article?: Article;
  entrepot?: Entrepot;
}

export interface Mouvement {
  id: string;
  date: string;
  articleId: string;
  entrepotId: string;
  type: TypeMouvement;
  quantiteDemandee: number;
  quantiteFournie: number;
  departement?: string;
  numeroCommande?: string;
  numeroOperation?: string;
  sourceDestination?: string;
  prodSav: ProdSav;
  commentaire?: string;
  adresseMail?: string;
  manager?: string;
  infoSupplementaire?: string;
  adresse?: string;
  cout?: number;
  envoye: boolean;
  recu: boolean;
  article?: Article;
  entrepot?: Entrepot;
  user?: User;
}

export interface LigneCommande {
  id: string;
  commandeId: string;
  articleId: string;
  quantiteDemandee: number;
  quantiteValidee?: number;
  quantiteFournie?: number;
  commentaire?: string;
  stockDisponible?: number;
  entrepotSource?: string;
  article?: Article;
}

export interface Commande {
  id: string;
  numero: string;
  dateReception: string;
  dateCommande?: string;
  dateTraitement?: string;
  dateTransmissionLog2?: string;
  dateExpedition?: string;
  dateLivraison?: string;
  departement: string;
  demandeur?: string;
  emailDemandeur?: string;
  societe?: string;
  interlocuteur?: string;
  manager?: string;
  nombreGrilles?: number;
  typeGrille?: string;
  statut: StatutCommande;
  commentaire?: string;
  commentaireLog2?: string;
  fichierExcelUrl?: string;
  fichierPerceptionUrl?: string;
  bonRetourUrl?: string;
  emailEnvoye: boolean;
  dateEmailEnvoye?: string;
  bonRetourRecu: boolean;
  dateBonRetourRecu?: string;
  valideurId?: string;
  expediteurId?: string;
  intervenantId?: string;
  dateValidation?: string;
  telephoneDestinataire?: string;
  adresseLivraison?: string;
  lignes?: LigneCommande[];
  valideur?: User;
  expediteur?: User;
  intervenant?: Pick<Intervenant, 'id' | 'nom' | 'prenom'>;
}

export interface LigneLivraison {
  id: string;
  articleId: string;
  quantiteCommandee: number;
  quantiteRecue: number;
  commentaire?: string;
  article?: Article;
}

export interface Livraison {
  id: string;
  numero: string;
  dateLivraison: string;
  fournisseur: string;
  entrepotId: string;
  statut: StatutLivraison;
  bonLivraisonUrl?: string;
  bonCommandeUrl?: string;
  commentaire?: string;
  lignes?: LigneLivraison[];
  entrepot?: Entrepot;
}

export interface Notification {
  id: string;
  userId?: string;
  type: string;
  titre: string;
  message: string;
  lue: boolean;
  lien?: string;
  createdAt: string;
}

export interface Societe {
  id: string;
  nom: string;
  code?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  actif: boolean;
  createdAt: string;
  intervenants?: Pick<Intervenant, 'id' | 'nom' | 'prenom'>[];
}

export interface Intervenant {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  societeId?: string;
  actif: boolean;
  autoEntrepreneur?: boolean;
  createdAt: string;
  societe?: Pick<Societe, 'id' | 'nom' | 'code'>;
}

export interface DashboardKpis {
  totalEntrees: number;
  totalSorties: number;
  soldeNet: number;
  articlesActifs: number;
  commandesEnAttente: number;
  commandesAttLog2: number;
  commandesValidees: number;
  commandesExpediees: number;
  commandesLivrees: number;
  commandesTraitees: number;
  commandesTotal: number;
  stocksEnAlerte: number;
  tauxService: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ArticleStats extends Article {
  stockPhysique: number;
  stockTheorique: number;
  totalEntrees: number;
  totalSorties: number;
  ecart: number;
  stockTotal: number;
  enAlerte: boolean;
}

export interface RepartitionCommandeTS {
  id: string;
  ligneCommandeTSId: string;
  entrepotId: string;
  tauxRepartition: number;
  qteRecue: number;
  entrepot?: Entrepot;
}

export interface LigneCommandeTS {
  id: string;
  commandeTSId: string;
  articleId: string;
  qteProd: number;
  qteSav: number;
  qteMalfacon: number;
  article?: Article;
  repartitions?: RepartitionCommandeTS[];
}

export interface CommandeTS {
  id: string;
  numero: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  commentaire?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: User;
  lignes?: LigneCommandeTS[];
}
