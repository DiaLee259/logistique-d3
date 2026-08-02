r"""
Seed initial des FormuleConsommable.

Reporte les regles de calcul de la feuille "Consommable PROD" de l'Excel
TECHNO SMART. Chaque formule correspond a un produit avec ses filtres
et coefficients editables.

Usage:
  python seed_formules.py
  python seed_formules.py --reset  # supprime les formules existantes avant d'inserer
"""

import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from config import DATABASE_URL

FORMULES = [
    # ── STANDARD ZMD MONO ──────────────────────────────────────────────────────
    # KIT PTO MONO 25M : 40 % des PROD OK ZMD Standard hors PLP
    {
        "codeArticle": "KIT-PTO-25M",
        "nomProduit": "KIT PTO MONO 25M",
        "categorie": "STANDARD - ZMD MONO",
        "descriptionFormule": "40% des interventions PROD OK ZMD Infrastructure=Standard hors PLP",
        "conditionZone": "ZMD",
        "conditionInfra": "Standard",
        "conditionInfraMode": "EQ",
        "conditionEtat": "OK",
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": True,
        "multiplicateur": 0.4,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 10,
    },
    # KIT PTO MONO 40M : 60 % des mêmes interventions
    {
        "codeArticle": "KIT-PTO-40M",
        "nomProduit": "KIT PTO MONO 40M",
        "categorie": "STANDARD - ZMD MONO",
        "descriptionFormule": "60% des interventions PROD OK ZMD Infrastructure=Standard hors PLP",
        "conditionZone": "ZMD",
        "conditionInfra": "Standard",
        "conditionInfraMode": "EQ",
        "conditionEtat": "OK",
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": True,
        "multiplicateur": 0.6,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 20,
    },
    # ── JARRETIERES ZMD ────────────────────────────────────────────────────────
    # Jarretieres ZMD : OK + 15% des NOK
    {
        "codeArticle": "JARR-ZMD",
        "nomProduit": "Jarretières ZMD",
        "categorie": "ZMD - Jarretières",
        "descriptionFormule": "PROD ZMD OK (x1) + PROD ZMD NOK (x0.15)",
        "conditionZone": "ZMD",
        "conditionInfra": None,
        "conditionInfraMode": "EQ",
        "conditionEtat": "OK",       # côté OK : multiplicateur=1
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": False,
        "multiplicateur": 1.0,
        "multiplicateurNok": 0.15,   # côté NOK : 15%
        "minimumQte": None,
        "ordre": 30,
    },
    # ── ANCRAGE POTEAU ──────────────────────────────────────────────────────────
    # Pince d'ancrage : 4 par intervention Poteau ou Façade
    {
        "codeArticle": "PINCE-ANCRAGE",
        "nomProduit": "Pince d'ancrage",
        "categorie": "Fixation",
        "descriptionFormule": "4 x (PROD Infrastructure=Poteau + Infrastructure=Façade)",
        "conditionZone": None,
        "conditionInfra": "Poteau",   # Poteau ET Façade : 2 formules séparées à sommer
        "conditionInfraMode": "EQ",
        "conditionEtat": None,
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": False,
        "multiplicateur": 4.0,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 40,
    },
    # ── DISPOSITIF SUSPENSION ───────────────────────────────────────────────────
    # 10% des pinces d'ancrage — calculé côté service à partir de PINCE-ANCRAGE
    {
        "codeArticle": "DISP-SUSPENSION",
        "nomProduit": "Dispositif de suspension",
        "categorie": "Fixation",
        "descriptionFormule": "10% du résultat Pince d'ancrage",
        "conditionZone": None,
        "conditionInfra": "Poteau",
        "conditionInfraMode": "EQ",
        "conditionEtat": None,
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": False,
        "multiplicateur": 0.4,       # 4 pinces × 10% = 0.4 par intervention Poteau
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 50,
    },
    # ── ONU PON MIGRATION ───────────────────────────────────────────────────────
    # ONU : PROD PON Migration OK avec modem FREE
    {
        "codeArticle": "ONU-PON",
        "nomProduit": "ONU (modem optique)",
        "categorie": "Équipement PON",
        "descriptionFormule": "PROD OK PON Migration avec modem Freebox (Révolution, Pop, Mini 4K…)",
        "conditionZone": None,
        "conditionInfra": None,
        "conditionInfraMode": "EQ",
        "conditionEtat": "OK",
        "conditionActivite": "PROD",
        "conditionTechnologie": "PON",
        "conditionTypeAbonne": "MIGRATION",
        "excludePLP": False,
        "multiplicateur": 1.0,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 60,
    },
    # ── KIT ECAM CHAMBRE ────────────────────────────────────────────────────────
    {
        "codeArticle": "KIT-ECAM-CHAMBRE",
        "nomProduit": "KIT ECAM Simple (Chambre)",
        "categorie": "Génie Civil",
        "descriptionFormule": "PROD Infrastructure=Chambre hors PLP",
        "conditionZone": None,
        "conditionInfra": "Chambre",
        "conditionInfraMode": "EQ",
        "conditionEtat": None,
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": True,
        "multiplicateur": 1.0,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 70,
    },
    # ── COMPLEXE ZMD ────────────────────────────────────────────────────────────
    # Interventions PROD OK ZMD sur infra NON-Standard (complexe)
    {
        "codeArticle": "KIT-PTO-COMPLEXE-25M",
        "nomProduit": "KIT PTO MONO 25M Complexe",
        "categorie": "COMPLEXE - ZMD",
        "descriptionFormule": "40% des PROD OK ZMD Infrastructure<>Standard hors PLP",
        "conditionZone": "ZMD",
        "conditionInfra": "Standard",
        "conditionInfraMode": "NEQ",   # exclure Standard = prendre Complexe
        "conditionEtat": "OK",
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": True,
        "multiplicateur": 0.4,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 80,
    },
    {
        "codeArticle": "KIT-PTO-COMPLEXE-40M",
        "nomProduit": "KIT PTO MONO 40M Complexe",
        "categorie": "COMPLEXE - ZMD",
        "descriptionFormule": "60% des PROD OK ZMD Infrastructure<>Standard hors PLP",
        "conditionZone": "ZMD",
        "conditionInfra": "Standard",
        "conditionInfraMode": "NEQ",
        "conditionEtat": "OK",
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": True,
        "multiplicateur": 0.6,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 90,
    },
    # ── ZTD ─────────────────────────────────────────────────────────────────────
    {
        "codeArticle": "KIT-PTO-ZTD-25M",
        "nomProduit": "KIT PTO MONO 25M ZTD",
        "categorie": "STANDARD - ZTD",
        "descriptionFormule": "40% des PROD OK ZTD Standard hors PLP",
        "conditionZone": "ZTD",
        "conditionInfra": "Standard",
        "conditionInfraMode": "EQ",
        "conditionEtat": "OK",
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": True,
        "multiplicateur": 0.4,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 100,
    },
    {
        "codeArticle": "KIT-PTO-ZTD-40M",
        "nomProduit": "KIT PTO MONO 40M ZTD",
        "categorie": "STANDARD - ZTD",
        "descriptionFormule": "60% des PROD OK ZTD Standard hors PLP",
        "conditionZone": "ZTD",
        "conditionInfra": "Standard",
        "conditionInfraMode": "EQ",
        "conditionEtat": "OK",
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": True,
        "multiplicateur": 0.6,
        "multiplicateurNok": 0.0,
        "minimumQte": None,
        "ordre": 110,
    },
    {
        "codeArticle": "JARR-ZTD",
        "nomProduit": "Jarretières ZTD",
        "categorie": "ZTD - Jarretières",
        "descriptionFormule": "PROD ZTD OK (x1) + PROD ZTD NOK (x0.15)",
        "conditionZone": "ZTD",
        "conditionInfra": None,
        "conditionInfraMode": "EQ",
        "conditionEtat": "OK",
        "conditionActivite": "PROD",
        "conditionTechnologie": None,
        "conditionTypeAbonne": None,
        "excludePLP": False,
        "multiplicateur": 1.0,
        "multiplicateurNok": 0.15,
        "minimumQte": None,
        "ordre": 120,
    },
]


