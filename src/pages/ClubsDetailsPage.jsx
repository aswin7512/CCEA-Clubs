import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { isEventOver } from '../lib/eventUtils';
import { motion } from 'framer-motion';

const ClubsDetailsPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchClubsData();
  }, []);

  const fetchClubsData = async () => {
    setIsLoading(true);
    try {
      // Fetch approved chapters
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('club_chapters')
        .select('*')
        .eq('status', 'approved')
        .order('name', { ascending: true });

      if (chaptersError) throw chaptersError;

      // Fetch member counts
      const { data: membersData, error: membersError } = await supabase
        .from('club_members')
        .select('chapter_id')
        .eq('status', 'approved');

      if (membersError) throw membersError;

      // Fetch all upcoming events to show "Next Activity"
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('chapter_id, name, event_date');

      if (eventsError) throw eventsError;

      const upcomingEvents = (eventsData || []).filter(e => !isEventOver(e));

      // Aggregate
      const aggregated = chaptersData.map(chapter => {
        const memberCount = membersData.filter(m => m.chapter_id === chapter.id).length;
        
        // Find next event
        const chapterEvents = upcomingEvents.filter(e => e.chapter_id === chapter.id);
        chapterEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
        
        const nextActivity = chapterEvents.length > 0 ? chapterEvents[0].name : 'No upcoming activities';
        const totalActivities = (eventsData || []).filter(e => e.chapter_id === chapter.id).length;

        return {
          id: chapter.id,
          name: chapter.name,
          description: chapter.description,
          memberCount,
          nextActivity,
          totalActivities,
          isActive: true
        };
      });

      setClubs(aggregated);
    } catch (error) {
      console.error('Error fetching clubs data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container flex-center" style={{ minHeight: '60vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <motion.div 
      className="page-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="card" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Clubs Directory</h2>
          <p className="text-secondary">Discover all active clubs, their member counts, and upcoming activities.</p>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem' }}>Club Name</th>
                <th style={{ padding: '1rem' }}>Next Activity</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Members</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Total Events</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((club) => (
                <tr 
                  key={club.id} 
                  style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background-color 0.2s ease' }}
                  onClick={() => navigate(`/club/${club.id}`)}
                  className="animate-hover"
                >
                  <td style={{ padding: '1rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{club.name}</span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {club.nextActivity}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {club.memberCount}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {club.totalActivities}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <span className="badge" style={{ 
                      backgroundColor: 'rgba(46, 204, 113, 0.2)',
                      color: '#2ecc71'
                    }}>
                      Active
                    </span>
                  </td>
                </tr>
              ))}
              {clubs.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No clubs available at the moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default ClubsDetailsPage;
