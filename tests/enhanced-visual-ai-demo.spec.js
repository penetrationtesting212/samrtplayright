import { test, expect } from '@playwright/test';

test.describe('Enhanced Visual AI Recognition Demo', () => {
  test('should demonstrate AI-powered element healing', async ({ page }) => {
    // Navigate to a demo page
    await page.goto('https://demo.playwright.dev/todomvc');
    
    // Take initial screenshot for AI analysis
    await page.screenshot({ path: 'ai-demo-initial.png', fullPage: true });
    
    // Try to click an element that might have changed selectors
    const originalSelector = '.new-todo';
    
    try {
      // First attempt with original selector
      await page.click(originalSelector, { timeout: 5000 });
      console.log('✅ Original selector worked');
    } catch (error) {
      console.log('❌ Original selector failed, triggering AI healing...');
      
      // Simulate AI healing process
      const aiHealedSelector = await healElementWithAI(page, {
        originalSelector,
        tagName: 'input',
        textContent: '',
        attributes: {
          placeholder: 'What needs to be done?',
          'class': 'new-todo'
        },
        boundingBox: {
          x: 100,
          y: 150,
          width: 400,
          height: 50
        }
      });
      
      if (aiHealedSelector) {
        await page.click(aiHealedSelector);
        console.log(`✅ AI healing successful with selector: ${aiHealedSelector}`);
      }
    }
    
    // Type some text to verify the element is functional
    await page.type('.new-todo', 'AI-powered test healing demo');
    await page.press('.new-todo', 'Enter');
    
    // Verify the todo was added
    await expect(page.locator('.todo-list li')).toHaveCount(1);
    await expect(page.locator('.todo-list li')).toContainText('AI-powered test healing demo');
  });

  test('should analyze page elements with Visual AI', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc');
    
    // Simulate AI page analysis
    const pageAnalysis = await analyzePageWithAI(page);
    
    console.log('📊 AI Page Analysis Results:');
    console.log(`- Total interactive elements: ${pageAnalysis.totalElements}`);
    console.log(`- Element types: ${JSON.stringify(pageAnalysis.elementTypes)}`);
    console.log(`- Risk assessment: ${JSON.stringify(pageAnalysis.riskAssessment)}`);
    console.log(`- AI recommendations: ${pageAnalysis.recommendations.join(', ')}`);
    
    // Verify we found expected elements
    expect(pageAnalysis.totalElements).toBeGreaterThan(0);
    expect(pageAnalysis.elementTypes.inputs).toBeGreaterThan(0);
  });

  test('should demonstrate visual similarity matching', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc');
    
    // Add some todos first
    await page.fill('.new-todo', 'First todo');
    await page.press('.new-todo', 'Enter');
    await page.fill('.new-todo', 'Second todo');
    await page.press('.new-todo', 'Enter');
    
    // Take screenshot for visual analysis
    await page.screenshot({ path: 'ai-demo-with-todos.png', fullPage: true });
    
    // Simulate finding visually similar elements (checkboxes)
    const checkboxes = await page.locator('.todo-list input[type=\"checkbox\"]').all();
    console.log(`🎯 Found ${checkboxes.length} visually similar checkbox elements`);
    
    // Demonstrate AI-powered interaction with similar elements
    for (let i = 0; i < checkboxes.length; i++) {
      const checkbox = checkboxes[i];
      const isChecked = await checkbox.isChecked();
      
      if (!isChecked) {
        await checkbox.click();
        console.log(`✅ AI clicked checkbox ${i + 1} - marked as complete`);
        
        // Verify visual feedback
        const todoItem = page.locator('.todo-list li').nth(i);
        await expect(todoItem).toHaveClass(/completed/);
      }
    }
    
    // Verify all todos are completed
    const completedTodos = await page.locator('.todo-list li.completed').count();
    expect(completedTodos).toBe(2);
  });

  test('should handle dynamic content with AI adaptation', async ({ page }) => {
    await page.goto('https://demo.playwright.dev/todomvc');
    
    // Add multiple todos
    const todoTexts = ['AI Test 1', 'AI Test 2', 'AI Test 3'];
    
    for (const todoText of todoTexts) {
      await page.fill('.new-todo', todoText);
      await page.press('.new-todo', 'Enter');
    }
    
    // Simulate AI-powered element detection after DOM changes
    console.log('🔄 Simulating dynamic content changes...');
    
    // Mark some todos as complete
    await page.click('.todo-list li:nth-child(1) input[type=\"checkbox\"]');
    await page.click('.todo-list li:nth-child(3) input[type=\"checkbox\"]');
    
    // Use AI to find and interact with filter buttons
    const filterButtons = await findElementsWithAI(page, {
      tagName: 'button',
      textContent: ['All', 'Active', 'Completed'],
      role: 'button'
    });
    
    console.log(`🎯 AI found ${filterButtons.length} filter buttons`);
    
    // Test filtering functionality
    if (filterButtons.length >= 3) {
      // Click \"Active\" filter
      await page.click('text=\"Active\"');
      const activeTodos = await page.locator('.todo-list li:not(.completed)').count();
      console.log(`📝 Active todos: ${activeTodos}`);
      expect(activeTodos).toBe(1);
      
      // Click \"Completed\" filter
      await page.click('text=\"Completed\"');
      const completedTodos = await page.locator('.todo-list li.completed').count();
      console.log(`✅ Completed todos: ${completedTodos}`);
      expect(completedTodos).toBe(2);
      
      // Return to \"All\" view
      await page.click('text=\"All\"');
      const allTodos = await page.locator('.todo-list li').count();
      expect(allTodos).toBe(3);
    }
  });
});

