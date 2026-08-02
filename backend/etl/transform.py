import pandas as pd
import numpy as np
from column_map import COLUMN_MAP


# Valeurs string à remplacer par NULL
_NULL_STRINGS = {"", "nan", "NaN", "None", "none", "#REF!", "#N/A", "#VALEUR!", "#VALUE!"}


def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Retourne le premier nom de colonne trouvé dans df, ou None."""
    for c in candidates:
        if c in df.columns:
            return c
    return None


def _clean_string_series(s: pd.Series) -> pd.Series:
    """Strip + remplacement des valeurs nulles textuelles par NaN."""
    s = s.astype(str).str.strip()
    s = s.replace(_NULL_STRINGS, np.nan)
    return s


def transform(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Mappe les colonnes Excel vers les champs DB et nettoie les données.

    Retourne (dataframe_propre, liste_avertissements).
    Les colonnes introuvables sont présentes mais remplies de NaN.
    """
    warnings: list[str] = []
    mapped: dict[str, pd.Series] = {}

    for db_field, candidates in COLUMN_MAP.items():
        src_col = _find_col(df, candidates)
        if src_col is None:
            warnings.append(
                f"Colonne DB '{db_field}' introuvable (cherché : {candidates[:3]}...)"
            )
            mapped[db_field] = pd.Series([np.nan] * len(df), dtype=object)
        else:
            mapped[db_field] = df[src_col].copy()

    out = pd.DataFrame(mapped)

    # ── Colonnes numériques (BigInt nullable) ──────────────────────────────
    for col in ("idInterventionIw", "idInterventionGrdv", "idTechnicienCas"):
        out[col] = pd.to_numeric(out[col], errors="coerce").astype("Int64")

    # ── Colonnes dates ─────────────────────────────────────────────────────
    # dateIntervention : date précise de l'intervention
    out["dateIntervention"] = pd.to_datetime(
        out["dateIntervention"], errors="coerce", dayfirst=True
    )

    # moisIntervention : tronque au 1er du mois pour groupements mensuels.
    # Dans le fichier TECHNO SMART le champ est une chaine "YYYY-MM" (ex: "2024-08").
    raw_mois = out["moisIntervention"].astype(str).str.strip()
    raw_mois = raw_mois.replace(_NULL_STRINGS, np.nan)

    parsed_mois = pd.Series(pd.NaT, index=out.index, dtype="datetime64[ns]")

    # Format "YYYY-MM" : on ajoute "-01" pour obtenir une date parseable
    mask_ym = raw_mois.str.match(r"^\d{4}-\d{2}$", na=False)
    if mask_ym.any():
        parsed_mois[mask_ym] = pd.to_datetime(
            raw_mois[mask_ym] + "-01", format="%Y-%m-%d", errors="coerce"
        )
    # Autres formats (date ISO complete, datetime, texte)
    remaining = ~mask_ym & raw_mois.notna()
    if remaining.any():
        parsed_mois[remaining] = pd.to_datetime(
            raw_mois[remaining], errors="coerce", dayfirst=True
        )

    out["moisIntervention"] = parsed_mois.dt.to_period("M").dt.to_timestamp()

    # ── Colonnes texte : nettoyage ─────────────────────────────────────────
    text_cols = [
        "nomTechnicien", "nomSociete", "codeDepartement", "departement",
        "semaineIntervention", "technologie", "infrastructure", "operateur",
        "typeAbonne", "modeleModem", "typezone", "activites", "typePresta",
        "etat", "codeCloture", "categorieEchec", "aboRacco110", "aboRacco120",
    ]
    for col in text_cols:
        if col in out.columns:
            out[col] = _clean_string_series(out[col])

    # ── Filtrage des lignes sans aucune information utile ──────────────────
    # Une ligne est conservée si au moins un champ clé est renseigné.
    key_fields = ["typezone", "activites", "etat", "nomTechnicien"]
    available_keys = [c for c in key_fields if c in out.columns]
    if available_keys:
        n_before = len(out)
        mask = out[available_keys].notna().any(axis=1)
        out = out[mask].reset_index(drop=True)
        n_dropped = n_before - len(out)
        if n_dropped:
            warnings.append(f"{n_dropped:,} lignes ignorées (tous champs clés vides)")

    return out, warnings
