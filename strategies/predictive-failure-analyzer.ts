import { ElementContext, HealingCandidate } from '../types';
import { BaseHealingStrategy } from './base-strategy';
import { Page } from '@playwright/test';

export interface SelectorStabilityPrediction {
  selector: string;
  stabilityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  confidence: number;
  predictedFailureTime: number; // hours until likely failure
  recommendedActions: string[];
}

export interface FailurePredictionFeatures {
  selectorComplexity: number;
  elementStability: number;
  parentStability: number;
  attributeReliability: number;
  domDepth: number;
  changeFrequency: number;
  usagePattern: number;
  historicalReliability: number;
}

/**
 * Predictive Failure Analysis Strategy
 * Predicts which selectors are likely to break and provides preemptive healing
 */
export class PredictiveFailureAnalyzerStrategy extends BaseHealingStrategy {
  private predictionCache = new Map<string, SelectorStabilityPrediction>();
  private selectorHistory = new Map<string, any>();
  private mlModel: any = null;

  constructor(page: Page) {
    super(page, 'predictive-failure-analyzer');
    this.priority = 95; // Very high priority for predictive healing
  }

  async generateCandidates(context: ElementContext): Promise<HealingCandidate[]> {
    try {
      console.log(`🔮 Running predictive failure analysis for: ${context.originalSelector}`);
      
      // First, analyze the current selector's stability
      const prediction = await this.analyzeSelectorStability(context);
      
      // Generate healing candidates based on prediction
      const candidates = await this.generatePredictiveHealing(context, prediction);
      
      // Cache the prediction for future use
      this.predictionCache.set(context.originalSelector, prediction);
      
      return candidates.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error in predictive failure analysis:', error);
      return [];
    }
  }

  /**
   * Analyze selector stability and predict failure probability
   */
  private async analyzeSelectorStability(context: ElementContext): Promise<SelectorStabilityPrediction> {
    const features = await this.extractPredictionFeatures(context);
    
    // Calculate stability score based on multiple factors
    const stabilityScore = this.calculateStabilityScore(features);
    const riskLevel = this.determineRiskLevel(stabilityScore);
    const confidence = this.calculateConfidence(features);
    
    // Predict when failure might occur (in hours)
    const predictedFailureTime = this.predictFailureTime(stabilityScore, features);
    
    // Generate risk factors and recommendations
    const riskFactors = this.identifyRiskFactors(features);
    const recommendedActions = this.generateRecommendations(riskFactors, features);
    
    return {
      selector: context.originalSelector,
      stabilityScore,
      riskLevel,
      riskFactors,
      confidence,
      predictedFailureTime,
      recommendedActions
    };
  }

  /**
   * Extract features for ML-based prediction
   */
  private async extractPredictionFeatures(context: ElementContext): Promise<FailurePredictionFeatures> {
    try {
      const element = this.page.locator(context.originalSelector).first();
      
      // Check if element exists
      const elementCount = await element.count();
      if (elementCount === 0) {
        // Element already missing - high failure indicators
        return {
          selectorComplexity: 1.0,
          elementStability: 0.0,
          parentStability: 0.0,
          attributeReliability: 0.0,
          domDepth: 1.0,
          changeFrequency: 1.0,
          usagePattern: 0.5,
          historicalReliability: 0.0
        };
      }

      const elementInfo = await element.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(el);
        
        return {
          id: el.id,
          className: el.className,
          tagName: el.tagName.toLowerCase(),
          hasStableAttributes: !!(el.id || el.getAttribute('data-testid') || el.getAttribute('aria-label')),
          isVisible: rect.width > 0 && rect.height > 0,
          position: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          domDepth: this.getDOMDepth(el),
          hasReliableParents: this.hasReliableParents(el),
          attributeCount: el.attributes.length,
          textContent: el.textContent?.trim() || '',
          isInteractive: ['button', 'input', 'select', 'textarea', 'a'].includes(el.tagName.toLowerCase()),
          hasNthChildSelector: /nth-child|nth-of-type/.test(context.originalSelector)
        };
      });

      // Calculate features
      const selectorComplexity = this.calculateSelectorComplexity(context.originalSelector);
      const elementStability = this.calculateElementStability(elementInfo);
      const parentStability = elementInfo.hasReliableParents ? 0.8 : 0.3;
      const attributeReliability = this.calculateAttributeReliability(elementInfo);
      const domDepth = Math.min(elementInfo.domDepth / 20, 1.0); // Normalize to 0-1
      const changeFrequency = this.estimateChangeFrequency(context.originalSelector);
      const usagePattern = this.analyzeUsagePattern(context.originalSelector);
      const historicalReliability = this.getHistoricalReliability(context.originalSelector);

