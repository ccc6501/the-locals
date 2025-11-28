"""
Add password to existing user and generate token
"""
import sqlite3
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT config
SECRET_KEY = "your-secret-key-change-this"
ALGORITHM = "HS256"

# Connect to database
conn = sqlite3.connect('admin_panel.db')
cursor = conn.cursor()

# Hash password
password = "admin123"  # Default password
hashed = pwd_context.hash(password)

# Update first user with email and hashed password
cursor.execute("""
UPDATE users
SET email = ?, hashed_password = ?
WHERE handle = 'chance'
""", ('admin@thelocal.build', hashed))

conn.commit()

# Get user
cursor.execute("SELECT id, email FROM users WHERE handle = 'chance'")
user = cursor.fetchone()

if user:
    user_id, email = user
    
    # Create token
    expire = datetime.utcnow() + timedelta(days=30)
    token_data = {"sub": email, "exp": expire}
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    print("\n" + "="*60)
    print("✓ User updated successfully!")
    print("="*60)
    print(f"\nEmail: {email}")
    print(f"Password: {password}")
    print(f"\nAuth Token (save this):")
    print(f"{token}")
    print("\n" + "="*60)
    print("\nTo use in frontend, run in browser console:")
    print(f"localStorage.setItem('chatops_token', '{token}')")
    print("="*60 + "\n")
else:
    print("❌ User not found")

conn.close()
