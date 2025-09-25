"""
Playwright Test Case Generator API
A production-ready FastAPI application for generating comprehensive test cases from Playwright scripts.
"""

import logging
import os
from contextlib import asynccontextmanager

import structlog
import uvicorn
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config.settings import get_settings, Settings
from api.routes import test_generation, health, script_parsing
from services.llm_service import LLMService
from utils.logging_config import setup_logging


# Setup structured logging
setup_logging()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown tasks."""
    logger.info("Starting Playwright Test Generator API")
    
    # Initialize services
    settings = get_settings()
    llm_service = LLMService(settings)
    
    # Verify LLM connectivity
    try:
        await llm_service.health_check()
        logger.info("LLM services initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize LLM services", error=str(e))
        raise
    
    # Store services in app state
    app.state.llm_service = llm_service
    app.state.settings = settings
    
    yield
    
    # Cleanup
    logger.info("Shutting down Playwright Test Generator API")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title="Playwright Test Generator API",
        description="Generate comprehensive test cases from Playwright scripts using AI",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(health.router, prefix="/api/v1", tags=["Health"])
    app.include_router(test_generation.router, prefix="/api/v1", tags=["Test Generation"])
    app.include_router(script_parsing.router, prefix="/api/v1", tags=["Script Parsing"])
    
    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        logger.error("Unhandled exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )
    
    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )