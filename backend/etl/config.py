import os
from pathlib import Path
from dotenv import load_dotenv

# Charge le .env du backend (dossier parent)
load_dotenv(Path(__file__).parent.parent / ".env")

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/logistique_db"
)

SHEET_NAME = "INTERVENTION TECHNO SMART"
CHUNK_SIZE = 5000

UPLOAD_FOLDER = Path(__file__).parent / "uploads"
LOG_FOLDER = Path(__file__).parent / "logs"

UPLOAD_FOLDER.mkdir(exist_ok=True)
LOG_FOLDER.mkdir(exist_ok=True)