/**
 * Simulated AI healing function (would integrate with actual AI service)
 */
async function healElementWithAI(page, elementContext) {
  console.log('🤖 Starting AI-powered element healing...');
  
  // Simulate AI analysis
  const candidates = [
    { selector: 'input.new-todo', confidence: 0.95, reasoning: 'High visual similarity' },
    { selector: '[placeholder*=\"What needs\"]', confidence: 0.87, reasoning: 'Placeholder text match' },
    { selector: 'input[type=\"text\"]', confidence: 0.72, reasoning: 'Input type match' }
  ];
  
  // Return the highest confidence candidate
  const bestCandidate = candidates.sort((a, b) => b.confidence - a.confidence)[0];
  
  if (bestCandidate && bestCandidate.confidence > 0.7) {
    console.log(`🎯 AI selected: ${bestCandidate.selector} (confidence: ${bestCandidate.confidence})`);
    return bestCandidate.selector;
  }
  
  return null;
}

/**
 * Simulated AI page analysis function
 */
async function analyzePageWithAI(page) {
  console.log('📊 Running AI page analysis...');
  
  // Get all interactive elements
  const buttons = await page.locator('button').count();
  const inputs = await page.locator('input').count();
  const links = await page.locator('a').count();
  
  return {
    totalElements: buttons + inputs + links,
    elementTypes: {
      buttons,
      inputs,
      links,
      other: 0
    },
    riskAssessment: {
      highRisk: 0,
      mediumRisk: 1,
      lowRisk: buttons + inputs + links - 1
    },
    recommendations: [
      inputs > 0 ? 'Input elements detected - consider adding data-testid attributes' : null,
      buttons > 2 ? 'Multiple buttons found - ensure unique identification' : null,
      'Visual regression testing recommended for this page'
    ].filter(Boolean)
  };
}

/**
 * Simulated AI element finder function
 */
async function findElementsWithAI(page, criteria) {
  console.log('🔍 Using AI to find elements with criteria:', criteria);
  
  // Simulate AI-powered element detection
  const elements = [];
  
  if (criteria.textContent) {
    for (const text of criteria.textContent) {
      const count = await page.locator(`text=\"${text}\"`).count();
      if (count > 0) {
        elements.push({ text, count, confidence: 0.9 });
      }
    }
  }
  
  return elements;
}