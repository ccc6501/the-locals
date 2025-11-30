"""
Chat routes - Threads and Messages with AI integration
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
from dotenv import load_dotenv
from pydantic import BaseModel

from database import get_db
from models import User, Thread, Message, Connection
from schemas import ThreadCreate, ThreadResponse, MessageCreate, MessageResponse
from auth_utils import get_current_active_user

# AI imports
import openai
from openai import OpenAI
import httpx

load_dotenv()

router = APIRouter()


@router.get("/ollama/models")
async def get_ollama_models(base_url: str = "http://localhost:11434"):
    """
    Get list of available Ollama models.
    No authentication required.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            
            # Extract model names
            models = [model["name"] for model in data.get("models", [])]
            
            return {
                "models": models,
                "base_url": base_url,
                "count": len(models)
            }
    
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Ollama at {base_url}. Make sure Ollama is running."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch Ollama models: {str(e)}"
        )


# Simple chat models for ChatOps console
class ChatConfig(BaseModel):
    """Provider-specific configuration"""
    api_key: Optional[str] = None
    model: Optional[str] = None
    ollama_model: Optional[str] = None  # Specific field for Ollama model selection
    base_url: Optional[str] = None


class SimpleChatRequest(BaseModel):
    """Simple chat request for ChatOps console"""
    message: str
    provider: str = "openai"
    temperature: float = 0.7
    config: Optional[ChatConfig] = None
    thread_id: Optional[int] = None  # Optional thread/room ID for message persistence


class SimpleChatResponse(BaseModel):
    """Simple chat response with metadata"""
    role: str = "assistant"
    text: str
    provider: str
    model: str
    temperature: float
    authorTag: str = "TL"
    createdAt: str


async def _build_ai_context() -> str:
    """Build real-time system context for AI responses"""
    try:
        # Get network snapshot
        async with httpx.AsyncClient(timeout=3.0) as client:
            try:
                network_resp = await client.get("http://127.0.0.1:8000/api/system/tailscale/snapshot")
                network_data = network_resp.json() if network_resp.status_code == 200 else {}
            except Exception:
                network_data = {}
            
            try:
                system_resp = await client.get("http://127.0.0.1:8000/api/system/public/summary")
                system_data = system_resp.json() if system_resp.status_code == 200 else {}
            except Exception:
                system_data = {}
        
        # Build context string
        context_parts = []
        
        # Network context
        if network_data.get("status") == "ok":
            devices = network_data.get("devices", [])
            online_devices = [d for d in devices if d.get("online")]
            primary_hub = next((d for d in devices if d.get("role") == "primary-hub"), None)
            dev_hub = next((d for d in devices if d.get("role") == "dev-hub"), None)
            clients = [d for d in online_devices if d.get("role") == "client"]
            
            context_parts.append(f"NETWORK: {len(online_devices)} devices online (total: {len(devices)})")
            if primary_hub:
                status = "online" if primary_hub.get("online") else "offline"
                context_parts.append(f"  - Primary Hub ({primary_hub.get('name')}): {status}")
            if dev_hub:
                status = "online" if dev_hub.get("online") else "offline"
                context_parts.append(f"  - Dev Hub ({dev_hub.get('name')}): {status}")
            if clients:
                context_parts.append(f"  - Clients online: {', '.join(d.get('name', 'unknown') for d in clients)}")
        else:
            context_parts.append(f"NETWORK: Tailscale not available ({network_data.get('error', 'unknown error')})")
        
        # System context
        if system_data:
            context_parts.append(f"SYSTEM: CPU {system_data.get('cpu', 'N/A')}%, Memory {system_data.get('memory', 'N/A')}%, Disk {system_data.get('disk', 'N/A')}%")
        
        # Storage context (placeholder for future expansion)
        context_parts.append("STORAGE: D:\\ drive accessible via local file system")
        
        return "\n".join(context_parts)
    
    except Exception as e:
        return f"CONTEXT ERROR: {str(e)}"


