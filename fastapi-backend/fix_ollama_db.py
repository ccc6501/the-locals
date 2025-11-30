"""
Fix corrupted Ollama URL in SQLite database
"""
import sqlite3
import json

# Connect to database
conn = sqlite3.connect('admin_panel.db')
cursor = conn.cursor()

print("=" * 60)
print("INSPECTING DATABASE FOR CORRUPTED OLLAMA URL")
print("=" * 60)

# List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("\nTables in database:")
for table in tables:
    print(f"  - {table[0]}")

# Check connection/connections table
for table_name in ['connection', 'connections', 'cloud_storage_config']:
    try:
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        if rows:
            print(f"\n{table_name.upper()} TABLE:")
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [col[1] for col in cursor.fetchall()]
            print(f"Columns: {columns}")
            
            for row in rows:
                print(f"\nRow: {dict(zip(columns, row))}")
                
                # Look for corrupted values
                row_dict = dict(zip(columns, row))
                for key, value in row_dict.items():
                    if value and isinstance(value, str):
                        if 'localhost3' in value or '114344' in value or '%3A' in value:
                            print(f"  ⚠️  CORRUPTED VALUE FOUND in {key}: {value}")
    except sqlite3.OperationalError:
        continue

print("\n" + "=" * 60)
print("FIX OPTIONS:")
print("=" * 60)

# Try to find and fix Ollama connection
try:
    cursor.execute("SELECT id, service, config FROM connection WHERE service='ollama'")
    ollama_row = cursor.fetchone()
    
    if ollama_row:
        print(f"\n✅ Found Ollama connection (ID: {ollama_row[0]})")
        print(f"Current config: {ollama_row[2]}")
        
        # Parse and display the config
        if ollama_row[2]:
            try:
                config = json.loads(ollama_row[2])
                print(f"Parsed config: {json.dumps(config, indent=2)}")
                
                if 'endpoint' in config or 'base_url' in config:
                    current_url = config.get('endpoint') or config.get('base_url')
                    if 'localhost3' in current_url or '114344' in current_url:
                        print(f"\n🚨 CORRUPTED URL DETECTED: {current_url}")
                        print("\nFixing to: http://localhost:11434")
                        
                        # Fix the config
                        if 'endpoint' in config:
                            config['endpoint'] = 'http://localhost:11434'
                        if 'base_url' in config:
                            config['base_url'] = 'http://localhost:11434'
                        
                        new_config = json.dumps(config)
                        cursor.execute(
                            "UPDATE connection SET config=? WHERE id=?",
                            (new_config, ollama_row[0])
                        )
                        conn.commit()
                        print("✅ FIXED! Ollama URL updated to http://localhost:11434")
                    else:
                        print(f"✅ URL looks OK: {current_url}")
            except json.JSONDecodeError:
                print("⚠️  Config is not valid JSON")
        else:
            print("⚠️  Config is empty/null")
    else:
        print("\nNo Ollama connection found in database")
        
except sqlite3.OperationalError as e:
    print(f"Table 'connection' not found or error: {e}")

# Also check for any other corrupted values in all string columns
print("\n" + "=" * 60)
print("SCANNING ALL TABLES FOR CORRUPTED VALUES:")
print("=" * 60)

for table in tables:
    table_name = table[0]
    try:
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        if rows:
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [col[1] for col in cursor.fetchall()]
            
            for row in rows:
                for i, value in enumerate(row):
                    if value and isinstance(value, str):
                        if 'localhost3' in value or '114344' in value:
                            print(f"\n⚠️  Found in {table_name}.{columns[i]}:")
                            print(f"   Value: {value[:100]}...")
    except:
        continue

conn.close()
print("\n" + "=" * 60)
print("DONE")
print("=" * 60)
