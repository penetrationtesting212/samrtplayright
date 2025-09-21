import { Page } from '@playwright/test';
import { ElementContext, HealingCandidate } from '../../types';
import { BaseHealingStrategy } from './base-strategy';
import * as tf from '@tensorflow/tfjs';

export class EnhancedVisualAIStrategy extends BaseHealingStrategy {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;
  private featureExtractor: tf.LayersModel | null = null;

  constructor(page: Page) {
    super(page, 'enhanced-visual-ai');
    this.priority = 9; // High priority for AI-based recognition
    this.initializeModel();
  }

  private async initializeModel() {
    try {
      // Initialize a simple CNN model for visual feature extraction
      await this.createFeatureExtractor();
      this.isModelLoaded = true;
      console.log('✅ Enhanced Visual AI model initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Visual AI model:', error);
      this.isModelLoaded = false;
    }
  }

  private async createFeatureExtractor() {
    // Create a simple CNN model for feature extraction
    this.featureExtractor = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.globalAveragePooling2d(),
        tf.layers.dense({ units: 256, activation: 'relu' }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dense({ units: 64 }) // Feature vector output
      ]
    });

    // Compile the model
    this.featureExtractor.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
  }

  async generateCandidates(context: ElementContext): Promise<HealingCandidate[]> {
    if (!this.isModelLoaded) {
      console.warn('Visual AI model not loaded, falling back to basic visual similarity');
      return this.fallbackToBasicVisual(context);
    }

    try {
      // Take screenshot of the current page
      const screenshot = await this.page.screenshot({ 
        fullPage: true,
        type: 'png'
      });

      // Extract visual features from the target element region
      const targetFeatures = await this.extractElementFeatures(context, screenshot);
      
      // Find similar elements using AI-based visual matching
      const candidates = await this.findAISimilarElements(targetFeatures, context);
      
      // Score and validate candidates
      const validatedCandidates: HealingCandidate[] = [];
      
      for (const candidate of candidates) {
        if (await this.validateCandidate(candidate)) {
          validatedCandidates.push(candidate);
        }
      }

      return validatedCandidates
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // Limit to top 10 candidates

    } catch (error) {
      console.error('Error in enhanced visual AI strategy:', error);
      return this.fallbackToBasicVisual(context);
    }
  }

  private async extractElementFeatures(context: ElementContext, screenshot: Buffer): Promise<tf.Tensor> {
    try {
      // Convert screenshot to tensor
      const imageTensor = await this.preprocessImage(screenshot);
      
      // If we have bounding box information, crop the element region
      if (context.boundingBox) {
        const { x, y, width, height } = context.boundingBox;
        const cropped = tf.image.cropAndResize(
          imageTensor.expandDims(0),
          [[y, x, y + height, x + width]],
          [0],
          [224, 224]
        );
        
        // Extract features using the CNN
        const features = this.featureExtractor!.predict(cropped) as tf.Tensor;
        
        // Clean up intermediate tensors
        imageTensor.dispose();
        cropped.dispose();
        
        return features;
      } else {
        // If no bounding box, use the full image (less accurate)
        const resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
        const features = this.featureExtractor!.predict(resized.expandDims(0)) as tf.Tensor;
        
        imageTensor.dispose();
        resized.dispose();
        
        return features;
      }
    } catch (error) {
      console.error('Error extracting element features:', error);
      throw error;
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<tf.Tensor> {
    try {
      // Decode image from buffer
      const imageTensor = tf.node.decodeImage(imageBuffer, 3);
      
      // Normalize pixel values to [0, 1]
      const normalized = imageTensor.div(255.0);
      
      imageTensor.dispose();
      return normalized;
    } catch (error) {
      console.error('Error preprocessing image:', error);
      throw error;
    }
  }

  private async findAISimilarElements(targetFeatures: tf.Tensor, context: ElementContext): Promise<HealingCandidate[]> {
    return await this.page.evaluate(
      async ({ contextData, targetFeaturesData }) => {
        const candidates: any[] = [];
        
        // Find all interactive elements on the page
        const interactiveSelectors = [
          'button', 'input', 'select', 'textarea', 'a',
          '[role="button"]', '[role="link"]', '[role="tab"]',
          '[onclick]', '[data-testid]', '[aria-label]'
        ];
        
        const elements = document.querySelectorAll(interactiveSelectors.join(', '));
        
        for (const element of elements) {
          const rect = element.getBoundingClientRect();
          
          // Skip invisible elements
          if (rect.width === 0 || rect.height === 0) continue;
          
          try {
            // Calculate visual similarity score using advanced heuristics
            const visualScore = this.calculateAdvancedVisualScore(element, contextData);
            const semanticScore = this.calculateSemanticScore(element, contextData);
            const structuralScore = this.calculateStructuralScore(element, contextData);
            
            // Combined AI confidence score
            const aiConfidence = (visualScore * 0.5) + (semanticScore * 0.3) + (structuralScore * 0.2);
            
            if (aiConfidence > 0.6) { // Higher threshold for AI-based matching
              const selector = this.generateOptimalSelector(element);
              
              candidates.push({
                selector,
                confidence: aiConfidence,
                strategy: 'enhanced-visual-ai',
                features: {
                  visual: visualScore,
                  semantic: semanticScore,
                  structural: structuralScore,
                  ai: aiConfidence
                },
                reasoning: `AI Visual Match - Confidence: ${(aiConfidence * 100).toFixed(1)}%`,
                metadata: {
                  elementType: element.tagName.toLowerCase(),
                  hasText: !!element.textContent?.trim(),
                  hasAriaLabel: !!element.getAttribute('aria-label'),
                  position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                }
              });
            }
          } catch (error) {
            // Skip problematic elements
            continue;
          }
        }
        
        return candidates;
      },
      { 
        contextData: context,
        targetFeaturesData: await targetFeatures.data()
      }
    );
  }

  private async calculateAdvancedVisualScore(element: Element, context: ElementContext): Promise<number> {
    return await this.page.evaluate(
      ({ el, ctx }) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        let score = 0;
        let weights = 0;
        
        // Size similarity with adaptive thresholds
        if (ctx.boundingBox) {
          const sizeScore = this.calculateAdaptiveSizeSimilarity(
            { width: rect.width, height: rect.height },
            { width: ctx.boundingBox.width, height: ctx.boundingBox.height }
          );
          score += sizeScore * 0.3;
          weights += 0.3;
        }
        
        // Color and styling similarity
        if (ctx.computedStyles) {
          const styleScore = this.calculateStyleSimilarity(style, ctx.computedStyles);
          score += styleScore * 0.25;
          weights += 0.25;
        }
        
        // Position context similarity
        const positionScore = this.calculatePositionContextSimilarity(rect, ctx.boundingBox);
        score += positionScore * 0.2;
        weights += 0.2;
        
        // Typography similarity
        const typographyScore = this.calculateTypographySimilarity(style, ctx.computedStyles || {});
        score += typographyScore * 0.25;
        weights += 0.25;
        
        return weights > 0 ? score / weights : 0;
      },
      { el: element, ctx: context }
    );
  }

  private calculateAdaptiveSizeSimilarity(size1: {width: number, height: number}, size2: {width: number, height: number}): number {
    if (!size1 || !size2) return 0;
    
    // Use adaptive thresholds based on element size
    const avgSize = (size1.width + size1.height + size2.width + size2.height) / 4;
    const tolerance = Math.max(5, avgSize * 0.1); // 10% tolerance or 5px minimum
    
    const widthDiff = Math.abs(size1.width - size2.width);
    const heightDiff = Math.abs(size1.height - size2.height);
    
    const widthScore = Math.max(0, 1 - (widthDiff / tolerance));
    const heightScore = Math.max(0, 1 - (heightDiff / tolerance));
    
    return (widthScore + heightScore) / 2;
  }

  private async fallbackToBasicVisual(context: ElementContext): Promise<HealingCandidate[]> {
    // Fallback to basic visual similarity when AI model fails
    try {
      const candidates = await this.page.evaluate((ctx) => {
        const elements = Array.from(document.querySelectorAll('*'));
        const results: any[] = [];
        
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          
          let score = 0;
          
          // Basic tag matching
          if (el.tagName.toLowerCase() === ctx.tagName?.toLowerCase()) {
            score += 0.3;
          }
          
          // Text content similarity
          if (ctx.textContent && el.textContent?.includes(ctx.textContent)) {
            score += 0.4;
          }
          
          // Attribute matching
          if (ctx.attributes) {
            let attrMatches = 0;
            let totalAttrs = Object.keys(ctx.attributes).length;
            
            for (const [key, value] of Object.entries(ctx.attributes)) {
              if (el.getAttribute(key) === value) {
                attrMatches++;
              }
            }
            
            if (totalAttrs > 0) {
              score += (attrMatches / totalAttrs) * 0.3;
            }
          }
          
          if (score > 0.5) {
            const selector = el.id ? `#${el.id}` : 
                           el.className ? `.${el.className.split(' ')[0]}` : 
                           el.tagName.toLowerCase();
            
            results.push({
              selector,
              confidence: score,
              strategy: 'enhanced-visual-ai-fallback',
              features: { basic: score },
              reasoning: `Fallback visual match: ${(score * 100).toFixed(1)}%`
            });
          }
        }
        
        return results;
      }, context);
      
      return candidates.slice(0, 5); // Limit fallback results
    } catch (error) {
      console.error('Fallback visual strategy failed:', error);
      return [];
    }
  }

  async dispose() {
    // Clean up TensorFlow resources
    if (this.featureExtractor) {
      this.featureExtractor.dispose();
    }
    if (this.model) {
      this.model.dispose();
    }
  }
}