@router.post("/chat", response_model=SimpleChatResponse)
async def simple_chat(request: SimpleChatRequest, db: Session = Depends(get_db)):
    """
    Simple chat endpoint for ChatOps console.
    No authentication required, supports OpenAI and Ollama with automatic fallback.
    Returns exactly one assistant response per request.
    """
    
    # Phase 6: Check if AI is enabled for this room
    if request.thread_id:
        thread = db.query(Thread).filter(Thread.id == request.thread_id).first()
        if thread and not thread.ai_enabled:
            # Return a polite message instead of an AI response
            return SimpleChatResponse(
                role="assistant",
                text="AI responses are disabled for this room. Enable them in room settings to chat with The Local.",
                provider="disabled",
                model="none",
                temperature=request.temperature,
                authorTag="TL",
                createdAt=datetime.utcnow().isoformat()
            )
    
    # Single-provider routing - exactly one provider per request
    if request.provider == "openai":
        return await _chat_openai_simple(request, db)
    elif request.provider == "ollama":
        # Try Ollama first, fallback to OpenAI if it fails
        try:
            return await _chat_ollama_simple(request, db)
        except HTTPException as e:
            # If Ollama is unavailable (503) or model missing, fallback to OpenAI
            if e.status_code in [503, 404]:
                print(f"Ollama unavailable ({e.detail}), falling back to OpenAI")
                # Create OpenAI request with fallback metadata
                openai_request = SimpleChatRequest(
                    message=request.message,
                    provider="openai",
                    temperature=request.temperature,
                    config=request.config
                )
                response = await _chat_openai_simple(openai_request, db)
                # Add fallback metadata
                response.provider = "openai"
                response.model = f"{response.model} (fallback)"
                return response
            else:
                # Re-raise other errors
                raise
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {request.provider}")


async def _chat_openai_simple(request: SimpleChatRequest, db: Session) -> SimpleChatResponse:
    """Call OpenAI API for simple chat with graceful fallbacks.
    Fallback order for models: user-specified -> gpt-4o -> gpt-4o-mini -> gpt-3.5-turbo
    Provides clearer error messages for common failure modes (auth, quota, model not found).
    """

    # Get API key from database first (priority), then environment variable
    # DB key takes priority over env var
    db_key = None
    try:
        openai_conn = db.query(Connection).filter(Connection.service == "openai").first()
        if openai_conn and getattr(openai_conn, 'config', None):
            import json
            config_data = json.loads(openai_conn.config)
            db_key = config_data.get("apiKey")
    except Exception as e:
        print(f"Warning: Could not retrieve OpenAI key from database: {e}")
    
    api_key = db_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key required. Set it in Connections > OpenAI or set OPENAI_API_KEY environment variable."
        )

    # Updated priority list; allow env override OPENAI_MODEL_PRIORITY (comma-separated)
    requested_model = (request.config.model if request.config else None) or os.getenv("OPENAI_DEFAULT_MODEL", "gpt-4o-mini")
    env_priority = os.getenv("OPENAI_MODEL_PRIORITY", "gpt-4o-mini,gpt-4o,gpt-4.1-mini,gpt-4.1,gpt-3.5-turbo")
    priority_list = [m.strip() for m in env_priority.split(',') if m.strip()]
    fallback_models = [requested_model] + priority_list

    # Deduplicate while preserving order
    seen = set()
    models_to_try = []
    for m in fallback_models:
        if m not in seen:
            seen.add(m)
            models_to_try.append(m)

    # Build real-time context for AI
    context = await _build_ai_context()

    last_error = None
    client = OpenAI(api_key=api_key)
    # Try to get available models list once (non-fatal)
    available_models = set()
    try:
        for mdl in client.models.list().data:
            if hasattr(mdl, 'id'):
                available_models.add(mdl.id)
    except Exception as e:
        print(f"[openai] model list failed (non-fatal): {e}")

    for model in models_to_try:
        try:
            if available_models and model not in available_models:
                # Skip quickly if we know model not present
                raise Exception(f"Model '{model}' not in account model list")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are The Local, a helpful AI assistant for a Tailscale-powered home hub. Be friendly, concise, and helpful. You can answer questions about the system, help manage the network, or just chat.

Current system context (use this for accurate answers):
{context}

