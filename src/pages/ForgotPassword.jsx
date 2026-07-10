import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AnimatedPage from '../components/AnimatedPage';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setMessage('');
      setLoading(true);
      await resetPassword(email);
      setMessage('An OTP code has been sent to your email.');
      setIsOtpSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'recovery'
      });

      if (error) throw error;

      navigate('/update-password');
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP');
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
          <h2>Reset Password</h2>

          {error && (
            <motion.div
              className="alert alert-danger"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error}
            </motion.div>
          )}

          {message && (
            <motion.div
              className="alert alert-success"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {message}
            </motion.div>
          )}

          {!isOtpSent ? (
            <form onSubmit={handleSendOtp}>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your registered email"
                />
              </div>

              <motion.button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? 'Sending OTP...' : 'Send OTP Code'}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="form-label" htmlFor="otp-code">OTP Code</label>
                <input
                  id="otp-code"
                  type="text"
                  className="form-control"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  placeholder="Enter verification code"
                  maxLength={8}
                  style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.25rem', fontWeight: 700 }}
                />
              </div>

              <motion.button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
                whileTap={{ scale: 0.97 }}
              >
                {loading ? 'Verifying...' : 'Verify & Set New Password'}
              </motion.button>
            </form>
          )}

          <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.875rem' }}>
            <p>
              Remembered your password? <Link to="/login">Sign In</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  );
};

export default ForgotPassword;
