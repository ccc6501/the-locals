"""
FastAPI Backend Server for Admin Panel
Supports: OpenAI, Ollama, Tailscale, Cloud Storage, WebSockets
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import get_db, engine, Base
from routers import auth, users, invites, chat, connections, storage, settings, system, devices
from chat_routes import router as chat_router
# from websocket_manager import ConnectionManager

# Create database tables
Base.metadata.create_all(bind=engine)

# WebSocket connection manager
# manager = ConnectionManager()


# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     """Application lifespan events"""
#     # Startup
#     print("🚀 Starting Admin Panel API Server...")
#     yield
#     # Shutdown
#     print("👋 Shutting down Admin Panel API Server...")


# Initialize FastAPI app
app = FastAPI(
    title="Admin Panel API",
    description="Production-ready backend for admin panel with AI, storage, and real-time features",
    version="1.0.0"
    # lifespan=lifespan
)

# CORS configuration - Allow all Tailscale and localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development/Tailscale
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(devices.router, prefix="/api/devices", tags=["Devices"])
app.include_router(invites.router, prefix="/api/invites", tags=["Invites"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(chat_router)  # Group chat routes at /chat
app.include_router(connections.router, prefix="/api/connections", tags=["Connections"])
app.include_router(storage.router, prefix="/api/storage", tags=["Cloud Storage"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(system.router, prefix="/api/system", tags=["System"])


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Admin Panel API Server",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    print("Health check endpoint called")
    try:
        result = {"status": "healthy"}
        print(f"Returning result: {result}")
        return result
    except Exception as e:
        print(f"Error in health check: {e}")
        raise


# @app.websocket("/ws")
# async def websocket_endpoint(websocket: WebSocket, token: str = None):
#     """
#     WebSocket endpoint for real-time updates
#     Connect: ws://localhost:8086/ws?token=YOUR_JWT_TOKEN
#     """
#     await manager.connect(websocket)
#     try:
#         while True:
#             data = await websocket.receive_json()
#             message_type = data.get("type")
#             message_data = data.get("data")
#             
#             # Handle different message types
#             if message_type == "message":
#                 # Broadcast new message to all connected clients
#                 await manager.broadcast({
#                     "type": "new_message",
#                     "data": message_data
#                 })
#             elif message_type == "user_status":
#                 # Broadcast user status change
#                 await manager.broadcast({
#                     "type": "user_status_changed",
#                     "data": message_data
#                 })
#             elif message_type == "notification":
#                 # Broadcast notification
#                 await manager.broadcast({
#                     "type": "notification",
#                     "data": message_data
#                 })
#             else:
#                 # Echo back unknown message types
#                 await websocket.send_json({
#                     "type": "error",
#                     "message": f"Unknown message type: {message_type}"
#                 })
#     except WebSocketDisconnect:
#         manager.disconnect(websocket)
#         await manager.broadcast({
#             "type": "user_disconnected",
#             "data": {"message": "A user disconnected"}
#         })


if __name__ == "__main__":
    import hypercorn.asyncio
    import asyncio
    from hypercorn.config import Config
    
    config = Config()
    config.bind = ["0.0.0.0:8000"]  # Listen on all interfaces for remote access
    config.accesslog = "-"
    config.errorlog = "-"
    
    asyncio.run(hypercorn.asyncio.serve(app, config))
