import { Page } from 'playwright';
import { HealingStrategy, ElementCandidate, ElementContext } from '../types';
import { ImageProcessor } from './utils/image-processor';
import ssim from 'ssim.js';
import * as jimp from 'jimp';

export class SSIMHealingStrategy implements HealingStrategy {
  name = 'SSIM Visual Healing';
  priority = 95; // High priority for visual accuracy
  private imageProcessor: ImageProcessor;

  constructor(private page: Page) {
    this.imageProcessor = ImageProcessor.getInstance();
  }

  async findCandidates(context: ElementContext): Promise<ElementCandidate[]> {
    try {
      console.log(`🔍 SSIM Healing: Searching for visually similar elements...`);
      
      // Take current screenshot
      const currentScreenshot = await this.page.screenshot({ type: 'png' });
      
      // Get all interactive elements
      const elements = await this.page.evaluate(() => {
        const interactiveSelector = 'button, input, select, textarea, a, [role="button"], [onclick], [tabindex]';
        const elements = Array.from(document.querySelectorAll(interactiveSelector));
        
        return elements.map((el, index) => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);
          
          return {
            selector: this.generateSelector(el, index),
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            text: el.textContent?.trim() || '',
            tag: el.tagName.toLowerCase(),
            attributes: {
              id: el.id,
              class: el.className,
              type: (el as HTMLInputElement).type || null,
              role: el.getAttribute('role'),
              'aria-label': el.getAttribute('aria-label')
            },
            visible: styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
            enabled: !(el as HTMLInputElement).disabled
          };
        });
        
        function generateSelector(element: Element, fallbackIndex: number): string {
          // Try ID first
          if (element.id) {
            return `#${element.id}`;
          }
          
          // Try data attributes
          const dataTestId = element.getAttribute('data-testid') || element.getAttribute('data-test');
          if (dataTestId) {
            return `[data-testid="${dataTestId}"], [data-test="${dataTestId}"]`;
          }
          
          // Try class-based selector
          if (element.className) {
            const classes = element.className.split(' ').filter(c => c.length > 0);
            if (classes.length > 0) {
              return `.${classes.join('.')}`;
            }
          }
          
          // Fallback to nth-child
          return `${element.tagName.toLowerCase()}:nth-child(${fallbackIndex + 1})`;
        }
      });

      const candidates: ElementCandidate[] = [];
      
      // Process elements with SSIM-based visual comparison
      for (const elementInfo of elements) {
        if (!elementInfo.visible || elementInfo.boundingBox.width < 10 || elementInfo.boundingBox.height < 10) {
          continue;
        }

        try {
          // Calculate visual similarity using SSIM
          const ssimScore = await this.calculateElementSSIM(
            currentScreenshot,
            elementInfo.boundingBox,
            context
          );

          if (ssimScore > 0.3) { // Threshold for potential matches
            const confidence = this.calculateConfidence(ssimScore, elementInfo, context);
            
            candidates.push({
              selector: elementInfo.selector,
              strategy: this.name,
              score: ssimScore,
              confidence,
              features: {
                ssim: ssimScore,
                visual: ssimScore,
                textMatch: this.calculateTextSimilarity(elementInfo.text, context.expectedText || ''),
                attributeMatch: this.calculateAttributeSimilarity(elementInfo.attributes, context)
              },
              reasoning: `SSIM visual match: ${(ssimScore * 100).toFixed(1)}%, confidence: ${(confidence * 100).toFixed(1)}%`,
              metadata: {
                boundingBox: elementInfo.boundingBox,
                elementInfo
              }
            });
          }
        } catch (error) {
          console.warn(`SSIM calculation failed for element:`, error);
          continue;
        }
      }

