import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const FacultyDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignedChapters, setAssignedChapters] = useState([]);
  const [otherChapters, setOtherChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChapters();
  }, [user]);

  const fetchChapters = async () => {
    try {
      setLoading(true);

      // 1. Fetch all approved chapters on campus
      const { data: allChapters, error: chaptersError } = await supabase
        .from('club_chapters')
        .select('*')
        .eq('status', 'approved')
        .order('name');

      if (chaptersError) throw chaptersError;

      // 2. Fetch coordinator memberships of this faculty
      const { data: myMemberships, error: membershipsError } = await supabase
        .from('club_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', 'faculty_coordinator')
        .eq('status', 'approved');

      if (membershipsError) throw membershipsError;

      const assignedIds = (myMemberships || []).map(m => m.chapter_id);

      const assigned = (allChapters || []).filter(c => assignedIds.includes(c.id));
      const others = (allChapters || []).filter(c => !assignedIds.includes(c.id));

      setAssignedChapters(assigned);
      setOtherChapters(others);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

      {/* Assigned Clubs Section */}
      {assignedChapters.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', display: 'inline-block', boxShadow: '0 0 10px var(--primary-glow)' }}></span>
            My Assigned Clubs (Manager)
          </h3>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="card-grid"
          >
            {assignedChapters.map(chapter => (
              <motion.div
                key={chapter.id}
                variants={item}
                className="glass-panel"
                style={{ backgroundColor: 'var(--input-bg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                whileHover={{ y: -6, boxShadow: 'var(--glass-shadow-hover)' }}
              >
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>{chapter.name} ({chapter.academic_year})</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    {chapter.description || 'No description provided.'}
                  </p>
                </div>
                <motion.button
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  onClick={() => navigate(`/club/${chapter.id}`)}
                  whileTap={{ scale: 0.96 }}
                >
                  Manage Club Operations
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {/* Campus Clubs Section */}
      <div>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--secondary-color)', display: 'inline-block' }}></span>
          Campus Clubs
        </h3>
        {otherChapters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏛️</div>
            <p>No other active clubs found on campus.</p>
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="card-grid"
          >
            {otherChapters.map(chapter => (
              <motion.div
                key={chapter.id}
                variants={item}
                className="glass-panel"
                style={{ backgroundColor: 'var(--input-bg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                whileHover={{ y: -6, boxShadow: 'var(--glass-shadow-hover)' }}
              >
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>{chapter.name} ({chapter.academic_year})</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    {chapter.description || 'No description provided.'}
                  </p>
                </div>
                <motion.button
                  className="btn btn-outline"
                  style={{ width: '100%', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  onClick={() => navigate(`/club/${chapter.id}`)}
                  whileTap={{ scale: 0.96 }}
                >
                  View Club Details
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default FacultyDashboard;
