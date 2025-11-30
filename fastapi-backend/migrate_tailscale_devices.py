"""
Migration: Add Tailscale device tracking to devices table
Also seeds the three test devices for multi-user testing
"""

from sqlalchemy import text
from database import engine, SessionLocal
from models import User, Device
from datetime import datetime


def migrate():
    """Add Tailscale columns to devices table"""
    with engine.connect() as conn:
        # Add Tailscale columns
        try:
            conn.execute(text("ALTER TABLE devices ADD COLUMN tailscale_ip VARCHAR(50)"))
            conn.execute(text("CREATE UNIQUE INDEX idx_devices_tailscale_ip ON devices(tailscale_ip)"))
            print("✓ Added tailscale_ip column")
        except Exception as e:
            print(f"  tailscale_ip column may already exist: {e}")
        
        try:
            conn.execute(text("ALTER TABLE devices ADD COLUMN tailscale_hostname VARCHAR(100)"))
            print("✓ Added tailscale_hostname column")
        except Exception as e:
            print(f"  tailscale_hostname column may already exist: {e}")
        
        try:
            conn.execute(text("ALTER TABLE devices ADD COLUMN is_tailscale_device BOOLEAN DEFAULT 0"))
            print("✓ Added is_tailscale_device column")
        except Exception as e:
            print(f"  is_tailscale_device column may already exist: {e}")
        
        conn.commit()
    
    print("\n✓ Migration complete!")


def seed_tailscale_devices():
    """Seed the three test devices for multi-user testing"""
    db = SessionLocal()
    
    try:
        # Get admin user (@chance)
        admin_user = db.query(User).filter(User.handle == "@chance").first()
        if not admin_user:
            print("ERROR: Admin user '@chance' not found. Please create it first.")
            return
        
        # Create moderator user (chance - iPhone) - using different handle to avoid conflict
        chance_user = db.query(User).filter(User.handle == "@chance_iphone").first()
        if not chance_user:
            from auth_utils import get_password_hash
            chance_user = User(
                name="Chance (iPhone)",
                handle="@chance_iphone",
                email="chance@thelocal.app",
                hashed_password=get_password_hash("password123"),
                role="moderator",
                status="offline"
            )
            db.add(chance_user)
            db.commit()
            db.refresh(chance_user)
            print(f"✓ Created moderator user: {chance_user.handle}")
        
        # Create regular user (ipad)
        ipad_user = db.query(User).filter(User.handle == "@ipad").first()
        if not ipad_user:
            from auth_utils import get_password_hash
            ipad_user = User(
                name="iPad User",
                handle="@ipad",
                email="ipad@thelocal.app",
                hashed_password=get_password_hash("password123"),
                role="user",
                status="offline"
            )
            db.add(ipad_user)
            db.commit()
            db.refresh(ipad_user)
            print(f"✓ Created regular user: {ipad_user.handle}")
        
        # Seed Tailscale devices
        devices_config = [
            {
                "user_id": admin_user.id,
                "device_name": "home-hub",
                "device_type": "desktop",
                "tailscale_ip": "100.88.23.90",
                "tailscale_hostname": "home-hub",
                "ip_address": "127.0.0.1",
                "user_agent": "Chrome/Windows (home-hub admin)",
                "is_tailscale_device": True
            },
            {
                "user_id": chance_user.id,
                "device_name": "chance (iPhone)",
                "device_type": "mobile",
                "tailscale_ip": "100.112.252.35",
                "tailscale_hostname": "chance",
                "ip_address": "100.112.252.35",
                "user_agent": "Safari/iOS (chance moderator)",
                "is_tailscale_device": True
            },
            {
                "user_id": ipad_user.id,
                "device_name": "ipad",
                "device_type": "tablet",
                "tailscale_ip": "100.126.159.45",
                "tailscale_hostname": "ipad",
                "ip_address": "100.126.159.45",
                "user_agent": "Safari/iPadOS (ipad user)",
                "is_tailscale_device": True
            }
        ]
        
        for device_config in devices_config:
            # Check if device already exists
            existing = db.query(Device).filter(
                Device.tailscale_ip == device_config["tailscale_ip"]
            ).first()
            
            if existing:
                # Update existing device
                for key, value in device_config.items():
                    setattr(existing, key, value)
                existing.last_active = datetime.utcnow()
                print(f"✓ Updated device: {device_config['device_name']}")
            else:
                # Create new device
                device = Device(**device_config)
                db.add(device)
                print(f"✓ Created device: {device_config['device_name']}")
        
        db.commit()
        
        print("\n=== Tailscale Device Setup Complete ===")
        print(f"Admin (home-hub): localhost or 100.88.23.90 -> @chance")
        print(f"Moderator (iPhone): 100.112.252.35 -> @chance_iphone")
        print(f"User (iPad): 100.126.159.45 -> @ipad")
        print("\nAll devices can now auto-login via their Tailscale IP!")
        
    except Exception as e:
        print(f"Error seeding devices: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("=== Tailscale Device Migration ===\n")
    migrate()
    print("\n=== Seeding Test Devices ===\n")
    seed_tailscale_devices()
