import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const FacultyDashboard = () => {
  const { user } = useAuth();
  const [myChapters, setMyChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChapters();
  }, [user]);

  const fetchChapters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('club_members')
        .select('*, chapter:club_chapters(*)')
        .eq('user_id', user.id)
        .eq('role', 'faculty_coordinator')
        .eq('status', 'approved');

      if (error) throw error;
      setMyChapters(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div>
      <h3 style={{ marginBottom: '1.5rem' }}>My Assigned Clubs</h3>
      {myChapters.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>You are not assigned as a faculty coordinator to any active club chapters.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {myChapters.map(mem => (
            <div key={mem.id} style={{ padding: '1.5rem', border: '1px solid var(--input-border)', borderRadius: '0.5rem', backgroundColor: 'var(--input-bg)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>{mem.chapter.name} ({mem.chapter.academic_year})</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{mem.chapter.description}</p>
              
              <button className="btn btn-outline" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                Manage Club Operations
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FacultyDashboard;
