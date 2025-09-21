import * as tf from '@tensorflow/tfjs';
import { Page } from '@playwright/test';
import { ElementContext, HealingCandidate } from '../types';
import { ImageProcessor } from '../strategies/utils/image-processor';
import { SSIMHealingStrategy } from '../strategies/ssim-healing-strategy';

export class VisualAIController {
  private static instance: VisualAIController;
  private imageProcessor: ImageProcessor;
  private models: Map<string, tf.LayersModel> = new Map();
  private isInitialized = false;
  private ssimHealingStrategy?: SSIMHealingStrategy;

  private constructor() {
    this.imageProcessor = ImageProcessor.getInstance();
  }

  static getInstance(): VisualAIController {
    if (!VisualAIController.instance) {
      VisualAIController.instance = new VisualAIController();
    }
    return VisualAIController.instance;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize TensorFlow.js backend
      await tf.ready();
      
      // Create and load models
      await this.loadModels();
      
      this.isInitialized = true;
      console.log('🤖 Visual AI Controller initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Visual AI Controller:', error);
      throw error;
    }
  }

  private async loadModels() {
    // Feature extraction model
    const featureModel = this.imageProcessor.createFeatureExtractionModel();
    this.models.set('feature-extractor', featureModel);

    // Element classification model
    const classificationModel = this.createElementClassificationModel();
    this.models.set('element-classifier', classificationModel);

    console.log('📊 Loaded AI models: feature-extractor, element-classifier');
  }

  private createElementClassificationModel(): tf.LayersModel {
    return tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [64], units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'softmax' }) // button, link, input, etc.
      ]
    });
  }

  async analyzePageForElements(page: Page): Promise<VisualElementAnalysis[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      const imageTensor = await this.imageProcessor.preprocessImage(screenshot);
      
      // Get all interactive elements
      const elements = await page.evaluate(() => {
        const interactiveSelectors = [
          'button', 'a', 'input', 'select', 'textarea',
          '[role="button"]', '[role="link"]', '[onclick]',
          '[data-testid]', '.btn', '.button'
        ];
        
        return Array.from(document.querySelectorAll(interactiveSelectors.join(', ')))
          .map((el, index) => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 5 || rect.height < 5) return null;
            
            return {
              index,
              selector: this.generateSelector(el),
              boundingBox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y), 
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              tagName: el.tagName.toLowerCase(),
              textContent: el.textContent?.trim() || '',
              attributes: {
                id: el.id,
                className: el.className,
                'data-testid': el.getAttribute('data-testid') || '',
                'aria-label': el.getAttribute('aria-label') || ''
              }
            };
          })
          .filter(Boolean);
      });

      const analyses: VisualElementAnalysis[] = [];
      const viewport = await page.viewportSize();
      
      if (!viewport) return analyses;

      // Analyze each element
      for (const element of elements) {
        try {
          const analysis = await this.analyzeElement(
            imageTensor, 
            element, 
            viewport.width, 
            viewport.height
          );
          analyses.push(analysis);
        } catch (error) {
          console.warn(`Failed to analyze element ${element.index}:`, error);
        }
      }

      imageTensor.dispose();
      return analyses;
    } catch (error) {
      console.error('Error analyzing page for elements:', error);
      return [];
    }
  }

  private async analyzeElement(
    imageTensor: tf.Tensor,
    element: any,
    pageWidth: number,
    pageHeight: number
  ): Promise<VisualElementAnalysis> {
    // Extract element region
    const croppedElement = this.imageProcessor.cropImageRegion(
      imageTensor,
      element.boundingBox,
      pageWidth,
      pageHeight
    );

    // Extract visual features
    const featureModel = this.models.get('feature-extractor')!;
    const features = await this.imageProcessor.extractFeatures(croppedElement, featureModel);

    // Classify element type
    const classificationModel = this.models.get('element-classifier')!;
    const classification = classificationModel.predict(features) as tf.Tensor;
    const classificationData = await classification.data();

    // Calculate visual metrics
    const edgeFeatures = await this.imageProcessor.detectEdges(croppedElement);
    const edgeIntensity = tf.mean(edgeFeatures).dataSync()[0];

    // Clean up tensors
    croppedElement.dispose();
    features.dispose();
    classification.dispose();
    edgeFeatures.dispose();

    return {
      element,
      visualFeatures: {
        hasText: element.textContent.length > 0,
        hasIcon: edgeIntensity > 0.1,
        hasImage: false, // Could be enhanced with image detection
        isButton: classificationData[0] > 0.5,
        isLink: classificationData[1] > 0.5,
        isInput: classificationData[2] > 0.5
      },
      visualMetrics: {
        edgeIntensity,
        aspectRatio: element.boundingBox.width / element.boundingBox.height,
        area: element.boundingBox.width * element.boundingBox.height
      },
      aiConfidence: Math.max(...classificationData)
    };
  }

  async findVisualMatches(
    page: Page,
    targetContext: ElementContext,
    threshold: number = 0.6
  ): Promise<HealingCandidate[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const pageAnalysis = await this.analyzePageForElements(page);
      const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
      
      // Extract target features if we have bounding box
      let targetFeatures: tf.Tensor | null = null;
      if (targetContext.boundingBox) {
        targetFeatures = await this.extractTargetFeatures(targetContext, screenshot);
      }

      const candidates: HealingCandidate[] = [];

      for (const analysis of pageAnalysis) {
        let visualSimilarity = 0;

        if (targetFeatures) {
          // Use AI-based visual similarity
          const elementFeatures = await this.extractElementFeatures(
            analysis.element, 
            screenshot
          );
          visualSimilarity = this.imageProcessor.calculateCosineSimilarity(
            targetFeatures, 
            elementFeatures
          );
          elementFeatures.dispose();
        } else {
          // Fallback to heuristic-based similarity
          visualSimilarity = this.calculateHeuristicSimilarity(targetContext, analysis);
        }

        if (visualSimilarity > threshold) {
          candidates.push({
            selector: analysis.element.selector,
            strategy: 'visual-ai',
            score: visualSimilarity,
            confidence: visualSimilarity * analysis.aiConfidence,
            features: {
              visual: visualSimilarity,
              ai: analysis.aiConfidence,
              semantic: this.calculateSemanticSimilarity(targetContext, analysis.element)
            },
            reasoning: `Visual AI match: ${(visualSimilarity * 100).toFixed(1)}% similarity, ${(analysis.aiConfidence * 100).toFixed(1)}% AI confidence`,
            metadata: {
              visualFeatures: analysis.visualFeatures,
              visualMetrics: analysis.visualMetrics
            }
          });
        }
      }

      if (targetFeatures) {
        targetFeatures.dispose();
      }

      return candidates.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error finding visual matches:', error);
      return [];
    }
  }

  private async extractTargetFeatures(context: ElementContext, screenshot: Buffer): Promise<tf.Tensor> {
    const imageTensor = await this.imageProcessor.preprocessImage(screenshot);
    // Implementation would extract features from the target element region
    // For brevity, returning a dummy tensor
    return imageTensor;
  }

  private async extractElementFeatures(element: any, screenshot: Buffer): Promise<tf.Tensor> {
    const imageTensor = await this.imageProcessor.preprocessImage(screenshot);
    // Implementation would extract features from the element region
    // For brevity, returning a dummy tensor
    return imageTensor;
  }

  private calculateHeuristicSimilarity(context: ElementContext, analysis: VisualElementAnalysis): number {
    let score = 0;
    let factors = 0;

    // Tag similarity
    if (context.tagName === analysis.element.tagName) {
      score += 0.3;
    }
    factors++;

    // Text similarity
    if (context.textContent && analysis.element.textContent) {
      const textSim = this.calculateTextSimilarity(context.textContent, analysis.element.textContent);
      score += textSim * 0.4;
    }
    factors++;

    // Size similarity
    if (context.boundingBox) {
      const sizeSim = this.calculateSizeSimilarity(context.boundingBox, analysis.element.boundingBox);
      score += sizeSim * 0.3;
    }
    factors++;

    return score / factors;
  }

  private calculateSemanticSimilarity(context: ElementContext, element: any): number {
    // Simple semantic similarity based on text and attributes
    let score = 0;
    
    if (context.textContent && element.textContent) {
      score += this.calculateTextSimilarity(context.textContent, element.textContent) * 0.6;
    }
    
    if (context.attributes && element.attributes) {
      // Check important attributes
      const importantAttrs = ['data-testid', 'aria-label', 'id'];
      let attrMatches = 0;
      let totalAttrs = 0;
      
      for (const attr of importantAttrs) {
        if (context.attributes[attr] && element.attributes[attr]) {
          totalAttrs++;
          if (context.attributes[attr] === element.attributes[attr]) {
            attrMatches++;
          }
        }
      }
      
      if (totalAttrs > 0) {
        score += (attrMatches / totalAttrs) * 0.4;
      }
    }
    
    return Math.min(score, 1);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private calculateSizeSimilarity(size1: any, size2: any): number {
    const widthRatio = Math.min(size1.width, size2.width) / Math.max(size1.width, size2.width);
    const heightRatio = Math.min(size1.height, size2.height) / Math.max(size1.height, size2.height);
    return (widthRatio + heightRatio) / 2;
  }

  dispose() {
    // Clean up all models
    for (const [name, model] of this.models) {
      model.dispose();
      console.log(`🗑️ Disposed AI model: ${name}`);
    }
    this.models.clear();
    
    // Dispose SSIM strategy if initialized
    if (this.ssimHealingStrategy) {
      this.ssimHealingStrategy.dispose();
    }
    
    this.isInitialized = false;
  }

  // ============ SSIM Enhanced Methods ============

  /**
   * Initialize SSIM healing strategy for the current page
   */
  async initializeSSIMHealing(page: Page): Promise<void> {
    try {
      this.ssimHealingStrategy = new SSIMHealingStrategy(page);
      console.log('🎯 SSIM Healing Strategy initialized');
    } catch (error) {
      console.error('Failed to initialize SSIM healing strategy:', error);
    }
  }

  /**
   * Find visual matches using enhanced SSIM comparison
   */
  async findSSIMEnhancedMatches(
    page: Page,
    targetContext: ElementContext,
    threshold: number = 0.6
  ): Promise<HealingCandidate[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Initialize SSIM strategy if not already done
      if (!this.ssimHealingStrategy) {
        await this.initializeSSIMHealing(page);
      }

      if (!this.ssimHealingStrategy) {
        console.warn('SSIM strategy not available, falling back to standard visual matching');
        return this.findVisualMatches(page, targetContext, threshold);
      }

      console.log('🔍 Finding candidates with SSIM-enhanced visual AI...');
      
      // Get SSIM-based candidates
      const ssimCandidates = await this.ssimHealingStrategy.findCandidates(targetContext);
      
      // Get traditional AI candidates
      const aiCandidates = await this.findVisualMatches(page, targetContext, threshold * 0.8); // Lower threshold for combining
      
      // Combine and enhance candidates with dual approach
      const combinedCandidates = await this.combineSSIMWithAI(ssimCandidates, aiCandidates, page, targetContext);
      
      console.log(`📊 Combined SSIM+AI analysis found ${combinedCandidates.length} enhanced candidates`);
      return combinedCandidates;
    } catch (error) {
      console.error('Error in SSIM-enhanced visual matching:', error);
      return this.findVisualMatches(page, targetContext, threshold); // Fallback
    }
  }

  /**
   * Combine SSIM and AI candidates for enhanced accuracy
   */
  private async combineSSIMWithAI(
    ssimCandidates: any[],
    aiCandidates: HealingCandidate[],
    page: Page,
    targetContext: ElementContext
  ): Promise<HealingCandidate[]> {
    const combinedMap = new Map<string, HealingCandidate>();
    
    // Process SSIM candidates
    for (const ssimCandidate of ssimCandidates) {
      const candidate: HealingCandidate = {
        selector: ssimCandidate.selector,
        strategy: 'ssim-enhanced-ai',
        score: ssimCandidate.score,
        confidence: ssimCandidate.confidence,
        features: {
          ...ssimCandidate.features,
          ssimEnhanced: true
        },
        reasoning: `SSIM+AI: ${ssimCandidate.reasoning}`,
        metadata: ssimCandidate.metadata
      };
      
      combinedMap.set(ssimCandidate.selector, candidate);
    }
    
    // Enhance with AI candidates and boost confidence for matches
    for (const aiCandidate of aiCandidates) {
      const existing = combinedMap.get(aiCandidate.selector);
      
      if (existing) {
        // Both SSIM and AI found this candidate - boost confidence
        existing.confidence = Math.min(
          existing.confidence * 1.2 + aiCandidate.confidence * 0.3,
          1.0
        );
        existing.features = {
          ...existing.features,
          ...aiCandidate.features,
          dualConfirmed: true
        };
        existing.reasoning += ` + AI confirmation (${(aiCandidate.confidence * 100).toFixed(1)}%)`;
      } else {
        // AI-only candidate
        combinedMap.set(aiCandidate.selector, {
          ...aiCandidate,
          strategy: 'ai-visual',
          features: {
            ...aiCandidate.features,
            ssimEnhanced: false
          }
        });
      }
    }
    
    // Convert to array and sort by confidence
    const result = Array.from(combinedMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8); // Limit to top 8 candidates
    
    return result;
  }

  /**
   * Perform advanced image comparison using SSIM + AI features
   */
  async performAdvancedComparison(
    currentScreenshot: Buffer,
    referenceScreenshot: Buffer,
    elementContext?: ElementContext
  ): Promise<{
    ssimScore: number;
    aiFeatureSimilarity: number;
    combinedScore: number;
    recommendation: 'high_match' | 'moderate_match' | 'low_match' | 'no_match';
  }> {
    try {
      // Use enhanced image processor for SSIM comparison
      const ssimScore = await this.imageProcessor.calculateSSIMJS(
        currentScreenshot,
        referenceScreenshot
      );
      
      // Extract AI features from both images
      const currentTensor = await this.imageProcessor.preprocessImage(currentScreenshot);
      const referenceTensor = await this.imageProcessor.preprocessImage(referenceScreenshot);
      
      const featureModel = this.models.get('feature-extractor');
      if (!featureModel) {
        throw new Error('Feature extraction model not loaded');
      }
      
      const currentFeatures = await this.imageProcessor.extractFeatures(currentTensor, featureModel);
      const referenceFeatures = await this.imageProcessor.extractFeatures(referenceTensor, featureModel);
      
      const aiFeatureSimilarity = this.imageProcessor.calculateCosineSimilarity(
        currentFeatures,
        referenceFeatures
      );
      
      // Calculate combined score
      const combinedScore = (
        ssimScore * 0.5 +           // SSIM gets 50% weight
        aiFeatureSimilarity * 0.5   // AI features get 50% weight
      );
      
      // Determine recommendation
      let recommendation: 'high_match' | 'moderate_match' | 'low_match' | 'no_match';
      if (combinedScore > 0.85) recommendation = 'high_match';
      else if (combinedScore > 0.65) recommendation = 'moderate_match';
      else if (combinedScore > 0.4) recommendation = 'low_match';
      else recommendation = 'no_match';
      
      // Clean up tensors
      currentTensor.dispose();
      referenceTensor.dispose();
      currentFeatures.dispose();
      referenceFeatures.dispose();
      
      return {
        ssimScore,
        aiFeatureSimilarity,
        combinedScore,
        recommendation
      };
    } catch (error) {
      console.error('Error in advanced image comparison:', error);
      return {
        ssimScore: 0,
        aiFeatureSimilarity: 0,
        combinedScore: 0,
        recommendation: 'no_match'
      };
    }
  }

  /**
   * Generate SSIM-based healing report
   */
  async generateSSIMHealingReport(
    page: Page,
    targetContext: ElementContext
  ): Promise<{
    totalElements: number;
    ssimCandidates: number;
    aiCandidates: number;
    combinedCandidates: number;
    topCandidates: HealingCandidate[];
    recommendations: string[];
  }> {
    try {
      const candidates = await this.findSSIMEnhancedMatches(page, targetContext, 0.5);
      
      const ssimCandidates = candidates.filter(c => c.features?.ssimEnhanced).length;
      const aiCandidates = candidates.filter(c => c.features?.ai).length;
      const combinedCandidates = candidates.filter(c => c.features?.dualConfirmed).length;
      
      // Generate recommendations
      const recommendations = [];
      
      if (combinedCandidates > 0) {
        recommendations.push(`${combinedCandidates} candidates confirmed by both SSIM and AI analysis`);
      }
      
      if (ssimCandidates > aiCandidates) {
        recommendations.push('SSIM analysis found more candidates - element has strong visual characteristics');
      } else if (aiCandidates > ssimCandidates) {
        recommendations.push('AI analysis more effective - element may have complex features');
      }
      
      const highConfidenceCandidates = candidates.filter(c => c.confidence > 0.8).length;
      if (highConfidenceCandidates === 0) {
        recommendations.push('No high-confidence matches found - consider updating element locator strategy');
      } else {
        recommendations.push(`${highConfidenceCandidates} high-confidence matches available for healing`);
      }
      
      return {
        totalElements: candidates.length,
        ssimCandidates,
        aiCandidates,
        combinedCandidates,
        topCandidates: candidates.slice(0, 5),
        recommendations
      };
    } catch (error) {
      console.error('Error generating SSIM healing report:', error);
      return {
        totalElements: 0,
        ssimCandidates: 0,
        aiCandidates: 0,
        combinedCandidates: 0,
        topCandidates: [],
        recommendations: ['Error occurred during analysis']
      };
    }
  }
}

export interface VisualElementAnalysis {
  element: any;
  visualFeatures: {
    hasText: boolean;
    hasIcon: boolean;
    hasImage: boolean;
    isButton: boolean;
    isLink: boolean;
    isInput: boolean;
  };
  visualMetrics: {
    edgeIntensity: number;
    aspectRatio: number;
    area: number;
  };
  aiConfidence: number;
}