// JavaScript-compatible Predictive Failure Analyzer implementation
class PredictiveFailureAnalyzer {
  constructor() {
    this.isInitialized = false;
    this.selectorHistory = new Map();
    this.pageChangeHistory = new Map();
  }

  static getInstance() {
    if (!PredictiveFailureAnalyzer.instance) {
      PredictiveFailureAnalyzer.instance = new PredictiveFailureAnalyzer();
    }
    return PredictiveFailureAnalyzer.instance;
  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      console.log('🔮 Initializing Predictive Failure Analyzer (Server Mode)...');
      // Simulate ML model initialization
      this.isInitialized = true;
      console.log('✅ Predictive Failure Analyzer ready');
    } catch (error) {
      console.error('❌ Failed to initialize Predictive Failure Analyzer:', error);
      throw error;
    }
  }

  async analyzePageStability(page, url) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log(`📊 Analyzing page stability for: ${url}`);
      
      // Extract page selectors for analysis
      const selectors = await this.extractPageSelectors(page);
      
      // Analyze each selector for stability prediction
      const predictedFailures = [];
      
      for (const selector of selectors) {
        const prediction = await this.predictSelectorStability(page, selector, url);
        if (prediction.riskLevel !== 'low') {
          predictedFailures.push(prediction);
        }
      }

      // Calculate overall page stability
      const overallStability = selectors.length > 0 ? 
        selectors.reduce((sum, sel) => {
          const pred = predictedFailures.find(p => p.selector === sel) || { stabilityScore: 0.8 };
          return sum + pred.stabilityScore;
        }, 0) / selectors.length : 0.7;

      const riskySelectorCount = predictedFailures.length;

      // Generate recommendations based on findings
      const recommendations = this.generatePageRecommendations(predictedFailures, overallStability);

      return {
        overallStability,
        riskySelectorCount,
        predictedFailures,
        recommendations,
        analysisTimestamp: new Date()
      };
    } catch (error) {
      console.error('Error analyzing page stability:', error);
      throw error;
    }
  }

  async extractPageSelectors(page) {
    return await page.evaluate(() => {
      const selectors = [];
      
      // Find elements with common test selectors
      const elements = document.querySelectorAll('*');
      
      elements.forEach(el => {
        // ID selectors
        if (el.id) {
          selectors.push(`#${el.id}`);
        }
        
        // Data-testid selectors
        const testId = el.getAttribute('data-testid');
        if (testId) {
          selectors.push(`[data-testid="${testId}"]`);
        }
        
        // Class selectors (first class only)
        if (el.className && typeof el.className === 'string') {
          const firstClass = el.className.split(' ')[0];
          if (firstClass && !selectors.includes(`.${firstClass}`)) {
            selectors.push(`.${firstClass}`);
          }
        }
        
        // Aria-label selectors
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) {
          selectors.push(`[aria-label="${ariaLabel}"]`);
        }
      });
      
      return [...new Set(selectors)].slice(0, 20); // Limit to 20 selectors for demo
    });
  }

  async predictSelectorStability(page, selector, url) {
    try {
      // Extract features for prediction (simulated)
      const features = await this.extractSelectorFeatures(page, selector);
      
      // Calculate stability score based on selector characteristics
      let stabilityScore = 0.5; // Base score
      let riskFactors = [];
      
      // Scoring logic based on healing strategies memory
      if (features.hasId) stabilityScore += 0.3;
      if (features.hasTestId) stabilityScore += 0.25;
      if (features.hasAriaLabel) stabilityScore += 0.15;
      if (!features.hasId && !features.hasTestId) riskFactors.push('No stable identifiers');
      if (features.complexity > 5) riskFactors.push('Complex selector structure');
      if (features.isGeneric) riskFactors.push('Generic container element');
      if (!features.isVisible) riskFactors.push('Element not visible');
      
      stabilityScore = Math.min(stabilityScore, 1.0);
      
      // Determine risk level
      const riskLevel = stabilityScore > 0.7 ? 'low' : stabilityScore > 0.4 ? 'medium' : 'high';
      
      // Predict failure timeline based on risk
      const predictedFailureTime = riskLevel === 'high' ? 24 : riskLevel === 'medium' ? 168 : 720;
      
      // Generate recommendations based on proactive healing strategy memory
      const recommendedActions = [];
      if (riskFactors.includes('No stable identifiers')) {
        recommendedActions.push('Add data-testid attribute');
      }
      if (riskFactors.includes('Complex selector structure')) {
        recommendedActions.push('Simplify selector');
      }
      if (recommendedActions.length === 0) {
        recommendedActions.push('Monitor for changes');
      }
      
      return {
        selector,
        stabilityScore,
        riskLevel,
        riskFactors,
        confidence: 0.7 + (stabilityScore * 0.3),
        predictedFailureTime,
        recommendedActions,
        historicalData: this.getHistoricalData(url, selector)
      };
    } catch (error) {
      console.error(`Error predicting stability for ${selector}:`, error);
      return {
        selector,
        stabilityScore: 0.5,
        riskLevel: 'medium',
        riskFactors: ['Analysis failed'],
        confidence: 0.3,
        predictedFailureTime: 168,
        recommendedActions: ['Manual review recommended']
      };
    }
  }

  async extractSelectorFeatures(page, selector) {
    return await page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      
      if (elements.length === 0) {
        return {
          hasId: false,
          hasTestId: false,
          hasAriaLabel: false,
          complexity: sel.split(' ').length,
          isGeneric: sel.includes('div') || sel.includes('span'),
          isVisible: false,
          count: 0
        };
      }
      
      const element = elements[0];
      const rect = element.getBoundingClientRect();
      
      return {
        hasId: !!element.id,
        hasTestId: !!element.getAttribute('data-testid'),
        hasAriaLabel: !!element.getAttribute('aria-label'),
        complexity: sel.split(' ').length,
        isGeneric: element.tagName === 'DIV' || element.tagName === 'SPAN',
        isVisible: rect.width > 0 && rect.height > 0,
        count: elements.length
      };
    }, selector);
  }

  getHistoricalData(url, selector) {
    const key = `${url}:${selector}`;
    return this.selectorHistory.get(key) || {
      usageCount: 0,
      failureCount: 0,
      lastFailure: null,
      averageLifespan: 30,
      commonFailureReasons: []
    };
  }

  generatePageRecommendations(predictions, overallStability) {
    const recommendations = [];
    
    if (overallStability < 0.4) {
      recommendations.push('Critical page stability issues detected - comprehensive refactoring recommended');
    }
    
    const highRiskCount = predictions.filter(p => p.riskLevel === 'high').length;
    if (highRiskCount > 0) {
      recommendations.push(`${highRiskCount} high-risk selectors need immediate attention`);
    }
    
    const noStableIds = predictions.filter(p => 
      p.riskFactors.includes('No stable identifiers')
    ).length;
    if (noStableIds > 2) {
      recommendations.push('Add data-testid attributes to improve selector stability');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Page stability looks good');
    }
    
    return recommendations;
  }

  async recordSelectorUsage(url, selector, success) {
    const key = `${url}:${selector}`;
    const existing = this.selectorHistory.get(key) || {
      usageCount: 0,
      failureCount: 0,
      lastFailure: null,
      averageLifespan: 30,
      commonFailureReasons: []
    };
    
    existing.usageCount++;
    
    if (!success) {
      existing.failureCount++;
      existing.lastFailure = new Date();
    }
    
    this.selectorHistory.set(key, existing);
  }

  dispose() {
    this.selectorHistory.clear();
    this.pageChangeHistory.clear();
    this.isInitialized = false;
    console.log('🗑️ Predictive Failure Analyzer disposed');
  }
}

