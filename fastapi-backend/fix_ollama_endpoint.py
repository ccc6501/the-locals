"""
Fix Ollama endpoint from Docker hostname to localhost
"""
import sqlite3
import json

# Connect to database
conn = sqlite3.connect('admin_panel.db')
cursor = conn.cursor()

print("Fixing Ollama endpoint...")

# Get current Ollama config
cursor.execute("SELECT id, config FROM connections WHERE service='ollama'")
row = cursor.fetchone()

if row:
    ollama_id, config_str = row
    config = json.loads(config_str)
    
    print(f"Current config: {config}")
    
    # Fix the endpoint
    if 'endpoint' in config:
        old_endpoint = config['endpoint']
        config['endpoint'] = 'http://localhost:11434'
        print(f"Changing endpoint from: {old_endpoint}")
        print(f"                    to: {config['endpoint']}")
    
    # Update database
    new_config = json.dumps(config)
    cursor.execute(
        "UPDATE connections SET config=? WHERE id=?",
        (new_config, ollama_id)
    )
    conn.commit()
    
    # Verify
    cursor.execute("SELECT config FROM connections WHERE service='ollama'")
    verify = cursor.fetchone()[0]
    print(f"\n✅ UPDATED! New config: {verify}")
else:
    print("❌ No Ollama connection found")

conn.close()
print("\n✅ Done! Restart backend to apply changes.")
