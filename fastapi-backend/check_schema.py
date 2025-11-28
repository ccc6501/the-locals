import sqlite3

conn = sqlite3.connect('admin_panel.db')
cursor = conn.cursor()

# Get table schema
cursor.execute("PRAGMA table_info(users)")
columns = cursor.fetchall()

print("Users table columns:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

conn.close()
