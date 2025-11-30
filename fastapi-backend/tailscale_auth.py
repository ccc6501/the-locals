"""
Tailscale authentication utilities
Auto-login users based on their Tailnet IP address
"""

from fastapi import Request, HTTPException, status
from sqlalchemy.orm import Session
from models import User, Device
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling Tailscale and proxy headers"""
    # Check Tailscale-specific headers first
    tailscale_ip = request.headers.get("Tailscale-User-Login")
    if tailscale_ip:
        return tailscale_ip
    
    # Check X-Forwarded-For (proxy/reverse proxy)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP (nginx proxy)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to direct client IP
    if request.client:
        return request.client.host
    
    return "unknown"


def get_user_by_tailscale_ip(db: Session, ip_address: str) -> Optional[User]:
    """
    Get user by their Tailscale IP address
    Returns None if no matching device found
    """
    # Check if this is localhost (admin access)
    if ip_address in ["127.0.0.1", "::1", "localhost"]:
        # Return admin user for localhost
        admin_user = db.query(User).filter(User.role == "admin").first()
        if admin_user:
            logger.info(f"Localhost access -> Admin user: {admin_user.handle}")
            return admin_user
    
    # Look up device by Tailscale IP
    device = db.query(Device).filter(
        Device.tailscale_ip == ip_address,
        Device.is_tailscale_device == True
    ).first()
    
    if not device:
        logger.warning(f"No Tailscale device found for IP: {ip_address}")
        return None
    
    # Update device last_active timestamp
    device.last_active = datetime.utcnow()
    device.is_active = True
    db.commit()
    
    # Get associated user
    user = db.query(User).filter(User.id == device.user_id).first()
    if user:
        # Update user status to online
        user.status = "online"
        db.commit()
        logger.info(f"Tailscale auth successful: {user.handle} ({ip_address})")
    
    return user


async def get_current_user_from_ip(request: Request, db: Session) -> Optional[User]:
    """
    Middleware function to auto-authenticate users via Tailscale IP
    Can be used as a dependency in FastAPI routes
    """
    client_ip = get_client_ip(request)
    user = get_user_by_tailscale_ip(db, client_ip)
    
    if user:
        # Attach user info to request state for logging/debugging
        request.state.user = user
        request.state.client_ip = client_ip
    
    return user


def require_tailscale_auth(request: Request, db: Session) -> User:
    """
    Dependency that requires Tailscale authentication
    Raises 401 if user not found
    """
    client_ip = get_client_ip(request)
    user = get_user_by_tailscale_ip(db, client_ip)
    
    if not user:
        logger.warning(f"Authentication failed for IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Not authorized. Unknown Tailscale device: {client_ip}"
        )
    
    return user


def check_user_role(user: User, required_role: str) -> bool:
    """
    Check if user has required role or higher
    Role hierarchy: admin > moderator > user
    """
    roles_hierarchy = ["user", "moderator", "admin"]
    
    if user.role not in roles_hierarchy or required_role not in roles_hierarchy:
        return False
    
    user_level = roles_hierarchy.index(user.role)
    required_level = roles_hierarchy.index(required_role)
    
    return user_level >= required_level


def require_role(required_role: str):
    """
    Dependency factory for role-based access control
    Usage: depends=require_role("moderator")
    """
    def role_checker(request: Request, db: Session) -> User:
        user = require_tailscale_auth(request, db)
        
        if not check_user_role(user, required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Requires: {required_role}"
            )
        
        return user
    
    return role_checker
