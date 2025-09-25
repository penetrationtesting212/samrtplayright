"""
Health check and monitoring routes.
"""

import platform
import psutil
from datetime import datetime
from fastapi import APIRouter, Depends
import structlog

from models.responses import HealthCheckResponse, SupportedModelsResponse
from models.requests import HealthCheckRequest, LLMModel
from api.dependencies import get_llm_service, get_settings

logger = structlog.get_logger()
router = APIRouter()


@router.get(
    "/health",
    response_model=HealthCheckResponse,
    summary="Health Check",
    description="Check the health status of the API and its dependencies"
)
async def health_check(llm_service=Depends(get_llm_service)) -> HealthCheckResponse:
    """
    Comprehensive health check for the API and its services.
    
    Returns information about:
    - API status
    - LLM service connectivity
    - System resources
    - Version information
    """
    try:
        # Check LLM services
        llm_health = await llm_service.health_check()
        
        # Get system information
        system_info = {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "cpu_usage": psutil.cpu_percent(interval=1),
            "memory_usage": psutil.virtual_memory().percent,
            "disk_usage": psutil.disk_usage('/').percent
        }
        
        return HealthCheckResponse(
            status="healthy",
            llm_services=llm_health,
            system_info=system_info
        )
        
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return HealthCheckResponse(
            status="unhealthy",
            llm_services={"error": str(e)},
            system_info={}
        )


@router.post(
    "/health/llm",
    summary="LLM Health Check",
    description="Check the health of a specific LLM model"
)
async def llm_health_check(
    request: HealthCheckRequest,
    llm_service=Depends(get_llm_service)
) -> dict:
    """
    Check the health and responsiveness of a specific LLM model.
    
    This endpoint tests connectivity and response quality for
    the specified model or all configured models.
    """
    try:
        if request.model:
            # Test specific model
            test_prompt = "Generate a simple 'Hello World' test in Python using pytest."
            response = await llm_service.generate_tests(
                test_prompt,
                request.model,
                0.1
            )
            
            return {
                "model": request.model.value,
                "status": "healthy",
                "response_preview": response[:200] + "..." if len(response) > 200 else response,
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            # Test all models
            health_results = await llm_service.health_check()
            return {
                "all_models": health_results,
                "timestamp": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        logger.error("LLM health check failed", model=request.model, error=str(e))
        return {
            "model": request.model.value if request.model else "all",
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get(
    "/supported-models",
    response_model=SupportedModelsResponse,
    summary="Get Supported Models",
    description="List all available LLM models and their capabilities"
)
async def get_supported_models(
    llm_service=Depends(get_llm_service),
    settings=Depends(get_settings)
) -> SupportedModelsResponse:
    """
    Get information about all supported LLM models.
    
    Returns details about model capabilities, recommendations,
    and availability based on current API key configuration.
    """
    models = llm_service.get_supported_models()
    
    return SupportedModelsResponse(
        models=models,
        default_model=settings.default_llm_model,
        recommendation="Claude 3.5 Sonnet is recommended for test generation based on research findings showing superior performance for code generation and analysis tasks."
    )