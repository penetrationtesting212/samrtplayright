"""
Logging configuration for structured logging.
"""

import logging
import sys
from typing import Dict, Any

import structlog


def setup_logging():
    """Configure structured logging for the application."""
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )


class RequestLoggingMiddleware:
    """Middleware for logging HTTP requests and responses."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            start_time = time.time()
            
            # Log request
            logger = structlog.get_logger()
            logger.info(
                "Request started",
                method=scope["method"],
                path=scope["path"],
                client=scope.get("client")
            )
            
            async def send_wrapper(message):
                if message["type"] == "http.response.start":
                    processing_time = (time.time() - start_time) * 1000
                    logger.info(
                        "Request completed",
                        method=scope["method"],
                        path=scope["path"],
                        status_code=message["status"],
                        processing_time_ms=processing_time
                    )
                await send(message)
            
            await self.app(scope, receive, send_wrapper)
        else:
            await self.app(scope, receive, send)


def get_request_id_processor() -> structlog.processors.CallsiteParameterAdder:
    """Add request ID to log entries."""
    return structlog.processors.CallsiteParameterAdder(
        parameters=[structlog.processors.CallsiteParameter.PATHNAME]
    )