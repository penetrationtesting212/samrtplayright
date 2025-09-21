import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AllureReportModal from '../../components/AllureReportModal';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen,
});

describe('AllureReportModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    executionId: 'test-execution-123',
    executionName: 'Test Execution',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders correctly when open', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: true,
        generated: true,
        lastModified: '2024-01-01T12:00:00Z',
        reportPath: '/reports/test-execution-123/index.html',
      }),
    });

    render(<AllureReportModal {...defaultProps} />);

    expect(screen.getByText('Allure Report')).toBeInTheDocument();
    expect(screen.getByText('Test Execution')).toBeInTheDocument();
    expect(screen.getByText('Checking report status...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/allure/status/test-execution-123');
    });
  });

  it('does not render when closed', () => {
    render(<AllureReportModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Allure Report')).not.toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<AllureReportModal {...defaultProps} />);
    
    expect(screen.getByText('Checking report status...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });

  it('displays existing report with iframe', async () => {
    const reportData = {
      exists: true,
      generated: true,
      lastModified: '2024-01-01T12:00:00Z',
      reportPath: '/reports/test-execution-123/index.html',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => reportData,
    });

    render(<AllureReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Report generated on/)).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('Allure Report');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', reportData.reportPath);

    const openTabButton = screen.getByRole('button', { name: /open in new tab/i });
    expect(openTabButton).toBeInTheDocument();
  });

  it('displays no report available state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: false,
        generated: false,
      }),
    });

    render(<AllureReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Allure Report Available')).toBeInTheDocument();
    });

    expect(screen.getByText('Generate an Allure report for this execution to view detailed test results.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Allure Report' })).toBeInTheDocument();
  });

  it('displays error state when API call fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<AllureReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('handles API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Report not found' }),
    });

    render(<AllureReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Report not found')).toBeInTheDocument();
  });

  it('generates report when button is clicked', async () => {
    // First call - no report exists
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: false,
        generated: false,
      }),
    });

    // Second call - generate report
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Third call - check status after generation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: true,
        generated: true,
        lastModified: '2024-01-01T12:00:00Z',
        reportPath: '/reports/test-execution-123/index.html',
      }),
    });

    render(<AllureReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Allure Report Available')).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: 'Generate Allure Report' });
    fireEvent.click(generateButton);

    expect(screen.getByText('Generating Report...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/allure/generate/test-execution-123', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: true }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Report generated on/)).toBeInTheDocument();
    });
  });

  it('handles generate report error', async () => {
    // First call - no report exists
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: false,
        generated: false,
      }),
    });

    // Second call - generate report fails
    mockFetch.mockRejectedValueOnce(new Error('Generation failed'));

    render(<AllureReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No Allure Report Available')).toBeInTheDocument();
    });

    const generateButton = screen.getByRole('button', { name: 'Generate Allure Report' });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to generate report')).toBeInTheDocument();
  });

  it('opens report in new tab when button is clicked', async () => {
    const reportData = {
      exists: true,
      generated: true,
      lastModified: '2024-01-01T12:00:00Z',
      reportPath: '/reports/test-execution-123/index.html',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => reportData,
    });

    render(<AllureReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open in new tab/i })).toBeInTheDocument();
    });

    const openTabButton = screen.getByRole('button', { name: /open in new tab/i });
    fireEvent.click(openTabButton);

    expect(mockWindowOpen).toHaveBeenCalledWith(reportData.reportPath, '_blank');
  });

  it('refreshes report status when refresh button is clicked', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        exists: true,
        generated: true,
        lastModified: '2024-01-01T12:00:00Z',
        reportPath: '/reports/test-execution-123/index.html',
      }),
    });

    render(<AllureReportModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('calls onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: false,
        generated: false,
      }),
    });

    render(<AllureReportModal {...defaultProps} onClose={mockOnClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('displays execution name when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: false,
        generated: false,
      }),
    });

    render(<AllureReportModal {...defaultProps} executionName="My Custom Test" />);

    expect(screen.getByText('My Custom Test')).toBeInTheDocument();
  });

  it('displays fallback execution ID when name not provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: false,
        generated: false,
      }),
    });

    render(<AllureReportModal {...defaultProps} executionName={undefined} />);

    expect(screen.getByText('Execution test-execution-123')).toBeInTheDocument();
  });

  it('does not check status when modal is closed', () => {
    render(<AllureReportModal {...defaultProps} isOpen={false} />);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('checks status when modal opens', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exists: false,
        generated: false,
      }),
    });

    const { rerender } = render(<AllureReportModal {...defaultProps} isOpen={false} />);
    expect(mockFetch).not.toHaveBeenCalled();

    rerender(<AllureReportModal {...defaultProps} isOpen={true} />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/allure/status/test-execution-123');
    });
  });
});