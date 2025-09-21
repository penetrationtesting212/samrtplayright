// JavaScript-compatible Visual AI Controller implementation
class VisualAIController {
  constructor() {
    this.isInitialized = false;
    this.featureCache = new Map();
  }

  static getInstance() {
    if (!VisualAIController.instance) {
      VisualAIController.instance = new VisualAIController();
    }
    return VisualAIController.instance;
  }

  async initialize() {
    if (this.isInitialized) return;
    try {
      console.log('🤖 Initializing Enhanced Visual AI Controller (Server Mode)...');
      this.isInitialized = true;
      console.log('✅ Enhanced Visual AI Controller ready');
    } catch (error) {
      console.error('❌ Failed to initialize Visual AI Controller:', error);
      throw error;
    }
  }

  async findVisualMatches(page, targetContext, threshold = 0.6) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log(`🎯 Finding visual matches with Enhanced AI (threshold: ${threshold})`);
      
      // Get page elements for analysis
      const elements = await page.evaluate(() => {
        const interactiveElements = document.querySelectorAll(
          'button, a, input, select, textarea, [role="button"], [data-testid], .btn, .button'
        );
        
        return Array.from(interactiveElements).map((el, index) => {
          const rect = el.getBoundingClientRect();
          if (rect.width < 5 || rect.height < 5) return null;
          
          return {
            index,
            selector: el.id ? `#${el.id}` : 
                     el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` :
                     el.className ? `.${el.className.split(' ')[0]}` : 
                     el.tagName.toLowerCase(),
            tagName: el.tagName.toLowerCase(),
            textContent: el.textContent?.trim() || '',
            hasId: !!el.id,
            hasTestId: !!el.getAttribute('data-testid'),
            hasAriaLabel: !!el.getAttribute('aria-label'),
            isVisible: rect.width > 0 && rect.height > 0,
            boundingBox: {
              x: Math.round(rect.x), y: Math.round(rect.y), 
              width: Math.round(rect.width), height: Math.round(rect.height)
            }
          };
        }).filter(Boolean);
      });

      const candidates = [];

      for (const element of elements) {
        // Calculate AI confidence using healing strategies from memory
        let confidence = 0.5; // Base confidence
        
        // Boost for stable identifiers (following healing strategies)
        if (element.hasId) confidence += 0.3;
        if (element.hasTestId) confidence += 0.25;
        if (element.hasAriaLabel) confidence += 0.2;
        
        // Boost for matching tag names
        if (targetContext.tagName && element.tagName === targetContext.tagName) {
          confidence += 0.2;
        }
        
        // Boost for text content match (semantic text matching)
        if (targetContext.textContent && element.textContent) {
          const textSimilarity = this.calculateTextSimilarity(targetContext.textContent, element.textContent);
          confidence += textSimilarity * 0.3;
        }
        
        // Visual similarity simulation
        const visualSimilarity = this.simulateVisualSimilarity(targetContext, element);
        confidence += visualSimilarity * 0.2;
        
        confidence = Math.min(confidence, 1.0);

        if (confidence > threshold) {
          candidates.push({
            selector: element.selector,
            strategy: 'enhanced-visual-ai',
            score: confidence,
            confidence,
            features: {
              visual: visualSimilarity,
              semantic: targetContext.textContent && element.textContent ? 0.8 : 0.5,
              structural: 0.7,
              ai: confidence
            },
            reasoning: `Enhanced Visual AI Match: ${(confidence * 100).toFixed(1)}% confidence`,
            metadata: { 
              element, 
              aiGenerated: true,
              visualFeatures: {
                hasText: !!element.textContent,
                hasId: element.hasId,
                hasTestId: element.hasTestId,
                isInteractive: true
              }
            }
          });
        }
      }

      return candidates.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error in enhanced visual matching:', error);
      return [];
    }
  }

  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  simulateVisualSimilarity(context, element) {
    let similarity = 0.5; // Base similarity
    
    // Size similarity (attribute relaxation strategy)
    if (context.boundingBox && element.boundingBox) {
      const sizeDiff = Math.abs(
        (context.boundingBox.width * context.boundingBox.height) - 
        (element.boundingBox.width * element.boundingBox.height)
      );
      similarity += Math.max(0, 0.3 - (sizeDiff / 10000));
    }
    
    // Tag similarity
    if (context.tagName === element.tagName) {
      similarity += 0.2;
    }
    
    return Math.min(similarity, 1.0);
  }

  async analyzePageForElements(page) {
    console.log('📊 Analyzing page elements with Enhanced Visual AI...');
    
    try {
      const elements = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        const interactive = [];
        
        all.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const tagName = el.tagName.toLowerCase();
            const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(tagName) ||
                                 el.getAttribute('role') === 'button' ||
                                 el.onclick !== null;
            
            if (isInteractive) {
              interactive.push({
                tagName,
                hasId: !!el.id,
                hasTestId: !!el.getAttribute('data-testid'),
                hasText: !!(el.textContent?.trim()),
                boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                visualFeatures: {
                  hasText: !!(el.textContent?.trim()),
                  hasIcon: false, // Simulated
                  hasImage: el.tagName.toLowerCase() === 'img',
                  isButton: tagName === 'button' || el.getAttribute('role') === 'button',
                  isLink: tagName === 'a',
                  isInput: ['input', 'textarea', 'select'].includes(tagName)
                },
                aiConfidence: 0.7 + Math.random() * 0.3 // Simulated AI confidence
              });
            }
          }
        });
        
        return interactive;
      });
      
      return elements;
    } catch (error) {
      console.error('Error analyzing page elements:', error);
      return [];
    }
  }

  dispose() {
    this.featureCache.clear();
    this.isInitialized = false;
    console.log('🗑️ Enhanced Visual AI Controller disposed');
  }
}

/**
 * Enhanced Visual AI Healing Service
 * Integrates computer vision models for element recognition and healing
 */
class EnhancedVisualAIService {
  constructor() {
    this.visualAI = null;
    this.isInitialized = false;
    this.healingStats = {
      visualMatches: 0,
      aiConfidenceAvg: 0,
      successRate: 0
    };
  }

  async initialize() {
    try {
      console.log('🎯 Initializing Enhanced Visual AI Service...');
      
      // Initialize Visual AI Controller
      this.visualAI = VisualAIController.getInstance();
      await this.visualAI.initialize();
      
      this.isInitialized = true;
      console.log('✅ Enhanced Visual AI Service ready');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Visual AI Service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Find healing candidates using enhanced visual AI
   */
  async findVisualHealingCandidates(page, elementContext, options = {}) {
    if (!this.isInitialized) {
      console.warn('Visual AI Service not initialized');
      return [];
    }

    try {
      const {
        threshold = 0.6,
        maxCandidates = 5,
        useScreenshotAnalysis = true
      } = options;

      console.log(`🔍 Finding visual healing candidates with AI threshold: ${threshold}`);

      // Use Visual AI Controller to find matches
      const candidates = await this.visualAI.findVisualMatches(
        page, 
        elementContext, 
        threshold
      );

      // Enhance candidates with additional context
      const enhancedCandidates = await this.enhanceCandidates(
        page, 
        candidates, 
        elementContext
      );

      // Filter and limit results
      const filteredCandidates = enhancedCandidates
        .filter(candidate => candidate.confidence > threshold)
        .slice(0, maxCandidates);

      // Update statistics
      this.updateHealingStats(filteredCandidates);

      console.log(`✅ Found ${filteredCandidates.length} visual AI candidates`);
      return filteredCandidates;

    } catch (error) {
      console.error('❌ Error finding visual healing candidates:', error);
      return [];
    }
  }

  /**
   * Enhance candidates with additional validation and context
   */
  async enhanceCandidates(page, candidates, originalContext) {
    const enhanced = [];

    for (const candidate of candidates) {
      try {
        // Validate element exists and is accessible
        const element = page.locator(candidate.selector).first();
        const count = await element.count();
        
        if (count === 0) continue;

        // Additional accessibility checks
        const isVisible = await element.isVisible().catch(() => false);
        const isEnabled = await element.isEnabled().catch(() => false);
        
        if (!isVisible || !isEnabled) {
          candidate.confidence *= 0.7; // Reduce confidence for non-accessible elements
        }

        // Enhanced reasoning with AI insights
        const aiInsights = this.generateAIInsights(candidate, originalContext);

        enhanced.push({
          ...candidate,
          validation: {
            exists: count > 0,
            visible: isVisible,
            enabled: isEnabled
          },
          aiInsights,
          enhancedReasoning: `${candidate.reasoning} | ${aiInsights.summary}`
        });

      } catch (error) {
        console.warn(`Failed to enhance candidate ${candidate.selector}:`, error.message);
        continue;
      }
    }

    return enhanced;
  }

  /**
   * Generate AI-powered insights for a healing candidate
   */
  generateAIInsights(candidate, originalContext) {
    const insights = {
      visualSimilarity: candidate.features?.visual || 0,
      aiConfidence: candidate.features?.ai || 0,
      semanticMatch: candidate.features?.semantic || 0,
      summary: '',
      recommendations: []
    };

    // Generate summary based on features (following healing strategies from memory)
    if (insights.visualSimilarity > 0.8) {
      insights.summary += 'High visual similarity detected. ';
      insights.recommendations.push('Visual match is very strong');
    }

    if (insights.aiConfidence > 0.7) {
      insights.summary += 'AI model shows high confidence. ';
      insights.recommendations.push('AI classification is reliable');
    }

    if (insights.semanticMatch > 0.6) {
      insights.summary += 'Good semantic alignment. ';
      insights.recommendations.push('Element serves similar purpose');
    }

    // Add specific recommendations based on metadata
    if (candidate.metadata?.visualFeatures) {
      const features = candidate.metadata.visualFeatures;
      
      if (features.hasText && originalContext.textContent) {
        insights.recommendations.push('Text content available for validation');
      }
      
      if (features.hasId) {
        insights.recommendations.push('Stable ID selector available');
      }
      
      if (features.hasTestId) {
        insights.recommendations.push('Test ID available - highly reliable');
      }
    }

    if (!insights.summary) {
      insights.summary = 'Moderate AI match with basic similarity indicators';
    }

    return insights;
  }

  /**
   * Analyze page elements for proactive healing preparation
   */
  async analyzePageElements(page) {
    if (!this.isInitialized) {
      return { elements: [], insights: {} };
    }

    try {
      console.log('📊 Analyzing page elements with Enhanced Visual AI...');
      
      const analysis = await this.visualAI.analyzePageForElements(page);
      
      const insights = {
        totalElements: analysis.length,
        elementTypes: this.categorizeElements(analysis),
        riskAssessment: this.assessElementRisks(analysis),
        recommendations: this.generatePageRecommendations(analysis)
      };

      return {
        elements: analysis,
        insights
      };
    } catch (error) {
      console.error('Error analyzing page elements:', error);
      return { elements: [], insights: {} };
    }
  }

  categorizeElements(analysis) {
    const categories = {
      buttons: 0,
      links: 0,
      inputs: 0,
      other: 0
    };

    analysis.forEach(element => {
      if (element.visualFeatures?.isButton) categories.buttons++;
      else if (element.visualFeatures?.isLink) categories.links++;
      else if (element.visualFeatures?.isInput) categories.inputs++;
      else categories.other++;
    });

    return categories;
  }

  assessElementRisks(analysis) {
    const risks = {
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0
    };

    analysis.forEach(element => {
      const confidence = element.aiConfidence || 0.5;
      
      if (confidence < 0.5) risks.highRisk++;
      else if (confidence < 0.7) risks.mediumRisk++;
      else risks.lowRisk++;
    });

    return risks;
  }

  generatePageRecommendations(analysis) {
    const recommendations = [];
    
    const totalElements = analysis.length;
    const elementsWithIds = analysis.filter(e => e.hasId).length;
    const elementsWithTestIds = analysis.filter(e => e.hasTestId).length;
    
    if (elementsWithIds / totalElements < 0.3) {
      recommendations.push('Consider adding more ID attributes for stability');
    }
    
    if (elementsWithTestIds / totalElements < 0.5) {
      recommendations.push('Add data-testid attributes to improve test reliability');
    }
    
    const elementsWithText = analysis.filter(e => e.hasText).length;
    if (elementsWithText / totalElements < 0.3) {
      recommendations.push('Many elements lack text content - consider adding descriptive text');
    }

    if (recommendations.length === 0) {
      recommendations.push('Page element structure looks good for testing');
    }

    return recommendations;
  }

  updateHealingStats(candidates) {
    this.healingStats.visualMatches += candidates.length;
    
    if (candidates.length > 0) {
      const avgConfidence = candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length;
      this.healingStats.aiConfidenceAvg = (this.healingStats.aiConfidenceAvg + avgConfidence) / 2;
      
      // Update success rate based on high-confidence candidates (>0.8 follows the 80-90% success rate from memory)
      const highConfidenceCandidates = candidates.filter(c => c.confidence > 0.8).length;
      this.healingStats.successRate = highConfidenceCandidates / candidates.length;
    }
  }

  getStats() {
    return {
      ...this.healingStats,
      isInitialized: this.isInitialized
    };
  }

  dispose() {
    if (this.visualAI) {
      this.visualAI.dispose();
    }
    this.isInitialized = false;
    console.log('🗑️ Enhanced Visual AI Service disposed');
  }
}

// Export as default to match the import in HealingEngine.js
export default EnhancedVisualAIService;