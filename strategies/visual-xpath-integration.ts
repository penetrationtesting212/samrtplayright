import { BaseHealingStrategy } from './base-strategy';
import { ElementContext, HealingCandidate } from '../types';

export class VisualXPathIntegration extends BaseHealingStrategy {
  constructor(page: any) {
    super(page, 'visual-xpath-integration');
  }

  async generateCandidates(context: ElementContext): Promise<HealingCandidate[]> {
    console.log('👁️ VisualXPathIntegration generating candidates');
    
    try {
      const visualInfo = await this.analyzeElementVisually(context);
      if (!visualInfo) return await this.generateBasicXPaths(context);
      
      const candidates: HealingCandidate[] = [];
      
      // Visual-enhanced XPaths
      candidates.push(...await this.generateVisualXPaths(context, visualInfo));
      candidates.push(...await this.generatePositionXPaths(context, visualInfo));
      candidates.push(...await this.generateStyleXPaths(context, visualInfo));
      
      return this.validateAndRank(candidates);
    } catch (error) {
      console.error('👁️ Error:', error);
      return await this.generateBasicXPaths(context);
    }
  }

  private async analyzeElementVisually(context: ElementContext): Promise<any> {
    try {
      return await this.page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement;
        if (!element) return null;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return {
          position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          styles: { backgroundColor: style.backgroundColor, display: style.display },
          isVisible: rect.width > 0 && rect.height > 0,
          isInteractive: ['button', 'input', 'a'].includes(element.tagName.toLowerCase()) || 
                        style.cursor === 'pointer',
          viewport: { width: window.innerWidth, height: window.innerHeight }
        };
      }, context.originalSelector);
    } catch {
      return null;
    }
  }

  private async generateVisualXPaths(context: ElementContext, visualInfo: any): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    const { attributes } = context;

    // Visually validated data-testid
    if (attributes?.['data-testid'] && visualInfo.isVisible) {
      candidates.push(this.createCandidate(
        `//*[@data-testid="${attributes['data-testid']}" and not(contains(@style, "display: none"))]`,
        0.95,
        { attribute: 1.0, visual: 1.0 },
        'Visually validated data-testid XPath'
      ));
    }

    // Interactive element validation
    if (visualInfo.isInteractive && attributes?.id) {
      candidates.push(this.createCandidate(
        `//*[@id="${attributes.id}" and (name()="button" or @role="button" or contains(@class, "btn"))]`,
        0.90,
        { interaction: 1.0, visual: 0.9 },
        'Interactive element XPath'
      ));
    }

    return candidates;
  }

  private async generatePositionXPaths(context: ElementContext, visualInfo: any): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    const { attributes } = context;
    const { position, viewport } = visualInfo;

    // Viewport area detection
    const relativeY = position.y / viewport.height;
    const identifier = attributes?.['data-testid'] || attributes?.id;
    
    if (identifier && relativeY < 0.2) { // Header area
      const attrName = attributes?.['data-testid'] ? 'data-testid' : 'id';
      candidates.push(this.createCandidate(
        `//ancestor::*[contains(@class, "header") or contains(@class, "nav")]//*[@${attrName}="${identifier}"]`,
        0.80,
        { position: 1.0, area: 1.0 },
        'Header area positioning XPath'
      ));
    }

    return candidates;
  }

  private async generateStyleXPaths(context: ElementContext, visualInfo: any): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    const { attributes, tagName } = context;

    // Button styling
    if (visualInfo.isInteractive && tagName.toLowerCase() === 'button') {
      candidates.push(this.createCandidate(
        `//*[name()="button" and @data-testid="${attributes?.['data-testid']}"]`,
        0.85,
        { style: 1.0, semantics: 1.0 },
        'Button element styling XPath'
      ));
    }

    // Form elements
    if (['input', 'select'].includes(tagName.toLowerCase()) && attributes?.name) {
      candidates.push(this.createCandidate(
        `//form//*[@name="${attributes.name}"]`,
        0.85,
        { form: 1.0, structure: 0.9 },
        'Form element context XPath'
      ));
    }

    return candidates;
  }

  private async generateBasicXPaths(context: ElementContext): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    const { attributes, textContent } = context;

    if (attributes?.['data-testid']) {
      candidates.push(this.createCandidate(
        `//*[@data-testid="${attributes['data-testid']}"]`,
        0.85,
        { attribute: 1.0, fallback: 1.0 },
        'Basic data-testid XPath'
      ));
    }

    if (textContent && textContent.length < 50) {
      candidates.push(this.createCandidate(
        `//*[contains(text(), "${textContent}")]`,
        0.70,
        { text: 0.8, fallback: 1.0 },
        'Basic text XPath'
      ));
    }

    return candidates;
  }

  private async validateAndRank(candidates: HealingCandidate[]): Promise<HealingCandidate[]> {
    const validated: HealingCandidate[] = [];
    
    for (const candidate of candidates) {
      try {
        const isValid = await this.validateCandidate(candidate.selector);
        if (isValid) {
          const count = await this.page.locator(candidate.selector).count();
          if (count === 1) candidate.confidence += 0.1; // Prefer unique selectors
          validated.push(candidate);
        }
      } catch {}
    }
    
    return validated.sort((a, b) => b.confidence - a.confidence);
  }
}