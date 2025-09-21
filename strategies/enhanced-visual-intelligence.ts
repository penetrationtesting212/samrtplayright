import { Page } from '@playwright/test';
import { ElementContext, HealingCandidate } from '../types';
import { BaseHealingStrategy } from './base-strategy';
import * as tf from '@tensorflow/tfjs';
import { ImageProcessor } from './utils/image-processor';

export class EnhancedVisualIntelligenceStrategy extends BaseHealingStrategy {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;
  private imageProcessor: ImageProcessor;

  constructor(page: Page) {
    super(page, 'enhanced-visual-intelligence');
    this.priority = 8;
    this.imageProcessor = ImageProcessor.getInstance();
    this.initializeModel();
  }

  private async initializeModel() {
    try {
      this.model = this.imageProcessor.createFeatureExtractionModel();
      this.isModelLoaded = true;
      console.log('✅ Enhanced Visual AI model initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Visual AI model:', error);
      this.isModelLoaded = false;
    }
  }

  async generateCandidates(context: ElementContext): Promise<HealingCandidate[]> {
    if (!this.isModelLoaded || !this.model) {
      return [];
    }

    try {
      const screenshot = await this.page.screenshot({ fullPage: true, type: 'png' });
      const targetFeatures = await this.extractTargetFeatures(context, screenshot);
      
      if (!targetFeatures) return [];

      const candidates = await this.findAIMatches(targetFeatures, context, screenshot);
      targetFeatures.dispose();

      return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    } catch (error) {
      console.error('Error in enhanced visual intelligence:', error);
      return [];
    }
  }

  private async extractTargetFeatures(context: ElementContext, screenshot: Buffer): Promise<tf.Tensor | null> {
    try {
      const imageTensor = await this.imageProcessor.preprocessImage(screenshot);
      
      if (context.boundingBox) {
        const viewport = await this.page.viewportSize();
        if (!viewport) return null;
        
        const cropped = this.imageProcessor.cropImageRegion(
          imageTensor, context.boundingBox, viewport.width, viewport.height
        );
        const features = await this.imageProcessor.extractFeatures(cropped, this.model!);
        
        imageTensor.dispose();
        cropped.dispose();
        return features;
      }
      
      const features = await this.imageProcessor.extractFeatures(imageTensor, this.model!);
      imageTensor.dispose();
      return features;
    } catch (error) {
      console.error('Error extracting features:', error);
      return null;
    }
  }

  private async findAIMatches(
    targetFeatures: tf.Tensor, 
    context: ElementContext, 
    screenshot: Buffer
  ): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    const imageTensor = await this.imageProcessor.preprocessImage(screenshot);
    const viewport = await this.page.viewportSize();
    
    if (!viewport) {
      imageTensor.dispose();
      return candidates;
    }

    // Get interactive elements
    const elements = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a, input, [role="button"]'))
        .map((el, i) => {
          const rect = el.getBoundingClientRect();
          if (rect.width < 10 || rect.height < 10) return null;
          
          return {
            index: i,
            selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
            boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            tagName: el.tagName.toLowerCase(),
            textContent: el.textContent?.trim() || ''
          };
        }).filter(Boolean);
    });

    // Process elements with AI
    for (const elementInfo of elements) {
      try {
        const cropped = this.imageProcessor.cropImageRegion(
          imageTensor, elementInfo.boundingBox, viewport.width, viewport.height
        );
        const features = await this.imageProcessor.extractFeatures(cropped, this.model!);
        const similarity = this.imageProcessor.calculateCosineSimilarity(targetFeatures, features);
        
        if (similarity > 0.5) {
          candidates.push({
            selector: elementInfo.selector,
            strategy: this.name,
            score: similarity,
            confidence: similarity,
            features: { visual: similarity, ai: similarity },
            reasoning: `AI Visual Match: ${(similarity * 100).toFixed(1)}%`
          });
        }
        
        cropped.dispose();
        features.dispose();
      } catch (error) {
        continue;
      }
    }
    
    imageTensor.dispose();
    return candidates;
  }

  async dispose() {
    if (this.model) {
      this.model.dispose();
    }
  }
}