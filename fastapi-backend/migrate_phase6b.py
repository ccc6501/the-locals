"""
Migration script for Phase 6B - Advanced Room Management
Adds: room settings, self-destruct, metrics tracking
"""

import sqlite3
from datetime import datetime

def migrate_phase6b():
    """Add Phase 6B columns to threads table"""
    
    db_path = "admin_panel.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("=" * 70)
        print("PHASE 6B MIGRATION - Advanced Room Management")
        print("=" * 70)
        
        # Get current columns
        cursor.execute("PRAGMA table_info(threads)")
        columns = [col[1] for col in cursor.fetchall()]
        
        print(f"\nCurrent threads table columns: {len(columns)}")
        
        # Columns to add
        new_columns = {
            "ai_enabled": ("BOOLEAN", "1"),  # True
            "notifications_enabled": ("BOOLEAN", "1"),  # True
            "self_destruct_at": ("DATETIME", "NULL"),
            "total_messages": ("INTEGER", "0"),
            "total_ai_requests": ("INTEGER", "0"),
            "last_activity_at": ("DATETIME", f"'{datetime.utcnow().isoformat()}'")
        }
        
        added = 0
        skipped = 0
        
        for col_name, (col_type, default_val) in new_columns.items():
            if col_name not in columns:
                print(f"\n✅ Adding '{col_name}' ({col_type})...")
                cursor.execute(f"""
                    ALTER TABLE threads 
                    ADD COLUMN {col_name} {col_type} DEFAULT {default_val}
                """)
                added += 1
                print(f"   '{col_name}' added successfully")
            else:
                print(f"\n⏭️  '{col_name}' already exists")
                skipped += 1
        
        conn.commit()
        
        # Verify
        cursor.execute("PRAGMA table_info(threads)")
        final_columns = [col[1] for col in cursor.fetchall()]
        
        print("\n" + "=" * 70)
        print("MIGRATION COMPLETE")
        print("=" * 70)
        print(f"\n✅ Added {added} new columns")
        print(f"⏭️  Skipped {skipped} existing columns")
        print(f"\nTotal columns in threads table: {len(final_columns)}")
        print("\nNew Phase 6B features:")
        print("  - ai_enabled: Toggle AI responses per room")
        print("  - notifications_enabled: Toggle notifications per room")
        print("  - self_destruct_at: Auto-delete timestamp")
        print("  - total_messages: Message count tracking")
        print("  - total_ai_requests: AI request count tracking")
        print("  - last_activity_at: Last message timestamp")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"\n❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False
    
    return True


if __name__ == "__main__":
    success = migrate_phase6b()
    exit(0 if success else 1)