      return {
        selectorComplexity,
        elementStability,
        parentStability,
        attributeReliability,
        domDepth,
        changeFrequency,
        usagePattern,
        historicalReliability
      };
    } catch (error) {
      console.error('Error extracting prediction features:', error);
      // Return default risky features
      return {
        selectorComplexity: 0.8,
        elementStability: 0.2,
        parentStability: 0.2,
        attributeReliability: 0.3,
        domDepth: 0.8,
        changeFrequency: 0.7,
        usagePattern: 0.5,
        historicalReliability: 0.3
      };
    }
  }

  /**
   * Calculate selector complexity (higher = more likely to break)
   */
  private calculateSelectorComplexity(selector: string): number {
    let complexity = 0;
    
    // Length penalty
    complexity += Math.min(selector.length / 100, 0.3);
    
    // XPath penalty
    if (selector.startsWith('//') || selector.includes('xpath')) {
      complexity += 0.4;
    }
    
    // CSS complexity
    const cssComplexityFactors = [
      /nth-child|nth-of-type/.test(selector) ? 0.3 : 0,
      (selector.match(/>/g) || []).length * 0.1, // Child combinators
      (selector.match(/\+/g) || []).length * 0.15, // Adjacent combinators
      (selector.match(/~/g) || []).length * 0.15, // General sibling combinators
      (selector.match(/\[.*?\]/g) || []).length * 0.05 // Attribute selectors
    ];
    
    complexity += cssComplexityFactors.reduce((sum, factor) => sum + factor, 0);
    
    return Math.min(complexity, 1.0);
  }

  /**
   * Calculate element stability score
   */
  private calculateElementStability(elementInfo: any): number {
    let stability = 0.5; // Base stability
    
    // Positive stability factors
    if (elementInfo.hasStableAttributes) stability += 0.3;
    if (elementInfo.isVisible) stability += 0.2;
    if (elementInfo.isInteractive) stability += 0.1;
    if (elementInfo.textContent.length > 0) stability += 0.1;
    
    // Negative stability factors
    if (elementInfo.hasNthChildSelector) stability -= 0.3;
    if (elementInfo.attributeCount < 2) stability -= 0.2;
    if (!elementInfo.id && !elementInfo.className) stability -= 0.3;
    
    return Math.max(0, Math.min(1, stability));
  }

  /**
   * Calculate attribute reliability
   */
  private calculateAttributeReliability(elementInfo: any): number {
    let reliability = 0;
    
    // High reliability attributes
    if (elementInfo.id) reliability += 0.4;
    if (elementInfo.className && elementInfo.className.includes('test')) reliability += 0.3;
    if (elementInfo.hasStableAttributes) reliability += 0.3;
    
    return Math.min(reliability, 1.0);
  }

  /**
   * Estimate how frequently this selector changes
   */
  private estimateChangeFrequency(selector: string): number {
    // This would ideally use historical data
    // For now, use heuristics
    
    if (selector.includes('nth-child') || selector.includes('nth-of-type')) {
      return 0.8; // High change frequency
    }
    
    if (selector.startsWith('#') || selector.includes('data-testid')) {
      return 0.1; // Low change frequency
    }
    
    if (selector.includes('class') && selector.split('.').length > 3) {
      return 0.6; // Medium-high change frequency
    }
    
    return 0.5; // Default medium frequency
  }

  /**
   * Analyze usage patterns
   */
  private analyzeUsagePattern(selector: string): number {
    // This would track how often the selector is used
    // For now, return a baseline
    return 0.5;
  }

  /**
   * Get historical reliability data
   */
  private getHistoricalReliability(selector: string): number {
    const history = this.selectorHistory.get(selector);
    if (!history) return 0.5;
    
    const successRate = history.successes / (history.successes + history.failures);
    return successRate;
  }

  /**
   * Calculate overall stability score
   */
  private calculateStabilityScore(features: FailurePredictionFeatures): number {
    const weights = {
      selectorComplexity: -0.25,
      elementStability: 0.3,
      parentStability: 0.15,
      attributeReliability: 0.2,
      domDepth: -0.1,
      changeFrequency: -0.2,
      usagePattern: 0.1,
      historicalReliability: 0.2
    };
    
    let score = 0.5; // Base score
    
    Object.entries(weights).forEach(([feature, weight]) => {
      score += features[feature as keyof FailurePredictionFeatures] * weight;
    });
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Determine risk level based on stability score
   */
  private determineRiskLevel(stabilityScore: number): 'low' | 'medium' | 'high' {
    if (stabilityScore >= 0.7) return 'low';
    if (stabilityScore >= 0.4) return 'medium';
    return 'high';
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(features: FailurePredictionFeatures): number {
    // Higher confidence when we have more data
    let confidence = 0.5;
    
    if (features.historicalReliability > 0.5) confidence += 0.2;
    if (features.attributeReliability > 0.5) confidence += 0.2;
    if (features.elementStability > 0.5) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Predict when failure might occur
   */
  private predictFailureTime(stabilityScore: number, features: FailurePredictionFeatures): number {
    // Lower stability = sooner failure
    const baseTime = stabilityScore * 168; // Base: 0-168 hours (1 week)
    
    // Adjust based on change frequency
    const adjustedTime = baseTime * (1 - features.changeFrequency);
    
    return Math.max(1, adjustedTime); // At least 1 hour
  }

  /**
   * Identify specific risk factors
   */
  private identifyRiskFactors(features: FailurePredictionFeatures): string[] {
    const factors: string[] = [];
    
    if (features.selectorComplexity > 0.6) {
      factors.push('Complex selector structure');
    }
    
    if (features.elementStability < 0.4) {
      factors.push('Unstable element properties');
    }
    
    if (features.attributeReliability < 0.5) {
      factors.push('Unreliable element attributes');
    }
    
    if (features.domDepth > 0.7) {
      factors.push('Deep DOM nesting');
    }
    
    if (features.changeFrequency > 0.6) {
      factors.push('High page change frequency');
    }
    
    return factors;
  }

  /**
   * Generate specific recommendations
   */
  private generateRecommendations(riskFactors: string[], features: FailurePredictionFeatures): string[] {
    const recommendations: string[] = [];
    
    if (riskFactors.includes('Complex selector structure')) {
      recommendations.push('Simplify selector by using ID or data-testid attributes');
    }
    
    if (riskFactors.includes('Unreliable element attributes')) {
      recommendations.push('Add stable attributes like data-testid to the element');
    }
    
    if (riskFactors.includes('Deep DOM nesting')) {
      recommendations.push('Use more specific selectors to reduce DOM dependency');
    }
    
    if (riskFactors.includes('High page change frequency')) {
      recommendations.push('Monitor page changes and update selectors proactively');
    }
    
    if (features.historicalReliability < 0.3) {
      recommendations.push('Consider alternative locating strategies');
    }
    
    return recommendations;
  }

  /**
   * Generate healing candidates based on prediction
   */
  private async generatePredictiveHealing(
    context: ElementContext, 
    prediction: SelectorStabilityPrediction
  ): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    
    try {
      // If high risk, generate multiple alternatives
      if (prediction.riskLevel === 'high') {
        console.log(`⚠️ High-risk selector detected: ${context.originalSelector}`);
        
        // Try to find the element and generate alternatives
        const element = this.page.locator(context.originalSelector).first();
        const elementCount = await element.count();
        
        if (elementCount > 0) {
          // Generate multiple healing strategies
          const alternatives = await this.generateAlternativeSelectors(element);
          
          alternatives.forEach((alternative, index) => {
            candidates.push({
              selector: alternative,
              confidence: Math.max(0.6 - (index * 0.1), 0.3), // Decreasing confidence
              reasoning: `Predictive healing alternative #${index + 1}`,
              method: 'predictive-analysis',
              metadata: {
                originalRisk: prediction.riskLevel,
                predictedFailureTime: prediction.predictedFailureTime,
                riskFactors: prediction.riskFactors
              }
            });
          });
        }
      }
      
      // Add fallback candidates
      candidates.push({
        selector: context.originalSelector,
        confidence: prediction.stabilityScore,
        reasoning: `Original selector (predicted ${prediction.riskLevel} risk)`,
        method: 'predictive-stability',
        metadata: prediction
      });
      
    } catch (error) {
      console.error('Error generating predictive healing candidates:', error);
    }
    
    return candidates;
  }

  /**
   * Generate alternative selectors for an element
   */
  private async generateAlternativeSelectors(element: any): Promise<string[]> {
    try {
      const alternatives: string[] = [];
      
      const elementInfo = await element.evaluate((el: Element) => ({
        id: el.id,
        'data-testid': el.getAttribute('data-testid'),
        'aria-label': el.getAttribute('aria-label'),
        textContent: el.textContent?.trim(),
        tagName: el.tagName.toLowerCase(),
        className: el.className,
        type: el.getAttribute('type'),
        name: el.getAttribute('name'),
        role: el.getAttribute('role')
      }));
      
      // ID selector (highest priority)
      if (elementInfo.id) {
        alternatives.push(`#${elementInfo.id}`);
      }
      
      // Data-testid selector
      if (elementInfo['data-testid']) {
        alternatives.push(`[data-testid="${elementInfo['data-testid']}"]`);
      }
      
      // Aria-label selector
      if (elementInfo['aria-label']) {
        alternatives.push(`[aria-label="${elementInfo['aria-label']}"]`);
      }
      
      // Text selector
      if (elementInfo.textContent && elementInfo.textContent.length < 50) {
        alternatives.push(`text="${elementInfo.textContent}"`);
      }
      
      // Attribute selectors
      if (elementInfo.name) {
        alternatives.push(`[name="${elementInfo.name}"]`);
      }
      
      if (elementInfo.type) {
        alternatives.push(`${elementInfo.tagName}[type="${elementInfo.type}"]`);
      }
      
      if (elementInfo.role) {
        alternatives.push(`[role="${elementInfo.role}"]`);
      }
      
      return alternatives.slice(0, 5); // Limit to top 5 alternatives
    } catch (error) {
      console.error('Error generating alternative selectors:', error);
      return [];
    }
  }
}

export default PredictiveFailureAnalyzerStrategy;