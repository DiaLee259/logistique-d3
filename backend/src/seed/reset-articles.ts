import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const articles = [
  { reference: 'O-KPTOMA25-0-PN', nom: 'KIT PTO MONO 25 M (ou 30/35M)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-KPTOMA40-0-PN', nom: 'KIT PTO MONO 40 M (ou 45/50M)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-PTOM/APC-0-TL', nom: 'PTO 1FO', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-C2FO/EXT500-0-FI', nom: 'Câble abonné EXT 2FO (2x 1fo) touret 500m', unite: 'unité', seuilAlerte: 2 },
  { reference: 'O-KPTOBA25-2-PN', nom: 'KIT PTO BI 25M (ou 30/35M)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-KPTOBA40-2-PN', nom: 'KIT PTO BI 40M (ou 45/50M)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-PTOB/APC-0-FN', nom: 'PTO 2 FO', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-KPTOQA25-0-PN', nom: 'KIT PTO QUADRI 25M (ou 30/35M)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-KPTOQA40-0-PN', nom: 'KIT PTO QUADRI 40M (ou 45/50M)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-PTOQ/APC-0-PN', nom: 'PTO 4FO', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-C4FO/EXT-0-FI', nom: 'Câble abonné EXT 4FO (500M)', unite: 'unité', seuilAlerte: 2 },
  { reference: 'MFO13720A3.5', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 3,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JT2D/A/2,5-0-ET', nom: 'JARRETIERE ROUGE SC/APC G652 2,5M', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/4-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 4m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'AC560 000', nom: 'Pince d\'ancrage (+cable fixation FO diam 6-8mm)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'DS4 - 09172', nom: 'Dispositif de suspension câble FO rond 4/6mm', unite: 'unité', seuilAlerte: 5 },
  { reference: 'F-SFP01A-0-LR', nom: 'SFP', unite: 'unité', seuilAlerte: 3 },
  { reference: 'F-MDONU05A-0-JN', nom: 'ONU', unite: 'unité', seuilAlerte: 3 },
  { reference: 'MFOA20275', nom: 'KIT ECAM Simple pour câble 3-7mm', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-CAB1ADEPORT20-0-RX', nom: 'Câble de déport 3mm DTIO-PTO 20m', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-CAB1ADEPORT40-0-RX', nom: 'Câble de déport 3mm DTIO-PTO 40m', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-PC2_25/U-20-PN', nom: 'CORDONS PRECO 2FO 25m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-PC2_40/U-20-PN', nom: 'CORDONS PRECO 2FO 40m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JT2D/A/1-0', nom: 'JARRETIERE ROUGE SC/APC G652D 1m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'MFOA20241', nom: 'Kit ECAM de câble de 4/12 mm', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-EPI100-0-HN', nom: 'EPIBOX', unite: 'unité', seuilAlerte: 5 },
  { reference: '5/14 - 0207', nom: 'Traverse 11 trous', unite: 'unité', seuilAlerte: 5 },
  { reference: '5/19 - 0148', nom: 'Traverse 15 trous Appui commun', unite: 'unité', seuilAlerte: 5 },
  { reference: '91944', nom: 'Réhausse monobloc', unite: 'unité', seuilAlerte: 5 },
  { reference: 'IFDB-MDROP-02-FR08', nom: 'kits d\'arrimage + supports SMOUV.+ collier + mousse (TYCO)', unite: 'unité', seuilAlerte: 10 },
  { reference: 'OCADK-S2-S2-NNCS', nom: 'Corps de traverse OC-ADK-S2-S2-NNCS (TYCO)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'O-C2FO/INT250-0-TL', nom: 'Câble abonné INT 2FO (2 x 1fo) touret 250m', unite: 'unité', seuilAlerte: 2 },
  { reference: 'O-C4FO/INT250-0-TL', nom: 'Câble abonné INT 4FO (1 x 4fo) touret 250m', unite: 'unité', seuilAlerte: 2 },
  { reference: 'O-JTA2/A/4.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 4,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/5.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 5,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/6-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 6m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/6.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 6,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/7-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 7m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/7.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 7,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/8-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 8m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/8.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 8,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/9-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 9m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/9.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 9,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/10-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 10m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/10.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 10,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/11-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 11m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/11.5-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 11,5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'O-JTA2/A/12-0-FN', nom: 'JARRETIERE ROUGE 1.6mm SC/APC G657A2 en 12m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'JR1.6-SCALCU-7A-5', nom: 'Cordon simplex SMF G.657A2 gaine 1.6mm rouge LC/UPC-SC/APC 5m', unite: 'unité', seuilAlerte: 10 },
  { reference: 'TENIO-SKG3-5/8', nom: 'Entrée de boîte', unite: 'unité', seuilAlerte: 10 },
  { reference: 'OFDC-ISROD-6MM-24', nom: 'Fixations de câble type ISROD pour 1 câble diam 4 à 6mm max', unite: 'unité', seuilAlerte: 10 },
  { reference: '9979', nom: 'Connecteur montable pour câbles préco 0,9', unite: 'unité', seuilAlerte: 10 },
  { reference: 'TENIO-CTU-L-(10)', nom: 'TENIO Arrimage 1 câbles (conditionnement 10 unités)', unite: 'unité', seuilAlerte: 5 },
  { reference: 'A-FSA200BA-1-ZN', nom: 'Jarretières UPC-APC FREEBOX (Kit ONU)', unite: 'unité', seuilAlerte: 5 },
];

async function main() {
  console.log('🗑️  Suppression des anciennes données...\n');

  // Supprimer dans l'ordre pour respecter les FK
  await prisma.notification.deleteMany({});
  await prisma.inventairePhysique.deleteMany({});
  await prisma.consommation.deleteMany({});
  await prisma.repartitionCommandeTS.deleteMany({});
  await prisma.ligneCommandeTS.deleteMany({});
  await prisma.commandeTS.deleteMany({});
  await prisma.ligneLivraison.deleteMany({});
  await prisma.ligneCommande.deleteMany({});
  await prisma.mouvement.deleteMany({});
  await prisma.livraison.deleteMany({});
  await prisma.commande.deleteMany({});
  await prisma.lienPrestataire.deleteMany({});
  await prisma.stock.deleteMany({});
  await prisma.article.deleteMany({});

  console.log('✅ Anciennes données supprimées\n');
  console.log('📦 Insertion des nouveaux articles...\n');

  let count = 0;
  for (const article of articles) {
    await prisma.article.create({ data: article });
    count++;
    console.log(`  ✓ ${article.reference} — ${article.nom}`);
  }

  console.log(`\n🎉 ${count} articles insérés avec succès !`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
