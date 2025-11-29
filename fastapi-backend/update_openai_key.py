"""
Update OpenAI API key in database
"""
import sqlite3
import json

# Connect to database
conn = sqlite3.connect('admin_panel.db')
cursor = conn.cursor()

print("Updating OpenAI API key...")

# Get current OpenAI config
cursor.execute("SELECT id, config FROM connections WHERE service='openai'")
row = cursor.fetchone()

if row:
    openai_id, config_str = row
    config = json.loads(config_str)
    
    print(f"Current model: {config.get('model', 'N/A')}")
    
    # Update the API key - REPLACE WITH YOUR ACTUAL KEY
    new_key = "sk-proj-YOUR_API_KEY_HERE"
    config['apiKey'] = new_key
    
    print(f"New API key: {new_key[:20]}...{new_key[-10:]}")
    
    # Update database
    new_config = json.dumps(config)
    cursor.execute(
        "UPDATE connections SET config=? WHERE id=?",
        (new_config, openai_id)
    )
    conn.commit()
    
    print(f"\n✅ UPDATED! Model remains: {config.get('model', 'N/A')}")
else:
    print("❌ No OpenAI connection found")

conn.close()
print("\n✅ Done! Restart backend to apply changes.")
