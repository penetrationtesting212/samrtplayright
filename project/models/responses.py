"""
Response models for the Playwright Test Generator API.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class TestCaseType(str, Enum):
    """Types of generated test cases."""
    FUNCTIONAL = "functional"
    SECURITY = "security"
    PERFORMANCE = "performance"
    EDGE_CASE = "edge_case"
    BOUNDARY = "boundary"
    NEGATIVE = "negative"


class GeneratedTestCase(BaseModel):
    """A single generated test case."""
    name: str = Field(..., description="Test case name")
    description: str = Field(..., description="Test case description")
    test_type: TestCaseType = Field(..., description="Type of test case")
    code: str = Field(..., description="Generated test code")
    priority: str = Field(..., description="Test priority (high, medium, low)")
    estimated_execution_time: Optional[str] = Field(None, description="Estimated execution time")


class ParsedAction(BaseModel):
    """A parsed action from the Playwright script."""
    action_type: str = Field(..., description="Type of action (click, fill, navigate, etc.)")
    selector: Optional[str] = Field(None, description="CSS selector or element identifier")
    value: Optional[str] = Field(None, description="Value associated with the action")
    line_number: int = Field(..., description="Line number in the script")


class ParsedScript(BaseModel):
    """Parsed Playwright script structure."""
    test_name: Optional[str] = Field(None, description="Extracted test name")
    actions: List[ParsedAction] = Field(default_factory=list)
    assertions: List[str] = Field(default_factory=list)
    selectors: List[str] = Field(default_factory=list)
    urls: List[str] = Field(default_factory=list)
    form_fields: List[str] = Field(default_factory=list)
    total_lines: int = Field(..., description="Total lines in the script")


class TestGenerationResponse(BaseModel):
    """Response model for test generation."""
    success: bool = Field(..., description="Whether generation was successful")
    generated_tests: List[GeneratedTestCase] = Field(default_factory=list)
    parsed_script: ParsedScript = Field(..., description="Parsed script information")
    generation_metadata: Dict[str, Any] = Field(default_factory=dict)
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")
    llm_model_used: str = Field(..., description="LLM model used for generation")


class ScriptParsingResponse(BaseModel):
    """Response model for script parsing."""
    success: bool = Field(..., description="Whether parsing was successful")
    parsed_script: ParsedScript = Field(..., description="Parsed script structure")
    parsing_metadata: Dict[str, Any] = Field(default_factory=dict)
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")


class HealthCheckResponse(BaseModel):
    """Response model for health checks."""
    status: str = Field(..., description="Health status")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = Field(default="1.0.0")
    llm_services: Dict[str, str] = Field(default_factory=dict)
    system_info: Dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SupportedModelsResponse(BaseModel):
    """Response model for supported models endpoint."""
    models: List[Dict[str, str]] = Field(..., description="Available LLM models")
    default_model: str = Field(..., description="Default model")
    recommendation: str = Field(..., description="Recommended model and reasoning")