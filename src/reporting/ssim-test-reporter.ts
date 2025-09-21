import { allure } from 'allure-playwright';
import { Page } from '@playwright/test';
import { ImageProcessor } from '../strategies/utils/image-processor';

export class SSIMTestReporter {
  private imageProcessor: ImageProcessor;
  private testMetrics: Map<string, any> = new Map();

  constructor() {
    this.imageProcessor = ImageProcessor.getInstance();
  }

  async initialize(): Promise<void> {
    console.log('📊 SSIM Test Reporter initialized');
  }

  async recordSSIMMetrics(
    stepName: string,
    page: Page,
    options: {
      referenceImage?: Buffer;
      elementSelector?: string;
      description?: string;
    } = {}
  ): Promise<void> {
    try {
      const screenshot = await page.screenshot({ type: 'png' });
      const timestamp = new Date().toISOString();
      
      const metrics: any = {
        stepName,
        timestamp,
        description: options.description || `SSIM analysis for ${stepName}`,
        screenshot: screenshot.toString('base64')
      };

      // Calculate SSIM if reference provided
      if (options.referenceImage) {
        const ssimScore = await this.imageProcessor.calculateSSIMJS(
          screenshot,
          options.referenceImage
        );
        
        metrics.ssim = {
          score: ssimScore,
          status: this.getSSIMStatus(ssimScore)
        };
      }

      this.testMetrics.set(`${stepName}_${timestamp}`, metrics);
      await this.addToAllureReport(metrics);
      
      console.log(`📊 SSIM metrics recorded for: ${stepName}`);
    } catch (error) {
      console.error(`Failed to record SSIM metrics:`, error);
    }
  }

  private getSSIMStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 0.95) return 'excellent';
    if (score >= 0.85) return 'good';
    if (score >= 0.70) return 'fair';
    return 'poor';
  }

  private async addToAllureReport(metrics: any): Promise<void> {
    try {
      await allure.step(`SSIM Analysis: ${metrics.stepName}`, async () => {
        await allure.description(metrics.description);
        await allure.attachment('Screenshot', Buffer.from(metrics.screenshot, 'base64'), 'image/png');
        
        if (metrics.ssim) {
          await allure.parameter('SSIM Score', metrics.ssim.score.toFixed(4));
          await allure.parameter('SSIM Status', metrics.ssim.status);
        }
      });
    } catch (error) {
      console.error('Failed to add SSIM metrics to Allure:', error);
    }
  }

  async generateTestReport() {
    const allMetrics = Array.from(this.testMetrics.values());
    const ssimMetrics = allMetrics.filter(m => m.ssim);
    
    let totalSSIM = 0;
    let excellentCount = 0;
    
    for (const metric of ssimMetrics) {
      totalSSIM += metric.ssim.score;
      if (metric.ssim.status === 'excellent') excellentCount++;
    }
    
    const averageSSIM = ssimMetrics.length > 0 ? totalSSIM / ssimMetrics.length : 0;
    
    return {
      summary: {
        totalSteps: allMetrics.length,
        ssimAnalyses: ssimMetrics.length,
        averageSSIM,
        excellentMatches: excellentCount
      },
      recommendations: [
        averageSSIM > 0.9 ? 'Excellent visual consistency' : 'Consider investigating visual variations'
      ]
    };
  }

  clearMetrics(): void {
    this.testMetrics.clear();
  }
}

export const ssimReporter = new SSIMTestReporter();