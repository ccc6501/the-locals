"""
Recovery script to create admin accounts and generate a recovery file with login links.

Usage (optional args):
  python recovery_admin.py \
    --email admin@home.local \
    --password "My$trongP@ssw0rd" \
    --name "Admin" \
    --handle "@admin" \
    --backup-email admin-recovery@home.local \
    --backup-password "Another$trongP@ss1"

If passwords are not provided, strong random passwords will be generated.
This script is idempotent: if the user exists, it will set role=admin and reset the password.
"""

import argparse
import os
import sys
import secrets
import string
from datetime import datetime

# Allow running this script outside the backend folder by locating the backend path.
def _ensure_backend_on_sys_path():
    candidates = []
    # 1) Env var override
    env_path = os.environ.get("FASTAPI_BACKEND_PATH") or os.environ.get("BACKEND_PATH")
    if env_path:
        candidates.append(env_path)
    # 2) Relative paths from this script location
    here = os.path.dirname(os.path.abspath(__file__))
    candidates.append(os.path.join(here, "fastapi-backend"))
    candidates.append(os.path.join(here, "..", "fastapi-backend"))
    # 3) Common location on this machine
    candidates.append(r"c:\Users\Chance\Downloads\fastapi-backend")

    for p in candidates:
        if not p:
            continue
        p = os.path.abspath(p)
        if os.path.isdir(p):
            # Heuristic: ensure expected backend files exist
            if (os.path.exists(os.path.join(p, "database.py")) and
                os.path.exists(os.path.join(p, "models.py")) and
                os.path.exists(os.path.join(p, "auth_utils.py"))):
                if p not in sys.path:
                    sys.path.insert(0, p)
                return p
    return None

_BACKEND_PATH = _ensure_backend_on_sys_path()
if _BACKEND_PATH is None:
    raise RuntimeError(
        "Could not locate your fastapi-backend folder. Set FASTAPI_BACKEND_PATH to its absolute path, "
        "or move this script into that folder."
    )

from database import Base, engine, SessionLocal
from models import User
from auth_utils import get_password_hash


def generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{}"  # 80+ chars
    # Ensure at least one of each class
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pwd)
            and any(c.isupper() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$%^&*()-_=+[]{}" for c in pwd)):
            return pwd


def upsert_admin(db, email, password, name, handle):
    user = db.query(User).filter(User.email == email).first()
    hashed = get_password_hash(password)
    if user:
        # Set fields unconditionally to avoid type checker confusion with truthiness
        user.hashed_password = hashed
        user.role = "admin"
        user.name = name
        user.handle = handle
        db.commit()
        db.refresh(user)
        mode = "updated"
    else:
        # Ensure unique handle if needed
        base_handle = handle
        i = 2
        while db.query(User).filter(User.handle == handle).first():
            handle = f"{base_handle}{i}"
            i += 1
        user = User(
            name=name,
            handle=handle,
            email=email,
            hashed_password=hashed,
            role="admin",
            status="offline",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        mode = "created"
    return user, mode


def write_recovery_file(primary_email: str, primary_password: str, backup_email: str, backup_password: str) -> str:
    # Prefer backend data dir if present
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    path = os.path.join(data_dir, "RECOVERY_ADMIN.txt")

    lines = []
    lines.append("# Admin Panel — Recovery Admin Accounts\n")
    lines.append(f"Generated: {datetime.utcnow().isoformat()}Z\n\n")
    lines.append("Frontend Login URLs (try in order):\n")
    lines.append("  - http://localhost:3003\n")
    lines.append("  - http://home-hub:3003\n")
    lines.append("  - http://home-hub-1:3003\n")
    lines.append("  - Replace with your Tailscale IP if needed: http://100.x.x.x:3003\n\n")

    lines.append("Primary Admin:\n")
    lines.append(f"  Email:    {primary_email}\n")
    lines.append(f"  Password: {primary_password}\n\n")

    lines.append("Backup Admin:\n")
    lines.append(f"  Email:    {backup_email}\n")
    lines.append(f"  Password: {backup_password}\n\n")

    lines.append("API base (backend):\n")
    lines.append("  - http://localhost:8000\n")
    lines.append("  - http://home-hub:8000\n")
    lines.append("  - http://home-hub-1:8000\n\n")

    lines.append("Security notes:\n")
    lines.append("  - Change these passwords after first login.\n")
    lines.append("  - Delete this file once access is restored.\n")

    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)

    return path


def main():
    parser = argparse.ArgumentParser(description="Create or reset admin accounts for recovery.")
    parser.add_argument("--email", default="admin@home.local")
    parser.add_argument("--password", default=None)
    parser.add_argument("--name", default="Admin")
    parser.add_argument("--handle", default="@admin")
    parser.add_argument("--backup-email", dest="backup_email", default="admin-recovery@home.local")
    parser.add_argument("--backup-password", dest="backup_password", default=None)
    args = parser.parse_args()

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    primary_pwd = args.password or generate_password()
    backup_pwd = args.backup_password or generate_password()

    db = SessionLocal()
    try:
        p_user, p_mode = upsert_admin(db, args.email, primary_pwd, args.name, args.handle)
        b_user, b_mode = upsert_admin(db, args.backup_email, backup_pwd, f"{args.name} Backup", f"{args.handle}-backup")

        path = write_recovery_file(args.email, primary_pwd, args.backup_email, backup_pwd)

        print("=== Recovery Admin Accounts ===")
        print(f"Primary admin ({p_mode}): {args.email}")
        print(f"  Password: {primary_pwd}")
        print(f"Backup admin ({b_mode}): {args.backup_email}")
        print(f"  Password: {backup_pwd}")
        print("")
        print("Login links:")
        print("  - http://localhost:3003")
        print("  - http://home-hub:3003")
        print("  - http://home-hub-1:3003")
        print("")
        print(f"Recovery file written to: {path}")
        print("IMPORTANT: Change these passwords after login and then delete the recovery file.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