When asked about the network, always use the real device data above. Never make up device counts or names."""
                    },
                    {"role": "user", "content": request.message}
                ],
                temperature=request.temperature,
                max_tokens=1000
            )
            reply_text = response.choices[0].message.content or "No response from OpenAI"

            update_ai_status("openai", "online")
            
            # Persist assistant response if thread_id provided (Phase 1)
            if request.thread_id:
                persist_assistant_message(
                    thread_id=request.thread_id,
                    text=reply_text,
                    db=db,
                    sender="TL"
                )
            
            return SimpleChatResponse(
                role="assistant",
                text=reply_text,
                provider="openai",
                model=model if model == requested_model else f"{model} (fallback)",
                temperature=request.temperature,
                authorTag="TL",
                createdAt=datetime.utcnow().isoformat()
            )
        except Exception as e:
            last_error = e
            # If error clearly indicates auth or quota, stop early
            err_str = str(e).lower()
            if any(k in err_str for k in ["incorrect api key", "invalid api key", "rate limit", "quota", "billing"]):
                update_ai_status("openai", "offline")
                raise HTTPException(status_code=502, detail=f"OpenAI auth/quota error: {str(e)}")
            # For model not found, continue to next fallback
            if ("model" in err_str and "not" in err_str and "found" in err_str) or ("model" in err_str and "not" in err_str and "exist" in err_str):
                continue
            # Other errors try next model; if only one model, break
            continue

    # If we reach here, all attempts failed
    update_ai_status("openai", "offline")
    raise HTTPException(status_code=500, detail=f"OpenAI API error (all fallbacks failed): {repr(last_error)}")


async def _chat_ollama_simple(request: SimpleChatRequest, db: Session) -> SimpleChatResponse:
    """Call Ollama API for simple chat with model selection"""
    
    base_url = (request.config.base_url if request.config else None) or "http://localhost:11434"
    
    # Use ollama_model if provided, otherwise fallback to model, then default
    model = None
    if request.config:
        model = request.config.ollama_model or request.config.model
    model = model or "llama3"
    
    # Build real-time context for AI
    context = await _build_ai_context()
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": f"""You are The Local, a helpful AI assistant for a Tailscale-powered home hub. Be friendly, concise, and helpful. You can answer questions about the system, help manage the network, or just chat.

Current system context (use this for accurate answers):
{context}

When asked about the network, always use the real device data above. Never make up device counts or names."""
                        },
                        {
                            "role": "user",
                            "content": request.message
                        }
                    ],
                    "stream": False,
                    "options": {
                        "temperature": request.temperature,
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            
            reply_text = data["message"]["content"] or "No response from Ollama"
            
            # Update AI status cache
            update_ai_status("ollama", "online")
            
            # Persist assistant response if thread_id provided (Phase 1)
            if request.thread_id:
                persist_assistant_message(
                    thread_id=request.thread_id,
                    text=reply_text,
                    db=db,
                    sender="TL"
                )
            
            # Return with metadata - NO provider/model suffix in text
            return SimpleChatResponse(
                role="assistant",
                text=reply_text,
                provider="ollama",
                model=model,
                temperature=request.temperature,
                authorTag="TL",
                createdAt=datetime.utcnow().isoformat()
            )
    
    except httpx.ConnectError:
        # Update AI status as offline
        update_ai_status("ollama", "offline")
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Ollama at {base_url}. Make sure Ollama is running."
        )
    except httpx.HTTPStatusError as e:
        # Update AI status as offline
        update_ai_status("ollama", "offline")
        # Model not found or other Ollama error
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Ollama model '{model}' not found")
        raise HTTPException(status_code=e.response.status_code, detail=f"Ollama error: {e.response.text}")
    except Exception as e:
        # Update AI status as offline
        update_ai_status("ollama", "offline")
        raise HTTPException(status_code=500, detail=f"Ollama call failed: {str(e)}")


async def get_ai_response(message: str, thread_type: str, db: Session) -> str:
    """
    Get AI response from OpenAI or Ollama based on configuration
    """
    import json
    
    # Check OpenAI connection
    openai_conn = db.query(Connection).filter(Connection.service == "openai").first()
    if openai_conn is not None:
        if getattr(openai_conn, 'enabled', False):
            try:
                config_str = getattr(openai_conn, 'config', None)
                config = json.loads(config_str) if config_str else {}
                api_key = config.get("apiKey") or os.getenv("OPENAI_API_KEY")
                model = config.get("model", "gpt-4o-mini")
                
                client = openai.OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "You are a helpful AI assistant. Be concise and professional."},
                        {"role": "user", "content": message}
                    ],
                    max_tokens=500
                )
                return response.choices[0].message.content or "No response from AI"
            except Exception as e:
                print(f"OpenAI error: {e}")
    
    # Check Ollama connection
    ollama_conn = db.query(Connection).filter(Connection.service == "ollama").first()
    if ollama_conn is not None:
        if getattr(ollama_conn, 'enabled', False):
            try:
                config_str = getattr(ollama_conn, 'config', None)
                config = json.loads(config_str) if config_str else {}
                endpoint = config.get("endpoint", "http://localhost:11434")
                model = config.get("model", "llama2")
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{endpoint}/api/generate",
                        json={
                            "model": model,
                            "prompt": message,
                            "stream": False
                        },
                        timeout=30.0
                    )
                    if response.status_code == 200:
                        data = response.json()
                        return data.get("response", "No response from Ollama")
            except Exception as e:
                print(f"Ollama error: {e}")
    
    # Default response if no AI is configured
    return "AI services are not configured. Please set up OpenAI or Ollama in the Connections tab."


@router.get("/threads", response_model=List[ThreadResponse])
async def get_threads(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all chat threads"""
    threads = db.query(Thread).all()
    
    # Format response with messages
    response = []
    for thread in threads:
        messages = db.query(Message).filter(Message.thread_id == thread.id).all()
        last_message = messages[-1].text if messages else None
        
        response.append({
            "id": thread.id,
            "type": thread.type,
            "name": thread.name,
            "avatar": thread.avatar,
            "lastMessage": last_message,
            "unread": 0,
            "timestamp": thread.updated_at,
            "messages": [
                {
                    "id": msg.id,
                    "sender": msg.sender,
                    "text": msg.text,
                    "timestamp": msg.timestamp
                }
                for msg in messages
            ]
        })
    
    return response


