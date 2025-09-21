import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a custom render function that includes providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock data generators
export const mockExecution = {
  id: 'test-execution-123',
  testSuiteId: 'test-suite-456',
  status: 'passed' as const,
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-01-01T00:01:00Z',
  duration: 60000,
  summary: {
    total: 10,
    passed: 8,
    failed: 1,
    skipped: 1,
    healing: 2
  },
  results: [],
  healingActions: [],
  screenshots: [],
  logs: []
};

export const mockTestSuite = {
  id: 'test-suite-456',
  name: 'Sample Test Suite',
  description: 'A sample test suite for testing',
  url: 'https://example.com',
  tests: [
    {
      id: 'test-1',
      name: 'Sample Test',
      steps: [
        { type: 'navigate', target: 'https://example.com' },
        { type: 'click', target: '#submit-button' }
      ]
    }
  ],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

export const mockElement = {
  id: 'element-123',
  name: 'Submit Button',
  locator: '#submit-button',
  selectors: ['#submit-button', '.submit-btn', 'button[type="submit"]'],
  aiSelectors: ['#submit-button'],
  fallbackSelectors: ['button[type="submit"]'],
  metadata: {
    confidence: 0.95,
    visualSimilarity: 0.88,
    lastUpdated: '2024-01-01T00:00:00Z'
  }
};

// Mock API responses
export const mockApiResponses = {
  testSuites: {
    success: true,
    data: [mockTestSuite]
  },
  executions: {
    success: true,
    data: [mockExecution]
  },
  elements: {
    success: true,
    data: [mockElement]
  },
  aiAnalysis: {
    success: true,
    data: {
      confidence: 0.92,
      healingCandidates: [mockElement],
      visualSimilarity: 0.85
    }
  }
};