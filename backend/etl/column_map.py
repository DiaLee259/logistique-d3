# Mapping Excel → champs DB
# Pour chaque champ DB, liste de noms Excel possibles par ordre de priorité.
# Premier match trouvé dans le DataFrame gagne.
# Éditer ici si les colonnes de l'Excel changent.

COLUMN_MAP: dict[str, list[str]] = {
    # ── Identifiants ──────────────────────────────────────────────────────────
    # Noms exacts vérifiés sur le fichier TECHNO SMART en premier.
    "idInterventionIw": [
        "ID intervention IW",
        "Identifiant IW", "ID IW", "N° IW",
    ],
    "idInterventionGrdv": [
        "ID intervention GRDV",
        "Identifiant GRDV", "ID GRDV", "N° GRDV",
    ],
    "idTechnicienCas": [
        "ID technicien CAS",
        "Id technicien CAS", "Identifiant technicien",
    ],

    # ── Technicien & société ─────────────────────────────────────────────────
    # Note : dans le fichier TECHNO SMART ces deux colonnes sont entièrement vides.
    # Elles existent dans l'Excel mais leurs valeurs sont toutes NULL.
    "nomTechnicien": [
        "Paramètre.Tech", "Parametre.Tech", "Technicien",
    ],
    "nomSociete": [
        "Paramètre.Nom de la sociètèe",
        "Parametre.Nom de la societe",
        "Paramètre.Nom de la société",
    ],

    # ── Géographie ───────────────────────────────────────────────────────────
    "codeDepartement": [
        "Code département NRO",
        "Code departement NRO", "Code NRO",
    ],
    "departement": [
        "Département NRO",
        "Departement NRO",
    ],

    # ── Temporel ─────────────────────────────────────────────────────────────
    "dateIntervention": [
        "Date intervention",        # format datetime dans ce fichier
        "Date d'intervention",
    ],
    "moisIntervention": [
        "Mois intervention",        # format string "YYYY-MM" (ex: "2024-08")
        "Mois d'intervention",
    ],
    "semaineIntervention": [
        "Semaine intervention",     # format string "YYYY-WNN" (ex: "2024-W35")
        "Semaine d'intervention",
    ],

    # ── Technique ────────────────────────────────────────────────────────────
    "technologie": ["Technologie"],
    "infrastructure": ["Infrastructure"],
    "operateur": [
        "Opérateur exploitant",
        "Operateur exploitant", "Opérateur",
    ],
    "typeAbonne": [
        "Type abonné",
        "Type abonne",
    ],
    "modeleModem": [
        "Modèle modem",
        "Modele modem",
    ],

    # ── Classification ────────────────────────────────────────────────────────
    "typezone": ["Typezone"],
    "activites": [
        "Activités",                # col 79 : classification PROD / SAV calculée
        "Activites", "Activité", "Activite",
    ],
    "typePresta": [
        "Type de presta",
        "Type presta",
    ],

    # ── Résultat ──────────────────────────────────────────────────────────────
    "etat": ["État", "Etat", "état"],
    "codeCloture": [
        "Code clôture",
        "Code cloture",
    ],
    "categorieEchec": [
        "Catégorie d'échec",
        "Categorie d'echec",
    ],

    # ── Champs pour formules Déport PTO / EPIBOX ─────────────────────────────
    # Noms complets exacts vérifiés dans le fichier.
    "aboRacco110": [
        "AboRacco – 110 - Statut PTO et CAB avant travaux ?",
        "AboRacco – 110", "AboRacco - 110",
    ],
    "aboRacco120": [
        "AboRacco – 120 - Blocage lors travaux PTO et CAB ?",
        "AboRacco – 120", "AboRacco - 120",
    ],
}