@router.post("/threads", response_model=ThreadResponse)
async def create_thread(
    thread_data: ThreadCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create new chat thread"""
    new_thread = Thread(
        type=thread_data.type,
        name=thread_data.name,
        avatar=thread_data.avatar,
        user_id=thread_data.user_id or current_user.id
    )
    
    db.add(new_thread)
    db.commit()
    db.refresh(new_thread)
    
    # Add initial AI message if it's an AI thread
    if thread_data.type == "ai":
        initial_message = Message(
            thread_id=new_thread.id,
            sender="bot",
            text="Hello! I'm your AI assistant. How can I help you today?"
        )
        db.add(initial_message)
        db.commit()
    
    return {
        "id": new_thread.id,
        "type": new_thread.type,
        "name": new_thread.name,
        "avatar": new_thread.avatar,
        "lastMessage": "Hello! I'm your AI assistant. How can I help you today?" if thread_data.type == "ai" else None,
        "unread": 0,
        "timestamp": new_thread.created_at,
        "messages": []
    }


@router.get("/threads/{thread_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    thread_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all messages for a thread"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    messages = db.query(Message).filter(Message.thread_id == thread_id).all()
    return messages


@router.post("/threads/{thread_id}/messages", response_model=MessageResponse)
async def send_message(
    thread_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send message to a thread"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    # Create user message
    user_message = Message(
        thread_id=thread_id,
        user_id=current_user.id,
        sender="me",
        text=message_data.text
    )
    
    db.add(user_message)
    
    # Update thread timestamp
    setattr(thread, 'updated_at', datetime.utcnow())
    
    # Increment AI usage counter
    setattr(current_user, 'ai_usage', (current_user.ai_usage or 0) + 1)
    
    db.commit()
    db.refresh(user_message)
    
    # If it's an AI thread, get AI response
    thread_type = getattr(thread, 'type', None)
    if thread_type == "ai":
        ai_response_text = await get_ai_response(message_data.text, thread_type, db)
        
        ai_message = Message(
            thread_id=thread_id,
            sender="bot",
            text=ai_response_text
        )
        
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)
        
        return ai_message
    
    return user_message


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a thread (user can only delete their own threads)"""
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    
    # Only allow users to delete their own threads (or admins can delete any)
    thread_user_id = getattr(thread, 'user_id', None)
    user_role = getattr(current_user, 'role', None)
    if thread_user_id != current_user.id and user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own threads"
        )
    
    db.delete(thread)
    db.commit()
    
    return {"message": "Thread deleted successfully"}


