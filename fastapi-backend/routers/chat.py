"""
Chat routes - Threads and Messages with AI integration
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os
from dotenv import load_dotenv

from database import get_db
from models import User, Thread, Message, Connection
from schemas import ThreadCreate, ThreadResponse, MessageCreate, MessageResponse
from auth_utils import get_current_active_user

# AI imports
import openai
import httpx

load_dotenv()

router = APIRouter()


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
