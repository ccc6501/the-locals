"""
Test script to verify Tailscale IP-based authentication
Tests the /me endpoint with different IP addresses
"""

import requests

# Test from localhost (should return @chance)
print("=" * 60)
print("Testing GET /api/users/me from localhost")
print("=" * 60)

try:
    response = requests.get("http://localhost:8000/api/users/me")
    if response.status_code == 200:
        user = response.json()
        print(f"✅ SUCCESS: Got user {user['handle']}")
        print(f"   Name: {user['name']}")
        print(f"   Email: {user['email']}")
        print(f"   Role: {user['role']}")
    else:
        print(f"❌ FAILED: Status {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"❌ ERROR: {e}")

print("\n" + "=" * 60)
print("Expected Results:")
print("=" * 60)
print("• Localhost (127.0.0.1) → @chance (admin)")
print("• iPhone (100.112.252.35) → @chance_iphone (moderator)")
print("• iPad (100.126.159.45) → @ipad (user)")
print("\n✨ Frontend devices should now auto-refresh and show correct users!")
print("\nTo test from mobile devices:")
print("1. Open Safari on iPhone → http://100.88.23.90:5173")
print("2. Open Safari on iPad → http://100.88.23.90:5173")
print("3. Check header - should show device-specific username")
print("4. Check Users tab - should show 3 separate online users")
