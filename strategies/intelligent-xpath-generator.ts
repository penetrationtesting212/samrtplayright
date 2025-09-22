import { BaseHealingStrategy } from './base-strategy';
import { ElementContext, HealingCandidate } from '../types';

export class IntelligentXPathGenerator extends BaseHealingStrategy {
  constructor(page: any) {
    super(page, 'intelligent-xpath-generator');
  }

  async generateCandidates(context: ElementContext): Promise<HealingCandidate[]> {
    console.log('🧠 IntelligentXPathGenerator generating candidates for:', {
      selector: context.originalSelector,
      tagName: context.tagName,
      attributes: context.attributes
    });
    
    const candidates: HealingCandidate[] = [];
    
    try {
      // 1. Semantic XPath Generation - High Priority
      const semanticCandidates = await this.generateSemanticXPaths(context);
      candidates.push(...semanticCandidates);
      
      // 2. Adaptive XPath with Fallbacks - Medium Priority
      const adaptiveCandidates = await this.generateAdaptiveXPaths(context);
      candidates.push(...adaptiveCandidates);
      
      // 3. AI-Optimized XPath Patterns - Medium Priority
      const optimizedCandidates = await this.generateOptimizedXPaths(context);
      candidates.push(...optimizedCandidates);
      
      // 4. Context-Aware XPath - Lower Priority
      const contextualCandidates = await this.generateContextualXPaths(context);
      candidates.push(...contextualCandidates);
      
      console.log(`🧠 Generated ${candidates.length} intelligent XPath candidates`);
      return this.validateAndRankCandidates(candidates);
      
    } catch (error) {
      console.error('🧠 Error in IntelligentXPathGenerator:', error);
      return [];
    }
  }

  private async generateSemanticXPaths(context: ElementContext): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    const { attributes, textContent, tagName } = context;

    // High-priority attribute-based XPaths
    if (attributes?.['data-testid']) {
      candidates.push(this.createCandidate(
        `//*[@data-testid="${attributes['data-testid']}"]`,
        0.95,
        { attribute: 1.0, specificity: 0.95, stability: 0.9 },
        'Semantic XPath using data-testid (highest reliability)'
      ));
      
      // Fuzzy data-testid matching for minor variations
      candidates.push(this.createCandidate(
        `//*[contains(@data-testid, "${attributes['data-testid'].split('-')[0]}")]`,
        0.85,
        { attribute: 0.9, specificity: 0.8, stability: 0.8 },
        'Fuzzy data-testid matching for variations'
      ));
    }

    if (attributes?.['data-test'] || attributes?.['data-cy']) {
      const testAttr = attributes['data-test'] || attributes['data-cy'];
      const attrName = attributes['data-test'] ? 'data-test' : 'data-cy';
      
      candidates.push(this.createCandidate(
        `//*[@${attrName}="${testAttr}"]`,
        0.90,
        { attribute: 0.95, specificity: 0.9, stability: 0.85 },
        `Semantic XPath using ${attrName}`
      ));
    }

    // ID-based semantic XPath with enhanced matching
    if (attributes?.id) {
      candidates.push(this.createCandidate(
        `//*[@id="${attributes.id}"]`,
        0.90,
        { attribute: 0.95, specificity: 0.9, stability: 0.8 },
        'Semantic XPath using stable ID'
      ));
      
      // Partial ID matching for dynamic IDs
      if (attributes.id.includes('-') || attributes.id.includes('_')) {
        const idParts = attributes.id.split(/[-_]/);
        const stablePart = idParts.find(part => part.length > 3) || idParts[0];
        
        candidates.push(this.createCandidate(
          `//*[contains(@id, "${stablePart}")]`,
          0.75,
          { attribute: 0.8, specificity: 0.7, stability: 0.7 },
          'Partial ID matching for dynamic identifiers'
        ));
      }
    }

    // Aria-label semantic XPath
    if (attributes?.['aria-label']) {
      candidates.push(this.createCandidate(
        `//*[@aria-label="${attributes['aria-label']}"]`,
        0.85,
        { attribute: 0.9, accessibility: 1.0, stability: 0.8 },
        'Semantic XPath using ARIA label (accessibility-first)'
      ));
      
      // Case-insensitive aria-label matching
      candidates.push(this.createCandidate(
        `//*[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), "${attributes['aria-label'].toLowerCase()}")]`,
        0.80,
        { attribute: 0.85, accessibility: 0.9, stability: 0.75 },
        'Case-insensitive ARIA label matching'
      ));
    }

