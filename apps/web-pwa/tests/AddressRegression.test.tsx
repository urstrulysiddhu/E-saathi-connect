import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { formatAddress } from '../src/utils/address';
import { CollectorHome } from '../src/pages/collector/CollectorHome';
import { CollectorHistory } from '../src/pages/collector/CollectorHistory';
import { PickupManager } from '../src/pages/consumer/PickupManager';
import { requestsApi } from '../src/api/requests';
import { devicesApi } from '../src/api/devices';

// Mock API modules before they are loaded
jest.mock('../src/api/requests', () => ({
  requestsApi: {
    list: jest.fn(),
    accept: jest.fn().mockResolvedValue({}),
    reject: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    getForDevice: jest.fn().mockResolvedValue(null),
    escalate: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../src/api/devices', () => ({
  devicesApi: {
    list: jest.fn().mockResolvedValue({ items: [] }),
    get: jest.fn().mockResolvedValue(null),
  },
}));

describe('Address formatting utility and component regression tests', () => {
  describe('formatAddress unit tests', () => {
    it('formats a structured address object with {street, city, state, postalCode}', () => {
      const obj = { street: '123 Test St', city: 'Sydney', state: 'NSW', postalCode: '2000' };
      expect(formatAddress(obj)).toBe('123 Test St, Sydney, NSW, 2000');
    });

    it('formats address object with partial fields', () => {
      const obj = { street: '456 Ocean Rd', city: 'Perth' };
      expect(formatAddress(obj)).toBe('456 Ocean Rd, Perth');
    });

    it('handles alternative keys like line1, zip, country', () => {
      const obj = { line1: 'Suite 4', line2: '10 Wall St', city: 'Brisbane', state: 'QLD', zip: '4000', country: 'Australia' };
      expect(formatAddress(obj)).toBe('Suite 4, 10 Wall St, Brisbane, QLD, 4000, Australia');
    });

    it('preserves plain string address', () => {
      expect(formatAddress('789 Queen Street, Melbourne')).toBe('789 Queen Street, Melbourne');
    });

    it('returns custom or default fallback for null, undefined, empty string or empty object', () => {
      expect(formatAddress(null)).toBe('Address on file');
      expect(formatAddress(undefined)).toBe('Address on file');
      expect(formatAddress('')).toBe('Address on file');
      expect(formatAddress('   ')).toBe('Address on file');
      expect(formatAddress({})).toBe('Address on file');
      expect(formatAddress(null, 'Address on record')).toBe('Address on record');
    });
  });

  describe('CollectorHome regression test with object address', () => {
    it('renders without crashing when pickupAddress is an object {street, city, state, postalCode}', async () => {
      (requestsApi.list as jest.Mock).mockResolvedValue({
        items: [
          {
            requestId: 'req-pending-1',
            deviceId: 'dev-uuid-1',
            status: 'PENDING',
            pickupAddress: { street: '123 Harbour St', city: 'Sydney', state: 'NSW', postalCode: '2000' },
            pickupDate: '2026-10-15',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deviceDetails: {
              deviceId: 'dev-uuid-1',
              category: 'LAPTOP',
              brand: 'Dell',
              model: 'XPS 15',
              condition: 'EXCELLENT',
            },
          },
          {
            requestId: 'req-accepted-1',
            deviceId: 'dev-uuid-2',
            status: 'ACCEPTED',
            pickupAddress: { street: '50 Collins St', city: 'Melbourne', state: 'VIC', postalCode: '3000' },
            pickupDate: '2026-10-16',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deviceDetails: {
              deviceId: 'dev-uuid-2',
              category: 'SMARTPHONE',
              brand: 'Apple',
              model: 'iPhone 14',
              condition: 'WORKING',
            },
          },
        ],
      });

      render(
        <BrowserRouter>
          <CollectorHome />
        </BrowserRouter>
      );

      // Verify page renders without React error #31
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Collection Requests/i })).toBeInTheDocument();
      });

      // Verify address formatted as string is rendered
      expect(screen.getByText(/123 Harbour St, Sydney, NSW, 2000/i)).toBeInTheDocument();
      expect(screen.getByText(/50 Collins St, Melbourne, VIC, 3000/i)).toBeInTheDocument();
    });
  });

  describe('CollectorHistory regression test with object address', () => {
    it('renders without crashing when pickupAddress is an object', async () => {
      (requestsApi.list as jest.Mock).mockResolvedValue({
        items: [
          {
            requestId: 'req-hist-1',
            deviceId: 'dev-uuid-1',
            status: 'ACCEPTED',
            pickupAddress: { street: '77 Eagle St', city: 'Brisbane', state: 'QLD', postalCode: '4000' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      (devicesApi.list as jest.Mock).mockResolvedValue({
        items: [
          {
            deviceId: 'dev-uuid-1',
            category: 'LAPTOP',
            brand: 'Dell',
            model: 'Latitude',
            lifecycleState: 'COLLECTED',
          },
        ],
      });

      render(
        <BrowserRouter>
          <CollectorHistory />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Collection History/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/77 Eagle St, Brisbane, QLD, 4000/i)).toBeInTheDocument();
    });

    it('renders safely when devicesApi returns non-device items (commercial transaction pollution) without lifecycleState', async () => {
      (requestsApi.list as jest.Mock).mockResolvedValue({
        items: [
          {
            requestId: 'req-hist-tx-1',
            deviceId: 'dev-tx-polluted-1',
            status: 'ACCEPTED',
            pickupAddress: { street: '88 Tech Park', city: 'Bengaluru' },
            deviceDetails: {
              deviceId: 'dev-tx-polluted-1',
              model: 'Galaxy S22',
              lifecycleState: 'COLLECTED',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });
      // Non-device entity returned by GSI query (commercial transaction)
      (devicesApi.list as jest.Mock).mockResolvedValue({
        items: [
          {
            transactionId: 'tx-polluting-1',
            proposedByOrganizationId: 'COLLECTOR_ORG',
            transactionStatus: 'ACCEPTED',
            // No deviceId and no lifecycleState property
          },
        ],
      });

      render(
        <BrowserRouter>
          <CollectorHistory />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Collection History/i })).toBeInTheDocument();
      });

      // Does not throw TypeError: Cannot read properties of undefined (reading 'replace')
      expect(screen.getByText(/COLLECTED/i)).toBeInTheDocument();
      expect(screen.getByText(/88 Tech Park, Bengaluru/i)).toBeInTheDocument();
    });

    it('renders empty state when there are no collection history items', async () => {
      (requestsApi.list as jest.Mock).mockResolvedValue({ items: [] });
      (devicesApi.list as jest.Mock).mockResolvedValue({ items: [] });

      render(
        <BrowserRouter>
          <CollectorHistory />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/No historical collection events recorded yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('PickupManager regression test with object address', () => {
    it('renders without crashing when pickupAddress is an object', async () => {
      (requestsApi.list as jest.Mock).mockResolvedValue({
        items: [
          {
            requestId: 'req-consumer-1',
            deviceId: 'dev-consumer-1',
            status: 'PENDING',
            pickupAddress: { street: '10 St Georges Tce', city: 'Perth', state: 'WA', postalCode: '6000' },
            pickupDate: '2026-10-20',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      });

      render(
        <BrowserRouter>
          <PickupManager deviceId="dev-consumer-1" lifecycleState="CREATED" />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/10 St Georges Tce, Perth, WA, 6000/i)).toBeInTheDocument();
      });
    });
  });
});
