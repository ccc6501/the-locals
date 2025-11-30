# fastapi-backend/routers/rooms.py

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Thread, Message, User

router = APIRouter()


# ---------- Pydantic schemas ----------

class RoomOut(BaseModel):
    id: int
    name: str
    type: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: int
    thread_id: int
    user_id: Optional[int] = None
    sender: str
    text: str
    timestamp: datetime

    class Config:
        from_attributes = True


class RoomCreateRequest(BaseModel):
    name: str
    type: Optional[str] = "room"


class MessageCreateRequest(BaseModel):
    text: str


# ---------- Helpers ----------

def get_default_user(db: Session) -> User:
    user = db.query(User).filter(User.handle == "chance").first()
    if user:
        return user

    user = db.query(User).filter(User.id == 1).first()
    if user:
        return user

    raise HTTPException(
        status_code=500,
        detail="No default user found (handle='chance' or id=1).",
    )


def get_or_create_default_room(db: Session) -> Thread:
    # Try to find a 'General' room first
    room = (
        db.query(Thread)
        .filter(Thread.name == "General", Thread.type == "room")
        .first()
    )
    if room:
        return room

    # If any thread exists, just return the most recently updated one
    room = db.query(Thread).order_by(Thread.updated_at.desc()).first()
    if room:
        return room

    # Otherwise create a brand new default room
    now = datetime.utcnow()
    room = Thread(
        name="General",
        type="room",
        created_at=now,
        updated_at=now,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


# ---------- Routes ----------

@router.get("/api/rooms", response_model=List[RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    """
    Return all rooms (Threads). Guarantees at least one default room exists.
    """
    # Ensure at least one room exists
    get_or_create_default_room(db)

    rooms = (
        db.query(Thread)
        .order_by(Thread.updated_at.desc())
        .all()
    )
    return rooms


@router.post("/api/rooms", response_model=RoomOut)
def create_room(payload: RoomCreateRequest, db: Session = Depends(get_db)):
    """
    Create a new room (Thread) with the given name and optional type.
    """
    name = (payload.name or "").strip()
    room_type = (payload.type or "room").strip()

    if not name:
        raise HTTPException(status_code=400, detail="Room name is required.")

    # Optional: prevent exact duplicates
    existing = (
        db.query(Thread)
        .filter(Thread.name == name, Thread.type == room_type)
        .first()
    )
    if existing:
        return existing

    now = datetime.utcnow()
    room = Thread(
        name=name,
        type=room_type,
        created_at=now,
        updated_at=now,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get(
    "/api/rooms/{room_id}/messages",
    response_model=List[MessageOut],
)
def get_room_messages(
    room_id: int,
    limit: int = 50,
    before: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Return messages for a room ordered oldest->newest.
    Supports simple 'before id' pagination.
    """
    query = db.query(Message).filter(Message.thread_id == room_id)

    if before is not None:
        query = query.filter(Message.id < before)

    messages = (
        query.order_by(Message.timestamp.asc())
        .limit(min(max(limit, 1), 100))
        .all()
    )
    return messages


@router.post(
    "/api/rooms/{room_id}/messages",
    response_model=MessageOut,
)
def create_room_message(
    room_id: int,
    payload: MessageCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Create a new *user* message in the given room.
    """
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text is required.")

    user = get_default_user(db)

    now = datetime.utcnow()
    message = Message(
        thread_id=room_id,
        user_id=user.id,
        sender="CC",  # Chance / current user tag
        text=text,
        timestamp=now,
    )
    db.add(message)

    # Update room's updated_at
    thread = db.query(Thread).filter(Thread.id == room_id).first()
    if thread:
        thread.updated_at = now

    db.commit()
    db.refresh(message)
    return message
