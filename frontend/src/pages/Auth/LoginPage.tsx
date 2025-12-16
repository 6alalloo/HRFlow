import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect path from location state, or default to /workflows
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/workflows';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);

    setIsLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{
        background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1f35 50%, #0d1321 100%)',
      }}
    >
      <div
        className="card shadow-lg border-0"
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'rgba(15, 20, 35, 0.95)',
          borderRadius: '16px',
        }}
      >
        <div className="card-body p-5">
          {/* Logo/Brand */}
          <div className="text-center mb-4">
            <h1
              className="fw-bold mb-2"
              style={{
                fontSize: '2.5rem',
                background: 'linear-gradient(135deg, #4a90d9 0%, #67b8de 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              HRFlow
            </h1>
            <p className="text-muted mb-0">Workflow Automation Platform</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              className="alert py-2 px-3 mb-4"
              style={{
                backgroundColor: 'rgba(220, 53, 69, 0.15)',
                border: '1px solid rgba(220, 53, 69, 0.3)',
                color: '#f8d7da',
                borderRadius: '8px',
              }}
            >
              <small>{error}</small>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label
                htmlFor="email"
                className="form-label small text-light"
                style={{ opacity: 0.8 }}
              >
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hrflow.local"
                required
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '12px 16px',
                  borderRadius: '10px',
                }}
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="password"
                className="form-label small text-light"
                style={{ opacity: 0.8 }}
              >
                Password
              </label>
              <input
                type="password"
                className="form-control"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  padding: '12px 16px',
                  borderRadius: '10px',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn w-100 py-2"
              disabled={isLoading}
              style={{
                background: 'linear-gradient(135deg, #1e5799 0%, #2989d8 50%, #207cca 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                borderRadius: '10px',
                padding: '12px',
                transition: 'all 0.2s ease',
              }}
            >
              {isLoading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center mt-4">
            <small className="text-muted">
              Default credentials: admin@hrflow.local / admin123
            </small>
          </div>
        </div>
      </div>

      {/* Custom styles for input focus */}
      <style>{`
        .form-control:focus {
          background-color: rgba(255, 255, 255, 0.12) !important;
          border-color: rgba(74, 144, 217, 0.5) !important;
          box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.15) !important;
          color: #fff !important;
        }
        .form-control::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(30, 87, 153, 0.4);
        }
        .btn:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
