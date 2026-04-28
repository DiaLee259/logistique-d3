# Logistique Fibre Optique D3

Application web de gestion de stock fibre optique — NestJS + React + PostgreSQL

## Stack

| Couche | Technologie |
|--------|------------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | NestJS + Prisma ORM |
| Base de données | PostgreSQL 16 |
| Auth | JWT (7 jours) |
| PDF | PDFKit |
| Excel | ExcelJS |

## Démarrage rapide

### 1. Prérequis
- Node.js 20+
- Docker Desktop (pour PostgreSQL)

### 2. Base de données

```bash
# Démarrer PostgreSQL + pgAdmin
docker-compose up -d

# Vérifier : http://localhost:5050 (pgAdmin)
# Email: admin@logistique.fr / Password: admin
```

### 3. Backend

```bash
cd backend

# Copier et configurer l'env
cp .env.example .env
# Modifier .env si besoin

# Installer les dépendances
npm install

# Générer le client Prisma + créer les tables
npx prisma migrate dev --name init

# Injecter les données de test
npx ts-node src/seed/seed.ts

# Démarrer le backend
npm run start:dev
# → http://localhost:3000/api
```

### 4. Frontend

```bash
cd frontend

npm install
npm run dev
# → http://localhost:5173
```

## Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@logistique-d3.fr | password123 |
| Logisticien 1 (backoffice) | log1@logistique-d3.fr | password123 |
| Logisticien 2 (terrain) | log2@logistique-d3.fr | password123 |
| Chef de projet | chef@logistique-d3.fr | password123 |

## Routes API principales

```
POST   /api/auth/login
GET    /api/auth/me

GET    /api/articles
POST   /api/articles
PUT    /api/articles/:id

GET    /api/entrepots
GET    /api/stock
GET    /api/stock/alertes
GET    /api/stock/ecarts

GET    /api/mouvements
POST   /api/mouvements
POST   /api/mouvements/batch
DELETE /api/mouvements/:id
PATCH  /api/mouvements/:id/toggle/envoye
PATCH  /api/mouvements/:id/toggle/recu

GET    /api/commandes
POST   /api/commandes
GET    /api/commandes/:id
PATCH  /api/commandes/:id/valider
PATCH  /api/commandes/:id/expedier
GET    /api/commandes/:id/fiche-perception  (PDF)

GET    /api/livraisons
POST   /api/livraisons

GET    /api/dashboard/kpis
GET    /api/dashboard/evolution
GET    /api/dashboard/departements
GET    /api/dashboard/top-articles

POST   /api/uploads/fichier
POST   /api/uploads/excel/parse
```

## Structure du projet

```
logistique-fibre/
├── backend/
│   ├── prisma/schema.prisma      ← Schéma DB complet
│   ├── src/
│   │   ├── auth/                 ← JWT + guards + rôles
│   │   ├── users/                ← CRUD utilisateurs
│   │   ├── stock/
│   │   │   ├── articles/         ← Catalogue articles
│   │   │   ├── mouvements/       ← Entrées/sorties
│   │   │   ├── entrepots/        ← Entrepôts
│   │   │   └── stock.service     ← Stock temps réel
│   │   ├── orders/
│   │   │   ├── commandes/        ← Workflow commandes
│   │   │   └── livraisons/       ← Livraisons fournisseurs
│   │   ├── dashboard/            ← KPIs agrégés
│   │   ├── pdf/                  ← Génération fiche perception
│   │   ├── uploads/              ← Upload + parsing Excel
│   │   ├── notifications/        ← Alertes
│   │   └── seed/                 ← Données de test
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Articles.tsx
│       │   ├── Mouvements.tsx
│       │   ├── Commandes.tsx
│       │   ├── CommandeDetail.tsx
│       │   └── Livraisons.tsx
│       ├── components/
│       │   ├── AppLayout / AppSidebar / AppHeader
│       │   ├── KpiCard
│       │   └── StatusBadge
│       ├── contexts/AuthContext.tsx
│       └── lib/api.ts            ← Client API centralisé
│
└── docker-compose.yml            ← PostgreSQL + pgAdmin
```
