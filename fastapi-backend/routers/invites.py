"""
Invite system routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import random
import string

from database import get_db
from models import User, Invite
from schemas import InviteCreate, InviteResponse
from auth_utils import get_current_active_user, require_moderator

router = APIRouter()


def generate_invite_code() -> str:
    """Generate unique invite code"""
    prefix = "INV-"
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}{code}"


@router.get("", response_model=List[InviteResponse], response_model_by_alias=True)
async def get_invites(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all invites"""
    invites = db.query(Invite).all()
    return invites


@router.post("", response_model=InviteResponse, response_model_by_alias=True)
async def create_invite(
    invite_data: InviteCreate,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """Create new invite code (admin/moderator only)"""
    # Generate unique code
    while True:
        code = generate_invite_code()
        existing = db.query(Invite).filter(Invite.code == code).first()
        if not existing:
            break
    
    new_invite = Invite(
        code=code,
        max_uses=invite_data.max_uses,
        created_by=current_user.id
    )
    
    db.add(new_invite)
    db.commit()
    db.refresh(new_invite)
    
    return new_invite


@router.patch("/{invite_id}/revoke")
async def revoke_invite(
    invite_id: int,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """Revoke an invite code (admin/moderator only)"""
    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )
    
    invite.status = "revoked"
    db.commit()
    
    return {"message": "Invite revoked successfully"}


@router.delete("/{invite_id}")
async def delete_invite(
    invite_id: int,
    current_user: User = Depends(require_moderator),
    db: Session = Depends(get_db)
):
    """Delete an invite code (admin/moderator only)"""
    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found"
        )
    
    db.delete(invite)
    db.commit()
    
    return {"message": "Invite deleted successfully"}
