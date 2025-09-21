import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import CodegenRecorder from '../../components/CodegenRecorder';
import { mockApiResponses, mockWebSocket } from '../mocks/api-mocks';

// Mock WebSocket
global.WebSocket = vi.fn(() => mockWebSocket);

describe('CodegenRecorder Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    
    // Default fetch mock implementation
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/codegen/templates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: { templates: [] }
          })
        });
      }
      
      if (url.includes('/api/codegen/export/formats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: { formats: ['javascript', 'typescript', 'python'] }
          })
        });
      }
      
      if (url.includes('/api/codegen/healing/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            stats: { successRate: 85, totalAttempts: 100 }
          })
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'success' })
      });
    });
  });

  it('renders CodegenRecorder component correctly', async () => {
    render(<CodegenRecorder />);
    
    await waitFor(() => {
      expect(screen.getByText('Code Generator & Recorder')).toBeInTheDocument();
      expect(screen.getByText('Start Recording')).toBeInTheDocument();
    });
  });

  it('handles recording session start/stop', async () => {
    render(<CodegenRecorder />);
    
    // Start recording
    const startButton = screen.getByText('Start Recording');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(screen.getByText('Stop Recording')).toBeInTheDocument();
    });
    
    // Stop recording
    const stopButton = screen.getByText('Stop Recording');
    fireEvent.click(stopButton);
    
    await waitFor(() => {
      expect(screen.getByText('Start Recording')).toBeInTheDocument();
    });
  });

  it('configures recording options correctly', async () => {
    render(<CodegenRecorder />);
    
    // Open settings
    const settingsButton = screen.getByLabelText('Settings');
    fireEvent.click(settingsButton);
    
    await waitFor(() => {
      expect(screen.getByText('Recording Options')).toBeInTheDocument();
    });
    
    // Change browser option
    const browserSelect = screen.getByRole('combobox', { name: /browser/i });
    fireEvent.change(browserSelect, { target: { value: 'firefox' } });
    
    expect(browserSelect.value).toBe('firefox');
  });

  it('handles code generation and display', async () => {
    render(<CodegenRecorder />);
    
    // Mock generated code
    const mockCode = `
      const { test, expect } = require('@playwright/test');
      test('example test', async ({ page }) => {
        await page.goto('https://example.com');
        await page.click('#button');
      });
    `;
    
    // Simulate code generation
    (global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          data: { code: mockCode }
        })
      })
    );
    
    const generateButton = screen.getByText('Generate Code');
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue(mockCode.trim())).toBeInTheDocument();
    });
  });

  it('supports language and template selection', async () => {
    render(<CodegenRecorder />);
    
    // Test language selection
    const languageSelect = screen.getByRole('combobox', { name: /language/i });
    fireEvent.change(languageSelect, { target: { value: 'typescript' } });
    
    expect(languageSelect.value).toBe('typescript');
    
    // Test template selection
    const templateSelect = screen.getByRole('combobox', { name: /template/i });
    fireEvent.change(templateSelect, { target: { value: 'typescript-playwright' } });
    
    expect(templateSelect.value).toBe('typescript-playwright');
  });

  it('handles test execution with real-time updates', async () => {
    render(<CodegenRecorder />);
    
    // Mock test code
    const testCode = 'test("example", async () => {});';
    
    // Set up test code
    const codeInput = screen.getByRole('textbox', { name: /generated code/i });
    fireEvent.change(codeInput, { target: { value: testCode } });
    
    // Mock test execution
    (global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          executionId: 'test-execution-123'
        })
      })
    );
    
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/codegen/run'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(testCode)
        })
      );
    });
  });

  it('displays healing statistics', async () => {
    render(<CodegenRecorder />);
    
    await waitFor(() => {
      expect(screen.getByText('AI Healing Stats')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument(); // Success rate
    });
  });

  it('handles code export functionality', async () => {
    render(<CodegenRecorder />);
    
    // Open export modal
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);
    
    await waitFor(() => {
      expect(screen.getByText('Export Options')).toBeInTheDocument();
    });
    
    // Select export format
    const formatSelect = screen.getByRole('combobox', { name: /export format/i });
    fireEvent.change(formatSelect, { target: { value: 'typescript' } });
    
    // Export code
    const confirmExportButton = screen.getByText('Export Code');
    fireEvent.click(confirmExportButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/codegen/export'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  it('integrates with AI healing capabilities', async () => {
    render(<CodegenRecorder />);
    
    // Check healing mode toggle
    const healingToggle = screen.getByRole('checkbox', { name: /healing mode/i });
    fireEvent.click(healingToggle);
    
    expect(healingToggle).toBeChecked();
    
    // Verify healing integration
    await waitFor(() => {
      expect(screen.getByText('AI Healing Enabled')).toBeInTheDocument();
    });
  });

  it('handles WebSocket connection for real-time updates', async () => {
    render(<CodegenRecorder />);
    
    // Verify WebSocket connection
    await waitFor(() => {
      expect(global.WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('/codegen')
      );
    });
    
    // Check connection status indicator
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('supports POM (Page Object Model) conversion', async () => {
    render(<CodegenRecorder />);
    
    // Mock POM conversion
    (global.fetch as any).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          data: { pomCode: 'class GeneratedPage {}' }
        })
      })
    );
    
    const pomButton = screen.getByText('Convert to POM');
    fireEvent.click(pomButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/codegen/pom'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  it('displays recording actions and timeline', async () => {
    render(<CodegenRecorder />);
    
    // Mock recording actions
    const mockActions = [
      { type: 'click', target: '#button', timestamp: Date.now() },
      { type: 'fill', target: '#input', value: 'test', timestamp: Date.now() + 1000 }
    ];
    
    // Simulate receiving actions via WebSocket
    const wsMessage = {
      type: 'recordingAction',
      data: { actions: mockActions }
    };
    
    // Trigger WebSocket message
    if (mockWebSocket.addEventListener.mock.calls.length > 0) {
      const messageHandler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: JSON.stringify(wsMessage)
        });
      }
    }
    
    await waitFor(() => {
      expect(screen.getByText('Recording Timeline')).toBeInTheDocument();
    });
  });
});