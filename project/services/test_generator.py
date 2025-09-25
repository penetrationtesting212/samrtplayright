"""
Main test generation service that orchestrates parsing and AI generation.
"""

import json
import time
from typing import Dict, Any, List

import structlog

from models.requests import TestGenerationRequest, TestGenerationConfig
from models.responses import (
    TestGenerationResponse, GeneratedTestCase, TestCaseType, ParsedScript
)
from services.llm_service import LLMService
from services.playwright_parser import PlaywrightParser
from services.prompt_builder import PromptBuilder

logger = structlog.get_logger()


class TestGenerationService:
    """Service for generating test cases from Playwright scripts."""
    
    def __init__(self, llm_service: LLMService):
        self.llm_service = llm_service
        self.parser = PlaywrightParser()
        self.prompt_builder = PromptBuilder()
    
    async def generate_tests(self, request: TestGenerationRequest) -> TestGenerationResponse:
        """Generate comprehensive test cases from a Playwright script."""
        start_time = time.time()
        
        logger.info(
            "Starting test generation",
            script_length=len(request.playwright_script),
            model=request.config.llm_model.value
        )
        
        try:
            # Step 1: Parse the Playwright script
            parsed_script = await self.parser.parse_script(request.playwright_script)
            
            # Step 2: Analyze script complexity
            complexity_analysis = self.parser.analyze_script_complexity(parsed_script)
            
            # Step 3: Build the generation prompt
            prompt = await self.prompt_builder.build_prompt(
                request.user_prompt_template,
                parsed_script,
                request.config,
                complexity_analysis
            )
            
            # Step 4: Generate tests using LLM
            raw_response = await self.llm_service.generate_tests(
                prompt,
                request.config.llm_model,
                request.config.temperature
            )
            
            # Step 5: Parse and validate the generated response
            generated_tests = await self._parse_llm_response(raw_response, request.config)
            
            # Step 6: Build the final response
            processing_time = int((time.time() - start_time) * 1000)
            
            response = TestGenerationResponse(
                success=True,
                generated_tests=generated_tests,
                parsed_script=parsed_script,
                generation_metadata={
                    "complexity_analysis": complexity_analysis,
                    "prompt_length": len(prompt),
                    "raw_response_length": len(raw_response),
                    "model_used": request.config.llm_model.value,
                    "generation_timestamp": datetime.utcnow().isoformat()
                },
                processing_time_ms=processing_time,
                llm_model_used=request.config.llm_model.value
            )
            
            logger.info(
                "Test generation completed successfully",
                tests_generated=len(generated_tests),
                processing_time_ms=processing_time
            )
            
            return response
            
        except Exception as e:
            logger.error("Test generation failed", error=str(e))
            processing_time = int((time.time() - start_time) * 1000)
            
            # Return partial response with error information
            return TestGenerationResponse(
                success=False,
                generated_tests=[],
                parsed_script=ParsedScript(actions=[], assertions=[], selectors=[], urls=[], form_fields=[], total_lines=0),
                generation_metadata={
                    "error": str(e),
                    "generation_timestamp": datetime.utcnow().isoformat()
                },
                processing_time_ms=processing_time,
                llm_model_used=request.config.llm_model.value
            )
    
    async def _parse_llm_response(self, response: str, config: TestGenerationConfig) -> List[GeneratedTestCase]:
        """Parse the LLM response and extract test cases."""
        try:
            # Try to extract JSON from the response
            json_match = self._extract_json_from_response(response)
            if not json_match:
                raise ValueError("No valid JSON found in LLM response")
            
            data = json.loads(json_match)
            test_cases = []
            
            # Extract test cases from the response
            if "test_cases" in data:
                for test_data in data["test_cases"]:
                    test_case = GeneratedTestCase(
                        name=test_data.get("name", "Unnamed Test"),
                        description=test_data.get("description", "No description provided"),
                        test_type=TestCaseType(test_data.get("test_type", "functional")),
                        code=test_data.get("code", "# No code generated"),
                        priority=test_data.get("priority", "medium"),
                        estimated_execution_time=test_data.get("estimated_execution_time")
                    )
                    test_cases.append(test_case)
            
            return test_cases[:config.max_test_cases]  # Respect max limit
            
        except Exception as e:
            logger.error("Failed to parse LLM response", error=str(e))
            # Fallback: create a single test case with the raw response
            return [GeneratedTestCase(
                name="Generated Test",
                description="AI-generated test case (parsing failed)",
                test_type=TestCaseType.FUNCTIONAL,
                code=response,
                priority="medium"
            )]
    
    def _extract_json_from_response(self, response: str) -> str:
        """Extract JSON content from LLM response."""
        # Look for JSON blocks in various formats
        patterns = [
            r'```json\s*(\{.*?\})\s*```',
            r'```\s*(\{.*?\})\s*```',
            r'(\{[^{}]*\{[^}]*\}[^{}]*\})',  # Nested JSON
            r'(\{.*?\})',  # Simple JSON
        ]
        
        for pattern in patterns:
            import re
            match = re.search(pattern, response, re.DOTALL)
            if match:
                return match.group(1)
        
        return None