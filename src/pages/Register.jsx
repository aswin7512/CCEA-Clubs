import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

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
      navigate('/dashboard'); // or redirect to a "verify email" page if email confirmation is required
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
    <div className="container flex-center" style={{ minHeight: 'calc(100vh - 80px)', padding: '2rem 0' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Create an Account</h2>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--danger-color)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            type="button"
            className={`btn ${role === 'student' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1 }}
            onClick={() => setRole('student')}
          >
            Student
          </button>
          <button
            type="button"
            className={`btn ${role === 'faculty' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1 }}
            onClick={() => setRole('faculty')}
          >
            Faculty
          </button>
        </div>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="tel" className="form-control" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
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
            <>
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
                <input type="text" className="form-control" value={prpCode} onChange={(e) => setPrpCode(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Roll Number</label>
                <input type="text" className="form-control" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required />
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <p>
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
