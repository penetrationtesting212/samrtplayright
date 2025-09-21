const { Page } = require('@playwright/test');
const { ElementContext, HealingCandidate } = require('../types');
const { BaseHealingStrategy } = require('./base-strategy');
import * as tf from '@tensorflow/tfjs';
const { ImageProcessor } = require('./utils/image-processor');

class EnhancedVisualIntelligenceStrategy extends BaseHealingStrategy {
  model.LayersModel | null = null;
  isModelLoaded = false;
  imageProcessor;

  constructor(page) {
    super(page, 'enhanced-visual-intelligence');
    this.priority = 8;
    this.imageProcessor = ImageProcessor.getInstance();
    this.initializeModel();
  }

  async initializeModel() {
    try {
      this.model = this.imageProcessor.createFeatureExtractionModel();
      this.isModelLoaded = true;
      console.log('✅ Enhanced Visual AI model initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Visual AI model:', error);
      this.isModelLoaded = false;
    }
  }

  async generateCandidates(context) {
    if (!this.isModelLoaded || !this.model) {
      return [];
    }

    try {
      const screenshot = await this.page.screenshot({ fullPage, type: 'png' });
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

  async extractTargetFeatures(context, screenshot) {
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

  async findAIMatches(
    targetFeatures.Tensor, 
    context, 
    screenshot
  ) {
    const candidates = [];
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
          if (rect.width  0.5) {
          candidates.push({
            selector.selector,
            strategy.name,
            score,
            confidence,
            features: { visual, ai },
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

module.exports = { EnhancedVisualIntelligenceStrategy };