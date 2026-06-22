import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import AnimatedPage from '../components/AnimatedPage';

const VerifyOtp = () => {
  const [otp, setOtp] = useState(Array(8).fill(''));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);

  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp, resendOtp } = useAuth();
  
  // Get email from router state or query parameter
  const email = location.state?.email || new URLSearchParams(location.search).get('email') || '';

  const inputRefs = useRef([]);

  // Countdown timer for resending OTP
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // If email is missing, redirect to login page
  useEffect(() => {
    if (!email) {
      setError('No email address provided. Redirecting to login...');
      const timeout = setTimeout(() => {
        navigate('/login');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [email, navigate]);

  // Handle digit input change
  const handleChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 7) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle backspace / key down
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Focus previous input if current is empty
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1].focus();
      } else {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 7) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle paste events (e.g. copying 8-digit OTP from email)
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (!/^\d{8}$/.test(pasteData)) {
      setError('Please paste an 8-digit numeric code');
      return;
    }

    setError('');
    const newOtp = pasteData.split('');
    setOtp(newOtp);

    // Focus the last input box
    inputRefs.current[7].focus();
  };

  // Handle OTP Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = otp.join('');
    if (token.length !== 8) {
      setError('Please enter all 8 digits of the verification code.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);
      
      await verifyOtp(email, token, 'signup');
      
      setSuccess('Verification successful! Redirecting...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      let errMsg = err.message || 'Verification failed. Please check the code and try again.';
      if (errMsg.toLowerCase().includes('profiles_phone_number_key') || errMsg.toLowerCase().includes('phone_number')) {
        errMsg = 'This phone number is already registered.';
      } else if (errMsg.toLowerCase().includes('profiles_prp_code_key') || errMsg.toLowerCase().includes('prp_code')) {
        errMsg = 'This PRP Code is already registered.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle resend OTP
  const handleResend = async () => {
    if (timer > 0) return;
    try {
      setError('');
      setSuccess('');
      setResendLoading(true);
      
      await resendOtp(email, 'signup');
      
      setSuccess('A new verification code has been sent to your email.');
      setTimer(60);
    } catch (err) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AnimatedPage>
      <div className="auth-page" style={{ padding: '2rem 1rem' }}>
        <motion.div
          className="glass-panel auth-card"
          style={{ maxWidth: '520px', width: '100%' }}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <div className="text-center" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '0.75rem' }}>Verify Your Email</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              We've sent an 8-digit verification code to <strong style={{ color: 'var(--text-color)' }}>{email}</strong>.
            </p>
          </div>

          {error && (
            <motion.div
              className="alert alert-danger"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              className="alert alert-success"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {success}
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label text-center" style={{ display: 'block', marginBottom: '1rem' }}>
                Enter 8-Digit OTP Code
              </label>
              
              <div 
                style={{ 
                  display: 'flex', 
                  gap: '0.4rem', 
                  justifyContent: 'center', 
                  flexWrap: 'wrap' 
                }}
              >
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    onChange={(e) => handleChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={idx === 0 ? handlePaste : undefined}
                    style={{
                      width: '42px',
                      height: '52px',
                      padding: 0,
                      textAlign: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 'bold',
                      borderRadius: 'var(--radius)',
                      border: 'var(--border-thick)',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-color)',
                      transition: 'all 0.12s var(--transition-snap)',
                    }}
                    className="form-control"
                    required
                  />
                ))}
              </div>
            </div>

            <motion.button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: '1.25rem' }}
              disabled={loading || otp.some(d => d === '')}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Verifying...
                </span>
              ) : 'Verify Code'}
            </motion.button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Didn't receive the code?{' '}
              {timer > 0 ? (
                <span style={{ fontWeight: 600, color: 'var(--text-color)', fontFamily: 'var(--font-mono)' }}>
                  Resend in {timer}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-color)',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    padding: 0
                  }}
                >
                  {resendLoading ? 'Sending...' : 'Resend Code'}
                </button>
              )}
            </p>
          </div>

          <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.875rem', borderTop: 'var(--border-thin)', paddingTop: '1.25rem' }}>
            <p>
              Want to use a different account? <Link to="/register">Sign Up</Link> or <Link to="/login">Sign In</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  );
};

export default VerifyOtp;
