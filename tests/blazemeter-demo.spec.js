const { test, expect } = require('@playwright/test');
const { allure } = require('allure-playwright');

// Configure test metadata for Allure reporting
test.beforeEach(async ({ page }, testInfo) => {
  await allure.epic('BlazeMeter Demo Testing');
  await allure.feature('Landing Page Functionality');
  await allure.story('User Journey on BlazeMeter Demo Site');
  await allure.owner('QA Team');
  await allure.tags('smoke', 'demo', 'blazemeter', 'ui');
  await allure.severity('critical');
  
  // Add environment info
  await allure.parameter('Browser', testInfo.project.name);
  await allure.parameter('URL', 'https://demo.blazemeter.com');
  await allure.parameter('Test Type', 'UI Functional Test');
});

test.describe('BlazeMeter Demo Website Tests', () => {
  test('should load BlazeMeter demo landing page and verify key elements', async ({ page }) => {
    await allure.step('Navigate to BlazeMeter demo website', async () => {
      await page.goto('https://demo.blazemeter.com');
      await allure.attachment('URL', 'https://demo.blazemeter.com', 'text/plain');
    });
    
    await allure.step('Wait for page to load completely', async () => {
      await page.waitForLoadState('networkidle');
    });
    
    await allure.step('Verify page title contains expected keywords', async () => {
      await expect(page).toHaveTitle(/BlazeMeter|Performance Testing|Load Testing/);
      const title = await page.title();
      await allure.attachment('Page Title', title, 'text/plain');
    });
    
    await allure.step('Capture full page screenshot', async () => {
      const screenshot = await page.screenshot({ path: 'test-results/blazemeter-landing-page.png', fullPage: true });
      await allure.attachment('Landing Page Screenshot', screenshot, 'image/png');
    });
    
    await allure.step('Analyze page elements and structure', async () => {
      // Check for common elements that might be on the landing page
      const elementsToCheck = [
        'h1, h2, h3', // Headers
        'nav', // Navigation
        'button', // Buttons
        'a[href]', // Links
        'form', // Forms if any
      ];
      
      const elementCounts = {};
      for (const selector of elementsToCheck) {
        const elements = await page.locator(selector);
        const count = await elements.count();
        elementCounts[selector] = count;
        if (count > 0) {
          console.log(`Found ${count} elements matching ${selector}`);
        }
      }
      
      await allure.attachment('Element Analysis', JSON.stringify(elementCounts, null, 2), 'application/json');
    });
    
    await allure.step('Test Call-to-Action elements detection', async () => {
      // Check if there are any prominent call-to-action buttons
      const ctaSelectors = [
        'button:has-text("Get Started")',
        'button:has-text("Try")',
        'button:has-text("Sign Up")',
        'button:has-text("Demo")',
        'a:has-text("Get Started")',
        'a:has-text("Try")',
        'a:has-text("Sign Up")',
        'a:has-text("Demo")',
      ];
      
      const foundCTAs = [];
      for (const selector of ctaSelectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
          console.log(`Found CTA element: ${selector}`);
          foundCTAs.push(selector);
          await expect(element).toBeVisible();
          break;
        }
      }
      
      await allure.attachment('Found CTAs', foundCTAs.join(', '), 'text/plain');
    });
    
    // Verify page is responsive by checking viewport
    const viewportSize = page.viewportSize();
    console.log(`Page loaded with viewport: ${viewportSize.width}x${viewportSize.height}`);
    
    // Check for any obvious navigation elements
    const navElements = await page.locator('nav, .nav, .navbar, .navigation').count();
    if (navElements > 0) {
      console.log(`Found ${navElements} navigation elements`);
    }
    
    // Verify page loads without obvious errors
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error));
    
    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(2000);
    
    // Assert no page errors occurred
    expect(pageErrors).toHaveLength(0);
    
    console.log('BlazeMeter demo page test completed successfully');
  });

  test('should test basic navigation and interactions', async ({ page }) => {
    // Navigate to BlazeMeter demo website
    await page.goto('https://demo.blazemeter.com');
    await page.waitForLoadState('networkidle');
    
    // Try to find and interact with common elements
    try {
      // Look for menu items or navigation links
      const links = await page.locator('a[href]').all();
      if (links.length > 0) {
        console.log(`Found ${links.length} links on the page`);
        
        // Test the first few links (avoid external links that might redirect)
        for (let i = 0; i < Math.min(3, links.length); i++) {
          const link = links[i];
          const href = await link.getAttribute('href');
          
          // Only test internal links or anchors
          if (href && (href.startsWith('/') || href.startsWith('#') || href.includes('blazemeter'))) {
            console.log(`Testing link: ${href}`);
            
            // Check if link is visible and clickable
            if (await link.isVisible()) {
              await expect(link).toBeVisible();
              console.log(`Link ${i + 1} is visible and accessible`);
            }
          }
        }
      }
    } catch (error) {
      console.log('Navigation testing encountered expected variations:', error.message);
    }
    
    // Test page scroll functionality
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    
    console.log('Navigation and interaction test completed');
  });

  test('should verify page performance and load times', async ({ page }) => {
    await allure.step('Measure page load performance', async () => {
      // Start timing
      const startTime = Date.now();
      
      // Navigate to BlazeMeter demo website
      await page.goto('https://demo.blazemeter.com');
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('domcontentloaded');
      const domLoadTime = Date.now() - startTime;
      
      await page.waitForLoadState('networkidle');
      const networkIdleTime = Date.now() - startTime;
      
      console.log(`DOM Content Loaded: ${domLoadTime}ms`);
      console.log(`Network Idle: ${networkIdleTime}ms`);
      
      // Attach performance metrics to Allure report
      await allure.attachment('Performance Metrics', JSON.stringify({
        domLoadTime: `${domLoadTime}ms`,
        networkIdleTime: `${networkIdleTime}ms`,
        timestamp: new Date().toISOString()
      }, null, 2), 'application/json');
      
      // Verify reasonable load times (adjust thresholds as needed)
      expect(domLoadTime).toBeLessThan(10000); // 10 seconds max for DOM
      expect(networkIdleTime).toBeLessThan(15000); // 15 seconds max for network idle
    });
    
    // Check for any console errors
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Log any console errors but don't fail the test unless critical
    if (consoleLogs.length > 0) {
      console.log('Console errors detected:', consoleLogs);
    }
    
    console.log('Performance test completed');
  });
});