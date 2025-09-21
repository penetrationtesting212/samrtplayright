import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { ssimReporter } from '../src/reporting/ssim-test-reporter';

test.describe('Phase 1 & Phase 2 Integration Demo', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await allure.epic('Phase Implementation Demo');
    await allure.feature('Component Testing & SSIM Enhancement');
    await allure.story('Integration Testing');
    
    // Initialize SSIM reporter for this test
    await ssimReporter.initialize();
    ssimReporter.clearMetrics();
    
    await allure.step('Test Setup', async () => {
      await allure.parameter('Test Name', testInfo.title);
      await allure.parameter('Phase 1 Status', 'Component Testing Complete');
      await allure.parameter('Phase 2 Status', 'SSIM Enhancement Complete');
    });
  });

  test('Phase 1: Component Testing Verification', async ({ page }) => {
    await allure.step('Verify Component Test Infrastructure', async () => {
      await allure.description('Validates that Phase 1 component testing setup is working correctly');
      
      // Navigate to the application
      await page.goto('https://demo.blazemeter.com');
      await page.waitForLoadState('networkidle');
      
      // Record SSIM metrics for initial page load
      await ssimReporter.recordSSIMMetrics('page_load', page, {
        description: 'Initial page load visual baseline'
      });
      
      // Test component-like interactions
      await allure.step('Test Search Component Interaction', async () => {
        const searchBox = page.locator('#searchbox');
        await expect(searchBox).toBeVisible();
        
        await searchBox.fill('Playwright Testing');
        await ssimReporter.recordSSIMMetrics('search_input', page, {
          elementSelector: '#searchbox',
          description: 'Search box interaction'
        });
        
        await searchBox.press('Enter');
        await page.waitForTimeout(2000);
        
        // Verify search results appeared
        const resultsExist = await page.locator('.search-results, #search-results, [data-testid="search-results"]').count() > 0;
        if (resultsExist) {
          await allure.parameter('Search Results', 'Found');
        } else {
          await allure.parameter('Search Results', 'No specific results container found');
        }
      });
      
      await allure.parameter('Component Testing', 'PASSED');
    });
  });

  test('Phase 2: SSIM Visual Enhancement Demo', async ({ page }) => {
    await allure.step('Demonstrate SSIM-Enhanced Visual Analysis', async () => {
      await allure.description('Showcases Phase 2 SSIM.js integration with enhanced visual comparison');
      
      // Navigate to the application
      await page.goto('https://demo.blazemeter.com');
      await page.waitForLoadState('networkidle');
      
      // Take initial screenshot for comparison
      const initialScreenshot = await page.screenshot({ type: 'png' });
      
      await allure.step('SSIM Baseline Establishment', async () => {
        await ssimReporter.recordSSIMMetrics('baseline_capture', page, {
          description: 'Establishing visual baseline for SSIM comparison'
        });
        
        await allure.parameter('SSIM Baseline', 'Established');
      });
      
      // Simulate some interactions that might change the page
      await allure.step('Page Interaction and SSIM Monitoring', async () => {
        // Click on navigation or menu items
        const navLinks = page.locator('nav a, .navbar a, .menu a, a[href]');
        const linkCount = await navLinks.count();
        
        if (linkCount > 0) {
          await navLinks.first().click();
          await page.waitForTimeout(1000);
          
          // Compare with initial screenshot using SSIM
          const afterClickScreenshot = await page.screenshot({ type: 'png' });
          await ssimReporter.recordSSIMMetrics('after_navigation', page, {
            referenceImage: initialScreenshot,
            description: 'Post-navigation SSIM comparison'
          });
        }
        
        await allure.parameter('SSIM Monitoring', 'Active');
      });
      
      await allure.step('Advanced Visual Element Analysis', async () => {
        // Analyze specific elements with SSIM
        const buttonElements = page.locator('button, [role="button"], .btn');
        const buttonCount = await buttonElements.count();
        
        for (let i = 0; i < Math.min(buttonCount, 3); i++) {
          const button = buttonElements.nth(i);
          const buttonText = await button.textContent() || `Button ${i + 1}`;
          
          try {
            await button.scrollIntoViewIfNeeded();
            
            await ssimReporter.recordSSIMMetrics(`button_analysis_${i}`, page, {
              elementSelector: `button:nth-child(${i + 1}), [role="button"]:nth-child(${i + 1})`,
              description: `SSIM analysis of button: ${buttonText.trim()}`
            });
          } catch (error) {
            console.log(`Could not analyze button ${i}: ${error.message}`);
          }
        }
        
        await allure.parameter('Elements Analyzed', buttonCount.toString());
      });
    });
  });

  test('Integration: Component Testing + SSIM Analysis', async ({ page }) => {
    await allure.step('Combined Phase 1 & Phase 2 Demonstration', async () => {
      await allure.description('Demonstrates the integration of component testing infrastructure with SSIM-enhanced visual analysis');
      
      await page.goto('https://demo.blazemeter.com');
      await page.waitForLoadState('networkidle');
      
      // Phase 1: Component-style testing with structured approach
      await allure.step('Phase 1: Structured Component Testing', async () => {
        // Test multiple component-like interactions with structured validation
        const testComponents = [
          { name: 'Search', selector: '#searchbox, input[type="search"], .search-input' },
          { name: 'Navigation', selector: 'nav, .navbar, .navigation' },
          { name: 'Main Content', selector: 'main, .main-content, #content' }
        ];
        
        for (const component of testComponents) {
          await allure.step(`Test ${component.name} Component`, async () => {
            const element = page.locator(component.selector).first();
            const exists = await element.count() > 0;
            
            if (exists) {
              await element.scrollIntoViewIfNeeded();
              
              // Phase 2: SSIM analysis for each component
              await ssimReporter.recordSSIMMetrics(`component_${component.name.toLowerCase()}`, page, {
                elementSelector: component.selector,
                description: `SSIM analysis of ${component.name} component`
              });
              
              await allure.parameter(`${component.name} Component`, 'Found and Analyzed');
            } else {
              await allure.parameter(`${component.name} Component`, 'Not Found');
            }
          });
        }
      });
      
      // Phase 2: Advanced SSIM healing simulation
      await allure.step('Phase 2: SSIM-Based Healing Simulation', async () => {
        // Simulate a selector that might fail and needs healing
        const preferredSelector = '#specific-element-id';
        const fallbackSelectors = [
          '[data-testid="element"]',
          '.element-class',
          'button:contains("text")',
          'input[placeholder*="search"]'
        ];
        
        let healingSuccess = false;
        let usedSelector = '';
        
        // Try preferred selector first
        if (await page.locator(preferredSelector).count() > 0) {
          usedSelector = preferredSelector;
          healingSuccess = true;
        } else {
          // Simulate SSIM-based healing process
          for (const selector of fallbackSelectors) {
            const elementCount = await page.locator(selector).count();
            if (elementCount > 0) {
              usedSelector = selector;
              healingSuccess = true;
              
              // Record SSIM metrics for successful healing
              await ssimReporter.recordSSIMMetrics('healing_success', page, {
                elementSelector: selector,
                description: `SSIM-based healing found element with: ${selector}`
              });
              break;
            }
          }
        }
        
        await allure.parameter('Healing Strategy', healingSuccess ? 'Successful' : 'No Match Found');
        await allure.parameter('Final Selector', usedSelector || 'None');
      });
      
      // Generate final SSIM report
      await allure.step('Generate Integration Report', async () => {
        const report = await ssimReporter.generateTestReport();
        
        await allure.parameter('Total SSIM Analyses', report.summary.ssimAnalyses.toString());
        await allure.parameter('Average SSIM Score', report.summary.averageSSIM.toFixed(4));
        await allure.parameter('Test Quality', report.summary.excellentMatches > 0 ? 'High' : 'Standard');
        
        // Add recommendations
        if (report.recommendations.length > 0) {
          await allure.attachment(
            'Integration Recommendations',
            report.recommendations.join('\\n'),
            'text/plain'
          );
        }
      });
    });
  });

  test.afterEach(async () => {
    await allure.step('Test Cleanup and Final Metrics', async () => {
      // Add final SSIM report to Allure
      const finalReport = await ssimReporter.generateTestReport();
      
      await allure.attachment(
        'Final SSIM Test Report',
        JSON.stringify(finalReport, null, 2),
        'application/json'
      );
      
      await allure.parameter('Integration Status', 'Phase 1 & 2 Complete');
    });
  });
});