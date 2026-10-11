import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { calculateIndicativeValuation } from '../src/utils/valuation';
import { CollectorHome } from '../src/pages/collector/CollectorHome';
import { CollectorHistory } from '../src/pages/collector/CollectorHistory';
import { HubInventory } from '../src/pages/hub/HubInventory';
import { DestinationCompleted } from '../src/pages/destination/DestinationCompleted';
import { AdminHome } from '../src/pages/admin/AdminHome';
import { BrowserRouter } from 'react-router-dom';

// Mocks
jest.mock('../src/api/requests', () => ({
  requestsApi: {
    list: jest.fn().mockResolvedValue({ items: [] }),
    accept: jest.fn().mockResolvedValue({}),
    reject: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../src/api/devices', () => ({
  devicesApi: {
    list: jest.fn().mockResolvedValue({
      items: [
        {
          deviceId: 'test-device-uuid-1',
          category: 'LAPTOP',
          brand: 'Dell',
          model: 'XPS 15',
          condition: 'EXCELLENT',
          lifecycleState: 'PROCESSED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 5,
        },
        {
          deviceId: 'test-device-uuid-2',
          category: 'SMARTPHONE',
          brand: 'Apple',
          model: 'iPhone 13',
          condition: 'WORKING',
          lifecycleState: 'VERIFIED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 6,
        },
      ],
    }),
    get: jest.fn().mockResolvedValue({
      deviceId: 'test-device-uuid-1',
      category: 'LAPTOP',
      brand: 'Dell',
      model: 'XPS 15',
      condition: 'EXCELLENT',
      lifecycleState: 'PROCESSED',
      version: 5,
    }),
  },
}));

jest.mock('../src/api/commercial', () => ({
  commercialApi: {
    listTransactions: jest.fn().mockResolvedValue({ items: [] }),
  },
}));

jest.mock('../src/api/custody', () => ({
  custodyApi: {
    getTimeline: jest.fn().mockResolvedValue([]),
    verifyChain: jest.fn().mockResolvedValue({ valid: true, chainLength: 3, checkedAt: '' }),
  },
}));

jest.mock('../src/api/evidence', () => ({
  evidenceApi: {
    listForDevice: jest.fn().mockResolvedValue({ items: [] }),
    getAccessUrl: jest.fn().mockResolvedValue({ accessUrl: 'https://s3.example.com/test.jpg' }),
  },
}));

describe('Valuation Utility Verification', () => {
  it('calculates transparent indicative valuations for standard devices', () => {
    const laptopVal = calculateIndicativeValuation('LAPTOP', 'EXCELLENT');
    expect(laptopVal.currency).toBe('INR');
    expect(laptopVal.min).toBeGreaterThan(0);
    expect(laptopVal.min).toBeLessThan(laptopVal.max);
    expect(laptopVal.status).toBe('ESTIMATED');

    const phoneVal = calculateIndicativeValuation('MOBILE_PHONE', 'WORKING');
    expect(phoneVal.min).toBeGreaterThan(0);
    expect(phoneVal.status).toBe('ESTIMATED');
  });
});

describe('Collector Pages Verification', () => {
  it('renders CollectorHome without blank screen crash on empty or null fields', async () => {
    render(
      <BrowserRouter>
        <CollectorHome />
      </BrowserRouter>
    );
    expect(await screen.findByText(/Collector Dispatch/i)).toBeInTheDocument();
  });

  it('renders CollectorHistory component correctly', async () => {
    render(
      <BrowserRouter>
        <CollectorHistory />
      </BrowserRouter>
    );
    expect(await screen.findByText(/Collection History/i)).toBeInTheDocument();
  });
});

describe('Hub Inventory Verification', () => {
  it('renders HubInventory component correctly with filtering tabs', async () => {
    render(
      <BrowserRouter>
        <HubInventory />
      </BrowserRouter>
    );
    expect(await screen.findByText(/Hub Inventory/i)).toBeInTheDocument();
  });
});

describe('Destination Pages Verification', () => {
  it('renders DestinationCompleted component with audit records', async () => {
    render(
      <BrowserRouter>
        <DestinationCompleted />
      </BrowserRouter>
    );
    expect(await screen.findByText(/Completed Processing Records/i)).toBeInTheDocument();
  });
});

describe('Admin Verification & Operations', () => {
  it('renders AdminHome with segmented queues and tab navigation', async () => {
    render(
      <BrowserRouter>
        <AdminHome />
      </BrowserRouter>
    );
    expect(await screen.findByText(/Admin Operations & Verification/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting Verification/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified/i)).toBeInTheDocument();
    expect(screen.getByText(/Closed/i)).toBeInTheDocument();
    expect(screen.getByText(/All Ecosystem Devices/i)).toBeInTheDocument();
  });
});
