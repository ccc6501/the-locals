"""Reset admin password"""
from database import SessionLocal
from models import User
from auth_utils import get_password_hash

db = SessionLocal()
try:
    admin = db.query(User).filter(User.email == "ccc6501@gmail.com").first()
    if admin:
        # Set password to "admin123"
        admin.hashed_password = get_password_hash("admin123")
        db.commit()
        print("✅ Password reset successfully!")
        print(f"\nLogin with:")
        print(f"Email: {admin.email}")
        print(f"Password: admin123")
    else:
        print("❌ Admin user not found")
finally:
    db.close()
