"""
Advanced prompt builder for test generation using structured templates.
"""

import json
from typing import Dict, Any, List
from datetime import datetime

import structlog

from models.requests import TestGenerationConfig, OutputLanguage, TestFramework
from models.responses import ParsedScript, ParsedAction

logger = structlog.get_logger()


class PromptBuilder:
    """Builder for creating comprehensive test generation prompts."""
    
    def __init__(self):
        self.framework_templates = {
            TestFramework.PYTEST: self._get_pytest_template(),
            TestFramework.UNITTEST: self._get_unittest_template(),
            TestFramework.JEST: self._get_jest_template(),
            TestFramework.MOCHA: self._get_mocha_template(),
            TestFramework.JUNIT: self._get_junit_template(),
        }
    
    async def build_prompt(
        self,
        user_template: str,
        parsed_script: ParsedScript,
        config: TestGenerationConfig,
        complexity_analysis: Dict[str, Any]
    ) -> str:
        """Build a comprehensive prompt for test generation."""
        logger.info("Building test generation prompt", config=config.dict())
        
        # Build the context section
        script_context = self._build_script_context(parsed_script, complexity_analysis)
        
        # Build configuration section
        config_context = self._build_config_context(config)
        
        # Get framework-specific examples
        framework_examples = self._get_framework_examples(config.test_framework, config.output_language)
        
        # Build the complete prompt
        prompt = f"""
{user_template}

## SCRIPT ANALYSIS CONTEXT
The following Playwright script has been analyzed and parsed:

### Script Overview
- Test Name: {parsed_script.test_name or 'Not specified'}
- Total Actions: {len(parsed_script.actions)}
- Assertions Found: {len(parsed_script.assertions)}
- Complexity Level: {complexity_analysis.get('complexity_level', 'unknown')}
- Complexity Score: {complexity_analysis.get('complexity_score', 0)}

### Extracted Actions
{self._format_actions(parsed_script.actions)}

### Identified Selectors
{self._format_list(parsed_script.selectors)}

### Form Fields Detected
{self._format_list(parsed_script.form_fields)}

### URLs and Navigation
{self._format_list(parsed_script.urls)}

### Assertions Found
{self._format_list(parsed_script.assertions)}

## GENERATION CONFIGURATION
{config_context}

## FRAMEWORK-SPECIFIC REQUIREMENTS
{framework_examples}

## GENERATION REQUIREMENTS
Based on the analyzed script and user requirements, generate comprehensive test cases that:

1. **Cover All Identified Actions**: Create tests for each action type found in the script
2. **Include Security Testing**: {"Generate security tests (XSS, SQL injection, authentication bypass)" if config.include_security_tests else "Skip security tests"}
3. **Add Performance Testing**: {"Include performance and load testing scenarios" if config.include_performance_tests else "Skip performance tests"}
4. **Focus on Edge Cases**: {"Prioritize edge cases, boundary conditions, and error scenarios" if config.focus_on_edge_cases else "Focus on happy path scenarios"}
5. **Maximum Test Cases**: Generate up to {config.max_test_cases} test cases

## OUTPUT FORMAT
Return the response as valid JSON with the following structure:
{{
    "test_cases": [
        {{
            "name": "descriptive_test_name",
            "description": "detailed description of what the test validates",
            "test_type": "functional|security|performance|edge_case|boundary|negative",
            "code": "complete executable test code",
            "priority": "high|medium|low",
            "estimated_execution_time": "estimated time to execute"
        }}
    ],
    "generation_summary": {{
        "total_generated": "number of tests generated",
        "types_covered": ["list of test types"],
        "framework_used": "{config.test_framework.value}",
        "language": "{config.output_language.value}"
    }}
}}

Generate the test cases now:
"""
        
        logger.info("Prompt built successfully", prompt_length=len(prompt))
        return prompt
    
    def _build_script_context(self, parsed_script: ParsedScript, complexity_analysis: Dict[str, Any]) -> str:
        """Build the script context section."""
        context = f"""
Script contains {len(parsed_script.actions)} actions across {parsed_script.total_lines} lines.
Complexity: {complexity_analysis.get('complexity_level', 'unknown')} (score: {complexity_analysis.get('complexity_score', 0)})
"""
        return context.strip()
    
    def _build_config_context(self, config: TestGenerationConfig) -> str:
        """Build the configuration context section."""
        return f"""
- Target Language: {config.output_language.value}
- Test Framework: {config.test_framework.value}
- Security Tests: {'Enabled' if config.include_security_tests else 'Disabled'}
- Performance Tests: {'Enabled' if config.include_performance_tests else 'Disabled'}
- Edge Case Focus: {'Enabled' if config.focus_on_edge_cases else 'Disabled'}
- Maximum Test Cases: {config.max_test_cases}
- LLM Model: {config.llm_model.value}
"""
    
    def _format_actions(self, actions: List[ParsedAction]) -> str:
        """Format actions for display in the prompt."""
        if not actions:
            return "No actions detected"
        
        formatted = []
        for action in actions:
            action_desc = f"Line {action.line_number}: {action.action_type.upper()}"
            if action.selector:
                action_desc += f" on '{action.selector}'"
            if action.value:
                action_desc += f" with value '{action.value}'"
            formatted.append(action_desc)
        
        return '\n'.join(formatted)
    
    def _format_list(self, items: List[str]) -> str:
        """Format a list of items for display."""
        if not items:
            return "None detected"
        return '\n'.join(f"- {item}" for item in items[:10])  # Limit to first 10 items
    
    def _get_framework_examples(self, framework: TestFramework, language: OutputLanguage) -> str:
        """Get framework-specific examples and requirements."""
        return self.framework_templates.get(framework, "")
    
    def _get_pytest_template(self) -> str:
        """Get pytest-specific template and examples."""
        return """
### Pytest Framework Requirements
- Use pytest fixtures for setup and teardown
- Follow pytest naming conventions (test_* functions)
- Use assert statements for validations
- Include proper imports (pytest, playwright)
- Use parametrized tests where appropriate
- Include docstrings for test documentation

Example structure:
```python
import pytest
from playwright.sync_api import Page, expect

def test_example_functionality(page: Page):
    \"\"\"Test description here.\"\"\"
    # Test implementation
    page.goto("https://example.com")
    page.click("#button")
    expect(page.locator("#result")).to_have_text("Expected text")
```
"""
    
    def _get_unittest_template(self) -> str:
        """Get unittest-specific template."""
        return """
### Unittest Framework Requirements
- Inherit from unittest.TestCase
- Use setUp() and tearDown() methods
- Follow test_* method naming
- Use self.assert* methods for validations
- Include proper class and method docstrings

Example structure:
```python
import unittest
from playwright.sync_api import sync_playwright

class TestExample(unittest.TestCase):
    def setUp(self):
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch()
        self.page = self.browser.new_page()
    
    def test_functionality(self):
        \"\"\"Test description here.\"\"\"
        # Test implementation
        
    def tearDown(self):
        self.browser.close()
        self.playwright.stop()
```
"""
    
    def _get_jest_template(self) -> str:
        """Get Jest-specific template."""
        return """
### Jest Framework Requirements
- Use describe() and test() blocks
- Use beforeEach/afterEach for setup
- Use expect() for assertions
- Include proper async/await syntax
- Follow JavaScript/TypeScript conventions

Example structure:
```javascript
const { test, expect } = require('@playwright/test');

test.describe('Example Tests', () => {
    test('should validate functionality', async ({ page }) => {
        // Test implementation
        await page.goto('https://example.com');
        await page.click('#button');
        await expect(page.locator('#result')).toHaveText('Expected text');
    });
});
```
"""
    
    def _get_mocha_template(self) -> str:
        """Get Mocha-specific template."""
        return """
### Mocha Framework Requirements
- Use describe() and it() blocks
- Use before/after hooks for setup
- Support various assertion libraries (chai)
- Include proper async handling
- Follow JavaScript conventions

Example structure:
```javascript
const { chromium } = require('playwright');
const { expect } = require('chai');

describe('Example Tests', () => {
    let browser, page;
    
    before(async () => {
        browser = await chromium.launch();
        page = await browser.newPage();
    });
    
    it('should validate functionality', async () => {
        // Test implementation
    });
    
    after(async () => {
        await browser.close();
    });
});
```
"""
    
    def _get_junit_template(self) -> str:
        """Get JUnit-specific template."""
        return """
### JUnit Framework Requirements
- Use @Test annotations
- Use @BeforeEach/@AfterEach for setup
- Use assertions from org.junit.jupiter.api.Assertions
- Follow Java naming conventions
- Include proper exception handling

Example structure:
```java
import org.junit.jupiter.api.*;
import com.microsoft.playwright.*;

public class ExampleTest {
    private Playwright playwright;
    private Browser browser;
    private Page page;
    
    @BeforeEach
    void setUp() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch();
        page = browser.newPage();
    }
    
    @Test
    void testFunctionality() {
        // Test implementation
    }
    
    @AfterEach
    void tearDown() {
        browser.close();
        playwright.close();
    }
}
```
"""