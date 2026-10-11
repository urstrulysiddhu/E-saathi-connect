import { apiClient } from './client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

global.fetch = vi.fn();

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should not add a double slash when joining getBaseUrl and url', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    // Assume getBaseUrl returns http://localhost:3000 or something without trailing slash
    // but what if it DOES have a trailing slash? The environment configures it.
    // We can test that `apiClient.get('/devices')` properly normalizes it.
    await apiClient.get('/devices');
    const calledUrl = (global.fetch as any).mock.calls[0][0];
    
    // We expect it to not have double slashes like 'http://localhost:3000//devices'
    // but rather 'http://localhost:3000/devices' (or whatever the mock URL is)
    expect(calledUrl).not.toMatch(/\/\/[^\/]+\/\//);
  });
});
