import { Page } from '@playwright/test';
import { ElementContext, HealingCandidate } from '../types';
import { BaseHealingStrategy } from './base-strategy';
import { PredictiveFailureAnalyzer, SelectorStabilityPrediction } from '../src/ai/predictive-failure-analyzer';

export class ProactiveHealingStrategy extends BaseHealingStrategy {
  private predictiveAnalyzer: PredictiveFailureAnalyzer;
  private preemptiveSelectors = new Map<string, string[]>();
  private analysisCache = new Map<string, SelectorStabilityPrediction[]>();

  constructor(page: Page) {
    super(page, 'proactive-healing');
    this.priority = 10; // Highest priority for proactive healing
    this.predictiveAnalyzer = PredictiveFailureAnalyzer.getInstance();
  }

  async generateCandidates(context: ElementContext): Promise<HealingCandidate[]> {
    try {
      // First, check if we have pre-computed alternatives for this selector
      const preemptiveAlternatives = await this.getPreemptiveAlternatives(context.originalSelector);
      
      if (preemptiveAlternatives.length > 0) {
        console.log(`🚀 Using pre-computed healing candidates for ${context.originalSelector}`);
        return preemptiveAlternatives;
      }

      // If no pre-computed alternatives, run predictive analysis
      const url = this.page.url();
      const prediction = await this.predictiveAnalyzer.predictSelectorStability(
        this.page, 
        context.originalSelector, 
        url
      );

      // Generate healing candidates based on prediction
      const candidates = await this.generatePredictiveHealingCandidates(context, prediction);
      
      return candidates.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error in proactive healing strategy:', error);
      return [];
    }
  }

  /**
   * Proactively analyze page and prepare healing alternatives before failures occur
   */
  async preparePreemptiveHealing(): Promise<void> {
    try {
      const url = this.page.url();
      console.log(`🔮 Preparing preemptive healing for: ${url}`);

      // Run full page stability analysis
      const stabilityReport = await this.predictiveAnalyzer.analyzePageStability(this.page, url);
      
      // Focus on risky selectors
      const riskySelectorPredictions = stabilityReport.predictedFailures.filter(
        p => p.riskLevel === 'high' || p.riskLevel === 'medium'
      );

      console.log(`⚠️ Found ${riskySelectorPredictions.length} risky selectors`);

      // Generate alternative selectors for each risky selector
      for (const prediction of riskySelectorPredictions) {
        await this.generateAlternativeSelectors(prediction);
      }

      // Cache the analysis results
      this.analysisCache.set(url, riskySelectorPredictions);
      
      console.log(`✅ Preemptive healing prepared for ${riskySelectorPredictions.length} selectors`);
    } catch (error) {
      console.error('Error preparing preemptive healing:', error);
    }
  }

