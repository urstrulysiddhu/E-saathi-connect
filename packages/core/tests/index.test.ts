import { DomainError } from '../src/types/errors';

describe('Core Domain Foundations', () => {
  it('should instantiate DomainError correctly', () => {
    const error = new DomainError('Test error', 'INVALID_TRANSITION', {
      from: 'CREATED',
      to: 'PROCESSED',
    });
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('INVALID_TRANSITION');
    expect(error.details?.from).toBe('CREATED');
  });

  it('should validate dummy lifecycle type', () => {
    const state: import('../src/types/lifecycle').LifecycleState = 'CREATED';
    expect(state).toBe('CREATED');
  });
});
