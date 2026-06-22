import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Bold } from 'lucide-react';

const Profile = () => {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // Form states
  const [name, setName] = useState(profile?.name || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [division, setDivision] = useState(profile?.division || '');
  const [prpCode, setPrpCode] = useState(profile?.prp_code || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [rollNumber, setRollNumber] = useState(profile?.roll_number || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const departments = profile?.role === 'student'
    ? ['Computer Science', 'Electronics and Communication', 'Electrical and Electronics', 'Computer and Business Systems', 'Electrical and Computer', 'Mechanical', 'Civil']
    : ['Computer Science', 'Electronics and Communication', 'Electrical and Electronics', 'Computer and Business Systems', 'Electrical and Computer', 'Mechanical', 'Civil', 'Applied Science and Humanities'];

  const userEmail = user?.email || profile?.email?.replace(/^"|"$/g, '').trim();

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      setVerificationError('');
      console.log("handleSendOtp - userEmail:", userEmail, "user?.email:", user?.email, "profile?.email:", profile?.email);
      
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          shouldCreateUser: false
        }
      });

      if (otpError) {
        throw otpError;
      }

      setVerificationError('');
      setOtpSent(true);
    } catch (err) {
      setVerificationError(err.message || 'Could not send verification OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setVerificationError('');

      // Try with type 'magiclink' first (standard for passwordless OTP verification)
      let { error: verifyError } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otp,
        type: 'magiclink'
      });

      // If that fails, try with type 'signup' (in case the user's email is pending confirmation)
      if (verifyError) {
        const { error: signupVerifyError } = await supabase.auth.verifyOtp({
          email: userEmail,
          token: otp,
          type: 'signup'
        });
        verifyError = signupVerifyError;
      }

      if (verifyError) {
        throw verifyError;
      }

      setIsVerified(true);
      setIsVerifying(false);
      setSuccess('Identity verified successfully! You can now edit your details.');
    } catch (err) {
      setVerificationError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!name.trim()) throw new Error('Name is required.');
      if (!phoneNumber.trim()) throw new Error('Phone number is required.');
      if (!department.trim()) throw new Error('Department is required.');

      // Check if PRP code needs uniqueness check
      if (profile.role === 'student' && prpCode.trim()) {
        const { data: existingPrp, error: prpCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('prp_code', prpCode.trim())
          .neq('id', user.id)
          .maybeSingle();

        if (prpCheckError) throw prpCheckError;
        if (existingPrp) {
          throw new Error('This PRP Code is already assigned to another user.');
        }
      }

      // Check if phone number is unique
      const { data: existingPhone, error: phoneCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', phoneNumber.trim())
        .neq('id', user.id)
        .maybeSingle();

      if (phoneCheckError) throw phoneCheckError;
      if (existingPhone) {
        throw new Error('This phone number is already registered.');
      }

      const updateData = {
        name: name.trim(),
        phone_number: phoneNumber.trim(),
        department: department.trim(),
      };

      if (profile.role === 'student') {
        updateData.division = division.trim() || null;
        updateData.prp_code = prpCode.trim() || null;
        updateData.roll_number = rollNumber.trim() || null;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSuccess('Profile updated successfully!');
      setIsVerified(false);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      setPasswordLoading(true);
      setPasswordError('');
      setPasswordSuccess('');

      if (!currentPassword) throw new Error('Current password is required.');
      if (newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
      if (newPassword !== confirmPassword) throw new Error('New passwords do not match.');

      // 1. Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Incorrect current password.');
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsVerified(false);
    setIsVerifying(false);
    setOtpSent(false);
    setOtp('');
    setVerificationError('');
    // Reset fields to original profile values
    setName(profile?.name || '');
    setDepartment(profile?.department || '');
    setDivision(profile?.division || '');
    setPrpCode(profile?.prp_code || '');
    setPhoneNumber(profile?.phone_number || '');
    setRollNumber(profile?.roll_number || '');

    // Reset password fields
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  if (!profile) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '700px' }}>
      <button className="btn btn-outline" style={{ marginBottom: '1.5rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => navigate('/dashboard')}>
        &larr; Back to Dashboard
      </button>

      {/* Main Profile Info Section */}
      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--input-border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>My Profile</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, textTransform: 'capitalize' }}>
              Role: {profile.role?.replace('_', ' ')}
            </p>
          </div>
          {!isVerified && !isVerifying && (
            <button 
              className="btn btn-primary animate-hover" 
              onClick={() => setIsVerifying(true)}
            >
              Edit Details
            </button>
          )}
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--danger-color)' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--secondary-color)' }}>
            {success}
          </div>
        )}

        {/* Verification Sub-screen */}
        {isVerifying && (
          <div className="glass-panel" style={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--primary-color)', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>Email Verification Required</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              To view or modify your details, verify your identity with a one-time passcode sent to **{userEmail}**.
            </p>

            {verificationError && (
              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                {verificationError}
              </div>
            )}

            {!otpSent ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleSendOtp} disabled={loading}>
                  {loading ? 'Sending...' : 'Send Verification OTP'}
                </button>
                <button className="btn btn-outline" onClick={handleCancelEdit} disabled={loading}>
                  Cancel
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Enter OTP Code</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={otp} 
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))} 
                    placeholder="e.g. 12345678" 
                    required 
                    style={{ textAlign: 'center', letterSpacing: '0.4rem', fontSize: '1.25rem', fontWeight: 'bold' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={loading || otp.length < 6 || otp.length > 8}>
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleCancelEdit} disabled={loading}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Read-Only Profile View */}
        {!isVerified && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--input-bg)', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Full Name</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold' }}>{profile.name}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--input-bg)', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email Address</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold' }}>{profile.email}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--input-bg)', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Phone Number</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold' }}>{profile.phone_number}</p>
            </div>

            <div style={{ padding: '1rem', backgroundColor: 'var(--input-bg)', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Department</span>
              <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold' }}>{profile.department}</p>
            </div>

            {profile.role === 'student' && (
              <>
                <div style={{ padding: '1rem', backgroundColor: 'var(--input-bg)', borderRadius: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Roll Number</span>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold' }}>{profile.roll_number || 'N/A'}</p>
                </div>

                <div style={{ padding: '1rem', backgroundColor: 'var(--input-bg)', borderRadius: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Division</span>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold' }}>{profile.division || 'N/A'}</p>
                </div>

                <div style={{ padding: '1rem', backgroundColor: 'var(--input-bg)', borderRadius: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>PRP Code</span>
                  <p style={{ margin: '0.25rem 0 0 0', fontWeight: 'bold' }}>{profile.prp_code || 'N/A'}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Editable Form Profile View */}
        {isVerified && (
          <form onSubmit={handleSaveChanges} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input 
                type="tel" 
                className="form-control" 
                value={phoneNumber} 
                onChange={e => setPhoneNumber(e.target.value)} 
                required 
                disabled={!!profile?.phone_number} 
              />
              {profile?.phone_number && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Phone number cannot be changed once set.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <select 
                className="form-control" 
                value={department} 
                onChange={e => setDepartment(e.target.value)} 
                required
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {profile.role === 'student' && (
              <>
                <div className="form-group">
                  <label className="form-label">Roll Number</label>
                  <input type="text" className="form-control" value={rollNumber} onChange={e => setRollNumber(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Division</label>
                  <input type="text" className="form-control" value={division} onChange={e => setDivision(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">PRP Code</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={prpCode} 
                    onChange={e => setPrpCode(e.target.value)} 
                    disabled={!!profile?.prp_code}
                  />
                  {profile?.prp_code && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                      PRP Code cannot be changed once set.
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Change Password Section */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--input-border)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h4 style={{ margin: 0, color: 'var(--primary-color)' }}>Change Password</h4>
              
              {passwordError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--danger-color)', fontSize: '0.875rem' }}>
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--secondary-color)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--secondary-color)', fontSize: '0.875rem' }}>
                  {passwordSuccess}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)} 
                  placeholder="Enter current password"
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Enter new password (min. 6 characters)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="Re-enter new password"
                />
              </div>

              <button 
                type="button" 
                className="btn btn-outline animate-hover" 
                style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}
                onClick={handleChangePassword}
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {passwordLoading ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--input-border)', paddingTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" className="btn btn-outline" onClick={handleCancelEdit} disabled={loading}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Profile;