    // Role-based semantic XPath with enhanced context
    if (attributes?.role) {
      const ariaLabel = attributes['aria-label'];
      const name = ariaLabel || textContent?.substring(0, 30);
      
      if (name) {
        candidates.push(this.createCandidate(
          `//*[@role="${attributes.role}" and (contains(@aria-label, "${name}") or contains(text(), "${name}"))]`,
          0.85,
          { role: 1.0, text: 0.8, accessibility: 0.9 },
          'Role-based semantic XPath with name matching'
        ));
      } else {
        candidates.push(this.createCandidate(
          `//*[@role="${attributes.role}"]`,
          0.75,
          { role: 1.0, accessibility: 0.8 },
          'Basic role-based semantic XPath'
        ));
      }
    }

    // Text-based semantic XPath with normalization
    if (textContent && textContent.length > 2 && textContent.length < 100) {
      const normalizedText = textContent.trim().replace(/\s+/g, ' ');
      
      candidates.push(this.createCandidate(
        `//*[normalize-space(text())="${normalizedText}"]`,
        0.70,
        { text: 1.0, specificity: 0.8 },
        'Normalized text-based semantic XPath'
      ));
      
      // Partial text matching for longer content
      if (normalizedText.length > 20) {
        const shortText = normalizedText.substring(0, 20);
        candidates.push(this.createCandidate(
          `//*[contains(normalize-space(text()), "${shortText}")]`,
          0.65,
          { text: 0.8, specificity: 0.6 },
          'Partial text matching for content stability'
        ));
      }
    }

