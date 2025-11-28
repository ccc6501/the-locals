"""
Quick database setup for testing - creates minimal structure
"""
import sqlite3

# Create database
conn = sqlite3.connect('admin_panel.db')
cursor = conn.cursor()

# Drop and recreate users table
cursor.execute("DROP TABLE IF EXISTS users")
cursor.execute("""
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handle VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    hashed_password VARCHAR(255),
    initials VARCHAR(5),
    avatar_url VARCHAR(500),
    color VARCHAR(20) DEFAULT '#8b5cf6',
    role VARCHAR(20) DEFAULT 'member',
    is_bot BOOLEAN DEFAULT 0,
    status VARCHAR(20) DEFAULT 'offline',
    last_active_at DATETIME,
    devices INTEGER DEFAULT 0,
    ai_usage INTEGER DEFAULT 0,
    storage_used REAL DEFAULT 0.0,
    preferences TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")

# Create rooms table
cursor.execute("DROP TABLE IF EXISTS rooms")
cursor.execute("""
CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) DEFAULT 'group',
    icon VARCHAR(50),
    color VARCHAR(20),
    ai_config TEXT,
    created_by INTEGER,
    is_system BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
)
""")

# Create room_members table
cursor.execute("DROP TABLE IF EXISTS room_members")
cursor.execute("""
CREATE TABLE room_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    last_read_at DATETIME,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(room_id, user_id)
)
""")

# Create messages table
cursor.execute("DROP TABLE IF EXISTS messages")
cursor.execute("""
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    thread_id INTEGER,
    user_id INTEGER,
    sender VARCHAR(100) NOT NULL,
    text TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    msg_metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
)
""")

# Insert test user (owner)
cursor.execute("""
INSERT INTO users (handle, display_name, initials, color, role, is_bot)
VALUES ('chance', 'Chance', 'CC', '#8b5cf6', 'owner', 0)
""")
user_id = cursor.lastrowid

# Insert AI bot
cursor.execute("""
INSERT INTO users (handle, display_name, initials, color, role, is_bot)
VALUES ('thelocal', 'The Local', 'TL', '#3b82f6', 'admin', 1)
""")

# Insert test rooms
rooms_data = [
    ('general', 'General', 'system', '#💬', '#8b5cf6', True),
    ('network', 'Network', 'system', '#🌐', '#3b82f6', True),
    ('storage', 'Storage', 'system', '#💾', '#10b981', True),
    ('admin', 'Admin', 'system', '#⚙️', '#ef4444', True)
]

for slug, name, room_type, icon, color, is_system in rooms_data:
    cursor.execute("""
    INSERT INTO rooms (slug, name, type, icon, color, created_by, is_system)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (slug, name, room_type, icon, color, user_id, is_system))
    
    room_id = cursor.lastrowid
    
    # Add owner as room member
    cursor.execute("""
    INSERT INTO room_members (room_id, user_id, role)
    VALUES (?, ?, 'owner')
    """, (room_id, user_id))

conn.commit()
conn.close()

print("✓ Database created with:")
print("  - 2 users (Chance, The Local)")
print("  - 4 system rooms")
print("  - Room memberships")
print("\nYou can now use the API!")
