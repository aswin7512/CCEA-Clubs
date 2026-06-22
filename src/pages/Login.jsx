import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import AnimatedPage from '../components/AnimatedPage';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  useEffect(() => {
    // Check if the URL has the recovery hash from Supabase email
    if (location.hash.includes('type=recovery') || window.location.hash.includes('type=recovery')) {
      navigate('/update-password');
    }
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setEmailUnconfirmed(false);
      setLoading(true);
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to sign in');
      if (err.message && (
        err.message.toLowerCase().includes('confirm') || 
        err.message.toLowerCase().includes('verification')
      )) {
        setEmailUnconfirmed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage>
      <div className="auth-page">
        <motion.div
          className="glass-panel auth-card"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <h2>Welcome Back</h2>

          {error && (
            <motion.div
              className="alert alert-danger"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div>{error}</div>
              {emailUnconfirmed && (
                <div style={{ marginTop: '0.4rem' }}>
                  <Link 
                    to={`/verify-otp?email=${encodeURIComponent(email)}`}
                    style={{ 
                      color: 'inherit', 
                      textDecoration: 'underline', 
                      fontWeight: 700 
                    }}
                  >
                    Click here to verify your email.
                  </Link>
                </div>
              )}
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>

            <motion.button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={loading}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Signing In...
                </span>
              ) : 'Sign In'}
            </motion.button>
          </form>

          <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.875rem' }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <Link to="/forgot-password" style={{ color: 'var(--text-secondary)' }}>Forgot Password?</Link>
            </p>
            <p>
              Don't have an account? <Link to="/register">Sign Up</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  );
};

export default Login;
