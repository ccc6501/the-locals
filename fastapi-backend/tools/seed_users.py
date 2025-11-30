"""
Seed test users for development/testing
Run once to populate the database with test users
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import User, Base
from auth_utils import get_password_hash


def seed_users():
    """Seed test users into the database"""
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    # Default password for all test users (hashed)
    default_password = "password123"  # Local testing only
    hashed_pw = get_password_hash(default_password)
    
    # Test users to seed
    test_users = [
        {
            "name": "Chance",
            "handle": "@chance",
            "email": "chance@thelocal.dev",
            "role": "admin",
            "status": "online"
        },
        {
            "name": "Sofia",
            "handle": "@sofia",
            "email": "sofia@thelocal.dev",
            "role": "user",
            "status": "online"
        },
        {
            "name": "Alex",
            "handle": "@alex",
            "email": "alex@thelocal.dev",
            "role": "moderator",
            "status": "offline"
        },
        {
            "name": "Marcus",
            "handle": "@marcus",
            "email": "marcus@thelocal.dev",
            "role": "user",
            "status": "online"
        }
    ]
    
    created_count = 0
    skipped_count = 0
    
    print("\n" + "="*60)
    print("SEEDING TEST USERS")
    print("="*60 + "\n")
    
    for user_data in test_users:
        # Check if user already exists (by handle or email)
        existing_user = db.query(User).filter(
            (User.handle == user_data["handle"]) | (User.email == user_data["email"])
        ).first()
        
        if existing_user:
            print(f"⏭️  Skipped: {user_data['name']} ({user_data['handle']}) - already exists")
            skipped_count += 1
            continue
        
        # Create new user
        new_user = User(
            name=user_data["name"],
            handle=user_data["handle"],
            email=user_data["email"],
            hashed_password=hashed_pw,
            role=user_data["role"],
            status=user_data["status"]
        )
        
        db.add(new_user)
        created_count += 1
        print(f"✅ Created: {user_data['name']} ({user_data['handle']}) - Role: {user_data['role']}")
    
    # Commit all changes
    db.commit()
    
    print("\n" + "="*60)
    print(f"SUMMARY: Created {created_count} users, Skipped {skipped_count} existing")
    print(f"Default password for all users: {default_password}")
    print("="*60 + "\n")
    
    db.close()


if __name__ == "__main__":
    seed_users()
