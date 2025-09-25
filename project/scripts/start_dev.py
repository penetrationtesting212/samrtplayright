"""
Development server startup script with auto-reload.
"""

import os
import uvicorn

def start_development_server():
    """Start the development server with optimal settings."""
    
    # Set development environment variables
    os.environ.setdefault("DEBUG", "true")
    os.environ.setdefault("LOG_LEVEL", "DEBUG")
    
    print("🚀 Starting Playwright Test Generator API in development mode...")
    print("📖 API Documentation: http://localhost:8000/docs")
    print("🔄 Auto-reload enabled for code changes")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[".", "api", "services", "models", "config", "utils"],
        log_level="debug",
        access_log=True
    )


if __name__ == "__main__":
    start_development_server()