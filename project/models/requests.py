"""
Request models for the Playwright Test Generator API.
"""

from typing import Optional, List, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field, validator


class LLMModel(str, Enum):
    """Supported LLM models."""
    CLAUDE_35_SONNET = "claude-3.5-sonnet"
    CLAUDE_3_HAIKU = "claude-3-haiku"
    GPT_4 = "gpt-4"
    GPT_35_TURBO = "gpt-3.5-turbo"


class OutputLanguage(str, Enum):
    """Supported output languages for test generation."""
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"


class TestFramework(str, Enum):
    """Supported test frameworks."""
    PYTEST = "pytest"
    UNITTEST = "unittest"
    JEST = "jest"
    MOCHA = "mocha"
    JUNIT = "junit"


class TestGenerationConfig(BaseModel):
    """Configuration options for test generation."""
    llm_model: LLMModel = Field(default=LLMModel.CLAUDE_35_SONNET)
    output_language: OutputLanguage = Field(default=OutputLanguage.PYTHON)
    test_framework: TestFramework = Field(default=TestFramework.PYTEST)
    include_security_tests: bool = Field(default=True)
    include_performance_tests: bool = Field(default=False)
    focus_on_edge_cases: bool = Field(default=True)
    max_test_cases: int = Field(default=20, ge=1, le=50)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)


class TestGenerationRequest(BaseModel):
    """Request model for test generation endpoint."""
    playwright_script: str = Field(..., min_length=10, max_length=50000)
    user_prompt_template: str = Field(..., min_length=50, max_length=10000)
    config: TestGenerationConfig = Field(default_factory=TestGenerationConfig)
    
    @validator('playwright_script')
    def validate_playwright_script(cls, v):
        """Validate that the script contains Playwright-specific content."""
        required_indicators = ['page.', 'test(', 'expect(']
        if not any(indicator in v for indicator in required_indicators):
            raise ValueError('Script must contain valid Playwright syntax')
        return v


class ScriptParsingRequest(BaseModel):
    """Request model for script parsing endpoint."""
    playwright_script: str = Field(..., min_length=10, max_length=50000)
    include_metadata: bool = Field(default=True)
    
    @validator('playwright_script')
    def validate_script_content(cls, v):
        """Basic validation for script content."""
        if not v.strip():
            raise ValueError('Script cannot be empty')
        return v


class HealthCheckRequest(BaseModel):
    """Request model for health check with specific LLM model."""
    model: Optional[LLMModel] = Field(default=None)