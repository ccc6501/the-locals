"""
Migration script to add room settings columns to threads table
Run this once to update existing database schema
"""

import sqlite3
import sys

def migrate_room_settings():
    """Add ai_enabled and notifications_enabled columns to threads table"""
    
    db_path = "admin_panel.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("=" * 60)
        print("MIGRATING ROOM SETTINGS COLUMNS")
        print("=" * 60)
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(threads)")
        columns = [col[1] for col in cursor.fetchall()]
        
        print(f"\nCurrent threads table columns: {columns}")
        
        # Add ai_enabled column if it doesn't exist
        if "ai_enabled" not in columns:
            print("\n✅ Adding 'ai_enabled' column...")
            cursor.execute("""
                ALTER TABLE threads 
                ADD COLUMN ai_enabled BOOLEAN DEFAULT 1
            """)
            print("   'ai_enabled' column added successfully")
        else:
            print("\n⏭️  'ai_enabled' column already exists")
        
        # Add notifications_enabled column if it doesn't exist
        if "notifications_enabled" not in columns:
            print("\n✅ Adding 'notifications_enabled' column...")
            cursor.execute("""
                ALTER TABLE threads 
                ADD COLUMN notifications_enabled BOOLEAN DEFAULT 1
            """)
            print("   'notifications_enabled' column added successfully")
        else:
            print("\n⏭️  'notifications_enabled' column already exists")
        
        conn.commit()
        
        # Verify the migration
        cursor.execute("PRAGMA table_info(threads)")
        new_columns = [col[1] for col in cursor.fetchall()]
        
        print("\n" + "=" * 60)
        print("MIGRATION COMPLETE")
        print("=" * 60)
        print(f"\nUpdated threads table columns: {new_columns}")
        print("\n✅ All room settings columns are now available")
        print("   - ai_enabled (default: True)")
        print("   - notifications_enabled (default: True)")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"\n❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    migrate_room_settings()
