"""
LLM integration service for test generation.
"""

import asyncio
import time
from typing import Dict, Any, Optional, List

import anthropic
import openai
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from config.settings import Settings
from models.requests import LLMModel

logger = structlog.get_logger()


class LLMService:
    """Service for managing LLM interactions."""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.anthropic_client = None
        self.openai_client = None
        
        # Initialize clients if API keys are available
        if settings.anthropic_api_key:
            self.anthropic_client = anthropic.AsyncAnthropic(
                api_key=settings.anthropic_api_key
            )
        
        if settings.openai_api_key:
            self.openai_client = openai.AsyncOpenAI(
                api_key=settings.openai_api_key
            )
    
    async def health_check(self) -> Dict[str, str]:
        """Check health of all configured LLM services."""
        health_status = {}
        
        if self.anthropic_client:
            try:
                # Simple test call to verify connectivity
                await self._test_anthropic_connection()
                health_status["anthropic"] = "healthy"
            except Exception as e:
                logger.error("Anthropic health check failed", error=str(e))
                health_status["anthropic"] = "unhealthy"
        else:
            health_status["anthropic"] = "not_configured"
        
        if self.openai_client:
            try:
                await self._test_openai_connection()
                health_status["openai"] = "healthy"
            except Exception as e:
                logger.error("OpenAI health check failed", error=str(e))
                health_status["openai"] = "unhealthy"
        else:
            health_status["openai"] = "not_configured"
        
        return health_status
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def generate_tests(
        self,
        prompt: str,
        model: LLMModel,
        temperature: Optional[float] = None
    ) -> str:
        """Generate test cases using the specified LLM model."""
        start_time = time.time()
        
        try:
            if model.value.startswith("claude"):
                result = await self._generate_with_anthropic(prompt, model, temperature)
            elif model.value.startswith("gpt"):
                result = await self._generate_with_openai(prompt, model, temperature)
            else:
                raise ValueError(f"Unsupported model: {model}")
            
            processing_time = (time.time() - start_time) * 1000
            logger.info(
                "Test generation completed",
                model=model.value,
                processing_time_ms=processing_time,
                prompt_length=len(prompt),
                response_length=len(result)
            )
            
            return result
            
        except Exception as e:
            logger.error(
                "Test generation failed",
                model=model.value,
                error=str(e),
                prompt_length=len(prompt)
            )
            raise
    
    async def _generate_with_anthropic(
        self,
        prompt: str,
        model: LLMModel,
        temperature: Optional[float]
    ) -> str:
        """Generate tests using Anthropic's Claude models."""
        if not self.anthropic_client:
            raise ValueError("Anthropic client not configured")
        
        response = await self.anthropic_client.messages.create(
            model=model.value,
            max_tokens=self.settings.max_tokens,
            temperature=temperature or self.settings.temperature,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        
        return response.content[0].text
    
    async def _generate_with_openai(
        self,
        prompt: str,
        model: LLMModel,
        temperature: Optional[float]
    ) -> str:
        """Generate tests using OpenAI's GPT models."""
        if not self.openai_client:
            raise ValueError("OpenAI client not configured")
        
        response = await self.openai_client.chat.completions.create(
            model=model.value,
            messages=[{
                "role": "user",
                "content": prompt
            }],
            max_tokens=self.settings.max_tokens,
            temperature=temperature or self.settings.temperature
        )
        
        return response.choices[0].message.content
    
    async def _test_anthropic_connection(self):
        """Test Anthropic API connectivity."""
        await self.anthropic_client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=10,
            messages=[{"role": "user", "content": "test"}]
        )
    
    async def _test_openai_connection(self):
        """Test OpenAI API connectivity."""
        await self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=10
        )
    
    def get_supported_models(self) -> List[Dict[str, str]]:
        """Get list of supported models with their capabilities."""
        models = []
        
        if self.anthropic_client:
            models.extend([
                {
                    "id": "claude-3.5-sonnet",
                    "name": "Claude 3.5 Sonnet",
                    "provider": "anthropic",
                    "description": "Most capable model for complex test generation",
                    "recommended": True
                },
                {
                    "id": "claude-3-haiku",
                    "name": "Claude 3 Haiku",
                    "provider": "anthropic",
                    "description": "Fast and efficient for simpler test cases",
                    "recommended": False
                }
            ])
        
        if self.openai_client:
            models.extend([
                {
                    "id": "gpt-4",
                    "name": "GPT-4",
                    "provider": "openai",
                    "description": "High-quality test generation with good reasoning",
                    "recommended": False
                },
                {
                    "id": "gpt-3.5-turbo",
                    "name": "GPT-3.5 Turbo",
                    "provider": "openai",
                    "description": "Fast and cost-effective option",
                    "recommended": False
                }
            ])
        
        return models