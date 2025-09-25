"""
FastAPI dependencies for dependency injection and middleware.
"""

import time
from typing import Dict, Optional
from fastapi import Depends, HTTPException, Request, Header
import structlog

from config.settings import get_settings, Settings
from services.llm_service import LLMService

logger = structlog.get_logger()

# Global service instances (will be set during app startup)
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Get the LLM service instance."""
    if _llm_service is None:
        raise HTTPException(
            status_code=503,
            detail="LLM service not available"
        )
    return _llm_service


def set_llm_service(service: LLMService):
    """Set the global LLM service instance."""
    global _llm_service
    _llm_service = service


# In-memory rate limiting (in production, use Redis)
_rate_limit_storage: Dict[str, list] = {}


async def rate_limit_check(
    request: Request,
    settings: Settings = Depends(get_settings)
) -> bool:
    """
    Simple rate limiting based on client IP.
    In production, this should use Redis for distributed rate limiting.
    """
    client_ip = request.client.host
    current_time = time.time()
    window_start = current_time - 60  # 1-minute window
    
    # Get or create rate limit data for this IP
    if client_ip not in _rate_limit_storage:
        _rate_limit_storage[client_ip] = []
    
    # Clean old entries
    _rate_limit_storage[client_ip] = [
        timestamp for timestamp in _rate_limit_storage[client_ip]
        if timestamp > window_start
    ]
    
    # Check rate limit
    if len(_rate_limit_storage[client_ip]) >= settings.rate_limit_per_minute:
        logger.warning("Rate limit exceeded", client_ip=client_ip)
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )
    
    # Add current request
    _rate_limit_storage[client_ip].append(current_time)
    return True


async def api_key_check(
    request: Request,
    settings: Settings = Depends(get_settings),
    api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> bool:
    """
    API key validation (optional security layer).
    Only enforced if allowed_api_keys is configured.
    """
    if not settings.allowed_api_keys:
        return True  # No API key required
    
    if not api_key or api_key not in settings.allowed_api_keys:
        logger.warning("Invalid API key attempt", client_ip=request.client.host)
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key"
        )
    
    return True