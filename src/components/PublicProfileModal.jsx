import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  BookOpen, 
  Award, 
  Hash, 
  Layers,
  Shield,
  Calendar
} from 'lucide-react';

const PublicProfileModal = ({ isOpen, onClose, userId, profileData, additionalFields = [] }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Check if the provided profileData has the full set of details preloaded
    const isFullProfile = profileData && ('phone_number' in profileData) && ('created_at' in profileData);

    if (isFullProfile) {
      setProfile(profileData);
      setError('');
    } else if (profileData?.id || userId) {
      fetchUserProfile(profileData?.id || userId);
    }
  }, [isOpen, userId, profileData]);

  const fetchUserProfile = async (uid) => {
    try {
      setLoading(true);
      setError('');
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (fetchErr) throw fetchErr;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching public profile:', err);
      setError('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            position: 'relative'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '50%',
              width: '2rem',
              height: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-color)',
              transition: 'background 0.2s',
              zIndex: 10
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          >
            <X size={16} />
          </button>

          {/* Header Accent */}
          <div style={{
            height: '6px',
            background: 'linear-gradient(90deg, var(--primary-color), var(--secondary-color))'
          }} />

          <div style={{ padding: '2rem' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <div className="loader"></div>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <p style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</p>
                <button className="btn btn-outline" onClick={onClose}>Close</button>
              </div>
            ) : profile ? (
              <div>
                {/* User Initials Circle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                    border: '2px solid var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: 'var(--primary-color)'
                  }}>
                    {profile.name ? profile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-color)', fontWeight: 'bold' }}>
                      {profile.name}
                    </h3>
                    <span className="badge badge-secondary" style={{ 
                      marginTop: '0.35rem', 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      textTransform: 'capitalize' 
                    }}>
                      <Shield size={12} /> {profile.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Profile Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Email */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <Mail size={18} style={{ color: 'var(--primary-color)', marginTop: '0.25rem' }} />
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Email Address</span>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-color)', wordBreak: 'break-all' }}>{profile.email}</span>
                    </div>
                  </div>

                  {/* Phone */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <Phone size={18} style={{ color: 'var(--primary-color)', marginTop: '0.25rem' }} />
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Phone Number</span>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>{profile.phone_number || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Department */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <BookOpen size={18} style={{ color: 'var(--primary-color)', marginTop: '0.25rem' }} />
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Department</span>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>{profile.department || 'N/A'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Roll Number */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Hash size={18} style={{ color: 'var(--primary-color)', marginTop: '0.25rem' }} />
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Roll Number</span>
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>{profile.roll_number || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Division */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Layers size={18} style={{ color: 'var(--primary-color)', marginTop: '0.25rem' }} />
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Division</span>
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>{profile.division || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* PRP Code */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <Award size={18} style={{ color: 'var(--primary-color)', marginTop: '0.25rem' }} />
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>PRP Code</span>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>{profile.prp_code || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Additional Custom Fields */}
                  {additionalFields && additionalFields.map((field, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Award size={18} style={{ color: 'var(--secondary-color)', marginTop: '0.25rem' }} />
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>{field.label}</span>
                        {field.value && field.value.startsWith('http') ? (
                          <a 
                            href={field.value} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.95rem', color: 'var(--primary-color)', textDecoration: 'underline', wordBreak: 'break-all' }}
                          >
                            {field.value}
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.95rem', color: 'var(--text-color)', wordBreak: 'break-all' }}>{field.value || 'N/A'}</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Account Created At */}
                  {profile.created_at && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Calendar size={18} style={{ color: 'var(--primary-color)', marginTop: '0.25rem' }} />
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Joined On</span>
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-color)' }}>
                          {new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No profile data available.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PublicProfileModal;
