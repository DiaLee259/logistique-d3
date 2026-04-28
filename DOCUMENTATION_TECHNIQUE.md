# Documentation Technique — Logistique D3
## Application de Gestion de Stock Fibre Optique

> Version : 1.0 | Date : Avril 2026 | Statut : Production

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Structure du projet](#3-structure-du-projet)
4. [Modèle de données](#4-modèle-de-données)
5. [Logique métier](#5-logique-métier)
6. [API Backend — Référence complète](#6-api-backend--référence-complète)
7. [Diagrammes](#7-diagrammes)
8. [Authentification & sécurité](#8-authentification--sécurité)
9. [Déploiement](#9-déploiement)
10. [Maintenance & évolutivité](#10-maintenance--évolutivité)
11. [Tests](#11-tests)
12. [Checklists & risques](#12-checklists--risques)

---

## 1. Vue d'ensemble

### Objectif

**Logistique D3** est une application web interne de gestion de stock de matériel fibre optique. Elle centralise l'ensemble des flux logistiques : mouvements de stock, commandes prestataires, livraisons fournisseurs, inventaires physiques et approvisionnements périodiques.

### Problème métier résolu

Avant cette application, la gestion du stock se faisait sur des tableurs Excel dispersés entre plusieurs équipes (backoffice, terrain, chefs de projet). Cela engendrait :
- Des écarts de stock non détectés
- Des commandes traitées sans traçabilité
- Aucune visibilité sur les inventaires physiques
- Coordination impossible entre logisticiens terrain et backoffice

### Types d'utilisateurs

| Rôle | Code | Droits |
|------|------|--------|
| Administrateur | `ADMIN` | Accès total, gestion utilisateurs, paramètres |
| Logisticien Backoffice | `LOGISTICIEN_1` | Validation commandes, création mouvements, inventaires |
| Logisticien Terrain | `LOGISTICIEN_2` | Expéditions, livraisons, lecture stock |
| Chef de Projet | `CHEF_PROJET` | Lecture seule, dashboard, suivi commandes |

### Cas d'usage principaux

1. **Gestion des mouvements** — Entrées/Sorties de stock par entrepôt, article, département
2. **Workflow commandes prestataires** — Réception → Validation Log1 → Expédition Log2 → Livraison
3. **Livraisons fournisseurs** — Suivi BL, mise à jour automatique du stock
4. **Commandes TS** — Approvisionnements périodiques (1-3 mois) avec répartition par entrepôt
5. **Inventaire physique** — Comptage mensuel, alertes si > 3 mois sans inventaire
6. **Dashboard analytique** — KPIs, évolution stock, top articles, délais de traitement

---

## 2. Architecture technique

### Stack

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | React + TypeScript | 18 / 5.x |
| Build tool | Vite | 5.x |
| UI / Styling | Tailwind CSS | 3.x |
| State / Data | TanStack Query (React Query) | 5.x |
| Routing | React Router DOM | 6.x |
| HTTP Client | Axios | 1.x |
| Backend | NestJS | 10.x |
| Runtime | Node.js | 20+ |
| ORM | Prisma | 5.x |
| Base de données | PostgreSQL | 16 |
| Auth | JWT (jsonwebtoken) + bcryptjs | — |
| Notifications toasts | Sonner | 1.x |

### Description des couches

**Frontend (React SPA)**
Application monopage servie par NestJS en production. Toute la logique de navigation, d'affichage et de validation des formulaires est côté client. Les appels API sont centralisés dans `src/lib/api.ts` via Axios avec intercepteurs JWT.

**Backend (NestJS)**
API REST modulaire organisée en domaines métier. Chaque module contient : Controller (routes HTTP), Service (logique métier), Module (injection de dépendances). Le backend sert également les fichiers statiques du frontend en production.

**Base de données (PostgreSQL + Prisma)**
Schéma relationnel complet avec 14 modèles. Prisma ORM assure la type-safety des requêtes. Les migrations sont gérées via `prisma migrate`.

### Schéma d'architecture global

```mermaid
graph TB
    subgraph "Navigateur"
        UI[React SPA<br/>Vite + Tailwind]
        RQ[TanStack Query<br/>Cache & State]
        AX[Axios<br/>+ JWT interceptor]
    end

    subgraph "Serveur Node.js :3000"
        STATIC[Express Static<br/>dist/ frontend]
        API[NestJS API<br/>prefix /api]
        subgraph "Modules NestJS"
            AUTH[Auth Module<br/>JWT]
            USERS[Users Module]
            ARTICLES[Articles Module]
            MOUVEMENTS[Mouvements Module]
            ENTREPOTS[Entrepots Module]
            STOCK[Stock Module]
            COMMANDES[Commandes Module]
            LIVRAISONS[Livraisons Module]
            CMDTS[CommandesTS Module]
            INVENTAIRES[Inventaires Module]
            DASHBOARD[Dashboard Module]
            NOTIFS[Notifications Module]
            UPLOADS[Uploads Module]
        end
        PRISMA[Prisma ORM]
    end

    subgraph "Base de données"
        PG[(PostgreSQL 16)]
    end

    UI --> RQ --> AX
    AX -->|GET /| STATIC
    AX -->|/api/*| API
    API --> AUTH
    API --> USERS
    API --> ARTICLES
    API --> MOUVEMENTS
    API --> ENTREPOTS
    API --> STOCK
    API --> COMMANDES
    API --> LIVRAISONS
    API --> CMDTS
    API --> INVENTAIRES
    API --> DASHBOARD
    API --> NOTIFS
    API --> UPLOADS
    PRISMA --> PG
    AUTH --> PRISMA
    ARTICLES --> PRISMA
    MOUVEMENTS --> PRISMA
    COMMANDES --> PRISMA
    LIVRAISONS --> PRISMA
    CMDTS --> PRISMA
    INVENTAIRES --> PRISMA
    DASHBOARD --> PRISMA
```

---

## 3. Structure du projet

```
Claude code/
├── backend/                        # API NestJS
│   ├── src/
│   │   ├── main.ts                 # Point d'entrée, config Express + static
│   │   ├── app.module.ts           # Module racine, imports de tous les modules
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts    # Module Prisma global
│   │   │   └── prisma.service.ts   # Instance PrismaClient singleton
│   │   ├── auth/
│   │   │   ├── auth.controller.ts  # POST /login, GET /me, POST /refresh
│   │   │   ├── auth.service.ts     # Validation bcrypt + génération JWT
│   │   │   ├── auth.module.ts
│   │   │   ├── jwt.strategy.ts     # Stratégie Passport JWT
│   │   │   ├── jwt-auth.guard.ts   # Guard appliqué sur tous les endpoints
│   │   │   ├── roles.guard.ts      # Guard vérification rôle
│   │   │   ├── roles.decorator.ts  # @Roles() decorator
│   │   │   └── public.decorator.ts # @Public() decorator (bypass JWT)
│   │   ├── users/
│   │   │   ├── users.controller.ts # CRUD utilisateurs + toggle actif
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   ├── stock/
│   │   │   ├── articles/           # CRUD articles + stats
│   │   │   ├── entrepots/          # CRUD entrepôts
│   │   │   ├── mouvements/         # CRUD mouvements + filtres + pagination
│   │   │   ├── inventaires/        # Inventaire physique + alertes
│   │   │   ├── stock.controller.ts # Vue stock consolidé, alertes, écarts
│   │   │   └── stock.service.ts
│   │   ├── orders/
│   │   │   ├── commandes/          # Workflow commandes prestataires
│   │   │   ├── livraisons/         # Livraisons fournisseurs
│   │   │   └── commandes-ts/       # Commandes approvisionnement périodique
│   │   ├── dashboard/              # KPIs agrégés
│   │   ├── notifications/          # Système de notifications in-app
│   │   ├── uploads/                # Upload fichiers + parsing Excel
│   │   ├── pdf/                    # Génération PDF fiche perception
│   │   └── seed/                   # Script de données initiales
│   ├── prisma/
│   │   ├── schema.prisma           # Schéma complet (14 modèles)
│   │   └── migrations/             # Historique migrations DB
│   ├── frontend/                   # Build React (dist/) copié ici
│   ├── .env                        # Variables d'environnement
│   └── package.json
│
└── frontend/                       # Application React
    ├── src/
    │   ├── main.tsx                # Point d'entrée React
    │   ├── App.tsx                 # Router + providers globaux
    │   ├── index.css               # Variables CSS + Tailwind + dark mode
    │   ├── components/
    │   │   ├── AppLayout.tsx       # Layout principal (sidebar + header)
    │   │   ├── AppSidebar.tsx      # Navigation latérale collapsible
    │   │   ├── AppHeader.tsx       # Barre supérieure, notifs, thème, user
    │   │   ├── KpiCard.tsx         # Carte KPI réutilisable
    │   │   └── StatusBadge.tsx     # Badge statut coloré
    │   ├── contexts/
    │   │   ├── AuthContext.tsx     # JWT storage, login/logout, hasRole()
    │   │   └── ThemeContext.tsx    # Dark/light mode (localStorage)
    │   ├── lib/
    │   │   ├── api.ts              # Tous les appels API (Axios, 15 namespaces)
    │   │   ├── types.ts            # Types TypeScript (15 interfaces)
    │   │   └── utils.ts            # cn(), formatDate(), formatNumber()
    │   └── pages/
    │       ├── Login.tsx           # Page connexion
    │       ├── Dashboard.tsx       # KPIs, graphiques, alertes inventaire
    │       ├── Articles.tsx        # CRUD articles + état du stock
    │       ├── Mouvements.tsx      # Journal mouvements + filtres + création
    │       ├── Commandes.tsx       # Liste commandes prestataires
    │       ├── CommandeDetail.tsx  # Détail + workflow commande
    │       ├── Livraisons.tsx      # Livraisons fournisseurs + détail expandable
    │       ├── CommandesTS.tsx     # Commandes approvisionnement périodique
    │       ├── Inventaire.tsx      # Inventaire physique par entrepôt
    │       ├── Parametres.tsx      # Config articles, entrepôts, utilisateurs
    │       ├── PrestaireForm.tsx   # Formulaire public prestataire (no auth)
    │       └── NotFound.tsx        # Page 404
    └── package.json
```

---

## 4. Modèle de données

### Enums

```
Role          : ADMIN | LOGISTICIEN_1 | LOGISTICIEN_2 | CHEF_PROJET
TypeMouvement : ENTREE | SORTIE
StatutCommande: EN_ATTENTE | EN_VALIDATION | VALIDEE | EN_ATTENTE_LOG2 | EXPEDIEE | LIVREE | ANNULEE
StatutLivraison: EN_ATTENTE | EN_COURS | LIVREE | INCIDENT
ProdSav       : PROD | SAV | MALFACON | AUTRE
```

### Tables et champs

| Table | Champs clés | Description |
|-------|-------------|-------------|
| `users` | id, email (unique), password (bcrypt), nom, prenom, role, actif | Comptes utilisateurs |
| `entrepots` | id, code (unique), nom, localisation, gestionnaire?, adresse?, telephone?, email?, actif | Sites de stockage |
| `articles` | id, reference (unique), nom, description?, unite, seuilAlerte, actif, regleConsommation?, facteurConsommation? | Catalogue matériel |
| `stocks` | articleId, entrepotId (unique pair), quantite | Stock courant par article/entrepôt |
| `mouvements` | date, articleId, entrepotId, type, quantiteDemandee, quantiteFournie, departement?, sourceDestination?, prodSav, envoye, recu, userId?, commandeId? | Journal des flux |
| `commandes` | numero (unique), statut, departement, demandeur?, tokenPublic?, valideurId?, expediteurId? | Commandes prestataires |
| `lignes_commande` | commandeId, articleId, quantiteDemandee, quantiteValidee?, quantiteFournie? | Détail commandes |
| `livraisons` | numero (unique), dateLivraison, fournisseur, entrepotId, statut, commandeId? | Réceptions fournisseurs |
| `lignes_livraison` | livraisonId, articleId, quantiteCommandee, quantiteRecue | Détail livraisons |
| `commandes_ts` | numero (unique), titre, dateDebut, dateFin, statut (EN_COURS/CLOTUREE) | Commandes périodiques |
| `lignes_commandes_ts` | commandeTSId, articleId, qteProd, qteSav, qteMalfacon | Lignes par type |
| `repartitions_commandes_ts` | ligneCommandeTSId, entrepotId, tauxRepartition, qteRecue* | Répartition par entrepôt |
| `inventaires_physiques` | articleId, entrepotId, quantite, date, userId? | Comptages physiques |
| `notifications` | userId?, type, titre, message, lue, lien? | Notifications in-app |
| `liens_prestataire` | token (unique), nom, actif, expiresAt?, utilisations | Liens formulaire public |
| `consommations` | date, articleId, departement?, quantiteTheorique, quantiteReelle, ecart | Suivi consommation |

> *`qteRecue` dans `repartitions_commandes_ts` est **calculé dynamiquement** en production (agrégation sur `lignes_livraison`), la colonne DB n'est pas utilisée pour l'affichage.

### Diagramme ERD

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string password
        string nom
        string prenom
        enum role
        bool actif
    }

    entrepots {
        uuid id PK
        string code UK
        string nom
        string localisation
        string gestionnaire
        bool actif
    }

    articles {
        uuid id PK
        string reference UK
        string nom
        string unite
        int seuilAlerte
        bool actif
    }

    stocks {
        uuid id PK
        uuid articleId FK
        uuid entrepotId FK
        int quantite
    }

    mouvements {
        uuid id PK
        datetime date
        uuid articleId FK
        uuid entrepotId FK
        enum type
        int quantiteDemandee
        int quantiteFournie
        string departement
        enum prodSav
        bool envoye
        bool recu
        uuid userId FK
    }

    commandes {
        uuid id PK
        string numero UK
        enum statut
        string departement
        string tokenPublic UK
        uuid valideurId FK
        uuid expediteurId FK
    }

    lignes_commande {
        uuid id PK
        uuid commandeId FK
        uuid articleId FK
        int quantiteDemandee
        int quantiteValidee
        int quantiteFournie
    }

    livraisons {
        uuid id PK
        string numero UK
        datetime dateLivraison
        string fournisseur
        uuid entrepotId FK
        enum statut
        uuid commandeId FK
    }

    lignes_livraison {
        uuid id PK
        uuid livraisonId FK
        uuid articleId FK
        int quantiteCommandee
        int quantiteRecue
    }

    commandes_ts {
        uuid id PK
        string numero UK
        string titre
        datetime dateDebut
        datetime dateFin
        string statut
        uuid createdById FK
    }

    lignes_commandes_ts {
        uuid id PK
        uuid commandeTSId FK
        uuid articleId FK
        int qteProd
        int qteSav
        int qteMalfacon
    }

    repartitions_commandes_ts {
        uuid id PK
        uuid ligneCommandeTSId FK
        uuid entrepotId FK
        float tauxRepartition
        int qteRecue
    }

    inventaires_physiques {
        uuid id PK
        uuid articleId FK
        uuid entrepotId FK
        int quantite
        datetime date
        uuid userId
    }

    notifications {
        uuid id PK
        uuid userId
        string type
        string titre
        string message
        bool lue
    }

    users ||--o{ mouvements : "crée"
    users ||--o{ commandes_ts : "crée"
    users }o--o{ commandes : "valide/expédie"
    entrepots ||--o{ stocks : "contient"
    entrepots ||--o{ mouvements : "concerne"
    entrepots ||--o{ livraisons : "reçoit"
    entrepots ||--o{ repartitions_commandes_ts : "cible"
    articles ||--o{ stocks : "stocké dans"
    articles ||--o{ mouvements : "mouvement sur"
    articles ||--o{ lignes_commande : "commandé"
    articles ||--o{ lignes_livraison : "livré"
    articles ||--o{ lignes_commandes_ts : "planifié"
    articles ||--o{ inventaires_physiques : "compté"
    commandes ||--o{ lignes_commande : "contient"
    commandes ||--o{ livraisons : "génère"
    livraisons ||--o{ lignes_livraison : "contient"
    commandes_ts ||--o{ lignes_commandes_ts : "contient"
    lignes_commandes_ts ||--o{ repartitions_commandes_ts : "réparti"
```

---

## 5. Logique métier

### 5.1 Gestion du stock (mouvements)

Chaque mouvement de stock (ENTREE ou SORTIE) déclenche une mise à jour automatique de la table `stocks` (upsert). La quantité théorique est toujours la somme algébrique des mouvements depuis l'origine.

**Règles :**
- `ENTREE` → `stocks.quantite += quantiteFournie`
- `SORTIE` → `stocks.quantite -= quantiteFournie`
- Une SORTIE ne peut pas mettre le stock en négatif (pas de garde côté backend, avertissement côté frontend)
- Filtres disponibles : mois, période, entrepôt, article, département, type, search fulltext
- Pagination : 20 par page par défaut

**Champs de traçabilité :**
- `envoye` : booléen indiquant si le matériel a été physiquement expédié
- `recu` : booléen indiquant si le matériel a été confirmé reçu
- `prodSav` : classification PROD / SAV / MALFACON / AUTRE

### 5.2 Workflow commandes prestataires

Les commandes suivent un workflow strict en 7 étapes :

```
EN_ATTENTE → EN_VALIDATION → VALIDEE → EN_ATTENTE_LOG2 → EXPEDIEE → LIVREE
                                                                   ↘ ANNULEE
```

**Étapes détaillées :**
1. **EN_ATTENTE** — Commande créée (interne ou via formulaire public prestataire)
2. **EN_VALIDATION** — Log1 examine la commande
3. **VALIDEE** — Log1 valide, quantités confirmées, stock vérifié
4. **EN_ATTENTE_LOG2** — Transmise au logisticien terrain (Log2)
5. **EXPEDIEE** — Log2 marque l'expédition, mouvements SORTIE créés automatiquement
6. **LIVREE** — Confirmation réception par le prestataire

**Lien prestataire public :**
- Un token UUID unique (`tokenPublic`) permet à un prestataire d'accéder à un formulaire sans authentification
- Ce formulaire crée la commande directement en `EN_ATTENTE`
- Traçable via `LienPrestataire` (compteur d'utilisations, expiration optionnelle)

**Fiche perception :**
- Génération PDF via le service PDF (`pdf.service.ts`)
- Accessible via `GET /commandes/:id/fiche-perception`

### 5.3 Livraisons fournisseurs

- Chaque livraison est associée à un entrepôt et un fournisseur
- Les lignes de livraison (article + quantité reçue) mettent à jour le stock (`ENTREE`)
- Statuts : `EN_ATTENTE → EN_COURS → LIVREE / INCIDENT`
- Une livraison peut être liée à une commande TS (via `commandeId`)

### 5.4 Commandes TS (approvisionnement périodique)

- Commande créée pour une période définie (dateDebut → dateFin)
- Chaque ligne précise les quantités par type : PROD, SAV, MALFACON
- La répartition par entrepôt (`tauxRepartition`) est configurée à la création
- **`qteRecue` est calculé dynamiquement** : agrégation des `LigneLivraison` dont l'article, l'entrepôt et la date de livraison correspondent à la période de la commande TS
- Taux de couverture = `totalRecu / totalCommandé × 100`
- Une commande TS peut être clôturée (statut `CLOTUREE`)

```typescript
// Logique de calcul qteRecue (commandes-ts.service.ts)
const result = await prisma.ligneLivraison.aggregate({
  where: {
    articleId: ligne.articleId,
    livraison: {
      entrepotId: rep.entrepotId,
      dateLivraison: { gte: commande.dateDebut, lte: commande.dateFin },
    },
  },
  _sum: { quantiteRecue: true },
});
rep.qteRecue = result._sum.quantiteRecue ?? 0;
```

### 5.5 Inventaire physique

- Un inventaire = saisie des quantités comptées physiquement par article et entrepôt
- Stocké dans `inventaires_physiques` avec date horodatée
- **État par entrepôt** : comparaison stock théorique (table `stocks`) vs dernière quantité comptée → calcul de l'écart
- **Alerte** : tout entrepôt sans inventaire depuis > 3 mois est marqué `enAlerte: true`
- **Notification automatique** : si alerte active et pas de notification envoyée dans les 7 derniers jours → création d'une notification globale (`userId: null`) de type `INVENTAIRE_ALERTE`
- L'alerte est visible sur le Dashboard (refetch toutes les 60 secondes)

### 5.6 Notifications

- Modèle global : `userId = null` → visible par tous
- Modèle ciblé : `userId = uuid` → visible uniquement par cet utilisateur
- Types : `INVENTAIRE_ALERTE` (actuellement), extensible
- L'AppHeader affiche un compteur de notifications non lues avec refetch toutes les 30 secondes
- Actions : marquer une lue, marquer toutes lues

### 5.7 Dashboard

KPIs calculés :
- Total entrées / sorties sur la période
- Solde net
- Commandes en attente / validées / expédiées
- Articles en alerte de stock (quantite < seuilAlerte)
- Taux de service (commandes livrées / total)

Graphiques disponibles :
- Évolution entrées/sorties sur 12 mois (histogramme)
- Répartition par département (barres)
- Top 5 articles les plus consommés
- Délais moyens de traitement commandes

---

## 6. API Backend — Référence complète

> Base URL : `http://localhost:3000/api`  
> Auth : Header `Authorization: Bearer <jwt_token>` (sauf endpoints `@Public`)

### Auth

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| POST | `/auth/login` | Non | Connexion → retourne `{ access_token, user }` |
| GET | `/auth/me` | Oui | Profil de l'utilisateur connecté |
| POST | `/auth/refresh` | Oui | Renouvelle le JWT |

**Payload login :**
```json
{ "email": "user@domain.fr", "password": "MonMotDePasse" }
```

**Réponse login :**
```json
{
  "access_token": "eyJhbGci...",
  "user": { "id": "uuid", "email": "...", "nom": "...", "prenom": "...", "role": "ADMIN" }
}
```

---

### Utilisateurs

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/users` | Liste tous les utilisateurs |
| GET | `/users/:id` | Détail utilisateur |
| POST | `/users` | Créer un utilisateur |
| PUT | `/users/:id` | Modifier un utilisateur |
| PATCH | `/users/:id/toggle-actif` | Activer / désactiver |

---

### Articles

| Méthode | Endpoint | Query params | Description |
|---------|----------|-------------|-------------|
| GET | `/articles` | `search`, `actif` | Liste articles |
| GET | `/articles/stats` | `entrepotId` | Articles avec stock physique/théorique/écart |
| GET | `/articles/stock` | — | Stock complet par article |
| GET | `/articles/:id` | — | Détail article |
| POST | `/articles` | — | Créer article |
| PUT | `/articles/:id` | — | Modifier article |
| DELETE | `/articles/:id` | — | Supprimer article |

---

### Entrepôts

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/entrepots` | Liste entrepôts actifs |
| GET | `/entrepots/:id` | Détail entrepôt |
| POST | `/entrepots` | Créer entrepôt |
| PUT | `/entrepots/:id` | Modifier entrepôt |
| DELETE | `/entrepots/:id` | Supprimer entrepôt |

---

### Stock

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/stock` | Vue stock consolidé (avec `entrepotId` optionnel) |
| GET | `/stock/alertes` | Articles sous seuil d'alerte |
| GET | `/stock/ecarts` | Écarts stock théorique vs physique |
| POST | `/stock/inventaire` | Saisir inventaire (ancienne route, préférer `/inventaires`) |

---

### Mouvements

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/mouvements` | Liste paginée avec filtres |
| GET | `/mouvements/:id` | Détail mouvement |
| POST | `/mouvements` | Créer mouvement (met à jour stock) |
| POST | `/mouvements/batch` | Créer plusieurs mouvements d'un coup |
| PUT | `/mouvements/:id` | Modifier mouvement |
| DELETE | `/mouvements/:id` | Supprimer mouvement |
| PATCH | `/mouvements/:id/toggle/:field` | Basculer `envoye` ou `recu` |

**Query params GET /mouvements :**
```
mois=2026-04 | dateDebut=2026-01-01 | dateFin=2026-04-30
entrepotId=uuid | articleId=uuid | departement=string
type=ENTREE|SORTIE | envoye=true|false | recu=true|false
search=string | page=1 | limit=20
```

---

### Commandes prestataires

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/commandes` | Liste paginée |
| GET | `/commandes/:id` | Détail + lignes |
| POST | `/commandes` | Créer commande |
| PATCH | `/commandes/:id/valider` | Log1 valide |
| PATCH | `/commandes/:id/expedier` | Log2 expédie |
| PATCH | `/commandes/:id/livree` | Marquer livraison confirmée |
| PATCH | `/commandes/:id/annuler` | Annuler |
| PATCH | `/commandes/:id/email-envoye` | Marquer email envoyé |
| PATCH | `/commandes/:id/bon-retour` | Enregistrer bon de retour |
| GET | `/commandes/:id/fiche-perception` | Génère PDF (blob) |
| GET | `/commandes/liens` | Liste liens prestataires |
| POST | `/commandes/liens` | Générer lien prestataire |
| PATCH | `/commandes/liens/:id/desactiver` | Désactiver lien |
| GET | `/commandes/public/:token` | Formulaire public (sans auth) |
| POST | `/commandes/public/:token` | Soumettre commande publique |
| GET | `/commandes/public/suivi/:numero` | Suivi commande public |

---

### Livraisons

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/livraisons` | Liste paginée |
| GET | `/livraisons/:id` | Détail + lignes |
| POST | `/livraisons` | Créer livraison (met à jour stock ENTREE) |
| PATCH | `/livraisons/:id/statut` | Modifier statut |

---

### Commandes TS

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/commandes-ts` | Liste avec qteRecue calculé dynamiquement |
| GET | `/commandes-ts/:id` | Détail |
| POST | `/commandes-ts` | Créer commande TS avec lignes et répartitions |
| PUT | `/commandes-ts/:id` | Modifier en-tête |
| PUT | `/commandes-ts/:id/cloturer` | Clôturer |
| PUT | `/commandes-ts/lignes/:ligneId` | Modifier qteProd/qteSav/qteMalfacon |
| PUT | `/commandes-ts/repartitions/:id` | Modifier tauxRepartition |
| DELETE | `/commandes-ts/:id` | Supprimer |

---

### Inventaires physiques

| Méthode | Endpoint | Query params | Description |
|---------|----------|-------------|-------------|
| GET | `/inventaires` | `entrepotId`, `articleId`, `mois` | Historique inventaires |
| GET | `/inventaires/alertes` | — | Entrepôts en alerte (+ déclenche notif si besoin) |
| GET | `/inventaires/entrepot` | `entrepotId` | État stock vs inventaire par entrepôt |
| POST | `/inventaires` | — | Saisir un inventaire |

**Payload POST /inventaires :**
```json
{
  "entrepotId": "uuid",
  "lignes": [
    { "articleId": "uuid", "quantite": 42, "commentaire": "Comptage OK" }
  ]
}
```

---

### Dashboard

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/dashboard/kpis` | KPIs principaux |
| GET | `/dashboard/evolution` | Évolution entrées/sorties |
| GET | `/dashboard/departements` | Répartition par département |
| GET | `/dashboard/demandeurs` | Top demandeurs |
| GET | `/dashboard/delais` | Délais moyens traitement |
| GET | `/dashboard/top-articles` | Articles les plus mouvementés |
| GET | `/dashboard/commandes` | Statistiques commandes |

---

### Notifications

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/notifications` | Liste notifications (userId ou globales) |
| GET | `/notifications/count` | Nombre non lues |
| PATCH | `/notifications/:id/lire` | Marquer lue |
| PATCH | `/notifications/lire-toutes` | Marquer toutes lues |

---

### Uploads

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/uploads/fichier` | Upload fichier (multipart) → retourne URL |
| POST | `/uploads/excel/parse` | Parse Excel → retourne données JSON |

---

## 7. Diagrammes

### 7.1 User Flow — Navigation principale

```mermaid
flowchart TD
    START([Ouverture navigateur]) --> LOGIN[Page Login]
    LOGIN -->|Credentials valides| DASH[Dashboard]
    LOGIN -->|Token expiré| LOGIN
    
    DASH --> ART[Articles & Stock]
    DASH --> MOV[Mouvements]
    DASH --> CMD[Commandes]
    DASH --> LIV[Livraisons]
    DASH --> TS[Commandes TS]
    DASH --> INV[Inventaire]
    DASH --> PARAM[Paramètres]

    CMD --> DETAIL[Détail Commande]
    DETAIL -->|Log1| VALIDER[Valider]
    DETAIL -->|Log2| EXPEDIER[Expédier]
    DETAIL -->|Tous| LIVREE[Marquer Livrée]

    INV --> SELECT[Sélectionner Entrepôt]
    SELECT --> ETAT[Vue état stock vs inventaire]
    ETAT --> SAISIE[Dialog saisie inventaire]
    SAISIE --> SAVE[Enregistrer → DB]

    PARAM --> USERS[Gestion Utilisateurs]
    PARAM --> ENTREPOTS[Gestion Entrepôts]
    PARAM --> ARTICLES_PARAM[Gestion Articles]
```

### 7.2 Séquence — Création d'un mouvement de stock

```mermaid
sequenceDiagram
    actor Log1 as Logisticien 1
    participant FE as Frontend React
    participant API as NestJS API
    participant DB as PostgreSQL

    Log1->>FE: Clic "Nouveau mouvement"
    FE->>FE: Ouvre dialog (article, entrepôt, qté, type)
    Log1->>FE: Remplit et valide
    FE->>API: POST /api/mouvements
    Note over FE,API: { articleId, entrepotId, type: "SORTIE",<br/>quantiteDemandee: 10, quantiteFournie: 10, ... }
    API->>DB: INSERT INTO mouvements
    API->>DB: UPSERT stocks SET quantite = quantite - 10<br/>WHERE articleId AND entrepotId
    DB-->>API: OK
    API-->>FE: 201 { mouvement créé }
    FE->>FE: Invalide cache React Query
    FE-->>Log1: Toast "Mouvement enregistré"
    FE->>FE: Rafraîchit liste mouvements + stock
```

### 7.3 Séquence — Workflow commande prestataire complet

```mermaid
sequenceDiagram
    actor PREST as Prestataire
    actor Log1 as Logisticien 1
    actor Log2 as Logisticien 2
    participant FE as Frontend
    participant API as NestJS API
    participant DB as PostgreSQL

    PREST->>FE: Accès /commande-publique/:token
    FE->>API: GET /commandes/public/:token
    API-->>FE: Formulaire disponible
    PREST->>FE: Remplit et soumet commande
    FE->>API: POST /commandes/public/:token
    API->>DB: INSERT commande (statut: EN_ATTENTE)
    DB-->>API: OK
    Note over Log1: Notification / voit la commande

    Log1->>API: PATCH /commandes/:id/valider
    API->>DB: UPDATE statut = VALIDEE
    
    Log1->>API: PATCH /commandes/:id/expedier
    API->>DB: UPDATE statut = EXPEDIEE
    API->>DB: INSERT mouvements (SORTIE × articles)
    API->>DB: UPDATE stocks

    Log2->>API: PATCH /commandes/:id/livree
    API->>DB: UPDATE statut = LIVREE
    API-->>FE: Commande terminée
```

### 7.4 Séquence — Alerte inventaire physique

```mermaid
sequenceDiagram
    participant FE as Dashboard React
    participant API as NestJS API
    participant DB as PostgreSQL
    actor LOG as Logisticien

    Note over FE: Refetch toutes les 60s
    FE->>API: GET /inventaires/alertes
    API->>DB: SELECT entrepots actifs
    loop Pour chaque entrepôt
        API->>DB: SELECT dernier inventaire
        API->>API: dernierInventaire < maintenant - 3 mois ?
        alt En alerte
            API->>DB: Notification déjà créée < 7 jours ?
            alt Pas encore notifié
                API->>DB: INSERT notification (INVENTAIRE_ALERTE)
            end
        end
    end
    API-->>FE: [ { entrepot, enAlerte: true/false, dernierInventaire } ]
    FE->>FE: Affiche bannière rouge si enAlerte > 0
    LOG->>FE: Clic → page Inventaire
    LOG->>API: POST /inventaires { entrepotId, lignes }
    API->>DB: INSERT inventaires_physiques × N articles
    DB-->>API: OK (201)
    API-->>FE: Inventaires créés
    Note over FE: Prochain refetch → enAlerte: false
```

---

## 8. Authentification & Sécurité

### Système d'authentification

- **Mécanisme** : JWT (JSON Web Token) signé avec secret `JWT_SECRET`
- **Durée de validité** : 7 jours (`expiresIn: '7d'`)
- **Stockage côté client** : `localStorage` (`token` + `user`)
- **Transport** : Header HTTP `Authorization: Bearer <token>`
- **Hachage mots de passe** : bcryptjs (salt rounds: 10)

### Flux d'authentification

```mermaid
sequenceDiagram
    participant Browser
    participant API
    participant DB

    Browser->>API: POST /auth/login { email, password }
    API->>DB: SELECT user WHERE email
    DB-->>API: user record
    API->>API: bcrypt.compare(password, hash)
    alt Valide + actif
        API->>API: jwt.sign({ sub, email, role })
        API-->>Browser: { access_token, user }
        Browser->>Browser: localStorage.setItem('token', ...)
    else Invalide
        API-->>Browser: 401 Unauthorized
    end
    
    Browser->>API: GET /articles (+ Bearer token)
    API->>API: JwtAuthGuard.validate(token)
    alt Token valide
        API-->>Browser: 200 données
    else Token expiré/invalide
        API-->>Browser: 401
        Browser->>Browser: redirect /login + clear localStorage
    end
```

### Gestion des rôles

| Action | ADMIN | LOG_1 | LOG_2 | CHEF_PROJET |
|--------|-------|-------|-------|-------------|
| Créer mouvement | ✅ | ✅ | ❌ | ❌ |
| Valider commande | ✅ | ✅ | ❌ | ❌ |
| Expédier commande | ✅ | ❌ | ✅ | ❌ |
| Créer commande TS | ✅ | ✅ | ❌ | ❌ |
| Saisir inventaire | ✅ | ✅ | ❌ | ❌ |
| Gérer utilisateurs | ✅ | ❌ | ❌ | ❌ |
| Gérer paramètres | ✅ | ❌ | ❌ | ❌ |
| Lecture dashboard | ✅ | ✅ | ✅ | ✅ |

**Implémentation :**
- `JwtAuthGuard` global sur tous les controllers (`@UseGuards(JwtAuthGuard)`)
- `@Public()` decorator pour les routes prestataires sans auth
- Contrôle de rôle côté frontend via `hasRole('ADMIN', 'LOGISTICIEN_1')` dans chaque composant

### Sécurité des données

- Mot de passe jamais retourné dans les réponses (exclusion explicite dans `auth.service.ts`)
- `ValidationPipe` avec `whitelist: true` et `forbidNonWhitelisted: true` → rejette les champs non déclarés dans les DTOs
- CORS configuré : origines autorisées `localhost:5173`, `localhost:3000`, `FRONTEND_URL`
- Token prestataire : UUID aléatoire, peut expirer, compteur d'utilisations

---

## 9. Déploiement

### Variables d'environnement

**Fichier `backend/.env` (obligatoires) :**

```env
# Base de données
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/logistique_d3"

# JWT
JWT_SECRET="votre-secret-jwt-très-long-et-aléatoire-32-chars-minimum"

# Port (optionnel, défaut 3000)
PORT=3000

# URL frontend (pour CORS en production)
FRONTEND_URL="https://votre-domaine.com"
```

### Environnement de développement

```bash
# 1. Cloner le repo
git clone <repo-url>
cd "Claude code"

# 2. Installer les dépendances
cd backend && npm install
cd ../frontend && npm install

# 3. Configurer la DB
cd backend
cp .env.example .env          # Remplir DATABASE_URL + JWT_SECRET
npx prisma migrate dev        # Appliquer les migrations
npx prisma db seed            # (optionnel) Données de test

# 4. Lancer en dev
# Terminal 1 — Backend
cd backend && npm run start:dev   # Port 3000, hot reload

# Terminal 2 — Frontend
cd frontend && npm run dev        # Port 5173, hot reload Vite
```

### Build & Production (mode monorepo)

En production, le backend NestJS sert les fichiers statiques du frontend React via Express.

```bash
# 1. Build frontend
cd frontend
npm run build                  # Génère frontend/dist/

# 2. Copier dist vers backend
cp -r frontend/dist/. backend/frontend/

# 3. Build backend
cd backend
npm run build                  # Compile TypeScript → dist/

# 4. Démarrer
node dist/main                 # Application sur port 3000
```

### Architecture production recommandée : Vercel + Railway

```mermaid
graph LR
    subgraph "Utilisateurs"
        U1[Logisticien France]
        U2[Logisticien Paris]
        U3[Chef Projet]
    end

    subgraph "Vercel (Frontend)"
        V[React SPA<br/>https://logistique-d3.vercel.app]
    end

    subgraph "Railway (Backend)"
        R[NestJS API<br/>https://backend.railway.app/api]
        PG[(PostgreSQL 16)]
    end

    U1 & U2 & U3 -->|HTTPS| V
    V -->|API calls /api/*| R
    R --> PG
```

**Étapes de déploiement Vercel + Railway :**

```bash
# ── ÉTAPE 1 : Préparer le code ──────────────────────────────

# Mettre à jour l'URL API du frontend pour pointer vers Railway
# frontend/src/lib/api.ts — ligne baseURL
# Changer '/api' en process.env.VITE_API_URL || '/api'

# Créer frontend/.env.production
VITE_API_URL=https://votre-backend.railway.app/api

# ── ÉTAPE 2 : Pousser sur GitHub ────────────────────────────
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/vous/logistique-d3.git
git push -u origin main

# ── ÉTAPE 3 : Railway (Backend + DB) ────────────────────────
# 1. railway.app → Login avec GitHub
# 2. New Project → Deploy from GitHub Repo → sélectionner repo
# 3. Ajouter service PostgreSQL → copier DATABASE_URL
# 4. Variables d'environnement Railway :
#    DATABASE_URL = (fourni par Railway)
#    JWT_SECRET   = (générer : openssl rand -base64 32)
#    FRONTEND_URL = https://logistique-d3.vercel.app
#    PORT         = 3000
# 5. Settings → Root Directory : backend
# 6. Start command : node dist/main
# 7. Build command : npm run build

# ── ÉTAPE 4 : Appliquer les migrations sur la DB Railway ────
cd backend
DATABASE_URL="<url_railway>" npx prisma migrate deploy

# ── ÉTAPE 5 : Vercel (Frontend) ─────────────────────────────
# 1. vercel.com → Login avec GitHub
# 2. Import repository
# 3. Root Directory : frontend
# 4. Framework : Vite
# 5. Variables d'environnement :
#    VITE_API_URL = https://votre-backend.railway.app/api
# 6. Deploy
```

### Checklist pré-déploiement

- [ ] `JWT_SECRET` généré de façon sécurisée (min 32 caractères, aléatoire)
- [ ] `DATABASE_URL` pointe vers la DB de production
- [ ] Migrations appliquées (`prisma migrate deploy`)
- [ ] Au moins un compte ADMIN créé en base
- [ ] CORS configuré avec l'URL de production du frontend
- [ ] `FRONTEND_URL` défini dans les variables d'environnement du backend

---

## 10. Maintenance & évolutivité

### Points sensibles du système

| Point | Risque | Mitigation |
|-------|--------|-----------|
| Calcul dynamique `qteRecue` | N+1 queries en boucle sur les commandes TS | Ajouter `Promise.all` (déjà fait) ; envisager une vue matérialisée pour de gros volumes |
| JWT dans localStorage | XSS peut voler le token | Ajouter Content Security Policy, envisager httpOnly cookie |
| Pas de refresh token automatique | Session expirée = déconnexion brusque | Implémenter rotation automatique du token (7j) |
| Upload de fichiers local | Fichiers perdus si redéploiement | Migrer vers S3 / Cloudflare R2 |
| Notifications pull (polling) | Charge serveur inutile toutes les 30s | Remplacer par WebSocket ou Server-Sent Events |
| Pas de soft delete sur mouvements | Suppression définitive impossible à annuler | Ajouter `deletedAt` nullable (soft delete pattern) |

### Dette technique identifiée

1. **DTOs incomplets** : Plusieurs endpoints utilisent `dto: any` sans validation Prisma. Ajouter des DTOs typés pour tous les endpoints.
2. **Tests absents** : Aucun test unitaire ou e2e n'est actuellement écrit.
3. **Logs applicatifs** : Pas de logger structuré (Winston, Pino). En production, les erreurs ne sont pas tracées.
4. **Gestion des erreurs Prisma** : Les erreurs de contrainte DB (duplicate key, etc.) ne sont pas toutes interceptées et peuvent retourner des 500 non explicites.
5. **`qteRecue` en doublon** : La colonne `qteRecue` dans `repartitions_commandes_ts` existe en DB mais est calculée dynamiquement à l'affichage. Le champ DB est inutilisé → source de confusion.

### Améliorations recommandées (priorités)

**Court terme (< 1 mois) :**
- [ ] Ajouter Winston Logger + export vers fichier ou service externe
- [ ] DTOs typés sur tous les endpoints (remplacer `any`)
- [ ] Tests e2e sur les workflows critiques (mouvement, commande)
- [ ] Migrer upload fichiers vers S3/R2 (hors du serveur)

**Moyen terme (1-3 mois) :**
- [ ] WebSockets pour les notifications temps réel
- [ ] Soft delete sur mouvements et commandes
- [ ] Tableau de bord avancé avec filtres par entrepôt
- [ ] Export Excel des mouvements et inventaires
- [ ] Historique des modifications (audit log)

**Long terme :**
- [ ] Application mobile (React Native ou PWA)
- [ ] Intégration ERP / système de gestion fournisseurs
- [ ] Alertes email/SMS en complément des notifications in-app
- [ ] Multi-tenant (si extension à d'autres équipes)

### Monitoring recommandé

```
Outil          Rôle
─────────────────────────────────────────────────────
Railway Logs   Logs applicatifs temps réel (si Railway)
Sentry         Tracking erreurs JS frontend + Node backend
UptimeRobot    Monitoring disponibilité endpoint /api/auth/me
pgAdmin        Administration base de données PostgreSQL
```

---

## 11. Tests

### Ce qui doit être testé en priorité

#### Tests unitaires (backend)

| Service | Cas critiques |
|---------|--------------|
| `MouvementsService.create` | Stock mis à jour après ENTREE / SORTIE |
| `AuthService.validateUser` | Mot de passe incorrect → 401 ; compte inactif → 401 |
| `InventairesService.getAlertes` | Entrepôt > 3 mois sans inventaire → enAlerte: true |
| `CommandesTSService.enrichWithLivraisons` | qteRecue agrège correctement sur la période |
| `CommandesService.update` (workflow) | Transitions de statut invalides rejetées |

#### Tests d'intégration (e2e)

```
Scénario 1 : Cycle de vie complet d'une commande
  POST /commandes → PATCH /valider → PATCH /expedier → PATCH /livree
  Vérifier que statut change et que stock est débité

Scénario 2 : Mouvement de stock
  POST /mouvements (ENTREE, qté 50)
  GET /stock → vérifier quantite += 50
  POST /mouvements (SORTIE, qté 20)
  GET /stock → vérifier quantite = 30

Scénario 3 : Inventaire physique
  GET /inventaires/alertes → entrepôt en alerte
  POST /inventaires (avec lignes)
  GET /inventaires/alertes → entrepôt plus en alerte

Scénario 4 : Auth & rôles
  Login LOGISTICIEN_2 → tentative valider commande → 403
  Login ADMIN → même action → 200
```

#### Tests frontend (recommandés)

- Composant `Login` : email/password invalides → message d'erreur
- `AuthContext` : token expiré → redirection /login
- `hasRole()` : masque les boutons selon le rôle
- `Inventaire` : dialog pré-rempli avec stock théorique

---

## 12. Checklists & risques

### ✅ Checklist "Reprise par un développeur"

**Environnement :**
- [ ] Node.js 20+ installé
- [ ] PostgreSQL 16 installé ou accessible
- [ ] `backend/.env` configuré (`DATABASE_URL`, `JWT_SECRET`)
- [ ] `npm install` dans `backend/` et `frontend/`
- [ ] `npx prisma migrate dev` exécuté
- [ ] Backend démarre sans erreur : `npm run start:dev`
- [ ] Frontend démarre sans erreur : `npm run dev`
- [ ] Login possible avec un compte ADMIN

**Compréhension du code :**
- [ ] Lire `prisma/schema.prisma` — modèle de données complet
- [ ] Lire `src/lib/api.ts` — tous les appels API du frontend
- [ ] Lire `src/App.tsx` — routing et structure des pages
- [ ] Lire `commandes-ts.service.ts` — logique `enrichWithLivraisons`
- [ ] Lire `inventaires.service.ts` — logique alerte + notification

**Points d'attention :**
- [ ] `qteRecue` dans CommandesTS est calculé dynamiquement, ne pas le modifier en DB directement
- [ ] Les notifications globales ont `userId = null` — ne pas filtrer par userId pour les alertes inventaire
- [ ] La route `/commande-publique/:token` est publique (pas de JWT requis)

---

### ✅ Checklist "Mise en production"

**Base de données :**
- [ ] PostgreSQL accessible depuis le serveur applicatif
- [ ] `DATABASE_URL` correctement configurée (credentials prod)
- [ ] `npx prisma migrate deploy` exécuté (pas `migrate dev`)
- [ ] Compte ADMIN créé (`npx prisma studio` ou script seed)
- [ ] Backup DB automatique configuré

**Application :**
- [ ] `JWT_SECRET` différent du dev (min 32 chars, aléatoire)
- [ ] `NODE_ENV=production` défini
- [ ] Frontend buildé : `npm run build` dans `frontend/`
- [ ] `dist/` copié dans `backend/frontend/`
- [ ] Backend compilé : `npm run build` dans `backend/`
- [ ] `node dist/main` démarre sans erreur

**Réseau & sécurité :**
- [ ] HTTPS activé (obligatoire, pas de HTTP en production)
- [ ] `FRONTEND_URL` configuré pour le CORS
- [ ] Port 3000 (ou `PORT`) accessible depuis internet
- [ ] Pare-feu : seul le port 80/443 exposé (reverse proxy Nginx/Caddy → 3000)
- [ ] Logs applicatifs configurés

**Tests post-déploiement :**
- [ ] `GET /api/auth/login` répond en < 500ms
- [ ] Login admin fonctionne
- [ ] Upload d'un fichier fonctionne
- [ ] Dark/light mode fonctionne
- [ ] Notifications s'affichent

---

### ⚠️ Risques techniques

| Risque | Probabilité | Impact | Action recommandée |
|--------|-------------|--------|-------------------|
| Perte de données (pas de backup DB) | Moyenne | Critique | Configurer backup automatique quotidien |
| Token JWT volé (XSS) | Faible | Élevé | Migrer vers httpOnly cookie + CSRF protection |
| Port 3000 exposé directement sans HTTPS | Élevée | Élevé | Mettre un reverse proxy (Nginx/Caddy) avec SSL |
| Saturation disque (uploads locaux) | Moyenne | Élevé | Migrer vers stockage objet (S3) |
| Croissance des logs mouvements | Faible court terme | Moyen | Archivage après 2 ans |
| Session expirée sans feedback utilisateur | Élevée | Faible | Rafraîchissement automatique du JWT |
| N+1 queries CommandesTS avec beaucoup de données | Faible court terme | Moyen | Index DB + cache Redis si > 10k commandes |

---

*Documentation générée le 26/04/2026 — Logistique D3 v1.0*
