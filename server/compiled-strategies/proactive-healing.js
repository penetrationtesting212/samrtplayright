const { Page } = require('@playwright/test');
const { ElementContext, HealingCandidate } = require('../types');
const { BaseHealingStrategy } = require('./base-strategy');
const { PredictiveFailureAnalyzer, SelectorStabilityPrediction } = require('../src/ai/predictive-failure-analyzer');

class ProactiveHealingStrategy extends BaseHealingStrategy {
  predictiveAnalyzer;
  preemptiveSelectors = new Map();
  analysisCache = new Map();

  constructor(page) {
    super(page, 'proactive-healing');
    this.priority = 10; // Highest priority for proactive healing
    this.predictiveAnalyzer = PredictiveFailureAnalyzer.getInstance();
  }

  async generateCandidates(context) {
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
  async preparePreemptiveHealing() {
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

  async generateAlternativeSelectors(prediction) {
    const alternatives = [];
    
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
          id.id,
          tagName.tagName.toLowerCase(),
          className.className,
          textContent.textContent?.trim(),
          'data-testid'.getAttribute('data-testid'),
          'aria-label'.getAttribute('aria-label'),
          type.getAttribute('type'),
          role.getAttribute('role'),
          name.getAttribute('name'),
          placeholder.getAttribute('placeholder'),
          title.getAttribute('title')
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
      if (elementInfo.textContent && elementInfo.textContent.length  c.trim());
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
        
        return path ? '//' + path.substring(1) ;
      });

      if (xpath) {
        alternatives.push(xpath);
      }

      // Validate alternatives by testing them
      const validAlternatives = [];
      
      for (const alternative of alternatives) {
        try {
          const count = await this.page.locator(alternative).count();
          if (count === 1) { // Prefer unique selectors
            validAlternatives.push(alternative);
          } else if (count > 1 && validAlternatives.length  0) {
        this.preemptiveSelectors.set(prediction.selector, validAlternatives);
        console.log(`🛡️ Generated ${validAlternatives.length} alternatives for ${prediction.selector}`);
      }

    } catch (error) {
      console.error(`Error generating alternatives for ${prediction.selector}:`, error);
    }
  }

  async getPreemptiveAlternatives(originalSelector) {
    const alternatives = this.preemptiveSelectors.get(originalSelector);
    
    if (!alternatives || alternatives.length === 0) {
      return [];
    }

    const candidates = [];
    
    for (let i = 0; i  0) {
          // Calculate confidence based on selector type and position in alternatives
          let confidence = 0.9 - (i * 0.1); // Decrease confidence for later alternatives
          
          // Boost confidence for stable selector types
          if (alternative.includes('#')) confidence += 0.05; // ID selector
          if (alternative.includes('data-testid')) confidence += 0.04; // Test ID
          if (alternative.includes('aria-label')) confidence += 0.03; // Aria label
          
          confidence = Math.min(confidence, 0.95); // Cap at 95%
          
          candidates.push({
            selector,
            strategy.name,
            score,
            confidence,
            features: {
              preemptive.0,
              selectorType.getSelectorType(alternative),
              position,
              validated.0
            },
            reasoning: `Preemptive healing candidate #${i + 1} - ${this.getSelectorTypeDescription(alternative)}`,
            metadata: {
              originalSelector,
              alternativeIndex,
              generatedProactively
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

  getSelectorType(selector) {
    if (selector.includes('#')) return 1.0; // ID
    if (selector.includes('data-testid')) return 0.9; // Test ID
    if (selector.includes('aria-label')) return 0.8; // Aria label
    if (selector.startsWith('text=')) return 0.7; // Text
    if (selector.includes('[')) return 0.6; // Attribute
    if (selector.includes('.')) return 0.4; // Class
    if (selector.startsWith('//')) return 0.3; // XPath
    return 0.2; // Other
  }

  getSelectorTypeDescription(selector) {
    if (selector.includes('#')) return 'ID-based selector';
    if (selector.includes('data-testid')) return 'Test ID selector';
    if (selector.includes('aria-label')) return 'Accessibility label selector';
    if (selector.startsWith('text=')) return 'Text content selector';
    if (selector.includes('[') && !selector.includes('data-testid')) return 'Attribute selector';
    if (selector.includes('.')) return 'CSS class selector';
    if (selector.startsWith('//')) return 'XPath selector';
    return 'Generic selector';
  }

  async generatePredictiveHealingCandidates(
    context, 
    prediction
  ) {
    const candidates = [];

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

  async findSimilarElementsWithTestId(context) {
    const candidates = [];
    
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
              strategy.name,
              score.8 + (textSimilarity * 0.2),
              confidence.8 + (textSimilarity * 0.2),
              features: {
                predictive.0,
                textSimilarity,
                hasTestId.0
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

  async generateMoreSpecificSelectors(context) {
    const candidates = [];
    
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
            selector,
            strategy.name,
            score.85,
            confidence.85,
            features: {
              predictive.0,
              specificity.0,
              parentContext.0
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

  async generateFallbackCandidates(
    context, 
    prediction
  ) {
    const candidates = [];
    
    // Generate fallback based on prediction confidence
    const baseConfidence = Math.max(0.3, 1 - prediction.stabilityScore);
    
    // Try tag-based selector
    if (context.tagName) {
      candidates.push({
        selector.tagName,
        strategy.name,
        score * 0.5,
        confidence * 0.5,
        features: {
          predictive.0,
          fallback.0,
          tagBased.0
        },
        reasoning: 'Fallback tag-based selector'
      });
    }
    
    return candidates;
  }

  calculateTextSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    return union.length > 0 ? intersection.length / union.length ;
  }

  /**
   * Get preemptive healing statistics
   */
  getStatistics() {
    return {
      preemptiveSelectorCount.preemptiveSelectors.size,
      cachedAnalysisCount.analysisCache.size,
      totalAlternatives.from(this.preemptiveSelectors.values())
        .reduce((sum, alternatives) => sum + alternatives.length, 0)
    };
  }

  /**
   * Clear cached data for a specific URL
   */
  clearCache(url?) {
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

module.exports = { ProactiveHealingStrategy };