"""
Initialize database with sample data
Run this script to create an admin user and sample data
"""

from database import SessionLocal, engine, Base
from models import User, Thread, Message, Invite, Settings
from auth_utils import get_password_hash
import json

# Create all tables
Base.metadata.create_all(bind=engine)

def init_db():
    """Initialize database with sample data"""
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == "admin@example.com").first()
        if existing_admin:
            print("✅ Admin user already exists")
        else:
            # Create admin user
            admin = User(
                name="Admin User",
                handle="@admin",
                email="admin@example.com",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                status="offline",
                devices=2,
                ai_usage=342,
                storage_used=5.2
            )
            db.add(admin)
            print("✅ Created admin user (email: admin@example.com, password: admin123)")
        
        # Create sample users
        users_to_create = [
            {
                "name": "Sofia Martinez",
                "handle": "@sofia",
                "email": "sofia@example.com",
                "password": "password123",
                "role": "user",
                "devices": 1,
                "ai_usage": 156,
                "storage_used": 2.1
            },
            {
                "name": "Marcus Chen",
                "handle": "@marcus",
                "email": "marcus@example.com",
                "password": "password123",
                "role": "user",
                "devices": 3,
                "ai_usage": 89,
                "storage_used": 8.7
            }
        ]
        
        for user_data in users_to_create:
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            if not existing:
                user = User(
                    name=user_data["name"],
                    handle=user_data["handle"],
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    role=user_data["role"],
                    status="offline",
                    devices=user_data["devices"],
                    ai_usage=user_data["ai_usage"],
                    storage_used=user_data["storage_used"]
                )
                db.add(user)
                print(f"✅ Created user: {user_data['name']}")
        
        db.commit()
        
        # Create default AI chat thread
        existing_thread = db.query(Thread).filter(Thread.name == "AI Assistant").first()
        if not existing_thread:
            ai_thread = Thread(
                type="ai",
                name="AI Assistant",
                avatar="bot",
                user_id=1
            )
            db.add(ai_thread)
            db.commit()
            
            # Add initial message
            initial_message = Message(
                thread_id=ai_thread.id,
                sender="bot",
                text="Hello! I'm your AI assistant. How can I help you today?"
            )
            db.add(initial_message)
            print("✅ Created AI Assistant thread")
        
        # Create sample invite
        existing_invite = db.query(Invite).first()
        if not existing_invite:
            invite = Invite(
                code="INV-DEMO",
                uses=0,
                max_uses=10,
                status="active",
                created_by=1
            )
            db.add(invite)
            print("✅ Created sample invite: INV-DEMO")
        
        # Create default settings
        default_settings = {
            "allowRegistration": True,
            "requireEmailVerification": True,
            "aiRateLimit": 100,
            "storagePerUser": 50,
            "maxDevicesPerUser": 5,
            "systemInstructions": "You are a helpful AI assistant. Be concise and professional.",
            "maintenanceMode": False,
            "debugMode": False,
            "autoBackup": True
        }
        
        for key, value in default_settings.items():
            existing_setting = db.query(Settings).filter(Settings.key == key).first()
            if not existing_setting:
                setting = Settings(
                    key=key,
                    value=json.dumps(value) if not isinstance(value, str) else value
                )
                db.add(setting)
        
        print("✅ Created default settings")
        
        db.commit()
        
        print("\n🎉 Database initialized successfully!")
        print("\n📝 Login credentials:")
        print("   Email: admin@example.com")
        print("   Password: admin123")
        print("\n🌐 Start the server with: python main.py")
        print("📚 API docs: http://localhost:8000/docs")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 Initializing database...")
    init_db()