  private async generateAlternativeSelectors(prediction: SelectorStabilityPrediction): Promise<void> {
    const alternatives: string[] = [];
    
    try {
      // Try to find the element first
      const elements = await this.page.locator(prediction.selector).all();
      
      if (elements.length === 0) {
        console.warn(`Element not found for selector: ${prediction.selector}`);
        return;
      }

      const element = elements[0];

      // Generate multiple alternative selectors
      const elementInfo = await element.evaluate((el) => {
        return {
          id: el.id,
          tagName: el.tagName.toLowerCase(),
          className: el.className,
          textContent: el.textContent?.trim(),
          'data-testid': el.getAttribute('data-testid'),
          'aria-label': el.getAttribute('aria-label'),
          type: el.getAttribute('type'),
          role: el.getAttribute('role'),
          name: el.getAttribute('name'),
          placeholder: el.getAttribute('placeholder'),
          title: el.getAttribute('title')
        };
      });

      // Generate ID-based selector (highest priority)
      if (elementInfo.id) {
        alternatives.push(`#${elementInfo.id}`);
      }

      // Generate data-testid selector (second highest priority)
      if (elementInfo['data-testid']) {
        alternatives.push(`[data-testid="${elementInfo['data-testid']}"]`);
      }

      // Generate aria-label selector
      if (elementInfo['aria-label']) {
        alternatives.push(`[aria-label="${elementInfo['aria-label']}"]`);
      }

      // Generate text-based selector
      if (elementInfo.textContent && elementInfo.textContent.length < 50) {
        alternatives.push(`text="${elementInfo.textContent}"`);
        alternatives.push(`text=${elementInfo.textContent}`);
      }

      // Generate attribute-based selectors
      if (elementInfo.type) {
        alternatives.push(`${elementInfo.tagName}[type="${elementInfo.type}"]`);
      }

      if (elementInfo.name) {
        alternatives.push(`[name="${elementInfo.name}"]`);
      }

      if (elementInfo.placeholder) {
        alternatives.push(`[placeholder="${elementInfo.placeholder}"]`);
      }

      if (elementInfo.role) {
        alternatives.push(`[role="${elementInfo.role}"]`);
      }

      // Generate class-based selectors (be careful with these)
      if (elementInfo.className) {
        const classes = elementInfo.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
          // Try single class first
          alternatives.push(`.${classes[0]}`);
          
          // Try tag + class combination
          alternatives.push(`${elementInfo.tagName}.${classes[0]}`);
          
          // Try multiple classes if stable-looking
          if (classes.length > 1 && classes.some(c => c.includes('btn') || c.includes('button') || c.includes('input'))) {
            alternatives.push(`.${classes.slice(0, 2).join('.')}`);
          }
        }
      }

      // Generate XPath alternatives
      const xpath = await element.evaluate((el) => {
        let path = '';
        let currentElement = el;
        
        while (currentElement && currentElement !== document.body) {
          let selector = currentElement.tagName.toLowerCase();
          
          if (currentElement.id) {
            path = `//*[@id="${currentElement.id}"]` + path;
            break;
          }
          
          // Add position if needed
          const siblings = Array.from(currentElement.parentElement?.children || [])
            .filter(sibling => sibling.tagName === currentElement.tagName);
          
          if (siblings.length > 1) {
            const index = siblings.indexOf(currentElement) + 1;
            selector += `[${index}]`;
          }
          
          path = '/' + selector + path;
          currentElement = currentElement.parentElement;
        }
        
        return path ? '//' + path.substring(1) : null;
      });

      if (xpath) {
        alternatives.push(xpath);
      }

      // Validate alternatives by testing them
      const validAlternatives: string[] = [];
      
      for (const alternative of alternatives) {
        try {
          const count = await this.page.locator(alternative).count();
          if (count === 1) { // Prefer unique selectors
            validAlternatives.push(alternative);
          } else if (count > 1 && validAlternatives.length < 3) {
            // Allow non-unique selectors if we don't have enough alternatives
            validAlternatives.push(alternative);
          }
        } catch (error) {
          // Skip invalid selectors
          continue;
        }
      }

      if (validAlternatives.length > 0) {
        this.preemptiveSelectors.set(prediction.selector, validAlternatives);
        console.log(`🛡️ Generated ${validAlternatives.length} alternatives for ${prediction.selector}`);
      }

    } catch (error) {
      console.error(`Error generating alternatives for ${prediction.selector}:`, error);
    }
  }

  private async getPreemptiveAlternatives(originalSelector: string): Promise<HealingCandidate[]> {
    const alternatives = this.preemptiveSelectors.get(originalSelector);
    
    if (!alternatives || alternatives.length === 0) {
      return [];
    }

    const candidates: HealingCandidate[] = [];
    
    for (let i = 0; i < alternatives.length; i++) {
      const alternative = alternatives[i];
      
      try {
        // Test if the alternative selector still works
        const element = this.page.locator(alternative).first();
        const count = await element.count();
        
        if (count > 0) {
          // Calculate confidence based on selector type and position in alternatives
          let confidence = 0.9 - (i * 0.1); // Decrease confidence for later alternatives
          
          // Boost confidence for stable selector types
          if (alternative.includes('#')) confidence += 0.05; // ID selector
          if (alternative.includes('data-testid')) confidence += 0.04; // Test ID
          if (alternative.includes('aria-label')) confidence += 0.03; // Aria label
          
          confidence = Math.min(confidence, 0.95); // Cap at 95%
          
          candidates.push({
            selector: alternative,
            strategy: this.name,
            score: confidence,
            confidence,
            features: {
              preemptive: 1.0,
              selectorType: this.getSelectorType(alternative),
              position: i,
              validated: 1.0
            },
            reasoning: `Preemptive healing candidate #${i + 1} - ${this.getSelectorTypeDescription(alternative)}`,
            metadata: {
              originalSelector,
              alternativeIndex: i,
              generatedProactively: true
            }
          });
        }
      } catch (error) {
        console.warn(`Alternative selector failed validation: ${alternative}`, error);
        continue;
      }
    }
    
    return candidates;
  }

  private getSelectorType(selector: string): number {
    if (selector.includes('#')) return 1.0; // ID
    if (selector.includes('data-testid')) return 0.9; // Test ID
    if (selector.includes('aria-label')) return 0.8; // Aria label
    if (selector.startsWith('text=')) return 0.7; // Text
    if (selector.includes('[')) return 0.6; // Attribute
    if (selector.includes('.')) return 0.4; // Class
    if (selector.startsWith('//')) return 0.3; // XPath
    return 0.2; // Other
  }

  private getSelectorTypeDescription(selector: string): string {
    if (selector.includes('#')) return 'ID-based selector';
    if (selector.includes('data-testid')) return 'Test ID selector';
    if (selector.includes('aria-label')) return 'Accessibility label selector';
    if (selector.startsWith('text=')) return 'Text content selector';
    if (selector.includes('[') && !selector.includes('data-testid')) return 'Attribute selector';
    if (selector.includes('.')) return 'CSS class selector';
    if (selector.startsWith('//')) return 'XPath selector';
    return 'Generic selector';
  }

  private async generatePredictiveHealingCandidates(
    context: ElementContext, 
    prediction: SelectorStabilityPrediction
  ): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];

    // Generate candidates based on risk factors and recommendations
    for (const recommendation of prediction.recommendedActions) {
      if (recommendation.includes('data-testid')) {
        // Try to find elements with similar text content that have data-testid
        const testIdCandidates = await this.findSimilarElementsWithTestId(context);
        candidates.push(...testIdCandidates);
      }
      
      if (recommendation.includes('specific selector')) {
        // Generate more specific selectors
        const specificCandidates = await this.generateMoreSpecificSelectors(context);
        candidates.push(...specificCandidates);
      }
    }

    // Add fallback candidates based on element context
    const fallbackCandidates = await this.generateFallbackCandidates(context, prediction);
    candidates.push(...fallbackCandidates);

    return candidates;
  }

  private async findSimilarElementsWithTestId(context: ElementContext): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    
    try {
      const elements = await this.page.locator('[data-testid]').all();
      
      for (const element of elements) {
        const testId = await element.getAttribute('data-testid');
        const textContent = await element.textContent();
        
        if (testId && textContent && context.textContent) {
          const textSimilarity = this.calculateTextSimilarity(context.textContent, textContent);
          
          if (textSimilarity > 0.6) {
            candidates.push({
              selector: `[data-testid="${testId}"]`,
              strategy: this.name,
              score: 0.8 + (textSimilarity * 0.2),
              confidence: 0.8 + (textSimilarity * 0.2),
              features: {
                predictive: 1.0,
                textSimilarity,
                hasTestId: 1.0
              },
              reasoning: `Found similar element with test ID (${(textSimilarity * 100).toFixed(1)}% text similarity)`
            });
          }
        }
      }
    } catch (error) {
      console.warn('Error finding similar elements with test ID:', error);
    }
    
    return candidates;
  }

  private async generateMoreSpecificSelectors(context: ElementContext): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    
    try {
      // Try to make the selector more specific by adding parent context
      const parentSelector = await this.page.evaluate((originalSelector) => {
        const elements = document.querySelectorAll(originalSelector);
        if (elements.length === 1 || elements.length === 0) return null;
        
        const element = elements[0];
        const parent = element.parentElement;
        
        if (parent && parent.tagName !== 'BODY') {
          const parentClasses = parent.className ? parent.className.split(' ')[0] : '';
          const parentId = parent.id;
          
          if (parentId) {
            return `#${parentId} ${originalSelector}`;
          } else if (parentClasses) {
            return `.${parentClasses} ${originalSelector}`;
          } else {
            return `${parent.tagName.toLowerCase()} ${originalSelector}`;
          }
        }
        
        return null;
      }, context.originalSelector);
      
      if (parentSelector) {
        const count = await this.page.locator(parentSelector).count();
        if (count === 1) {
          candidates.push({
            selector: parentSelector,
            strategy: this.name,
            score: 0.85,
            confidence: 0.85,
            features: {
              predictive: 1.0,
              specificity: 1.0,
              parentContext: 1.0
            },
            reasoning: 'More specific selector using parent context'
          });
        }
      }
    } catch (error) {
      console.warn('Error generating more specific selectors:', error);
    }
    
    return candidates;
  }

  private async generateFallbackCandidates(
    context: ElementContext, 
    prediction: SelectorStabilityPrediction
  ): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    
    // Generate fallback based on prediction confidence
    const baseConfidence = Math.max(0.3, 1 - prediction.stabilityScore);
    
    // Try tag-based selector
    if (context.tagName) {
      candidates.push({
        selector: context.tagName,
        strategy: this.name,
        score: baseConfidence * 0.5,
        confidence: baseConfidence * 0.5,
        features: {
          predictive: 1.0,
          fallback: 1.0,
          tagBased: 1.0
        },
        reasoning: 'Fallback tag-based selector'
      });
    }
    
    return candidates;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  /**
   * Get preemptive healing statistics
   */
  getStatistics() {
    return {
      preemptiveSelectorCount: this.preemptiveSelectors.size,
      cachedAnalysisCount: this.analysisCache.size,
      totalAlternatives: Array.from(this.preemptiveSelectors.values())
        .reduce((sum, alternatives) => sum + alternatives.length, 0)
    };
  }

  /**
   * Clear cached data for a specific URL
   */
  clearCache(url?: string) {
    if (url) {
      // Clear cache for specific URL
      const keysToDelete = Array.from(this.preemptiveSelectors.keys())
        .filter(key => key.includes(url));
      
      keysToDelete.forEach(key => this.preemptiveSelectors.delete(key));
      this.analysisCache.delete(url);
    } else {
      // Clear all caches
      this.preemptiveSelectors.clear();
      this.analysisCache.clear();
    }
  }
}