import uuid
import json
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy import create_engine, text, BigInteger, DateTime, Text

from config import DATABASE_URL, CHUNK_SIZE


# Types SQLAlchemy explicites pour les colonnes ambiguës
_DTYPE_MAP = {
    "idInterventionIw":   BigInteger(),
    "idInterventionGrdv": BigInteger(),
    "idTechnicienCas":    BigInteger(),
    "dateIntervention":   DateTime(timezone=False),
    "moisIntervention":   DateTime(timezone=False),
}


def _get_engine():
    return create_engine(DATABASE_URL, pool_pre_ping=True)


def check_already_imported(nom_fichier: str) -> bool:
    """Retourne True si ce fichier a déjà été importé avec succès."""
    engine = _get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text('SELECT COUNT(*) FROM imports_consommable_log WHERE "nomFichier" = :n AND statut = :s'),
            {"n": nom_fichier, "s": "SUCCES"},
        ).fetchone()
    return (row[0] or 0) > 0


def create_import_log(nom_fichier: str) -> str:
    """Crée un enregistrement EN_COURS et retourne son id."""
    import_id = str(uuid.uuid4())
    engine = _get_engine()
    with engine.connect() as conn:
        conn.execute(
            text(
                'INSERT INTO imports_consommable_log (id, "nomFichier", statut, "dateImport") '
                "VALUES (:id, :nom, 'EN_COURS', NOW())"
            ),
            {"id": import_id, "nom": nom_fichier},
        )
        conn.commit()
    return import_id


def finalize_import_log(
    import_id: str,
    statut: str,
    nb_total: int,
    nb_importees: int,
    nb_erreurs: int,
    duree: float,
    erreurs: list,
    periode_debut: datetime | None,
    periode_fin: datetime | None,
) -> None:
    engine = _get_engine()
    with engine.connect() as conn:
        conn.execute(
            text(
                """UPDATE imports_consommable_log SET
                     statut            = :statut,
                     "nbLignesTotal"   = :total,
                     "nbLignesImportees" = :importees,
                     "nbErreurs"       = :erreurs,
                     "dureeSecondes"   = :duree,
                     erreurs           = :erreurs_json ::jsonb,
                     "periodeDebut"    = :debut,
                     "periodeFin"      = :fin
                   WHERE id = :id"""
            ),
            {
                "id": import_id,
                "statut": statut,
                "total": nb_total,
                "importees": nb_importees,
                "erreurs": nb_erreurs,
                "duree": duree,
                "erreurs_json": json.dumps(erreurs, ensure_ascii=False),
                "debut": periode_debut,
                "fin": periode_fin,
            },
        )
        conn.commit()


def load(df: pd.DataFrame, import_id: str) -> dict:
    """Insère les données par lots dans interventions_terrain.

    Retourne un dict avec nb_total, nb_importees, nb_erreurs, errors[].
    """
    engine = _get_engine()

    # Ajouter les colonnes système
    df = df.copy()
    df["id"] = [str(uuid.uuid4()) for _ in range(len(df))]
    df["sourceImportId"] = import_id
    df["createdAt"] = datetime.now(tz=timezone.utc).replace(tzinfo=None)

    n_total = len(df)
    n_imported = 0
    errors: list[dict] = []
    total_chunks = (n_total + CHUNK_SIZE - 1) // CHUNK_SIZE

    print(f"  Insertion de {n_total:,} lignes en {total_chunks} lots de {CHUNK_SIZE:,}...")

    for chunk_idx in range(total_chunks):
        start = chunk_idx * CHUNK_SIZE
        chunk = df.iloc[start : start + CHUNK_SIZE]
        try:
            chunk.to_sql(
                "interventions_terrain",
                engine,
                if_exists="append",
                index=False,
                method="multi",
                dtype=_DTYPE_MAP,
            )
            n_imported += len(chunk)
            pct = n_imported / n_total * 100
            print(f"  Lot {chunk_idx + 1}/{total_chunks} — {n_imported:,}/{n_total:,} lignes ({pct:.0f}%)")
        except Exception as exc:
            errors.append({"lot": chunk_idx + 1, "erreur": str(exc)[:400]})
            print(f"  Lot {chunk_idx + 1}/{total_chunks} ERREUR : {str(exc)[:120]}")

    return {
        "nb_total": n_total,
        "nb_importees": n_imported,
        "nb_erreurs": n_total - n_imported,
        "errors": errors,
    }
