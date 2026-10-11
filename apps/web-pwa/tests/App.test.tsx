import { render } from '@testing-library/react';
import { App } from '../src/App';
import '@testing-library/jest-dom';

jest.mock('../src/api/auth', () => ({
  authApi: {
    getSession: jest.fn().mockReturnValue(null),
    cognitoLogin: jest.fn(),
    devLogin: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  API_BASE_URL: 'http://localhost:3000',
}));

jest.mock('../src/pages/Login', () => ({
  Login: () => <div data-testid="login-mock">e-Saathi Connect</div>,
}));

describe('App Component', () => {
  it('should render the phase heading', () => {
    const { getByText } = render(<App />);
    expect(getByText(/e-Saathi Connect/i)).toBeInTheDocument();
  });
});
