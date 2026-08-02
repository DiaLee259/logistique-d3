r"""
ETL Consommables — point d'entree principal

Usage:
  python process.py "D:/Consommable/fichier.xlsx"            # import complet
  python process.py "D:/Consommable/fichier.xlsx" --inspect  # colonnes disponibles
  python process.py "D:/Consommable/fichier.xlsx" --force    # force re-import
"""

import sys
import time
from pathlib import Path
from datetime import datetime

from extract import extract, inspect
from transform import transform
from load import check_already_imported, create_import_log, finalize_import_log, load


def main() -> None:
    args = sys.argv[1:]

    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    filepath = Path(args[0])
    do_inspect = "--inspect" in args
    force = "--force" in args

    if not filepath.exists():
        print(f"Fichier introuvable : {filepath}")
        sys.exit(1)

    # ── Mode inspection ────────────────────────────────────────────────────
    if do_inspect:
        inspect(filepath)
        return

    nom_fichier = filepath.name
    print(f"\n{'='*60}")
    print(f"  Import : {nom_fichier}")
    print(f"{'='*60}\n")

    # ── Vérification doublons ──────────────────────────────────────────────
    if not force and check_already_imported(nom_fichier):
        print(
            f"Ce fichier a déjà été importé avec succès.\n"
            f"Utilisez --force pour le ré-importer."
        )
        sys.exit(0)

    # ── Extract ────────────────────────────────────────────────────────────
    t0 = time.time()
    df_raw = extract(filepath)

    # ── Transform ──────────────────────────────────────────────────────────
    print("\nTransformation...")
    df_clean, warnings = transform(df_raw)

    if warnings:
        print(f"\n  {len(warnings)} avertissement(s) :")
        for w in warnings:
            print(f"    ⚠  {w}")

    print(f"\n  {len(df_clean):,} lignes prêtes pour l'insertion")

    # Période couverte (min/max de dateIntervention)
    periode_debut = None
    periode_fin = None
    if "dateIntervention" in df_clean.columns:
        non_null = df_clean["dateIntervention"].dropna()
        if len(non_null):
            periode_debut = non_null.min().to_pydatetime()
            periode_fin = non_null.max().to_pydatetime()
            print(f"  Période : {periode_debut.date()} → {periode_fin.date()}")

    # ── Création de l'entrée de log ────────────────────────────────────────
    import_id = create_import_log(nom_fichier)
    print(f"\nImport ID : {import_id}")

    # ── Load ───────────────────────────────────────────────────────────────
    print()
    result = load(df_clean, import_id)
    duree = time.time() - t0

    # ── Finalisation du log ────────────────────────────────────────────────
    statut = "SUCCES" if result["nb_erreurs"] == 0 else (
        "PARTIEL" if result["nb_importees"] > 0 else "ECHEC"
    )
    finalize_import_log(
        import_id=import_id,
        statut=statut,
        nb_total=result["nb_total"],
        nb_importees=result["nb_importees"],
        nb_erreurs=result["nb_erreurs"],
        duree=duree,
        erreurs=result["errors"],
        periode_debut=periode_debut,
        periode_fin=periode_fin,
    )

    # ── Résumé ─────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"  Statut    : {statut}")
    print(f"  Importées : {result['nb_importees']:,} / {result['nb_total']:,} lignes")
    if result["nb_erreurs"]:
        print(f"  Erreurs   : {result['nb_erreurs']:,} lignes")
    print(f"  Durée     : {duree:.1f}s")
    print(f"{'='*60}\n")

    if statut == "ECHEC":
        sys.exit(1)


if __name__ == "__main__":
    main()
