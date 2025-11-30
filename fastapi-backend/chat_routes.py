# backend/chat_routes.py
# ⚠️ DEPRECATED: This in-memory chat system is being phased out
# New persistent rooms/messages use: fastapi-backend/routers/rooms.py
# Phase 1: Backend now uses Thread and Message models for persistence
# Phase 2: Frontend will be updated to use /api/rooms endpoints

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime

router = APIRouter(prefix="/chat", tags=["chat"])

MessageRole = Literal["user", "assistant", "system"]


class ChatRoom(BaseModel):
    id: str           # e.g. "general"
    name: str         # e.g. "General"
    description: str = ""


class ChatMessage(BaseModel):
    id: int
    room_id: str
    user_id: str
    user_name: str
    role: MessageRole
    content: str
    created_at: datetime
    model: Optional[str] = None
    lazlo_mode: bool = False


class NewMessage(BaseModel):
    content: str
    role: MessageRole = "user"
    lazlo_mode: bool = False
    model: Optional[str] = None
    # later we can add parent_id, thread_id, etc.


# ─────────────────────────────
# TEMP IN-MEMORY STORAGE
# ⚠️ DEPRECATED - Phase 1 Complete
# New system uses Thread and Message models (see routers/rooms.py)
# This remains for backwards compatibility until frontend is updated (Phase 2)
# ─────────────────────────────

# room_id -> ChatRoom
ROOMS: dict[str, ChatRoom] = {
    "general": ChatRoom(
        id="general",
        name="General",
        description="Default shared room for this Tailnet hub.",
    )
}

# room_id -> list[ChatMessage]
MESSAGES: dict[str, List[ChatMessage]] = {
    "general": []
}

NEXT_MESSAGE_ID: int = 1


# ─────────────────────────────
# HELPERS
# ─────────────────────────────

def _get_next_message_id() -> int:
    global NEXT_MESSAGE_ID
    current = NEXT_MESSAGE_ID
    NEXT_MESSAGE_ID += 1
    return current


def _get_room_or_404(room_id: str) -> ChatRoom:
    room = ROOMS.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_id}' not found")
    return room


# ─────────────────────────────
# ROUTES
# ─────────────────────────────

@router.get("/rooms", response_model=List[ChatRoom])
async def list_rooms() -> List[ChatRoom]:
    """
    List all chat rooms. For now, this will usually just be ["general"].
    Later we can add POST /rooms to create new rooms.
    """
    return list(ROOMS.values())


@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessage])
async def get_messages(
    room_id: str,
    since_id: Optional[int] = None,
    limit: int = 100,
) -> List[ChatMessage]:
    """
    Return messages for a room. If since_id is provided, only messages with id > since_id are returned.
    """
    _get_room_or_404(room_id)

    room_messages = MESSAGES.get(room_id, [])
    if since_id is not None:
        room_messages = [m for m in room_messages if m.id > since_id]

    if limit and len(room_messages) > limit:
        room_messages = room_messages[-limit:]

    return room_messages


@router.post("/rooms/{room_id}/messages", response_model=ChatMessage)
async def post_message(
    room_id: str,
    payload: NewMessage,
) -> ChatMessage:
    """
    Store a new message in a room. For now, user identity is hardcoded to 'chance'.
    Later we'll plug in real auth / users.
    """
    _get_room_or_404(room_id)

    msg = ChatMessage(
        id=_get_next_message_id(),
        room_id=room_id,
        user_id="chance",    # TODO: replace with real user
        user_name="chance",
        role=payload.role,
        content=payload.content.strip(),
        created_at=datetime.utcnow(),
        model=payload.model,
        lazlo_mode=payload.lazlo_mode,
    )

    if msg.room_id not in MESSAGES:
        MESSAGES[msg.room_id] = []
    MESSAGES[msg.room_id].append(msg)

    return msg