/**
 * Predictive Healing Service
 * Implements proactive healing with ML-based failure prediction
 */
class PredictiveHealingService {
  constructor() {
    this.analyzer = null;
    this.isInitialized = false;
    this.healingStats = {
      predictionsGenerated: 0,
      preventedFailures: 0,
      averageConfidence: 0
    };
  }

  async initialize() {
    try {
      console.log('🔮 Initializing Predictive Healing Service...');
      
      // Initialize Predictive Failure Analyzer
      this.analyzer = PredictiveFailureAnalyzer.getInstance();
      await this.analyzer.initialize();
      
      this.isInitialized = true;
      console.log('✅ Predictive Healing Service ready');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Predictive Healing Service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Analyze page for predictive healing opportunities
   */
  async analyzePageForPredictiveHealing(page, url) {
    if (!this.isInitialized) {
      console.warn('Predictive Healing Service not initialized');
      return null;
    }

    try {
      console.log(`🔍 Running predictive analysis for: ${url}`);
      
      const analysis = await this.analyzer.analyzePageStability(page, url);
      
      // Update statistics
      this.healingStats.predictionsGenerated += analysis.predictedFailures.length;
      
      if (analysis.predictedFailures.length > 0) {
        const avgConf = analysis.predictedFailures.reduce((sum, p) => sum + p.confidence, 0) / analysis.predictedFailures.length;
        this.healingStats.averageConfidence = (this.healingStats.averageConfidence + avgConf) / 2;
      }
      
      console.log(`✅ Predictive analysis complete: ${analysis.riskySelectorCount} risk factors identified`);
      return analysis;
      
    } catch (error) {
      console.error('❌ Error in predictive healing analysis:', error);
      return null;
    }
  }

  /**
   * Generate proactive healing recommendations
   */
  async generateProactiveHealing(page, url, riskThreshold = 0.6) {
    const analysis = await this.analyzePageForPredictiveHealing(page, url);
    
    if (!analysis) return [];
    
    const healingActions = [];
    
    for (const prediction of analysis.predictedFailures) {
      if (prediction.confidence > riskThreshold) {
        const healingAction = {
          selector: prediction.selector,
          riskLevel: prediction.riskLevel,
          confidence: prediction.confidence,
          predictedFailureTime: prediction.predictedFailureTime,
          recommendedActions: prediction.recommendedActions,
          strategy: 'predictive-healing',
          proactiveSteps: this.generateProactiveSteps(prediction)
        };
        
        healingActions.push(healingAction);
      }
    }
    
    return healingActions;
  }

  generateProactiveSteps(prediction) {
    const steps = [];
    
    if (prediction.riskFactors.includes('No stable identifiers')) {
      steps.push({
        action: 'enhance-selector',
        description: 'Add data-testid attribute for better stability',
        priority: 'high'
      });
    }
    
    if (prediction.riskFactors.includes('Complex selector structure')) {
      steps.push({
        action: 'simplify-selector',
        description: 'Refactor to use simpler, more stable selector',
        priority: 'medium'
      });
    }
    
    if (prediction.riskLevel === 'high') {
      steps.push({
        action: 'create-backup-selectors',
        description: 'Generate alternative selectors as fallbacks',
        priority: 'high'
      });
    }
    
    return steps;
  }

  /**
   * Record healing success for learning
   */
  async recordHealingOutcome(url, selector, success, actualFailureTime = null) {
    if (this.analyzer) {
      await this.analyzer.recordSelectorUsage(url, selector, success);
      
      if (success) {
        this.healingStats.preventedFailures++;
      }
    }
  }

  getStats() {
    return {
      ...this.healingStats,
      isInitialized: this.isInitialized,
      successRate: this.healingStats.predictionsGenerated > 0 ? 
        this.healingStats.preventedFailures / this.healingStats.predictionsGenerated : 0
    };
  }

  dispose() {
    if (this.analyzer) {
      this.analyzer.dispose();
    }
    this.isInitialized = false;
    console.log('🗑️ Predictive Healing Service disposed');
  }
}

// Export as default to match the import in HealingEngine.js
export default PredictiveHealingService;