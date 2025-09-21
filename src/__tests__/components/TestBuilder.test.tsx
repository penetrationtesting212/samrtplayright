import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import TestBuilder from '../../pages/TestBuilder';
import { mockApiResponses, mockAIServices } from '../mocks/api-mocks';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'test-suite-123' }),
  useNavigate: () => vi.fn(),
}));

// Mock API endpoints
global.fetch = vi.fn();

describe('TestBuilder Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/codegen/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: { sessions: [] }
          })
        });
      }
      
      if (url.includes('/api/ai/elements')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponses.elements)
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });
  });

  it('renders TestBuilder component correctly', async () => {
    render(<TestBuilder />);
    
    // Check for main elements
    expect(screen.getByText('Test Suite Builder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Test Suite Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description')).toBeInTheDocument();
  });

  it('allows adding new test steps', async () => {
    render(<TestBuilder />);
    
    // Find and click the "Add Step" button
    const addStepButton = screen.getByText('Add Step');
    fireEvent.click(addStepButton);
    
    await waitFor(() => {
      expect(screen.getByText('Navigate')).toBeInTheDocument();
      expect(screen.getByText('Click')).toBeInTheDocument();
      expect(screen.getByText('Fill')).toBeInTheDocument();
    });
  });

  it('handles form submission correctly', async () => {
    render(<TestBuilder />);
    
    // Fill in the form
    const nameInput = screen.getByPlaceholderText('Test Suite Name');
    const descriptionInput = screen.getByPlaceholderText('Description');
    
    fireEvent.change(nameInput, { target: { value: 'My Test Suite' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
    
    // Submit the form
    const saveButton = screen.getByText('Save Test Suite');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test-suites'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('My Test Suite')
        })
      );
    });
  });

  it('handles AI element discovery', async () => {
    render(<TestBuilder />);
    
    // Find and click the AI discover button
    const discoverButton = screen.getByText('AI Discover');
    fireEvent.click(discoverButton);
    
    // Enter URL for discovery
    const urlInput = screen.getByPlaceholderText('Enter URL to inspect');
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    
    const startButton = screen.getByText('Start Discovery');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/elements'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  it('displays validation errors for required fields', async () => {
    render(<TestBuilder />);
    
    // Try to submit without filling required fields
    const saveButton = screen.getByText('Save Test Suite');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test suite name is required')).toBeInTheDocument();
    });
  });

  it('handles browser selection correctly', async () => {
    render(<TestBuilder />);
    
    // Find browser select dropdown
    const browserSelect = screen.getByRole('combobox', { name: /browser/i });
    
    // Change browser selection
    fireEvent.change(browserSelect, { target: { value: 'firefox' } });
    
    expect(browserSelect.value).toBe('firefox');
  });

  it('supports test template selection', async () => {
    render(<TestBuilder />);
    
    // Find and click templates button
    const templatesButton = screen.getByText('Templates');
    fireEvent.click(templatesButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test Templates')).toBeInTheDocument();
    });
  });

  it('handles codegen import functionality', async () => {
    const mockSessions = [
      { id: 'session-1', name: 'Login Test', createdAt: '2024-01-01T00:00:00Z' }
    ];
    
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/codegen/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: { sessions: mockSessions }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });
    
    render(<TestBuilder />);
    
    // Find and click import button
    const importButton = screen.getByText('Import from Codegen');
    fireEvent.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText('Import Generated Code')).toBeInTheDocument();
    });
  });

  it('integrates with AI healing strategies', async () => {
    render(<TestBuilder />);
    
    // Test AI healing integration
    const aiHealingButton = screen.getByText('AI Healing');
    fireEvent.click(aiHealingButton);
    
    await waitFor(() => {
      expect(screen.getByText('AI-Powered Element Healing')).toBeInTheDocument();
    });
  });

  it('handles test execution with real-time updates', async () => {
    render(<TestBuilder />);
    
    // Mock WebSocket for real-time updates
    const mockWebSocket = {
      send: vi.fn(),
      addEventListener: vi.fn(),
      close: vi.fn(),
      readyState: 1
    };
    
    global.WebSocket = vi.fn(() => mockWebSocket) as any;
    
    // Find and click run test button
    const runButton = screen.getByText('Run Test');
    fireEvent.click(runButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test Execution')).toBeInTheDocument();
    });
  });

  it('supports visual similarity matching in element selection', async () => {
    render(<TestBuilder />);
    
    // Test visual similarity features
    const visualButton = screen.getByText('Visual Match');
    fireEvent.click(visualButton);
    
    await waitFor(() => {
      expect(screen.getByText('Visual Similarity Matching')).toBeInTheDocument();
    });
  });

  it('handles proactive healing strategy configuration', async () => {
    render(<TestBuilder />);
    
    // Test proactive healing configuration
    const healingButton = screen.getByText('Proactive Healing');
    fireEvent.click(healingButton);
    
    await waitFor(() => {
      expect(screen.getByText('Proactive Healing Configuration')).toBeInTheDocument();
    });
  });
});