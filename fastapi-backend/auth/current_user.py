"""
Helper to get the current user. For Phase 4A, always returns Chance.
Later phases will implement proper auth with headers/tokens.
"""

from sqlalchemy.orm import Session
from models import User


def get_current_user(db: Session) -> User:
    """
    Get the current authenticated user.
    For now, always returns Chance (hardcoded).
    Future: Will read from JWT token or session.
    """
    # Try to find user by handle @chance (from Phase 1 seeding)
    user = db.query(User).filter(User.handle == "@chance").first()
    
    # Fallback to looking by name "Chance" (case insensitive)
    if not user:
        user = db.query(User).filter(User.name.ilike("Chance")).first()
    
    # Last fallback to user with id=1
    if not user:
        user = db.query(User).filter(User.id == 1).first()
    
    # If still no user, raise an error
    if not user:
        raise ValueError("No default user found. Please create a user with handle='@chance' or id=1")
    
    return user
