import * as tf from '@tensorflow/tfjs';
import { Page } from '@playwright/test';
import { ElementContext } from '../types';

export interface SelectorStabilityPrediction {
  selector: string;
  stabilityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  confidence: number;
  predictedFailureTime: number; // hours until likely failure
  recommendedActions: string[];
  historicalData?: SelectorHistoryData;
}

export interface SelectorHistoryData {
  usageCount: number;
  failureCount: number;
  lastFailure: Date | null;
  averageLifespan: number; // days
  commonFailureReasons: string[];
  pageChangeCorrelation: number;
}

export interface PageStabilityReport {
  overallStability: number;
  riskySelectorCount: number;
  predictedFailures: SelectorStabilityPrediction[];
  recommendations: string[];
  analysisTimestamp: Date;
}

export class PredictiveFailureAnalyzer {
  private static instance: PredictiveFailureAnalyzer;
  private predictionModel: tf.LayersModel | null = null;
  private stabilityModel: tf.LayersModel | null = null;
  private isInitialized = false;
  private selectorHistory = new Map<string, SelectorHistoryData>();
  private pageChangeHistory = new Map<string, number[]>();

  private constructor() {}

  static getInstance(): PredictiveFailureAnalyzer {
    if (!PredictiveFailureAnalyzer.instance) {
      PredictiveFailureAnalyzer.instance = new PredictiveFailureAnalyzer();
    }
    return PredictiveFailureAnalyzer.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await tf.ready();
      
      // Create predictive models
      await this.createPredictionModel();
      await this.createStabilityModel();
      
      // Load historical data
      await this.loadHistoricalData();
      
      this.isInitialized = true;
      console.log('🔮 Predictive Failure Analyzer initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Predictive Failure Analyzer:', error);
      throw error;
    }
  }

  private async createPredictionModel() {
    // Neural network for predicting selector failure probability
    this.predictionModel = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [15], // Feature vector size
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Failure probability
      ]
    });

    this.predictionModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
  }

  private async createStabilityModel() {
    // LSTM model for analyzing temporal patterns
    this.stabilityModel = tf.sequential({
      layers: [
        tf.layers.lstm({
          inputShape: [10, 8], // 10 time steps, 8 features
          units: 32,
          returnSequences: true
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.lstm({ units: 16 }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'linear' }) // Stability score
      ]
    });

    this.stabilityModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
  }

  async analyzePageStability(page: Page, url: string): Promise<PageStabilityReport> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`📊 Analyzing page stability for: ${url}`);
      
      // Get all selectors currently in use
      const currentSelectors = await this.extractPageSelectors(page);
      
      // Analyze each selector
      const predictions: SelectorStabilityPrediction[] = [];
      
      for (const selector of currentSelectors) {
        const prediction = await this.predictSelectorStability(page, selector, url);
        predictions.push(prediction);
      }

      // Generate overall page report
      const report = this.generateStabilityReport(predictions, url);
      
      // Update page change history
      this.updatePageChangeHistory(url, predictions.length);
      
      return report;
    } catch (error) {
      console.error('Error analyzing page stability:', error);
      throw error;
    }
  }

  private async extractPageSelectors(page: Page): Promise<string[]> {
    return await page.evaluate(() => {
      const selectors: string[] = [];
      
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
      
      return [...new Set(selectors)].slice(0, 50); // Limit to 50 selectors
    });
  }

  async predictSelectorStability(
    page: Page, 
    selector: string, 
    url: string
  ): Promise<SelectorStabilityPrediction> {
    try {
      // Extract features for ML prediction
      const features = await this.extractSelectorFeatures(page, selector, url);
      
      // Get historical data
      const historicalData = this.selectorHistory.get(`${url}:${selector}`) || {
        usageCount: 0,
        failureCount: 0,
        lastFailure: null,
        averageLifespan: 30,
        commonFailureReasons: [],
        pageChangeCorrelation: 0
      };

      // Predict failure probability
      const featureTensor = tf.tensor2d([features]);
      const prediction = this.predictionModel!.predict(featureTensor) as tf.Tensor;
      const failureProbability = prediction.dataSync()[0];
      
      // Calculate stability score (inverse of failure probability)
      const stabilityScore = 1 - failureProbability;
      
      // Determine risk level
      const riskLevel = this.calculateRiskLevel(failureProbability);
      
      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(features, historicalData);
      
      // Predict failure time
      const predictedFailureTime = this.predictFailureTime(
        failureProbability, 
        historicalData
      );
      
      // Generate recommendations
      const recommendedActions = this.generateRecommendations(
        riskLevel, 
        riskFactors, 
        selector
      );

      // Clean up tensors
      featureTensor.dispose();
      prediction.dispose();

      return {
        selector,
        stabilityScore,
        riskLevel,
        riskFactors,
        confidence: 0.8 + (stabilityScore * 0.2), // Base confidence + stability bonus
        predictedFailureTime,
        recommendedActions,
        historicalData
      };
    } catch (error) {
      console.error(`Error predicting stability for ${selector}:`, error);
      
      // Return safe fallback prediction
      return {
        selector,
        stabilityScore: 0.5,
        riskLevel: 'medium',
        riskFactors: ['Analysis failed'],
        confidence: 0.3,
        predictedFailureTime: 168, // 1 week default
        recommendedActions: ['Manual review recommended']
      };
    }
  }

  private async extractSelectorFeatures(
    page: Page, 
    selector: string, 
    url: string
  ): Promise<number[]> {
    const features = await page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      
      if (elements.length === 0) {
        return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      }
      
      const element = elements[0];
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return [
        elements.length, // Selector specificity (lower = more specific)
        rect.width > 0 && rect.height > 0 ? 1 : 0, // Visibility
        element.id ? 1 : 0, // Has ID
        element.getAttribute('data-testid') ? 1 : 0, // Has test ID
        element.className ? element.className.split(' ').length : 0, // Class count
        sel.includes('#') ? 1 : 0, // Is ID selector
        sel.includes('[data-testid') ? 1 : 0, // Is test ID selector  
        sel.includes('.') ? 1 : 0, // Is class selector
        sel.split(' ').length, // Selector complexity
        element.children.length, // Child element count
        style.position === 'absolute' || style.position === 'fixed' ? 1 : 0, // Positioned
        parseFloat(style.zIndex) || 0, // Z-index (normalized to 0-1)
        element.tagName === 'DIV' ? 1 : 0, // Generic container
        element.textContent ? element.textContent.length : 0, // Text content length
        Date.now() % 1000 / 1000 // Time factor (normalized)
      ];
    }, selector);
    
    // Add historical features
    const history = this.selectorHistory.get(`${url}:${selector}`);
    const historicalFeatures = history ? [
      history.usageCount / 100, // Normalized usage
      history.failureCount / Math.max(history.usageCount, 1), // Failure rate
      history.averageLifespan / 365, // Normalized lifespan
      history.pageChangeCorrelation
    ] : [0, 0, 0.1, 0]; // Default values
    
    return [...features.slice(0, 11), ...historicalFeatures]; // 15 features total
  }

  private calculateRiskLevel(failureProbability: number): 'low' | 'medium' | 'high' {
    if (failureProbability < 0.3) return 'low';
    if (failureProbability < 0.7) return 'medium';
    return 'high';
  }

  private identifyRiskFactors(features: number[], history: SelectorHistoryData): string[] {
    const factors: string[] = [];
    
    // Feature-based risk factors
    if (features[0] > 10) factors.push('Low selector specificity');
    if (features[1] === 0) factors.push('Element not visible');
    if (features[2] === 0 && features[3] === 0) factors.push('No stable identifiers');
    if (features[8] > 5) factors.push('Complex selector structure');
    if (features[10] === 1) factors.push('Absolutely positioned element');
    if (features[12] === 1) factors.push('Generic container element');
    
    // Historical risk factors
    if (history.failureCount > 0) {
      factors.push(`${history.failureCount} previous failures`);
    }
    if (history.pageChangeCorrelation > 0.5) {
      factors.push('Correlated with page changes');
    }
    if (history.averageLifespan < 7) {
      factors.push('Short historical lifespan');
    }
    
    return factors;
  }

  private predictFailureTime(
    failureProbability: number, 
    history: SelectorHistoryData
  ): number {
    // Base prediction on failure probability
    let baseTime = 168; // 1 week default
    
    if (failureProbability > 0.8) baseTime = 24; // 1 day
    else if (failureProbability > 0.6) baseTime = 72; // 3 days
    else if (failureProbability > 0.4) baseTime = 168; // 1 week
    else if (failureProbability > 0.2) baseTime = 720; // 1 month
    else baseTime = 2160; // 3 months
    
    // Adjust based on historical data
    if (history.averageLifespan > 0) {
      const historicalFactor = history.averageLifespan * 24; // Convert days to hours
      baseTime = (baseTime + historicalFactor) / 2; // Average with historical data
    }
    
    return Math.max(baseTime, 1); // Minimum 1 hour
  }

  private generateRecommendations(
    riskLevel: 'low' | 'medium' | 'high',
    riskFactors: string[],
    selector: string
  ): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'high') {
      recommendations.push('Immediate attention required');
      recommendations.push('Consider adding data-testid attribute');
      recommendations.push('Schedule for refactoring');
    }
    
    if (riskLevel === 'medium') {
      recommendations.push('Monitor closely');
      recommendations.push('Prepare backup selectors');
    }
    
    // Specific recommendations based on risk factors
    if (riskFactors.some(f => f.includes('specificity'))) {
      recommendations.push('Use more specific selector');
    }
    
    if (riskFactors.some(f => f.includes('stable identifiers'))) {
      recommendations.push('Add ID or data-testid attribute');
    }
    
    if (riskFactors.some(f => f.includes('complex'))) {
      recommendations.push('Simplify selector structure');
    }
    
    if (riskFactors.some(f => f.includes('positioned'))) {
      recommendations.push('Monitor for layout changes');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Selector appears stable');
    }
    
    return recommendations;
  }

  private generateStabilityReport(
    predictions: SelectorStabilityPrediction[],
    url: string
  ): PageStabilityReport {
    const highRiskSelectors = predictions.filter(p => p.riskLevel === 'high');
    const mediumRiskSelectors = predictions.filter(p => p.riskLevel === 'medium');
    
    const overallStability = predictions.reduce((sum, p) => sum + p.stabilityScore, 0) / predictions.length;
    
    const recommendations: string[] = [];
    
    if (highRiskSelectors.length > 0) {
      recommendations.push(`${highRiskSelectors.length} high-risk selectors need immediate attention`);
    }
    
    if (mediumRiskSelectors.length > predictions.length * 0.5) {
      recommendations.push('Consider adding more stable selectors (data-testid, IDs)');
    }
    
    if (overallStability < 0.6) {
      recommendations.push('Page has low overall stability - comprehensive refactoring recommended');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Page stability looks good');
    }
    
    return {
      overallStability,
      riskySelectorCount: highRiskSelectors.length + mediumRiskSelectors.length,
      predictedFailures: predictions.filter(p => p.riskLevel !== 'low'),
      recommendations,
      analysisTimestamp: new Date()
    };
  }

  async recordSelectorUsage(url: string, selector: string, success: boolean) {
    const key = `${url}:${selector}`;
    const existing = this.selectorHistory.get(key) || {
      usageCount: 0,
      failureCount: 0,
      lastFailure: null,
      averageLifespan: 30,
      commonFailureReasons: [],
      pageChangeCorrelation: 0
    };
    
    existing.usageCount++;
    
    if (!success) {
      existing.failureCount++;
      existing.lastFailure = new Date();
    }
    
    this.selectorHistory.set(key, existing);
    
    // Persist to storage periodically
    if (existing.usageCount % 10 === 0) {
      await this.persistHistoricalData();
    }
  }

  private updatePageChangeHistory(url: string, selectorCount: number) {
    const history = this.pageChangeHistory.get(url) || [];
    history.push(selectorCount);
    
    // Keep only last 10 measurements
    if (history.length > 10) {
      history.shift();
    }
    
    this.pageChangeHistory.set(url, history);
  }

  private async loadHistoricalData() {
    try {
      // In a real implementation, this would load from persistent storage
      console.log('📚 Loading historical selector data...');
      // Placeholder for actual data loading
    } catch (error) {
      console.warn('Could not load historical data:', error);
    }
  }

  private async persistHistoricalData() {
    try {
      console.log('💾 Persisting selector history data...');
      // In a real implementation, this would save to persistent storage
    } catch (error) {
      console.warn('Could not persist historical data:', error);
    }
  }

  dispose() {
    if (this.predictionModel) {
      this.predictionModel.dispose();
    }
    if (this.stabilityModel) {
      this.stabilityModel.dispose();
    }
    this.isInitialized = false;
    console.log('🗑️ Predictive Failure Analyzer disposed');
  }
}