from database import SessionLocal
from models import Thread, RoomMember, User
from datetime import datetime

db = SessionLocal()

# Create room owned by Sofia with Alex as member
room = Thread(
    name='Sofia and Alex Private Room',
    type='dm',
    user_id=2,  # Sofia
    ai_enabled=True,
    notifications_enabled=True,
    created_at=datetime.utcnow(),
    updated_at=datetime.utcnow(),
    total_messages=15,
    total_ai_requests=3
)
db.add(room)
db.commit()
db.refresh(room)

# Add Sofia as owner
owner = RoomMember(
    thread_id=room.id,
    user_id=2,  # Sofia
    role='owner',
    created_at=datetime.utcnow()
)

# Add Alex as member
member = RoomMember(
    thread_id=room.id,
    user_id=5,  # Alex
    role='member',
    created_at=datetime.utcnow()
)

db.add_all([owner, member])
db.commit()

print(f'✅ Created room #{room.id}: "{room.name}"')
print(f'   Owner: Sofia (user_id=2)')
print(f'   Member: Alex (user_id=5)')
print(f'   You (@chance, user_id=4) are NOT a member')

db.close()
