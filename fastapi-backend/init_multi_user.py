#!/usr/bin/env python3
"""
Initialize multi-user and room system.
Creates tables, default users, and system rooms.
"""

import sys
from database import engine, SessionLocal
from models import Base, User, UserPermission, Room, RoomMember, Message
from auth_utils import get_password_hash
from datetime import datetime
import json


# Default AI configs for system rooms
DEFAULT_AI_CONFIGS = {
    "general": {
        "assistant_name": "The Local",
        "assistant_persona": "friendly household AI assistant",
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "safety_level": "standard",
        "allowed_tools": ["network_status", "storage_browse", "system_metrics"],
        "disabled_tools": ["restart_services", "modify_config"],
        "context_sources": ["network_snapshot", "system_summary", "room_history"]
    },
    "network": {
        "assistant_name": "NetOps AI",
        "assistant_persona": "technical network engineer",
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "safety_level": "relaxed",
        "allowed_tools": ["*"],  # all tools
        "disabled_tools": [],
        "context_sources": ["network_snapshot", "system_summary", "storage_summary", "room_history"]
    },
    "storage": {
        "assistant_name": "The Local",
        "assistant_persona": "storage and file management assistant",
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "safety_level": "standard",
        "allowed_tools": ["storage_browse", "storage_upload", "storage_download", "storage_stats"],
        "disabled_tools": ["restart_services", "modify_config", "network_manage"],
        "context_sources": ["storage_summary", "room_history"]
    },
    "admin": {
        "assistant_name": "AdminBot",
        "assistant_persona": "technical system administrator with full access",
        "model": "gpt-4o-mini",
        "temperature": 0.5,
        "safety_level": "relaxed",
        "allowed_tools": ["*"],
        "disabled_tools": [],
        "context_sources": ["network_snapshot", "system_summary", "storage_summary", "room_history", "system_logs"]
    }
}


