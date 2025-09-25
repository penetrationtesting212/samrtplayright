"""
API routes for Playwright script parsing functionality.
"""

from fastapi import APIRouter, HTTPException, Depends
import structlog

from models.requests import ScriptParsingRequest
from models.responses import ScriptParsingResponse, ErrorResponse
from services.playwright_parser import PlaywrightParser
from api.dependencies import rate_limit_check

logger = structlog.get_logger()
router = APIRouter()


@router.post(
    "/parse-playwright",
    response_model=ScriptParsingResponse,
    responses={
        400: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    },
    summary="Parse Playwright Script",
    description="Parse and analyze a Playwright script to extract structure and components"
)
async def parse_playwright_script(
    request: ScriptParsingRequest,
    _rate_limit=Depends(rate_limit_check)
) -> ScriptParsingResponse:
    """
    Parse a Playwright script and extract its structural components.
    
    This endpoint analyzes the script to identify:
    - Actions (clicks, fills, navigations)
    - Selectors and form fields
    - Assertions and expectations
    - URLs and navigation patterns
    - Overall complexity metrics
    """
    import time
    start_time = time.time()
    
    try:
        parser = PlaywrightParser()
        
        # Parse the script
        parsed_script = await parser.parse_script(request.playwright_script)
        
        # Generate additional metadata if requested
        metadata = {}
        if request.include_metadata:
            metadata = {
                "complexity_analysis": parser.analyze_script_complexity(parsed_script),
                "parsing_timestamp": time.time(),
                "script_hash": hash(request.playwright_script)
            }
        
        processing_time = int((time.time() - start_time) * 1000)
        
        response = ScriptParsingResponse(
            success=True,
            parsed_script=parsed_script,
            parsing_metadata=metadata,
            processing_time_ms=processing_time
        )
        
        logger.info(
            "Script parsing completed",
            actions_found=len(parsed_script.actions),
            processing_time_ms=processing_time
        )
        
        return response
        
    except Exception as e:
        processing_time = int((time.time() - start_time) * 1000)
        logger.error("Script parsing failed", error=str(e))
        
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse script: {str(e)}"
        )


@router.get(
    "/parsing-examples",
    summary="Get Parsing Examples",
    description="Get examples of supported Playwright script patterns"
)
async def get_parsing_examples() -> dict:
    """
    Get examples of Playwright script patterns that can be parsed.
    
    Returns sample scripts and their expected parsing results.
    """
    examples = {
        "basic_login": {
            "script": """
test('user login', async ({ page }) => {
    await page.goto('https://example.com/login');
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'testpass');
    await page.click('#login-button');
    await expect(page.locator('#dashboard')).toBeVisible();
});
            """,
            "expected_actions": [
                {"type": "navigate", "selector": "https://example.com/login"},
                {"type": "fill", "selector": "#username", "value": "testuser"},
                {"type": "fill", "selector": "#password", "value": "testpass"},
                {"type": "click", "selector": "#login-button"}
            ]
        },
        "form_submission": {
            "script": """
test('contact form submission', async ({ page }) => {
    await page.goto('/contact');
    await page.fill('[data-testid="name-input"]', 'John Doe');
    await page.fill('[data-testid="email-input"]', 'john@example.com');
    await page.selectOption('#category', 'support');
    await page.fill('#message', 'Test message');
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toContainText('Thank you');
});
            """,
            "expected_actions": [
                {"type": "navigate", "selector": "/contact"},
                {"type": "fill", "selector": "[data-testid=\"name-input\"]", "value": "John Doe"},
                {"type": "select", "selector": "#category", "value": "support"},
                {"type": "click", "selector": "button[type=\"submit\"]"}
            ]
        }
    }
    
    return {
        "examples": examples,
        "supported_actions": [
            "click", "fill", "type", "navigate", "wait", 
            "select", "check", "uncheck"
        ],
        "supported_selectors": [
            "CSS selectors (#id, .class, element)",
            "Attribute selectors ([data-testid='value'])",
            "Text selectors (getByText)",
            "Role selectors (getByRole)",
            "Test ID selectors (getByTestId)"
        ]
    }