    return candidates;
  }

  private async generateAdaptiveXPaths(context: ElementContext): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    const { attributes, tagName, textContent } = context;

    // Multi-level adaptive XPath with graceful degradation
    const adaptiveStrategies = [
      // Level 1: Precise targeting with multiple attributes
      {
        xpath: this.buildMultiAttributeXPath(attributes, tagName),
        confidence: 0.85,
        description: 'Multi-attribute adaptive targeting'
      },
      
      // Level 2: Form-aware adaptive XPath
      {
        xpath: await this.buildFormAwareXPath(context),
        confidence: 0.80,
        description: 'Form-context adaptive targeting'
      },
      
      // Level 3: Navigation-aware adaptive XPath
      {
        xpath: await this.buildNavigationAwareXPath(context),
        confidence: 0.75,
        description: 'Navigation-context adaptive targeting'
      },
      
      // Level 4: Container-aware adaptive XPath
      {
        xpath: await this.buildContainerAwareXPath(context),
        confidence: 0.70,
        description: 'Container-context adaptive targeting'
      }
    ];

    for (const strategy of adaptiveStrategies) {
      if (strategy.xpath && !strategy.xpath.includes('undefined') && !strategy.xpath.includes('null')) {
        candidates.push(this.createCandidate(
          strategy.xpath,
          strategy.confidence,
          { adaptive: 1.0, context: 0.8, fallback: 0.7 },
          strategy.description
        ));
      }
    }

    return candidates;
  }

  private async generateOptimizedXPaths(context: ElementContext): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    const { attributes, tagName } = context;

    // Performance-optimized XPath patterns
    const optimizedPatterns = [
      // Direct descendant optimization (faster than deep search)
      {
        xpath: `.//*[@${this.getBestAttributeSelector(attributes)}]`,
        confidence: 0.80,
        description: 'Direct descendant optimization for performance'
      },
      
      // Indexed positioning (more stable than absolute position)
      {
        xpath: this.buildIndexedXPath(attributes, tagName),
        confidence: 0.75,
        description: 'Indexed positioning for stability'
      },
      
      // Attribute combination optimization
      {
        xpath: this.buildAttributeCombinationXPath(attributes, tagName),
        confidence: 0.78,
        description: 'Optimized attribute combination'
      },
      
      // Hierarchical targeting with constraints
      {
        xpath: await this.buildHierarchicalXPath(context),
        confidence: 0.72,
        description: 'Hierarchical targeting with performance constraints'
      }
    ];

    optimizedPatterns.forEach((pattern, index) => {
      if (pattern.xpath && !pattern.xpath.includes('undefined')) {
        candidates.push(this.createCandidate(
          pattern.xpath,
          pattern.confidence - (index * 0.02), // Slight confidence decay
          { performance: 1.0, optimization: 0.9, stability: 0.8 },
          pattern.description
        ));
      }
    });

    return candidates;
  }

  private async generateContextualXPaths(context: ElementContext): Promise<HealingCandidate[]> {
    const candidates: HealingCandidate[] = [];
    
    // Analyze page context for framework-specific optimizations
    const pageContext = await this.analyzePageContext();
    
    // Framework-specific XPath patterns
    if (pageContext.isReactApp) {
      const reactXPath = this.buildReactOptimizedXPath(context);
      if (reactXPath) {
        candidates.push(this.createCandidate(
          reactXPath,
          0.80,
          { framework: 1.0, react: 1.0, context: 0.8 },
          'React-optimized XPath targeting'
        ));
      }
    }
    
    if (pageContext.hasAngular) {
      const angularXPath = this.buildAngularOptimizedXPath(context);
      if (angularXPath) {
        candidates.push(this.createCandidate(
          angularXPath,
          0.80,
          { framework: 1.0, angular: 1.0, context: 0.8 },
          'Angular-optimized XPath targeting'
        ));
      }
    }
    
    // Accessibility-first contextual XPath
    const a11yXPath = this.buildAccessibilityOptimizedXPath(context);
    if (a11yXPath) {
      candidates.push(this.createCandidate(
        a11yXPath,
        0.85,
        { accessibility: 1.0, inclusive: 1.0, context: 0.9 },
        'Accessibility-optimized XPath'
      ));
    }

    // Business logic context XPath
    const businessXPath = await this.buildBusinessContextXPath(context);
    if (businessXPath) {
      candidates.push(this.createCandidate(
        businessXPath,
        0.75,
        { business: 1.0, context: 0.8, semantic: 0.7 },
        'Business context-aware XPath'
      ));
    }

    return candidates;
  }

  // Helper methods for XPath building
  private buildMultiAttributeXPath(attributes: Record<string, string> | undefined, tagName: string): string {
    if (!attributes) return '';
    
    const priorityAttrs = ['data-testid', 'data-test', 'data-cy', 'id', 'name'];
    const conditions: string[] = [];
    
    for (const attr of priorityAttrs) {
      if (attributes[attr]) {
        conditions.push(`@${attr}="${attributes[attr]}"`);
      }
    }
    
    if (conditions.length === 0) return '';
    
    // Use OR conditions for fallback
    return `//*[${conditions.join(' or ')}]`;
  }

  private async buildFormAwareXPath(context: ElementContext): Promise<string> {
    const { attributes, tagName } = context;
    
    if (!attributes) return '';
    
    // Check if element is likely a form control
    const formTags = ['input', 'button', 'select', 'textarea'];
    const isFormElement = formTags.includes(tagName.toLowerCase());
    
    if (isFormElement && (attributes.name || attributes.id)) {
      const identifier = attributes.name || attributes.id;
      return `//form//*[@name="${identifier}" or @id="${identifier}"]`;
    }
    
    return '';
  }

  private async buildNavigationAwareXPath(context: ElementContext): Promise<string> {
    const { attributes, textContent } = context;
    
    if (attributes?.href || textContent) {
      const href = attributes.href;
      const text = textContent?.substring(0, 20);
      
      if (href && text) {
        const pathPart = this.extractPathFromHref(href);
        return `//nav//*[contains(@href, "${pathPart}") or contains(text(), "${text}")]`;
      } else if (text) {
        return `//nav//*[contains(text(), "${text}")]`;
      }
    }
    
    return '';
  }

  private async buildContainerAwareXPath(context: ElementContext): Promise<string> {
    const { attributes, tagName } = context;
    
    if (!attributes) return '';
    
    const identifier = attributes['data-testid'] || attributes.id || attributes.name;
    if (identifier) {
      return `//ancestor::*[contains(@class, "container") or contains(@class, "wrapper") or contains(@class, "content")]//*[@data-testid="${identifier}" or @id="${identifier}" or @name="${identifier}"]`;
    }
    
    return '';
  }

  private buildIndexedXPath(attributes: Record<string, string> | undefined, tagName: string): string {
    if (!attributes) return '';
    
    const primaryAttr = this.getBestAttributeSelector(attributes);
    if (primaryAttr) {
      return `//*[@${primaryAttr}][1]`; // First match for uniqueness
    }
    
    return '';
  }

  private buildAttributeCombinationXPath(attributes: Record<string, string> | undefined, tagName: string): string {
    if (!attributes) return '';
    
    const conditions: string[] = [];
    
    // Add tag constraint
    conditions.push(`name()="${tagName}"`);
    
    // Add attribute constraints in priority order
    const priorityAttrs = ['data-testid', 'id', 'name', 'type', 'role'];
    for (const attr of priorityAttrs) {
      if (attributes[attr]) {
        conditions.push(`@${attr}="${attributes[attr]}"`);
        break; // Use only the first available high-priority attribute
      }
    }
    
    return conditions.length > 1 ? `//*[${conditions.join(' and ')}]` : '';
  }

  private async buildHierarchicalXPath(context: ElementContext): Promise<string> {
    const { attributes } = context;
    
    if (!attributes) return '';
    
    const identifier = attributes['data-testid'] || attributes.id;
    if (identifier) {
      const attrName = attributes['data-testid'] ? 'data-testid' : 'id';
      return `//ancestor::*[position()<=3]//*[@${attrName}="${identifier}"]`;
    }
    
    return '';
  }

  private buildReactOptimizedXPath(context: ElementContext): string {
    const { attributes, textContent } = context;
    
    if (attributes?.['data-testid']) {
      return `//*[@data-testid="${attributes['data-testid']}" and (contains(@class, "react-") or ancestor::*[contains(@id, "react") or contains(@class, "react-")])]`;
    }
    
    if (textContent && textContent.length < 50) {
      return `//*[contains(@class, "react-") or ancestor::*[contains(@class, "react-")]]//*[contains(text(), "${textContent}")]`;
    }
    
    return '';
  }

  private buildAngularOptimizedXPath(context: ElementContext): string {
    const { attributes, textContent } = context;
    
    if (attributes?.['data-testid']) {
      return `//*[@data-testid="${attributes['data-testid']}" and (contains(@class, "ng-") or ancestor::*[contains(@class, "ng-") or @ng-app])]`;
    }
    
    if (textContent) {
      return `//*[contains(@class, "ng-") or ancestor::*[contains(@class, "ng-")]]//*[text()="${textContent}"]`;
    }
    
    return '';
  }

  private buildAccessibilityOptimizedXPath(context: ElementContext): string {
    const { attributes, textContent } = context;
    
    const a11yAttrs: string[] = [];
    
    if (attributes?.['aria-label']) a11yAttrs.push(`@aria-label="${attributes['aria-label']}"`);
    if (attributes?.title) a11yAttrs.push(`@title="${attributes.title}"`);
    if (attributes?.alt) a11yAttrs.push(`@alt="${attributes.alt}"`);
    if (attributes?.role) a11yAttrs.push(`@role="${attributes.role}"`);
    
    if (a11yAttrs.length > 0) {
      return `//*[${a11yAttrs.join(' or ')}]`;
    }
    
    return '';
  }

  private async buildBusinessContextXPath(context: ElementContext): Promise<string> {
    const { attributes, textContent, tagName } = context;
    
    // Business logic patterns
    const businessPatterns = [
      { pattern: 'submit', xpath: '//form//*[contains(@type, "submit") or contains(@class, "submit") or contains(text(), "Submit")]' },
      { pattern: 'login', xpath: '//*[contains(@class, "login") or contains(@id, "login") or contains(text(), "Login") or contains(text(), "Sign")]' },
      { pattern: 'search', xpath: '//*[contains(@class, "search") or contains(@placeholder, "search") or contains(@aria-label, "search")]' },
      { pattern: 'cart', xpath: '//*[contains(@class, "cart") or contains(text(), "Cart") or contains(@aria-label, "cart")]' }
    ];
    
    const text = textContent?.toLowerCase() || '';
    const className = attributes?.class?.toLowerCase() || '';
    const id = attributes?.id?.toLowerCase() || '';
    
    for (const { pattern, xpath } of businessPatterns) {
      if (text.includes(pattern) || className.includes(pattern) || id.includes(pattern)) {
        return xpath;
      }
    }
    
    return '';
  }

  // Utility methods
  private getBestAttributeSelector(attributes: Record<string, string> | undefined): string {
    if (!attributes) return '';
    
    const priority = ['data-testid', 'data-test', 'data-cy', 'id', 'name', 'aria-label', 'title'];
    for (const attr of priority) {
      if (attributes[attr]) {
        return `${attr}="${attributes[attr]}"`;
      }
    }
    return '';
  }

  private extractPathFromHref(href: string | undefined): string {
    if (!href) return '';
    
    try {
      const url = new URL(href, 'https://example.com');
      return url.pathname;
    } catch {
      return href.split('/').pop() || '';
    }
  }

  private async analyzePageContext(): Promise<{isReactApp: boolean, hasAngular: boolean}> {
    try {
      return await this.page.evaluate(() => {
        return {
          isReactApp: !!(window as any).React || 
                     document.querySelector('[data-reactroot]') !== null ||
                     document.querySelector('*[class*="react-"]') !== null,
          hasAngular: !!(window as any).angular || 
                     document.querySelector('[ng-app]') !== null ||
                     document.querySelector('*[class*="ng-"]') !== null
        };
      });
    } catch {
      return { isReactApp: false, hasAngular: false };
    }
  }

  private async validateAndRankCandidates(candidates: HealingCandidate[]): Promise<HealingCandidate[]> {
    const validatedCandidates: HealingCandidate[] = [];
    
    for (const candidate of candidates) {
      try {
        const isValid = await this.validateCandidate(candidate.selector);
        if (isValid) {
          validatedCandidates.push(candidate);
        }
      } catch {
        // Skip invalid candidates
      }
    }
    
    // Sort by confidence and feature scores
    return validatedCandidates.sort((a, b) => {
      const scoreA = a.confidence + (a.features.stability || 0) * 0.3;
      const scoreB = b.confidence + (b.features.stability || 0) * 0.3;
      return scoreB - scoreA;
    });
  }
}