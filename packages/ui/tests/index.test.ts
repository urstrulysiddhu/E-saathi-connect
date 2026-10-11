import { UiVersion } from '../src/index';

describe('UI Package', () => {
  it('should export a version', () => {
    expect(UiVersion).toBe('1.0.0');
  });
});
