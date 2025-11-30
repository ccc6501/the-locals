from database import SessionLocal
from models import RoomMember

db = SessionLocal()

# Remove admin (user_id=4) from room 12
membership = db.query(RoomMember).filter(
    RoomMember.thread_id == 12,
    RoomMember.user_id == 4
).first()

if membership:
    db.delete(membership)
    db.commit()
    print(f"✅ Removed admin from room #12 (role was: {membership.role})")
else:
    print("ℹ️  Admin was not a member of room #12")

db.close()
