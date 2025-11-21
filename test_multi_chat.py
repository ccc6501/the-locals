"""
Test script to simulate multiple users chatting in a room
"""
import requests
import time
from datetime import datetime

API_BASE = "http://localhost:8000"

def send_message(room_id, user_name, content):
    """Send a message as a specific user"""
    url = f"{API_BASE}/chat/rooms/{room_id}/messages"
    payload = {
        "content": content,
        "user_name": user_name
    }
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print(f"✓ {user_name}: {content}")
            return response.json()
        else:
            print(f"✗ Failed to send message: {response.status_code}")
            return None
    except Exception as e:
        print(f"✗ Error: {e}")
        return None

def simulate_conversation():
    """Simulate a multi-person conversation"""
    room_id = "general"
    
    conversations = [
        ("Alice", "Hey everyone! Just deployed the new feature to staging 🚀"),
        ("Bob", "Nice work Alice! I'm seeing it live now"),
        ("Charlie", "Looks great! Did we update the docs?"),
        ("Alice", "Yes, PR is open for review"),
        ("Bob", "I'll take a look after lunch"),
        ("Diana", "I can help with the testing"),
        ("Charlie", "Perfect, let's sync up in 30 mins"),
        ("Alice", "Sounds good to me 👍"),
    ]
    
    print(f"\n🎭 Simulating multi-person chat in '{room_id}' room...\n")
    
    for user_name, content in conversations:
        send_message(room_id, user_name, content)
        time.sleep(1.5)  # Pause between messages
    
    print(f"\n✅ Sent {len(conversations)} messages from {len(set(u for u, _ in conversations))} users")
    print(f"💡 Refresh your browser to see the color-coded messages!\n")

if __name__ == "__main__":
    print("=" * 60)
    print("Multi-Person Chat Simulator")
    print("=" * 60)
    simulate_conversation()
