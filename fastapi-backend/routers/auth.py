"""
Authentication routes - Login, Logout, Profile
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from user_agents import parse

from database import get_db
from models import User, Device
from schemas import UserLogin, Token, UserResponse
from auth_utils import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter()

def is_tailscale_ip(client_ip: str | None) -> bool:
    """Check if the request is coming from a Tailscale IP (100.x.x.x range)"""
    if not client_ip:
        return False
    # Tailscale uses the 100.64.0.0/10 CGNAT range
    return client_ip.startswith('100.')


def get_device_info(user_agent_string: str):
    """Parse user agent to get device information"""
    ua = parse(user_agent_string)
    
    # Determine device type
    if ua.is_mobile:
        device_type = "mobile"
    elif ua.is_tablet:
        device_type = "tablet"
    else:
        device_type = "desktop"
    
    # Create device name
    browser = ua.browser.family
    os = ua.os.family
    device_name = f"{browser} on {os}"
    
    return device_name, device_type


def track_device(user_id: int, ip_address: str, user_agent: str, db: Session):
    """Track user device and update device count"""
    device_name, device_type = get_device_info(user_agent)
    
    # Check if this device already exists for this user
    existing_device = db.query(Device).filter(
        Device.user_id == user_id,
        Device.ip_address == ip_address,
        Device.user_agent == user_agent
    ).first()
    
    if existing_device:
        # Update last active time
        existing_device.last_active = datetime.utcnow()
        existing_device.is_active = True
    else:
        # Create new device entry
        new_device = Device(
            user_id=user_id,
            device_name=device_name,
            device_type=device_type,
            ip_address=ip_address,
            user_agent=user_agent,
            is_active=True
        )
        db.add(new_device)
    
    db.commit()
    
    # Update user's device count (count active devices)
    active_device_count = db.query(Device).filter(
        Device.user_id == user_id,
        Device.is_active == True
    ).count()
    
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.devices = active_device_count
        db.commit()


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, request: Request, db: Session = Depends(get_db)):
    """
    User login endpoint
    Returns JWT access token
    Skips password verification for Tailscale network access
    Tracks device information
    """
    # Get client IP and user agent
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    print(f"[DEBUG] Login attempt from IP: {client_ip}, Email: {user_data.email}")
    
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Skip password verification if accessing from Tailscale network OR using auto-login
    if not is_tailscale_ip(client_ip) and user_data.password != "auto":
        print(f"[DEBUG] Not Tailscale IP and not auto-login, verifying password")
        if not verify_password(user_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        print(f"[DEBUG] Tailscale IP or auto-login detected, skipping password verification")

    
    # Check if user is suspended
    if user.status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended"
        )
    
    # Track device
    track_device(user.id, client_ip, user_agent, db)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=access_token_expires
    )
    
    # Update user status to online
    user.status = "online"
    db.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """
    User logout endpoint
    Sets user status to offline
    """
    current_user.status = "offline"
    db.commit()
    
    return {"message": "Successfully logged out"}


@router.get("/profile", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_active_user)):
    """
    Get current user profile
    """
    return current_user


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserLogin, 
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Register a new user (if registration is enabled)
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    
    # Generate handle from email
    handle = f"@{user_data.email.split('@')[0]}"
    
    # Check if handle exists and make it unique
    handle_count = db.query(User).filter(User.handle.like(f"{handle}%")).count()
    if handle_count > 0:
        handle = f"{handle}{handle_count + 1}"
    
    new_user = User(
        name=user_data.email.split('@')[0].title(),
        handle=handle,
        email=user_data.email,
        hashed_password=hashed_password,
        role="user",
        status="offline"
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Track device on registration
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    track_device(new_user.id, client_ip, user_agent, db)
    
    return new_user
