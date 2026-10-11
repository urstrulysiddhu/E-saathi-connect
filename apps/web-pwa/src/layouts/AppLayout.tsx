import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    if (!user) return [];
    switch (user.role) {
      case 'CONSUMER':
        return [
          { name: 'My Devices', path: '/consumer' },
          { name: 'Register Device', path: '/consumer/register' },
        ];
      case 'COLLECTOR':
        return [
          { name: 'Pending Handovers', path: '/collector' },
          { name: 'History', path: '/collector/history' },
        ];
      case 'HUB':
        return [
          { name: 'Incoming', path: '/hub' },
          { name: 'Inventory', path: '/hub/inventory' },
        ];
      case 'DESTINATION':
        return [
          { name: 'Processing', path: '/destination' },
          { name: 'Transactions', path: '/destination/transactions' },
          { name: 'Completed Records', path: '/destination/completed' },
        ];
      case 'ADMIN':
        return [
          { name: 'Verification Queue', path: '/admin' }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            e-Saathi Connect
          </Link>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 500 }}>{user.name}</span>
                <span className="badge badge-neutral">{user.role}</span>
              </div>
              <button onClick={handleLogout} className="btn btn-danger">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="main-layout">
        {user && (
          <aside className="sidebar">
            <nav>
              {getNavLinks().map((link) => {
                const isActive =
                  location.pathname === link.path ||
                  (link.path !== '/' &&
                    location.pathname.startsWith(link.path) &&
                    link.path.split('/').length > 2);
                return (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
