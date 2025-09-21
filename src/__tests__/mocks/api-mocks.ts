// Mock implementations for API services
export const mockPlaywrightService = {
  isReady: () => true,
  executeTestSuite: async () => ({
    success: true,
    results: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
  }),
  startRecording: async () => ({ sessionId: 'test-session' }),
  stopRecording: async () => ({ code: 'test code' })
};

export const mockEnhancedVisualAIService = {
  analyzeElements: async () => ({
    elements: [],
    confidence: 0.95,
    healingCandidates: []
  }),
  compareVisualSimilarity: async () => ({
    similarity: 0.88,
    confidence: 0.92
  }),
  generateHealingStrategies: async () => ({
    strategies: [],
    successProbability: 0.85
  })
};

export const mockPredictiveHealingService = {
  analyzeFailureRisk: async () => ({
    riskScore: 0.3,
    confidence: 0.87,
    recommendations: []
  }),
  generateProactiveHealingPlan: async () => ({
    healingPlan: [],
    successProbability: 0.82
  }),
  predictSelectorStability: async () => ({
    stability: 0.91,
    confidence: 0.89
  })
};

export const mockTestRunnerService = {
  runAdhocCode: async () => 'test-execution-id',
  getExecution: async () => null,
  getExecutions: async () => [],
  stopExecution: async () => ({ id: 'test-id', status: 'stopped' })
};

// Mock WebSocket connection
export const mockWebSocket = {
  send: () => {},
  close: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  readyState: 1
};

// Mock localStorage
export const mockLocalStorage = {
  getItem: (key: string) => null,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
  clear: () => {}
};

// Mock AI services
export const mockAIServices = {
  visualAI: mockEnhancedVisualAIService,
  predictiveHealing: mockPredictiveHealingService,
  testRunner: mockTestRunnerService
};