      console.log(`📊 SSIM Healing found ${candidates.length} visual candidates`);
      return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    } catch (error) {
      console.error('Error in SSIM healing strategy:', error);
      return [];
    }
  }

  private async calculateElementSSIM(
    screenshot: Buffer,
    boundingBox: { x: number; y: number; width: number; height: number },
    context: ElementContext
  ): Promise<number> {
    try {
      // Extract element region from screenshot
      const fullImage = await jimp.read(screenshot);
      const elementImage = fullImage.crop(
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height
      );

      // If we have a reference image from context, compare directly
      if (context.referenceImage) {
        const referenceImage = await jimp.read(context.referenceImage);
        return await this.compareImagesWithSSIM(elementImage, referenceImage);
      }

      // Otherwise, use pattern-based analysis
      return await this.analyzeElementPattern(elementImage, context);
    } catch (error) {
      console.error('Error calculating element SSIM:', error);
      return 0;
    }
  }

  private async compareImagesWithSSIM(image1: jimp, image2: jimp): Promise<number> {
    try {
      // Resize images to same dimensions
      const targetSize = Math.min(
        image1.getWidth(), image1.getHeight(),
        image2.getWidth(), image2.getHeight(),
        128 // Max size for performance
      );
      
      image1.resize(targetSize, targetSize);
      image2.resize(targetSize, targetSize);

      // Convert to format compatible with ssim.js
      const imageData1 = {
        data: new Uint8ClampedArray(image1.bitmap.data),
        width: image1.getWidth(),
        height: image1.getHeight()
      };

      const imageData2 = {
        data: new Uint8ClampedArray(image2.bitmap.data),
        width: image2.getWidth(),
        height: image2.getHeight()
      };

      const result = ssim(imageData1, imageData2);
      return result.mssim;
    } catch (error) {
      console.error('Error in SSIM comparison:', error);
      return 0;
    }
  }

  private async analyzeElementPattern(image: jimp, context: ElementContext): Promise<number> {
    try {
      // Basic pattern analysis based on element properties
      let score = 0.5; // Base score

      // Analyze image characteristics
      const { width, height } = image.bitmap;
      const aspectRatio = width / height;

      // Expected characteristics based on element type
      if (context.tagName === 'button') {
        // Buttons typically have certain aspect ratios and visual patterns
        if (aspectRatio > 0.3 && aspectRatio < 3.0) score += 0.2;
      } else if (context.tagName === 'input') {
        // Input fields typically have different characteristics
        if (aspectRatio > 2.0) score += 0.2; // Wider inputs
      }

      // Analyze color distribution for visual consistency
      const colorAnalysis = this.analyzeColorDistribution(image);
      if (colorAnalysis.hasDefinedStructure) score += 0.1;

      return Math.min(score, 1.0);
    } catch (error) {
      console.error('Error analyzing element pattern:', error);
      return 0;
    }
  }

  private analyzeColorDistribution(image: jimp): { hasDefinedStructure: boolean; dominantColors: number } {
    try {
      const pixels = image.bitmap.data;
      const colorCounts = new Map<string, number>();

      // Sample pixels for color analysis
      for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const color = `${Math.floor(r/32)}-${Math.floor(g/32)}-${Math.floor(b/32)}`; // Reduce color space
        
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
      }

      const uniqueColors = colorCounts.size;
      const hasDefinedStructure = uniqueColors > 3 && uniqueColors < 20; // Sweet spot for UI elements

      return { hasDefinedStructure, dominantColors: uniqueColors };
    } catch (error) {
      return { hasDefinedStructure: false, dominantColors: 0 };
    }
  }

  private calculateConfidence(
    ssimScore: number,
    elementInfo: any,
    context: ElementContext
  ): number {
    let confidence = ssimScore * 0.6; // Base confidence from SSIM

    // Boost confidence based on additional factors
    if (elementInfo.tag === context.tagName) {
      confidence += 0.15;
    }

    if (elementInfo.text && context.expectedText) {
      const textSimilarity = this.calculateTextSimilarity(elementInfo.text, context.expectedText);
      confidence += textSimilarity * 0.15;
    }

    if (elementInfo.attributes.id && context.attributes?.id) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const clean1 = text1.toLowerCase().trim();
    const clean2 = text2.toLowerCase().trim();
    
    if (clean1 === clean2) return 1.0;
    if (clean1.includes(clean2) || clean2.includes(clean1)) return 0.8;
    
    // Simple Levenshtein-based similarity
    const maxLen = Math.max(clean1.length, clean2.length);
    const distance = this.levenshteinDistance(clean1, clean2);
    return Math.max(0, 1 - distance / maxLen);
  }

  private calculateAttributeSimilarity(attributes: any, context: ElementContext): number {
    let similarity = 0;
    let checks = 0;

    if (context.attributes) {
      for (const [key, value] of Object.entries(context.attributes)) {
        checks++;
        if (attributes[key] === value) {
          similarity += 1;
        }
      }
    }

    return checks > 0 ? similarity / checks : 0;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  async dispose() {
    // Cleanup if needed
  }
}