def seed(reset: bool = False) -> None:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    now = datetime.now(tz=timezone.utc).replace(tzinfo=None)

    with engine.connect() as conn:
        if reset:
            conn.execute(text("DELETE FROM formules_consommable"))
            print("Formules existantes supprimées.")

        inserted = 0
        skipped = 0
        for f in FORMULES:
            existing = conn.execute(
                text('SELECT id FROM formules_consommable WHERE "codeArticle" = :code'),
                {"code": f["codeArticle"]},
            ).fetchone()

            if existing:
                skipped += 1
                continue

            conn.execute(
                text(
                    """INSERT INTO formules_consommable (
                        id, ordre, actif,
                        "codeArticle", "nomProduit", categorie, "descriptionFormule",
                        "conditionZone", "conditionInfra", "conditionInfraMode",
                        "conditionEtat", "conditionActivite", "conditionTechnologie",
                        "conditionTypeAbonne", "excludePLP",
                        multiplicateur, "multiplicateurNok", "minimumQte",
                        "createdAt", "updatedAt"
                    ) VALUES (
                        :id, :ordre, true,
                        :codeArticle, :nomProduit, :categorie, :descriptionFormule,
                        :conditionZone, :conditionInfra, :conditionInfraMode,
                        :conditionEtat, :conditionActivite, :conditionTechnologie,
                        :conditionTypeAbonne, :excludePLP,
                        :multiplicateur, :multiplicateurNok, :minimumQte,
                        :now, :now
                    )"""
                ),
                {
                    "id": str(uuid.uuid4()),
                    "now": now,
                    **{k: v for k, v in f.items()},
                },
            )
            inserted += 1

        conn.commit()

    print(f"Seed formules : {inserted} insérées, {skipped} déjà existantes.")


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    seed(reset=reset)