# Status HUD endpoint for frontend
class StatusResponse(BaseModel):
    """System status for HUD display"""
    tailnet: str  # "online" | "offline" | "unknown"
    ai: dict  # {"provider": str, "status": str}
    rooms: dict  # {"total": int, "active": int}


# Global cache for last AI status (simple in-memory cache)
_last_ai_status = {"provider": "unknown", "status": "unknown"}


@router.get("/status", response_model=StatusResponse)
async def get_system_status():
    """
    Get system status for frontend HUD.
    Returns Tailnet status, AI provider status, and room counts.
    """
    
    # Tailnet status - try to ping localhost, assume online if backend is running
    # TODO: Implement proper Tailnet health check
    tailnet_status = "online"  # Simplified for now
    
    # AI provider status from cache (updated on each chat request)
    ai_status = {
        "provider": _last_ai_status["provider"],
        "status": _last_ai_status["status"]
    }
    
    # Rooms - hardcoded for now, can be extended later
    rooms_status = {
        "total": 1,
        "active": 1
    }
    
    return StatusResponse(
        tailnet=tailnet_status,
        ai=ai_status,
        rooms=rooms_status
    )


def update_ai_status(provider: str, status: str):
    """Update global AI status cache"""
    global _last_ai_status
    _last_ai_status = {"provider": provider, "status": status}


def persist_assistant_message(
    thread_id: int,
    text: str,
    db: Session,
    sender: str = "TL"
) -> Optional[Message]:
    """
    Persist an assistant's reply to the database.
    
    Args:
        thread_id: The thread/room ID to save the message to
        text: The assistant's response text
        db: Database session
        sender: Sender name/tag (default: "TL" for The Local)
    
    Returns:
        The created Message object, or None if thread doesn't exist
    """
    try:
        # Verify thread exists
        thread = db.query(Thread).filter(Thread.id == thread_id).first()
        if not thread:
            print(f"[persist_message] Thread {thread_id} not found, skipping persistence")
            return None
        
        # Create message with user_id=None for assistant messages
        message = Message(
            thread_id=thread_id,
            user_id=None,  # Assistant messages have no user_id
            sender=sender,
            text=text.strip(),
            timestamp=datetime.utcnow()
        )
        
        db.add(message)
        db.commit()
        db.refresh(message)
        
        # Update thread's updated_at timestamp
        thread.updated_at = datetime.utcnow()
        db.commit()
        
        print(f"[persist_message] Saved assistant message {message.id} to thread {thread_id}")
        return message
    
    except Exception as e:
        print(f"[persist_message] Error saving message: {e}")
        db.rollback()
        return None


# --- ChatOps health endpoint ---
class ProviderHealthResponse(BaseModel):
    providerStatuses: dict


@router.get("/health")
async def chat_health(ollama_url: str = "http://localhost:11434", db: Session = Depends(get_db)):
    """Lightweight health endpoint for ChatOps console.
    Returns provider status codes without performing full chat calls.
    openai: 'key-missing' | 'ok'
    ollama: 'ok' | 'offline' | 'error'
    """
    # OpenAI status: check database key first (priority), then env var
    # DB key takes priority over env var
    import json
    db_key = None
    try:
        openai_conn = db.query(Connection).filter(Connection.service == "openai").first()
        if openai_conn and getattr(openai_conn, 'config', None):
            config_data = json.loads(openai_conn.config)
            db_key = config_data.get("apiKey")
    except Exception:
        pass
    
    openai_key = db_key or os.getenv("OPENAI_API_KEY")
    openai_status = "key-missing" if not openai_key else "ok"

    # Ollama status: attempt a quick version or tags request
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ollama_url}/api/version")
            resp.raise_for_status()
            ollama_status = "ok"
    except httpx.ConnectError:
        ollama_status = "offline"
    except Exception:
        ollama_status = "error"

    return {
        "providerStatuses": {
            "openai": openai_status,
            "ollama": ollama_status
        }
    }
