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
    base_url: Optional[str] = None


class SimpleChatRequest(BaseModel):
    """Simple chat request for ChatOps console"""
    message: str
    provider: str = "openai"
    temperature: float = 0.7
    config: Optional[ChatConfig] = None


class SimpleChatResponse(BaseModel):
    """Simple chat response"""
    reply: str
    provider: str
    model: str


@router.post("/chat", response_model=SimpleChatResponse)
async def simple_chat(request: SimpleChatRequest):
    """
    Simple chat endpoint for ChatOps console.
    No authentication required, supports OpenAI and Ollama.
    """
    
    if request.provider == "openai":
        return await _chat_openai_simple(request)
    elif request.provider == "ollama":
        return await _chat_ollama_simple(request)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {request.provider}")


async def _chat_openai_simple(request: SimpleChatRequest) -> SimpleChatResponse:
    """Call OpenAI API for simple chat"""
    
    # Get API key from request or environment
    api_key = None
    if request.config and request.config.api_key:
        api_key = request.config.api_key
    else:
        api_key = os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key required. Provide in config.api_key or set OPENAI_API_KEY environment variable."
        )
    
    model = (request.config.model if request.config else None) or "gpt-4o"
    
    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI assistant for The Local - a Tailscale-powered home hub with AI capabilities. Be concise and helpful."
                },
                {
                    "role": "user",
                    "content": request.message
                }
            ],
            temperature=request.temperature,
            max_tokens=1000
        )
        
        reply_text = response.choices[0].message.content
        
        return SimpleChatResponse(
            reply=reply_text,
            provider="openai",
            model=model
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")


async def _chat_ollama_simple(request: SimpleChatRequest) -> SimpleChatResponse:
    """Call Ollama API for simple chat"""
    
    base_url = (request.config.base_url if request.config else None) or "http://localhost:11434"
    model = (request.config.model if request.config else None) or "llama3"
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a helpful AI assistant for The Local - a Tailscale-powered home hub. Be concise and helpful."
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
            
            reply_text = data["message"]["content"]
            
            return SimpleChatResponse(
                reply=reply_text,
                provider="ollama",
                model=model
            )
    
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Ollama at {base_url}. Make sure Ollama is running."
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Ollama error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama call failed: {str(e)}")


async def get_ai_response(message: str, thread_type: str, db: Session) -> str:
    """
    Get AI response from OpenAI or Ollama based on configuration
    """
    # Check OpenAI connection
    openai_conn = db.query(Connection).filter(Connection.service == "openai").first()
    if openai_conn and openai_conn.enabled:
        try:
            import json
            config = json.loads(openai_conn.config) if openai_conn.config else {}
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
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI error: {e}")
    
    # Check Ollama connection
    ollama_conn = db.query(Connection).filter(Connection.service == "ollama").first()
    if ollama_conn and ollama_conn.enabled:
        try:
            import json
            config = json.loads(ollama_conn.config) if ollama_conn.config else {}
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
    thread.updated_at = datetime.utcnow()
    
    # Increment AI usage counter
    current_user.ai_usage += 1
    
    db.commit()
    db.refresh(user_message)
    
    # If it's an AI thread, get AI response
    if thread.type == "ai":
        ai_response_text = await get_ai_response(message_data.text, thread.type, db)
        
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
    if thread.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own threads"
        )
    
    db.delete(thread)
    db.commit()
    
    return {"message": "Thread deleted successfully"}
