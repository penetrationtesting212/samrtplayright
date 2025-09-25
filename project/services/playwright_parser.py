"""
Advanced Playwright script parser for extracting test structure and components.
"""

import re
import ast
from typing import List, Dict, Any, Optional, Tuple
import structlog

from models.responses import ParsedAction, ParsedScript

logger = structlog.get_logger()


class PlaywrightParser:
    """Advanced parser for Playwright scripts."""
    
    def __init__(self):
        # Regex patterns for different Playwright actions
        self.action_patterns = {
            'click': r'(?:page\.|[\w.]+\.)?click\s*\(\s*[\'"]([^\'"]+)[\'"]',
            'fill': r'(?:page\.|[\w.]+\.)?fill\s*\(\s*[\'"]([^\'"]+)[\'"],\s*[\'"]([^\'"]*)[\'"]',
            'type': r'(?:page\.|[\w.]+\.)?type\s*\(\s*[\'"]([^\'"]+)[\'"],\s*[\'"]([^\'"]*)[\'"]',
            'navigate': r'(?:page\.|[\w.]+\.)?goto\s*\(\s*[\'"]([^\'"]+)[\'"]',
            'wait': r'(?:page\.|[\w.]+\.)?waitFor(?:Selector|Element|Timeout)?\s*\(\s*[\'"]?([^\'"]+)?[\'"]?',
            'select': r'(?:page\.|[\w.]+\.)?selectOption\s*\(\s*[\'"]([^\'"]+)[\'"],\s*[\'"]([^\'"]*)[\'"]',
            'check': r'(?:page\.|[\w.]+\.)?check\s*\(\s*[\'"]([^\'"]+)[\'"]',
            'uncheck': r'(?:page\.|[\w.]+\.)?uncheck\s*\(\s*[\'"]([^\'"]+)[\'"]',
        }
        
        # Assertion patterns
        self.assertion_patterns = {
            'expect_visible': r'expect\s*\(\s*(?:page\.|[\w.]+\.)?(?:locator\s*\(\s*)?[\'"]([^\'"]+)[\'"]',
            'expect_text': r'expect\s*\([^)]+\)\.toHaveText\s*\(\s*[\'"]([^\'"]+)[\'"]',
            'expect_value': r'expect\s*\([^)]+\)\.toHaveValue\s*\(\s*[\'"]([^\'"]+)[\'"]',
            'expect_url': r'expect\s*\(\s*page\s*\)\.toHaveURL\s*\(\s*[\'"]([^\'"]+)[\'"]',
        }
        
        # URL extraction patterns
        self.url_patterns = [
            r'goto\s*\(\s*[\'"]([^\'"]+)[\'"]',
            r'baseURL[\'"]?\s*:\s*[\'"]([^\'"]+)[\'"]',
            r'url[\'"]?\s*:\s*[\'"]([^\'"]+)[\'"]',
        ]
        
        # Form field patterns
        self.form_field_patterns = [
            r'fill\s*\(\s*[\'"]([^\'"]+)[\'"]',
            r'type\s*\(\s*[\'"]([^\'"]+)[\'"]',
            r'selectOption\s*\(\s*[\'"]([^\'"]+)[\'"]',
            r'check\s*\(\s*[\'"]([^\'"]+)[\'"]',
        ]

    async def parse_script(self, script: str) -> ParsedScript:
        """Parse a Playwright script and extract its structure."""
        logger.info("Starting script parsing", script_length=len(script))
        
        lines = script.split('\n')
        actions = []
        assertions = []
        selectors = set()
        urls = set()
        form_fields = set()
        
        # Extract test name
        test_name = self._extract_test_name(script)
        
        # Parse each line for actions and patterns
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith('//') or line.startswith('#'):
                continue
            
            # Extract actions
            line_actions = self._extract_actions_from_line(line, line_num)
            actions.extend(line_actions)
            
            # Extract assertions
            line_assertions = self._extract_assertions_from_line(line)
            assertions.extend(line_assertions)
            
            # Extract selectors, URLs, and form fields
            selectors.update(self._extract_selectors_from_line(line))
            urls.update(self._extract_urls_from_line(line))
            form_fields.update(self._extract_form_fields_from_line(line))
        
        parsed_script = ParsedScript(
            test_name=test_name,
            actions=actions,
            assertions=assertions,
            selectors=list(selectors),
            urls=list(urls),
            form_fields=list(form_fields),
            total_lines=len(lines)
        )
        
        logger.info(
            "Script parsing completed",
            actions_found=len(actions),
            assertions_found=len(assertions),
            selectors_found=len(selectors),
            urls_found=len(urls)
        )
        
        return parsed_script
    
    def _extract_test_name(self, script: str) -> Optional[str]:
        """Extract the test name from the script."""
        test_patterns = [
            r'test\s*\(\s*[\'"]([^\'"]+)[\'"]',
            r'describe\s*\(\s*[\'"]([^\'"]+)[\'"]',
            r'it\s*\(\s*[\'"]([^\'"]+)[\'"]',
        ]
        
        for pattern in test_patterns:
            match = re.search(pattern, script)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_actions_from_line(self, line: str, line_num: int) -> List[ParsedAction]:
        """Extract actions from a single line."""
        actions = []
        
        for action_type, pattern in self.action_patterns.items():
            matches = re.finditer(pattern, line)
            for match in matches:
                selector = match.group(1) if match.groups() else None
                value = match.group(2) if len(match.groups()) > 1 else None
                
                actions.append(ParsedAction(
                    action_type=action_type,
                    selector=selector,
                    value=value,
                    line_number=line_num
                ))
        
        return actions
    
    def _extract_assertions_from_line(self, line: str) -> List[str]:
        """Extract assertions from a single line."""
        assertions = []
        
        for assertion_type, pattern in self.assertion_patterns.items():
            matches = re.finditer(pattern, line)
            for match in matches:
                assertions.append(match.group(0))
        
        return assertions
    
    def _extract_selectors_from_line(self, line: str) -> List[str]:
        """Extract CSS selectors from a line."""
        selectors = []
        
        # General selector patterns
        selector_patterns = [
            r'[\'"]([#.]\w[\w-]*)[\'"]',  # CSS selectors
            r'[\'"](\[[\w-]+(?:=[\w-]+)?\])[\'"]',  # Attribute selectors
            r'getByRole\s*\(\s*[\'"](\w+)[\'"]',  # Role selectors
            r'getByText\s*\(\s*[\'"]([^\'"]+)[\'"]',  # Text selectors
            r'getByTestId\s*\(\s*[\'"]([^\'"]+)[\'"]',  # Test ID selectors
        ]
        
        for pattern in selector_patterns:
            matches = re.finditer(pattern, line)
            selectors.extend([match.group(1) for match in matches])
        
        return selectors
    
    def _extract_urls_from_line(self, line: str) -> List[str]:
        """Extract URLs from a line."""
        urls = []
        
        for pattern in self.url_patterns:
            matches = re.finditer(pattern, line)
            urls.extend([match.group(1) for match in matches])
        
        return urls
    
    def _extract_form_fields_from_line(self, line: str) -> List[str]:
        """Extract form field selectors from a line."""
        form_fields = []
        
        for pattern in self.form_field_patterns:
            matches = re.finditer(pattern, line)
            form_fields.extend([match.group(1) for match in matches])
        
        return form_fields
    
    def analyze_script_complexity(self, parsed_script: ParsedScript) -> Dict[str, Any]:
        """Analyze the complexity and characteristics of the parsed script."""
        complexity_metrics = {
            "total_actions": len(parsed_script.actions),
            "action_types": len(set(action.action_type for action in parsed_script.actions)),
            "assertion_count": len(parsed_script.assertions),
            "unique_selectors": len(parsed_script.selectors),
            "form_interactions": len(parsed_script.form_fields),
            "navigation_steps": len(parsed_script.urls),
            "complexity_score": self._calculate_complexity_score(parsed_script)
        }
        
        # Categorize complexity
        score = complexity_metrics["complexity_score"]
        if score < 10:
            complexity_metrics["complexity_level"] = "simple"
        elif score < 25:
            complexity_metrics["complexity_level"] = "moderate"
        else:
            complexity_metrics["complexity_level"] = "complex"
        
        return complexity_metrics
    
    def _calculate_complexity_score(self, parsed_script: ParsedScript) -> int:
        """Calculate a complexity score for the script."""
        score = 0
        score += len(parsed_script.actions) * 2
        score += len(parsed_script.assertions) * 3
        score += len(set(action.action_type for action in parsed_script.actions)) * 5
        score += len(parsed_script.form_fields) * 2
        score += len(parsed_script.urls) * 1
        
        return score