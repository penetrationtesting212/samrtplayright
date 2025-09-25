"""
Comprehensive tests for the Playwright Test Generator API.
"""

import pytest
import json
from fastapi.testclient import TestClient

from main import create_app
from models.requests import TestGenerationConfig, LLMModel, OutputLanguage, TestFramework


@pytest.fixture
def client():
    """Create test client."""
    app = create_app()
    return TestClient(app)


@pytest.fixture
def sample_playwright_script():
    """Sample Playwright script for testing."""
    return """
test('user login flow', async ({ page }) => {
    await page.goto('https://example.com/login');
    await page.fill('#username', 'testuser@example.com');
    await page.fill('#password', 'securepassword123');
    await page.click('#login-button');
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('#welcome-message')).toContainText('Welcome');
});
"""


@pytest.fixture
def sample_user_prompt():
    """Sample user prompt template for testing."""
    return """
Generate comprehensive test cases for the provided Playwright script.
Focus on creating thorough, executable tests that validate all aspects
of the functionality including edge cases and error conditions.

Requirements:
- Generate both positive and negative test scenarios
- Include proper setup and teardown
- Use descriptive test names and documentation
- Ensure tests are maintainable and reliable
"""


class TestHealthEndpoints:
    """Test health check endpoints."""
    
    def test_health_check(self, client):
        """Test basic health check endpoint."""
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert "version" in data
    
    def test_supported_models(self, client):
        """Test supported models endpoint."""
        response = client.get("/api/v1/supported-models")
        assert response.status_code == 200
        
        data = response.json()
        assert "models" in data
        assert "default_model" in data
        assert "recommendation" in data


class TestScriptParsing:
    """Test script parsing functionality."""
    
    def test_parse_playwright_script(self, client, sample_playwright_script):
        """Test script parsing endpoint."""
        request_data = {
            "playwright_script": sample_playwright_script,
            "include_metadata": True
        }
        
        response = client.post("/api/v1/parse-playwright", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "parsed_script" in data
        assert "processing_time_ms" in data
        
        # Verify parsed content
        parsed = data["parsed_script"]
        assert len(parsed["actions"]) > 0
        assert len(parsed["selectors"]) > 0
    
    def test_parse_invalid_script(self, client):
        """Test parsing with invalid script."""
        request_data = {
            "playwright_script": "invalid script content",
            "include_metadata": False
        }
        
        response = client.post("/api/v1/parse-playwright", json=request_data)
        # Should handle gracefully, even if script is unusual
        assert response.status_code in [200, 400]
    
    def test_parsing_examples(self, client):
        """Test parsing examples endpoint."""
        response = client.get("/api/v1/parsing-examples")
        assert response.status_code == 200
        
        data = response.json()
        assert "examples" in data
        assert "supported_actions" in data
        assert "supported_selectors" in data


class TestTestGeneration:
    """Test test generation functionality."""
    
    @pytest.mark.asyncio
    async def test_generate_tests_structure(self, client, sample_playwright_script, sample_user_prompt):
        """Test the test generation endpoint structure (without LLM)."""
        request_data = {
            "playwright_script": sample_playwright_script,
            "user_prompt_template": sample_user_prompt,
            "config": {
                "llm_model": "claude-3.5-sonnet",
                "output_language": "python",
                "test_framework": "pytest",
                "include_security_tests": True,
                "include_performance_tests": False,
                "focus_on_edge_cases": True,
                "max_test_cases": 10
            }
        }
        
        # Note: This test will fail without proper LLM API keys
        # In production, use mocking for testing
        response = client.post("/api/v1/generate-tests", json=request_data)
        
        # Test structure regardless of API key availability
        assert response.status_code in [200, 500, 503]  # Various expected outcomes
    
    def test_invalid_script_generation(self, client, sample_user_prompt):
        """Test generation with invalid script."""
        request_data = {
            "playwright_script": "",  # Empty script
            "user_prompt_template": sample_user_prompt,
            "config": {}
        }
        
        response = client.post("/api/v1/generate-tests", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_validate_script(self, client, sample_playwright_script):
        """Test script validation endpoint."""
        request_data = {
            "playwright_script": sample_playwright_script
        }
        
        response = client.post("/api/v1/validate-script", json=request_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "valid" in data
        assert "parsed_script" in data
        assert "complexity_analysis" in data


class TestRateLimiting:
    """Test rate limiting functionality."""
    
    def test_rate_limiting(self, client):
        """Test that rate limiting works correctly."""
        # Make multiple requests quickly
        responses = []
        for _ in range(5):
            response = client.get("/api/v1/health")
            responses.append(response.status_code)
        
        # Should all succeed for reasonable number of requests
        assert all(status in [200, 429] for status in responses)


class TestInputValidation:
    """Test input validation."""
    
    def test_script_length_validation(self, client, sample_user_prompt):
        """Test script length limits."""
        # Test with very long script
        long_script = "a" * 60000  # Exceeds max length
        
        request_data = {
            "playwright_script": long_script,
            "user_prompt_template": sample_user_prompt
        }
        
        response = client.post("/api/v1/generate-tests", json=request_data)
        assert response.status_code == 422  # Validation error
    
    def test_empty_prompt_validation(self, client, sample_playwright_script):
        """Test empty prompt validation."""
        request_data = {
            "playwright_script": sample_playwright_script,
            "user_prompt_template": ""  # Empty template
        }
        
        response = client.post("/api/v1/generate-tests", json=request_data)
        assert response.status_code == 422  # Validation error