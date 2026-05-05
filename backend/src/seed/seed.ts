import { PrismaClient, TypeMouvement, StatutCommande, ProdSav } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seed...\n');

  // ── Utilisateurs ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@logistique-d3.fr' },
    update: {},
    create: { email: 'admin@logistique-d3.fr', password: passwordHash, nom: 'Admin', prenom: 'Super', role: 'ADMIN' },
  });

  const log1 = await prisma.user.upsert({
    where: { email: 'log1@logistique-d3.fr' },
    update: {},
    create: { email: 'log1@logistique-d3.fr', password: passwordHash, nom: 'Martin', prenom: 'Sophie', role: 'LOGISTICIEN_1' },
  });

  const log2 = await prisma.user.upsert({
    where: { email: 'log2@logistique-d3.fr' },
    update: {},
    create: { email: 'log2@logistique-d3.fr', password: passwordHash, nom: 'Dupont', prenom: 'Thomas', role: 'LOGISTICIEN_2' },
  });

  const chef = await prisma.user.upsert({
    where: { email: 'chef@logistique-d3.fr' },
    update: {},
    create: { email: 'chef@logistique-d3.fr', password: passwordHash, nom: 'Bernard', prenom: 'Pierre', role: 'CHEF_PROJET' },
  });

  console.log('✅ Utilisateurs créés');

  // ── Entrepôts ──────────────────────────────────────────────────────────────
  const e1 = await prisma.entrepot.upsert({
    where: { code: 'E1' },
    update: {},
    create: { code: 'E1', nom: 'Entrepôt Principal Paris', localisation: 'Zone Industrielle Nord, 75018 Paris' },
  });

  const e2 = await prisma.entrepot.upsert({
    where: { code: 'E2' },
    update: {},
    create: { code: 'E2', nom: 'Dépôt Lyon Sud', localisation: 'Parc Logistique, 69007 Lyon' },
  });

  console.log('✅ Entrepôts créés');

  // ── Articles fibre optique ─────────────────────────────────────────────────
  const articles = [
    { reference: 'KIT-PTO-SC', nom: 'Kit PTO SC/APC', description: 'Kit prise terminale optique SC/APC complet', unite: 'kit', seuilAlerte: 20, regleConsommation: '1 prise = 1 kit', facteurConsommation: 1.0 },
    { reference: 'CBL-MONO-G657', nom: 'Câble mono mode G.657 4FO', description: 'Câble fibre optique monomode G.657 4 fibres - bobine 500m', unite: 'mètre', seuilAlerte: 500, regleConsommation: '1 prise = 15m câble', facteurConsommation: 15.0 },
    { reference: 'CBL-MONO-G652', nom: 'Câble mono mode G.652 8FO', description: 'Câble fibre optique monomode G.652 8 fibres - bobine 1000m', unite: 'mètre', seuilAlerte: 1000 },
    { reference: 'SFP-1G-SX', nom: 'Module SFP 1G SX 850nm', description: 'Module SFP Gigabit multimode 850nm 550m', unite: 'unité', seuilAlerte: 5 },
    { reference: 'SFP-10G-LR', nom: 'Module SFP+ 10G LR 1310nm', description: 'Module SFP+ 10 Gigabit monomode 1310nm 10km', unite: 'unité', seuilAlerte: 3 },
    { reference: 'CON-SC-APC', nom: 'Connecteur SC/APC', description: 'Connecteur fibre optique SC/APC polish angle', unite: 'unité', seuilAlerte: 50 },
    { reference: 'CON-LC-UPC', nom: 'Connecteur LC/UPC', description: 'Connecteur fibre optique LC/UPC', unite: 'unité', seuilAlerte: 50 },
    { reference: 'EPI-LOVEE', nom: 'Épissure mécanique Love-E', description: 'Épissure mécanique pour fibre 250µm', unite: 'unité', seuilAlerte: 30 },
    { reference: 'BOITE-OPT-6', nom: 'Boîtier optique 6 ports', description: 'Boîtier de terminaison optique 6 ports SC/APC', unite: 'unité', seuilAlerte: 10 },
    { reference: 'BOITE-OPT-12', nom: 'Boîtier optique 12 ports', description: 'Boîtier de terminaison optique 12 ports SC/APC', unite: 'unité', seuilAlerte: 8 },
    { reference: 'GAINE-SCUT-6', nom: 'Gaine thermo-rétractable 6mm', description: 'Gaine thermorétractable protection épissure 6mm', unite: 'unité', seuilAlerte: 100 },
    { reference: 'RUBAN-ADH', nom: 'Ruban adhésif câble', description: 'Ruban adhésif double face pour fixation câble', unite: 'rouleau', seuilAlerte: 20 },
    { reference: 'SANGLE-CABLE', nom: 'Sangle de serrage câble', description: 'Sangle nylon 200mm pour fixation câble en fourreaux', unite: 'paquet', seuilAlerte: 15 },
    { reference: 'CHEV-OPT-2M', nom: 'Jarretière optique SC/APC 2m', description: 'Jarretière optique simplex SC/APC - SC/APC 2 mètres', unite: 'unité', seuilAlerte: 10 },
    { reference: 'CHEV-OPT-5M', nom: 'Jarretière optique SC/APC 5m', description: 'Jarretière optique simplex SC/APC - SC/APC 5 mètres', unite: 'unité', seuilAlerte: 10 },
  ];

  const createdArticles: any[] = [];
  for (const a of articles) {
    const art = await prisma.article.upsert({
      where: { reference: a.reference },
      update: {},
      create: a,
    });
    createdArticles.push(art);
  }

  console.log('✅ Articles créés');

  // ── Stocks initiaux ────────────────────────────────────────────────────────
  const stocksE1 = [
    { ref: 'KIT-PTO-SC', qte: 145 },
    { ref: 'CBL-MONO-G657', qte: 3200 },
    { ref: 'CBL-MONO-G652', qte: 5800 },
    { ref: 'SFP-1G-SX', qte: 12 },
    { ref: 'SFP-10G-LR', qte: 8 },
    { ref: 'CON-SC-APC', qte: 320 },
    { ref: 'CON-LC-UPC', qte: 180 },
    { ref: 'EPI-LOVEE', qte: 95 },
    { ref: 'BOITE-OPT-6', qte: 34 },
    { ref: 'BOITE-OPT-12', qte: 22 },
    { ref: 'GAINE-SCUT-6', qte: 450 },
    { ref: 'RUBAN-ADH', qte: 28 },
    { ref: 'SANGLE-CABLE', qte: 18 },
    { ref: 'CHEV-OPT-2M', qte: 42 },
    { ref: 'CHEV-OPT-5M', qte: 31 },
  ];

  const stocksE2 = [
    { ref: 'KIT-PTO-SC', qte: 78 },
    { ref: 'CBL-MONO-G657', qte: 1800 },
    { ref: 'CBL-MONO-G652', qte: 2200 },
    { ref: 'SFP-1G-SX', qte: 4 },
    { ref: 'SFP-10G-LR', qte: 2 },
    { ref: 'CON-SC-APC', qte: 140 },
    { ref: 'CON-LC-UPC', qte: 90 },
    { ref: 'EPI-LOVEE', qte: 45 },
    { ref: 'BOITE-OPT-6', qte: 16 },
    { ref: 'BOITE-OPT-12', qte: 9 },
    { ref: 'GAINE-SCUT-6', qte: 200 },
    { ref: 'RUBAN-ADH', qte: 12 },
    { ref: 'SANGLE-CABLE', qte: 8 },
    { ref: 'CHEV-OPT-2M', qte: 20 },
    { ref: 'CHEV-OPT-5M', qte: 15 },
  ];

  for (const s of stocksE1) {
    const art = createdArticles.find(a => a.reference === s.ref);
    if (art) {
      await prisma.stock.upsert({
        where: { articleId_entrepotId: { articleId: art.id, entrepotId: e1.id } },
        update: { quantite: s.qte },
        create: { articleId: art.id, entrepotId: e1.id, quantite: s.qte },
      });
    }
  }

  for (const s of stocksE2) {
    const art = createdArticles.find(a => a.reference === s.ref);
    if (art) {
      await prisma.stock.upsert({
        where: { articleId_entrepotId: { articleId: art.id, entrepotId: e2.id } },
        update: { quantite: s.qte },
        create: { articleId: art.id, entrepotId: e2.id, quantite: s.qte },
      });
    }
  }

  console.log('✅ Stocks initialisés');

  // ── Mouvements historiques ────────────────────────────────────────────────
  const depts = ['49', '22', '75', '93', '69', '31'];
  const managers = ['Lefebvre Marc', 'Girard Julie', 'Moreau Kevin', 'Simon Nathalie'];

  const kitPto = createdArticles.find(a => a.reference === 'KIT-PTO-SC')!;
  const cable = createdArticles.find(a => a.reference === 'CBL-MONO-G657')!;
  const sfp = createdArticles.find(a => a.reference === 'SFP-1G-SX')!;
  const connecteur = createdArticles.find(a => a.reference === 'CON-SC-APC')!;
  const boite = createdArticles.find(a => a.reference === 'BOITE-OPT-6')!;

  const mouvements = [
    // Entrées fournisseurs
    { date: new Date('2026-01-05'), articleId: kitPto.id, entrepotId: e1.id, type: TypeMouvement.ENTREE, quantiteDemandee: 200, quantiteFournie: 200, sourceDestination: 'Nexans France', numeroCommande: 'BL-2026-001', departement: null },
    { date: new Date('2026-01-08'), articleId: cable.id, entrepotId: e1.id, type: TypeMouvement.ENTREE, quantiteDemandee: 5000, quantiteFournie: 5000, sourceDestination: 'Prysmian Group', numeroCommande: 'BL-2026-002', departement: null },
    { date: new Date('2026-01-10'), articleId: sfp.id, entrepotId: e1.id, type: TypeMouvement.ENTREE, quantiteDemandee: 20, quantiteFournie: 18, sourceDestination: 'Finisar', numeroCommande: 'BL-2026-003', departement: null, commentaire: '2 unités refusées (non conformes)' },
    // Sorties techniciens
    { date: new Date('2026-01-12'), articleId: kitPto.id, entrepotId: e1.id, type: TypeMouvement.SORTIE, quantiteDemandee: 25, quantiteFournie: 25, departement: '49', manager: managers[0], numeroOperation: 'OP-49-001', envoye: true, recu: true },
    { date: new Date('2026-01-15'), articleId: cable.id, entrepotId: e1.id, type: TypeMouvement.SORTIE, quantiteDemandee: 500, quantiteFournie: 500, departement: '22', manager: managers[1], numeroOperation: 'OP-22-001', envoye: true, recu: true },
    { date: new Date('2026-01-20'), articleId: connecteur.id, entrepotId: e2.id, type: TypeMouvement.SORTIE, quantiteDemandee: 50, quantiteFournie: 50, departement: '75', manager: managers[2], envoye: true, recu: false },
    { date: new Date('2026-02-03'), articleId: kitPto.id, entrepotId: e1.id, type: TypeMouvement.SORTIE, quantiteDemandee: 30, quantiteFournie: 28, departement: '93', manager: managers[3], numeroOperation: 'OP-93-001', envoye: true, recu: true, commentaire: '2 kits manquants - réappro en cours' },
    { date: new Date('2026-02-07'), articleId: boite.id, entrepotId: e1.id, type: TypeMouvement.SORTIE, quantiteDemandee: 10, quantiteFournie: 10, departement: '69', manager: managers[0], envoye: true, recu: true },
    { date: new Date('2026-02-10'), articleId: cable.id, entrepotId: e2.id, type: TypeMouvement.SORTIE, quantiteDemandee: 300, quantiteFournie: 300, departement: '31', manager: managers[1], envoye: false, recu: false },
    { date: new Date('2026-02-14'), articleId: kitPto.id, entrepotId: e2.id, type: TypeMouvement.SORTIE, quantiteDemandee: 15, quantiteFournie: 15, departement: '49', manager: managers[2], envoye: true, recu: true },
    { date: new Date('2026-02-20'), articleId: sfp.id, entrepotId: e1.id, type: TypeMouvement.SORTIE, quantiteDemandee: 3, quantiteFournie: 3, departement: '75', manager: managers[3], envoye: true, recu: true },
    { date: new Date('2026-03-01'), articleId: kitPto.id, entrepotId: e1.id, type: TypeMouvement.ENTREE, quantiteDemandee: 100, quantiteFournie: 100, sourceDestination: 'Nexans France', numeroCommande: 'BL-2026-015' },
    { date: new Date('2026-03-05'), articleId: cable.id, entrepotId: e1.id, type: TypeMouvement.SORTIE, quantiteDemandee: 800, quantiteFournie: 800, departement: '22', manager: managers[0], envoye: true, recu: false },
    { date: new Date('2026-03-10'), articleId: connecteur.id, entrepotId: e1.id, type: TypeMouvement.SORTIE, quantiteDemandee: 100, quantiteFournie: 100, departement: '93', manager: managers[1], envoye: false, recu: false },
    { date: new Date('2026-04-01'), articleId: kitPto.id, entrepotId: e1.id, type: TypeMouvement.SORTIE, quantiteDemandee: 40, quantiteFournie: 40, departement: '75', manager: managers[2], envoye: true, recu: true },
  ];

  for (const m of mouvements) {
    await prisma.mouvement.create({ data: { ...m, userId: log2.id } });
  }

  console.log('✅ Mouvements historiques créés');

  // ── Commandes exemple ──────────────────────────────────────────────────────
  const cmd1 = await prisma.commande.create({
    data: {
      numero: 'CMD-2026-0001',
      departement: '49',
      demandeur: 'Technicien Rousseau',
      emailDemandeur: 'rousseau@technicien.fr',
      manager: 'Lefebvre Marc',
      nombreGrilles: 5,
      statut: StatutCommande.EN_ATTENTE,
      lignes: {
        create: [
          { articleId: kitPto.id, quantiteDemandee: 10 },
          { articleId: cable.id, quantiteDemandee: 150 },
          { articleId: connecteur.id, quantiteDemandee: 20 },
        ],
      },
    },
  });

  const cmd2 = await prisma.commande.create({
    data: {
      numero: 'CMD-2026-0002',
      departement: '22',
      demandeur: 'Technicien Petit',
      emailDemandeur: 'petit@technicien.fr',
      manager: 'Girard Julie',
      nombreGrilles: 3,
      statut: StatutCommande.VALIDEE,
      valideurId: log1.id,
      dateTraitement: new Date('2026-04-15'),
      lignes: {
        create: [
          { articleId: kitPto.id, quantiteDemandee: 5, quantiteValidee: 5, stockDisponible: 145 },
          { articleId: boite.id, quantiteDemandee: 3, quantiteValidee: 3, stockDisponible: 34 },
        ],
      },
    },
  });

  const cmd3 = await prisma.commande.create({
    data: {
      numero: 'CMD-2026-0003',
      departement: '75',
      demandeur: 'Technicien Blanc',
      emailDemandeur: 'blanc@technicien.fr',
      manager: 'Moreau Kevin',
      statut: StatutCommande.EXPEDIEE,
      valideurId: log1.id,
      expediteurId: log2.id,
      dateTraitement: new Date('2026-04-10'),
      dateExpedition: new Date('2026-04-12'),
      emailEnvoye: true,
      dateEmailEnvoye: new Date('2026-04-10'),
      lignes: {
        create: [
          { articleId: sfp.id, quantiteDemandee: 2, quantiteValidee: 2, quantiteFournie: 2, stockDisponible: 12 },
        ],
      },
    },
  });

  console.log('✅ Commandes exemple créées');

  // ── Notifications ──────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { type: 'STOCK_ALERTE', titre: 'Stock faible — SFP+ 10G LR', message: 'Le stock du SFP+ 10G LR est en dessous du seuil d\'alerte (2 unités, seuil: 3)', lien: '/articles', userId: log1.id },
      { type: 'COMMANDE_RECUE', titre: 'Nouvelle commande CMD-2026-0001', message: 'Commande reçue du département 49 — 3 articles à valider', lien: '/commandes', userId: log1.id },
      { type: 'COMMANDE_EXPEDIEE', titre: 'Commande CMD-2026-0003 expédiée', message: 'La commande a été expédiée vers le département 75', lien: '/commandes' },
    ],
  });

  console.log('✅ Notifications créées');

  console.log('\n🎉 Seed terminé avec succès !\n');
  console.log('Comptes disponibles :');
  console.log('  Admin       : admin@logistique-d3.fr / password123');
  console.log('  Logisticien 1 : log1@logistique-d3.fr  / password123');
  console.log('  Logisticien 2 : log2@logistique-d3.fr  / password123');
  console.log('  Chef projet : chef@logistique-d3.fr  / password123\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
