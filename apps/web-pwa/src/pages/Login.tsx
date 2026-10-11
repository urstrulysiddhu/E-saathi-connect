import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const navigateByRole = (roleKey: string) => {
    switch (roleKey.toLowerCase()) {
      case 'consumer':
        navigate('/consumer');
        break;
      case 'collector':
        navigate('/collector');
        break;
      case 'hub':
        navigate('/hub');
        break;
      case 'destination':
        navigate('/destination');
        break;
      case 'admin':
        navigate('/admin');
        break;
      default:
        navigate('/');
    }
  };

  const handleDevLogin = async (roleKey: string) => {
    setLoading(true);
    setError('');
    try {
      await login(roleKey);
      navigateByRole(roleKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCognitoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await login(email, password);
      if (session && session.role) {
        navigateByRole(session.role);
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const isDev = !import.meta.env.PROD;

  return (
    <div
      className="app-container"
      style={{ alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}
    >
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <h1
          className="heading-2"
          style={{ textAlign: 'center', color: '#059669', marginBottom: '0.5rem' }}
        >
          e-Saathi Connect
        </h1>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          Track less. Prove more.
        </p>

        {error && (
          <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form
          onSubmit={handleCognitoLogin}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                marginBottom: '0.25rem',
              }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                marginBottom: '0.25rem',
              }}
            >
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #cbd5e1',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '0.75rem', fontWeight: 600 }}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        {isDev && (
          <>
            <div
              style={{
                textAlign: 'center',
                margin: '1rem 0',
                color: '#94a3b8',
                fontSize: '0.875rem',
              }}
            >
              --- OR DEV LOGIN ---
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                disabled={loading}
                onClick={() => handleDevLogin('consumer')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '1rem' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>Consumer</div>
                </div>
              </button>
              <button
                disabled={loading}
                onClick={() => handleDevLogin('collector')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '1rem' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>Collector</div>
                </div>
              </button>
              <button
                disabled={loading}
                onClick={() => handleDevLogin('hub')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '1rem' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>Network Hub</div>
                </div>
              </button>
              <button
                disabled={loading}
                onClick={() => handleDevLogin('destination')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '1rem' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>Destination Facility</div>
                </div>
              </button>
              <button
                disabled={loading}
                onClick={() => handleDevLogin('admin')}
                className="btn btn-outline"
                style={{ justifyContent: 'flex-start', padding: '1rem' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>System Admin</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
