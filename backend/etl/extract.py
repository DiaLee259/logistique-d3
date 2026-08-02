import pandas as pd
from pathlib import Path
from config import SHEET_NAME


def extract(filepath: Path) -> pd.DataFrame:
    print(f"Lecture : {filepath}")
    df = pd.read_excel(
        filepath,
        sheet_name=SHEET_NAME,
        engine="openpyxl",
        # Ne pas forcer dtype=str : pandas parse les dates et les nombres
        # correctement, ce qui simplifie le transform.
    )
    # Normalise les noms de colonnes (espaces en bord)
    df.columns = df.columns.str.strip()
    print(f"  ✓ {len(df):,} lignes, {len(df.columns)} colonnes")
    return df


def inspect(filepath: Path) -> None:
    """Affiche toutes les colonnes disponibles avec un exemple de valeur.

    Utile pour ajuster column_map.py si les noms diffèrent de l'attendu.
    Usage : python process.py chemin/fichier.xlsx --inspect
    """
    df = extract(filepath)
    print(f"\nFeuille : '{SHEET_NAME}'\n")
    print(f"{'Index':>5}  {'Nom de colonne':<55}  {'Type':<12}  Exemple")
    print("-" * 100)
    for i, col in enumerate(df.columns):
        dtype = str(df[col].dtype)
        # Premier exemple non-nul
        non_null = df[col].dropna()
        sample = repr(str(non_null.iloc[0])[:45]) if len(non_null) > 0 else "(vide)"
        print(f"{i:5d}  {repr(col):<55}  {dtype:<12}  {sample}")
    print(f"\nTotal : {len(df.columns)} colonnes, {len(df):,} lignes")
