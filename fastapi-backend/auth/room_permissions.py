"""
Room permission helpers for role-based access control.
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Optional

from models import RoomMember, User


def get_membership(db: Session, user_id: int, room_id: int) -> Optional[RoomMember]:
    """
    Get the RoomMember record for a user in a specific room.
    
    Args:
        db: Database session
        user_id: User ID to check
        room_id: Room (Thread) ID to check
        
    Returns:
        RoomMember record if exists, None otherwise
    """
    return db.query(RoomMember).filter(
        RoomMember.user_id == user_id,
        RoomMember.thread_id == room_id
    ).first()


def is_owner(member: Optional[RoomMember]) -> bool:
    """Check if member has owner role."""
    return member is not None and member.role == "owner"


def is_admin(member: Optional[RoomMember]) -> bool:
    """Check if member has admin role."""
    return member is not None and member.role == "admin"


def is_moderator(member: Optional[RoomMember]) -> bool:
    """Check if member has moderator role."""
    return member is not None and member.role == "moderator"


def is_member(member: Optional[RoomMember]) -> bool:
    """Check if member exists (any role)."""
    return member is not None


def require_membership(db: Session, user: User, room_id: int, allow_global_admin: bool = False) -> RoomMember:
    """
    Require that a user is a member of a room.
    
    Args:
        db: Database session
        user: Current user
        room_id: Room (Thread) ID to check
        allow_global_admin: If True, global admins bypass membership check (for management, not message viewing)
        
    Returns:
        RoomMember record if user is a member
        
    Raises:
        HTTPException(403) if user is not a member and not a global admin
    """
    membership = get_membership(db, user.id, room_id)
    
    # Global admins can bypass membership check ONLY if explicitly allowed
    if membership is None:
        if allow_global_admin and user.role == "admin":
            # Create a pseudo-membership for permission checks only
            # This won't be persisted to DB
            pseudo_membership = RoomMember()
            pseudo_membership.user_id = user.id
            pseudo_membership.thread_id = room_id
            pseudo_membership.role = "admin"  # Give admin role for permission checks
            return pseudo_membership
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this room"
        )
    
    return membership


def can_add_members(member: Optional[RoomMember]) -> bool:
    """
    Check if a member has permission to add other members.
    Only owners and admins can add members.
    """
    return member is not None and member.role in ["owner", "admin"]
