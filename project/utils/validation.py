"""
Validation utilities for API inputs and responses.
"""

import re
from typing import List, Dict, Any, Optional
import structlog

logger = structlog.get_logger()


class ScriptValidator:
    """Validator for Playwright scripts."""
    
    def __init__(self):
        self.required_patterns = [
            r'test\s*\(',  # Test function declaration
            r'page\.',     # Page object usage
            r'expect\s*\(' # Expectations/assertions
        ]
        
        self.security_risk_patterns = [
            r'eval\s*\(',
            r'innerHTML\s*=',
            r'document\.write',
            r'setTimeout\s*\(\s*[\'"][^\'"]*[\'"]',  # String-based setTimeout
        ]
    
    def validate_playwright_script(self, script: str) -> Dict[str, Any]:
        """Validate a Playwright script for structure and security."""
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "security_issues": [],
            "suggestions": []
        }
        
        # Check for required patterns
        missing_patterns = []
        for pattern in self.required_patterns:
            if not re.search(pattern, script):
                missing_patterns.append(pattern)
        
        if missing_patterns:
            validation_result["is_valid"] = False
            validation_result["errors"].append(
                f"Missing required Playwright patterns: {', '.join(missing_patterns)}"
            )
        
        # Check for security risks
        for pattern in self.security_risk_patterns:
            matches = re.finditer(pattern, script)
            for match in matches:
                validation_result["security_issues"].append({
                    "pattern": pattern,
                    "location": match.span(),
                    "code": match.group(0)
                })
        
        # Check script length
        if len(script) < 50:
            validation_result["warnings"].append("Script is very short, may not contain meaningful tests")
        elif len(script) > 10000:
            validation_result["warnings"].append("Script is very long, consider breaking into smaller tests")
        
        # Check for common best practices
        if 'await' not in script:
            validation_result["suggestions"].append("Consider using async/await for better test reliability")
        
        if 'data-testid' not in script and 'getByTestId' not in script:
            validation_result["suggestions"].append("Consider using data-testid attributes for more reliable selectors")
        
        return validation_result
    
    def extract_test_metadata(self, script: str) -> Dict[str, Any]:
        """Extract metadata from the test script."""
        metadata = {
            "line_count": len(script.split('\n')),
            "character_count": len(script),
            "async_patterns": len(re.findall(r'\bawait\b', script)),
            "assertion_count": len(re.findall(r'\bexpect\s*\(', script)),
            "selector_diversity": self._analyze_selector_diversity(script)
        }
        
        return metadata
    
    def _analyze_selector_diversity(self, script: str) -> Dict[str, int]:
        """Analyze the diversity of selectors used in the script."""
        selector_types = {
            "id_selectors": len(re.findall(r'#[\w-]+', script)),
            "class_selectors": len(re.findall(r'\.[\w-]+', script)),
            "attribute_selectors": len(re.findall(r'\[[\w-]+', script)),
            "text_selectors": len(re.findall(r'getByText', script)),
            "role_selectors": len(re.findall(r'getByRole', script)),
            "testid_selectors": len(re.findall(r'data-testid|getByTestId', script))
        }
        
        return selector_types


def validate_generated_tests(test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate generated test cases for quality and completeness."""
    validation_result = {
        "is_valid": True,
        "errors": [],
        "warnings": [],
        "quality_score": 0
    }
    
    if not test_cases:
        validation_result["is_valid"] = False
        validation_result["errors"].append("No test cases generated")
        return validation_result
    
    total_score = 0
    for i, test_case in enumerate(test_cases):
        case_score = 0
        
        # Check required fields
        required_fields = ["name", "description", "test_type", "code"]
        for field in required_fields:
            if field not in test_case or not test_case[field]:
                validation_result["errors"].append(f"Test case {i+1} missing required field: {field}")
            else:
                case_score += 1
        
        # Check code quality
        code = test_case.get("code", "")
        if len(code) < 50:
            validation_result["warnings"].append(f"Test case {i+1} has very short code")
        elif 'assert' in code or 'expect' in code:
            case_score += 2  # Bonus for assertions
        
        total_score += case_score
    
    validation_result["quality_score"] = min(100, (total_score / (len(test_cases) * 6)) * 100)
    
    return validation_result