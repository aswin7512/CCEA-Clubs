import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AnimatedPage from '../components/AnimatedPage';

const Register = () => {
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [division, setDivision] = useState('');
  const [prpCode, setPrpCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [rollNumber, setRollNumber] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);

      const profileData = {
        role,
        name,
        department,
        phone_number: phoneNumber,
      };

      if (role === 'student') {
        profileData.division = division;
        profileData.prp_code = prpCode;
        profileData.roll_number = rollNumber;
      }

      // Check if phone number is already registered in public.profiles
      const { data: existingPhone, error: phoneCheckError } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (phoneCheckError) throw phoneCheckError;
      if (existingPhone) {
        throw new Error('This phone number is already registered.');
      }

      // Check if PRP Code is already registered for students
      if (role === 'student' && prpCode) {
        const { data: existingPRP, error: prpCheckError } = await supabase
          .from('profiles')
          .select('prp_code')
          .eq('prp_code', prpCode)
          .maybeSingle();

        if (prpCheckError) throw prpCheckError;
        if (existingPRP) {
          throw new Error('This PRP Code is already registered.');
        }
      }

      await signUp(email, password, profileData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to create an account');
    } finally {
      setLoading(false);
    }
  };

  const departments = role === 'student'
    ? ['Computer Science', 'Electronics and Communication', 'Electrical and Electronics', 'Computer and Business Systems', 'Electrical and Computer', 'Mechanical', 'Civil']
    : ['Computer Science', 'Electronics and Communication', 'Electrical and Electronics', 'Computer and Business Systems', 'Electrical and Computer', 'Mechanical', 'Civil', 'Applied Science and Humanities'];

  return (
    <AnimatedPage>
      <div className="auth-page" style={{ padding: '2rem 1rem' }}>
        <motion.div
          className="glass-panel auth-card"
          style={{ maxWidth: '500px' }}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <h2>Create an Account</h2>

          {error && (
            <motion.div
              className="alert alert-danger"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error}
            </motion.div>
          )}

          {/* Role Selector */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '0.75rem' }}>
            {['student', 'faculty'].map((r) => (
              <motion.button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  border: 'none',
                  borderRadius: '0.6rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                  background: role === r ? 'var(--primary-color)' : 'transparent',
                  color: role === r ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.3s',
                }}
                whileTap={{ scale: 0.96 }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </motion.button>
            ))}
          </div>

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Enter your full name" />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Create a password" />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-control" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required placeholder="Enter your phone number" />
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <select className="form-control" value={department} onChange={(e) => setDepartment(e.target.value)} required>
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {role === 'student' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="form-group">
                  <label className="form-label">Division</label>
                  <select className="form-control" value={division} onChange={(e) => setDivision(e.target.value)} required>
                    <option value="">Select Division (Choose A if No Division)</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">PRP Code</label>
                  <input type="text" className="form-control" value={prpCode} onChange={(e) => setPrpCode(e.target.value)} required placeholder="Enter your PRP code" />
                </div>

                <div className="form-group">
                  <label className="form-label">Roll Number</label>
                  <input type="text" className="form-control" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required placeholder="Enter your roll number" />
                </div>
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={loading}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Creating Account...
                </span>
              ) : 'Register'}
            </motion.button>
          </form>

          <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.875rem' }}>
            <p>
              Already have an account? <Link to="/login">Sign In</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  );
};

export default Register;
