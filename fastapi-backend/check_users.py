"""Check existing users in database"""
from database import SessionLocal
from models import User

db = SessionLocal()
try:
    users = db.query(User).all()
    print(f"\nFound {len(users)} users in database:\n")
    for user in users:
        print(f"ID: {user.id}")
        print(f"Email: {user.email}")
        print(f"Name: {user.name}")
        print(f"Role: {user.role}")
        print(f"Handle: {user.handle}")
        print("-" * 40)
finally:
    db.close()
