"""
API routes for test generation functionality.
"""

import time
from typing import Dict, List
from fastapi import APIRouter, HTTPException, Depends, Request
import structlog

from models.requests import TestGenerationRequest
from models.responses import TestGenerationResponse, ErrorResponse
from services.test_generator import TestGenerationService
from api.dependencies import get_llm_service, rate_limit_check

logger = structlog.get_logger()
router = APIRouter()


@router.post(
    "/generate-tests",
    response_model=TestGenerationResponse,
    responses={
        400: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    },
    summary="Generate Test Cases",
    description="Generate comprehensive test cases from a Playwright script using AI"
)
async def generate_tests(
    request: TestGenerationRequest,
    llm_service=Depends(get_llm_service),
    _rate_limit=Depends(rate_limit_check)
) -> TestGenerationResponse:
    """
    Generate comprehensive test cases from a Playwright script.
    
    This endpoint analyzes the provided Playwright script and generates
    multiple types of test cases including functional, security, performance,
    and edge case tests based on the configuration provided.
    """
    try:
        # Initialize the test generation service
        test_generator = TestGenerationService(llm_service)
        
        # Generate the tests
        response = await test_generator.generate_tests(request)
        
        logger.info(
            "Test generation request completed",
            success=response.success,
            tests_generated=len(response.generated_tests),
            processing_time=response.processing_time_ms
        )
        
        return response
        
    except ValueError as e:
        logger.warning("Invalid request parameters", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error("Test generation failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Internal server error during test generation"
        )


@router.post(
    "/validate-script",
    summary="Validate Playwright Script",
    description="Validate and analyze a Playwright script structure"
)
async def validate_script(
    request: dict,
    _rate_limit=Depends(rate_limit_check)
) -> dict:
    """
    Validate a Playwright script and return structural analysis.
    
    This endpoint analyzes the script structure without generating tests,
    useful for validation and debugging purposes.
    """
    try:
        script = request.get("playwright_script", "")
        if not script:
            raise ValueError("No script provided")
        
        from services.playwright_parser import PlaywrightParser
        parser = PlaywrightParser()
        
        # Parse the script
        parsed_script = await parser.parse_script(script)
        complexity_analysis = parser.analyze_script_complexity(parsed_script)
        
        return {
            "valid": True,
            "parsed_script": parsed_script.dict(),
            "complexity_analysis": complexity_analysis,
            "recommendations": _generate_recommendations(complexity_analysis)
        }
        
    except Exception as e:
        logger.error("Script validation failed", error=str(e))
        return {
            "valid": False,
            "error": str(e),
            "recommendations": ["Fix script syntax errors before proceeding"]
        }


def _generate_recommendations(complexity_analysis: Dict) -> List[str]:
    """Generate recommendations based on complexity analysis."""
    recommendations = []
    
    complexity_level = complexity_analysis.get("complexity_level", "unknown")
    score = complexity_analysis.get("complexity_score", 0)
    
    if complexity_level == "simple":
        recommendations.append("Consider adding more assertions for better coverage")
    elif complexity_level == "complex":
        recommendations.append("Consider breaking down into smaller test scenarios")
        recommendations.append("Enable security and performance testing for comprehensive coverage")
    
    if complexity_analysis.get("assertion_count", 0) < 3:
        recommendations.append("Add more assertions to validate expected behavior")
    
    if complexity_analysis.get("form_interactions", 0) > 0:
        recommendations.append("Include input validation and security tests for forms")
    
    return recommendations