def init_multi_user_system():
    """Initialize the multi-user and room system"""
    print("=" * 60)
    print("Initializing Multi-User & Room System")
    print("=" * 60)
    
    # Create all tables
    print("\n[1/5] Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created")
    
    db = SessionLocal()
    
    try:
        # Check if already initialized
        existing_users = db.query(User).filter(User.is_bot == False).first()
        if existing_users:
            print("\n⚠ System already initialized. Skipping user creation.")
            confirm = input("Continue anyway? This will create duplicate rooms. (y/N): ")
            if confirm.lower() != 'y':
                print("Aborting.")
                return
        
        # Create default owner user
        print("\n[2/5] Creating default users...")
        print("\nLet's create the owner account:")
        
        handle = input("Owner handle (e.g., @chance): ").strip()
        if not handle.startswith('@'):
            handle = '@' + handle
        handle = handle.lower()
        
        display_name = input("Display name (e.g., Chance): ").strip()
        
        initials = input("Initials (e.g., CC): ").strip().upper()[:2]
        
        # Check if user with this handle already exists
        existing = db.query(User).filter(User.handle == handle).first()
        if existing:
            print(f"✓ User {handle} already exists (ID: {existing.id})")
            owner = existing
        else:
            owner = User(
                handle=handle,
                display_name=display_name,
                name=display_name,  # Legacy field
                initials=initials,
                color="#8b5cf6",
                role="owner",
                is_bot=False,
                status="online",
                email=f"{handle[1:]}@local.thelocal",  # Dummy email
                hashed_password=get_password_hash("changeme123")  # Default password
            )
            db.add(owner)
            db.commit()
            db.refresh(owner)
            print(f"✓ Owner user created: {display_name} ({handle}) - ID: {owner.id}")
            print(f"  Default password: 'changeme123' (please change this!)")
        
        # Create AI bot user
        ai_bot = db.query(User).filter(User.handle == "@thelocal").first()
        if not ai_bot:
            ai_bot = User(
                handle="@thelocal",
                display_name="The Local",
                name="The Local",
                initials="TL",
                color="#10b981",
                role="bot",
                is_bot=True,
                status="online",
                email="ai@local.thelocal"
            )
            db.add(ai_bot)
            db.commit()
            db.refresh(ai_bot)
            print(f"✓ AI bot user created: The Local (@thelocal) - ID: {ai_bot.id}")
        else:
            print(f"✓ AI bot user already exists - ID: {ai_bot.id}")
        
        # Grant all permissions to owner
        print("\n[3/5] Setting up permissions...")
        all_permissions = [
            "manage_rooms",
            "manage_users",
            "restart_services",
            "modify_config",
            "access_storage",
            "view_logs",
            "run_automation",
            "manage_network"
        ]
        
        for perm in all_permissions:
            existing_perm = db.query(UserPermission).filter(
                UserPermission.user_id == owner.id,
                UserPermission.permission == perm
            ).first()
            if not existing_perm:
                db.add(UserPermission(user_id=owner.id, permission=perm))
        
        db.commit()
        print(f"✓ Granted {len(all_permissions)} permissions to {owner.display_name}")
        
        # Create system rooms
        print("\n[4/5] Creating system rooms...")
        system_rooms_config = [
            {
                "slug": "general",
                "name": "General",
                "description": "Main hangout space for everyone",
                "icon": "🏠",
                "color": "#8b5cf6",
                "ai_config": DEFAULT_AI_CONFIGS["general"]
            },
            {
                "slug": "network",
                "name": "Network Ops",
                "description": "Network monitoring and device management",
                "icon": "🌐",
                "color": "#3b82f6",
                "ai_config": DEFAULT_AI_CONFIGS["network"]
            },
            {
                "slug": "storage",
                "name": "Storage",
                "description": "File management and cloud storage",
                "icon": "💾",
                "color": "#10b981",
                "ai_config": DEFAULT_AI_CONFIGS["storage"]
            },
            {
                "slug": "admin",
                "name": "Admin",
                "description": "System administration and maintenance",
                "icon": "⚙️",
                "color": "#ef4444",
                "ai_config": DEFAULT_AI_CONFIGS["admin"]
            }
        ]
        
        created_rooms = []
        for room_config in system_rooms_config:
            existing_room = db.query(Room).filter(Room.slug == room_config["slug"]).first()
            if existing_room:
                print(f"  ✓ Room '{room_config['name']}' already exists - ID: {existing_room.id}")
                created_rooms.append(existing_room)
            else:
                room = Room(
                    slug=room_config["slug"],
                    name=room_config["name"],
                    description=room_config["description"],
                    type="system",
                    icon=room_config["icon"],
                    color=room_config["color"],
                    is_system=True,
                    ai_config=room_config["ai_config"],
                    created_by=owner.id
                )
                db.add(room)
                db.commit()
                db.refresh(room)
                created_rooms.append(room)
                print(f"  ✓ Created room: {room.name} (#{room.slug}) - ID: {room.id}")
        
        # Add owner to all rooms
        print("\n[5/5] Adding owner to rooms...")
        for room in created_rooms:
            existing_member = db.query(RoomMember).filter(
                RoomMember.room_id == room.id,
                RoomMember.user_id == owner.id
            ).first()
            if not existing_member:
                member = RoomMember(
                    room_id=room.id,
                    user_id=owner.id,
                    role="owner"
                )
                db.add(member)
        
        db.commit()
        print(f"✓ Added {owner.display_name} to all {len(created_rooms)} rooms")
        
        print("\n" + "=" * 60)
        print("✅ Multi-User & Room System Initialized Successfully!")
        print("=" * 60)
        print(f"\nCreated:")
        print(f"  • 2 users (1 owner, 1 AI bot)")
        print(f"  • {len(created_rooms)} system rooms")
        print(f"  • {len(all_permissions)} permissions for owner")
        print(f"\nDefault login:")
        print(f"  Handle: {owner.handle}")
        print(f"  Password: changeme123")
        print("\n⚠ Remember to change the default password!")
        print("\nNext steps:")
        print("  1. Restart the backend server")
        print("  2. Create additional users via API or UI")
        print("  3. Customize room AI configurations")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during initialization: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        init_multi_user_system()
    except KeyboardInterrupt:
        print("\n\nInitialization cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        sys.exit(1)
