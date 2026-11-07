"""
Buat atau reset akun admin.
Jalankan dari folder backend:

  python scripts/ensure_admin.py --email admin@contoh.com
  python scripts/ensure_admin.py --email admin@contoh.com --password "<password-kuat>"

Jika --password tidak diberikan, password akan diminta secara interaktif.
Jangan pernah commit password asli.
"""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

# Agar `import app` jalan saat dijalankan sebagai file
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.auth import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import User  # noqa: E402

MIN_PASSWORD_LEN = 8


def _read_password(cli_value: str | None) -> str:
    if cli_value:
        password = cli_value
    else:
        password = getpass.getpass("Password admin: ")
        if password != getpass.getpass("Ulangi password: "):
            sys.exit("Gagal: password tidak sama.")
    if len(password) < MIN_PASSWORD_LEN:
        sys.exit(f"Gagal: password minimal {MIN_PASSWORD_LEN} karakter.")
    return password


def main() -> None:
    p = argparse.ArgumentParser(description="Pastikan ada user admin di database.")
    p.add_argument("--email", required=True)
    p.add_argument("--password", default=None, help="Kosongkan agar diminta secara interaktif")
    p.add_argument("--name", default="Administrator")
    args = p.parse_args()

    password = _read_password(args.password)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if user:
            user.password = hash_password(password)
            user.role = "admin"
            user.name = args.name
            db.commit()
            print(f"OK: password & role admin diperbarui untuk {args.email}")
        else:
            db.add(
                User(
                    name=args.name,
                    email=args.email,
                    password=hash_password(password),
                    role="admin",
                )
            )
            db.commit()
            print(f"OK: admin dibuat — {args.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
