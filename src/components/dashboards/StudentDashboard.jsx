import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isEventOver } from '../../lib/eventUtils';
import { Plus, Calendar, MapPin } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeChapters, setActiveChapters] = useState([]);
  const [myMemberships, setMyMemberships] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch active chapters
      const { data: chapters, error: chaptersError } = await supabase
        .from('club_chapters')
        .select('*')
        .eq('status', 'approved')
        .order('name');
        
      if (chaptersError) throw chaptersError;
      
      // Fetch user's memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('club_members')
        .select('*, chapter:club_chapters(*)')
        .eq('user_id', user.id);
        
      if (membershipsError) throw membershipsError;

      // Fetch user's pending/rejected chapter applications
      const { data: pendingChapters, error: pendingChaptersError } = await supabase
        .from('club_chapters')
        .select('*')
        .eq('campus_lead_id', user.id)
        .in('status', ['pending', 'rejected']);

      if (pendingChaptersError) throw pendingChaptersError;

      const chapterApps = (pendingChapters || []).map(ch => ({
        id: `ch-${ch.id}`,
        chapter_id: ch.id,
        user_id: user.id,
        role: 'lead',
        designation: 'Campus Lead',
        status: ch.status,
        chapter: ch,
        isChapterCreation: true
      }));

      const combinedMemberships = [
        ...chapterApps,
        ...(memberships || [])
      ];

      // Fetch events from clubs they are enrolled in (status === 'approved') or open to anyone
      const enrolledChapterIds = (memberships || [])
        .filter(m => m.status === 'approved')
        .map(m => m.chapter_id);

      let query = supabase
        .from('events')
        .select('*, chapter:club_chapters(name)')
        .neq('admission_type', 'invite_only');

      if (enrolledChapterIds.length > 0) {
        query = query.or(`restrict_to_members.eq.false,chapter_id.in.(${enrolledChapterIds.map(id => `"${id}"`).join(',')})`);
      } else {
        query = query.eq('restrict_to_members', false);
      }

      const { data: eventsData, error: eventsError } = await query.order('event_date', { ascending: true });

      if (eventsError) throw eventsError;
      const events = eventsData || [];

      // Fetch user's event registrations
      const { data: userRegistrations, error: registrationsError } = await supabase
        .from('event_registrations')
        .select('event_id')
        .eq('user_id', user.id);
        
      if (registrationsError) throw registrationsError;
      const registeredEventIds = (userRegistrations || []).map(r => r.event_id);

      const upcoming = (events || []).filter(e => !isEventOver(e));
      const past = (events || []).filter(e => isEventOver(e) && registeredEventIds.includes(e.id)).reverse();

      const appliedChapterIds = [
        ...chapterApps.map(app => app.chapter_id),
        ...(memberships || []).map(m => m.chapter_id)
      ];

      const filteredChapters = (chapters || []).filter(c => !appliedChapterIds.includes(c.id));

      setActiveChapters(filteredChapters);
      setMyMemberships(combinedMemberships);
      setUpcomingEvents(upcoming);
      setPastEvents(past);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (chapterId) => {
    // Check if the chapter requires custom applicant details
    const chapter = activeChapters.find(c => c.id === chapterId);
    
    const parseLabels = (labelStr) => {
      if (!labelStr) return [];
      try {
        const parsed = JSON.parse(labelStr);
        if (Array.isArray(parsed)) return parsed;
        return [labelStr];
      } catch (e) {
        return [labelStr];
      }
    };
    
    const labels = parseLabels(chapter?.additional_field_label);
    if (labels.length > 0) {
      // Redirect to the Club Detail page with an auto-apply flag so they get prompted
      navigate(`/club/${chapterId}`, { state: { autoApply: true } });
      return;
    }

    try {
      const { error } = await supabase
        .from('club_members')
        .insert([{
          chapter_id: chapterId,
          user_id: user.id,
          role: 'member',
          status: 'pending'
        }]);

      if (error) throw error;
      alert('Application submitted successfully!');
      fetchDashboardData();
    } catch (err) {
      alert('Failed to apply: ' + err.message);
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
    <div>
      {/* My Memberships */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ margin: 0 }}>My Applications & Memberships</h3>
        <motion.button
          className="btn btn-primary"
          onClick={() => navigate('/create-chapter')}
          whileTap={{ scale: 0.96 }}
        >
          <Plus size={16} /> Start a New Club
        </motion.button>
      </div>

      {myMemberships.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: '2rem' }}>
          <div className="empty-state-icon">📋</div>
          <p>You haven't joined or applied to any clubs yet.</p>
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={{ display: 'grid', gap: '1rem', marginBottom: '2.5rem' }}
        >
          {myMemberships.map(mem => (
            <motion.div
              key={mem.id}
              variants={item}
              style={{
                padding: '1.25rem',
                border: '1px solid var(--input-border)',
                borderRadius: '1rem',
                backgroundColor: 'var(--input-bg)',
              }}
              whileHover={{ scale: 1.01, boxShadow: 'var(--glass-shadow-hover)' }}
            >
              <h4 style={{ marginBottom: '0.25rem' }}>{mem.chapter?.name} ({mem.chapter?.academic_year})</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {mem.isChapterCreation ? (
                  <span>Application to start a new club as <strong>Lead</strong></span>
                ) : (
                  <span>Role: <strong style={{ textTransform: 'capitalize' }}>{mem.role.replace('_', ' ')}</strong> {mem.designation && `(${mem.designation})`}</span>
                )}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className={`badge ${mem.status === 'approved' ? 'badge-success' : mem.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                  {mem.status}
                </span>

                {mem.status === 'approved' && (
                  <motion.button
                    className="btn btn-outline"
                    style={{ padding: '0.3rem 0.85rem', fontSize: '0.85rem' }}
                    onClick={() => navigate(`/club/${mem.chapter_id}`)}
                    whileTap={{ scale: 0.96 }}
                  >
                    {['core_team', 'lead', 'faculty_coordinator'].includes(mem.role) ? 'Manage Club' : 'Club Details'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Explore Active Clubs */}
      <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>Explore Active Clubs</h3>
      {activeChapters.length === 0 ? (
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
          {activeChapters.map(chapter => (
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <motion.button
                  className="btn btn-outline"
                  style={{ flex: 1, fontSize: '0.85rem', padding: '0.5rem' }}
                  onClick={() => navigate(`/club/${chapter.id}`)}
                  whileTap={{ scale: 0.96 }}
                >
                  View Details
                </motion.button>
                <motion.button
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.85rem', padding: '0.5rem' }}
                  onClick={() => handleApply(chapter.id)}
                  whileTap={{ scale: 0.96 }}
                >
                  Apply to Join
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Upcoming Events */}
      <h3 style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Upcoming Events</h3>
      {upcomingEvents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <p>No upcoming public events found.</p>
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="card-grid"
        >
          {upcomingEvents.map(event => (
            <motion.div
              key={event.id}
              variants={item}
              className="glass-panel"
              style={{ backgroundColor: 'var(--input-bg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              whileHover={{ y: -6, boxShadow: 'var(--glass-shadow-hover)' }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>{event.name}</h4>
                  <span className={`badge ${event.restrict_to_members ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                    {event.restrict_to_members ? 'Members Only' : 'Open'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600, marginBottom: '0.35rem' }}>{event.chapter?.name}</p>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={13} /> {new Date(event.event_date).toLocaleDateString()}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={13} /> {event.venue || 'Not specified'}
                  </span>
                </div>
              </div>
              <motion.button
                className="btn btn-outline"
                style={{ width: '100%', fontSize: '0.85rem', marginTop: '1.25rem' }}
                onClick={() => navigate(`/event/${event.id}`)}
                whileTap={{ scale: 0.96 }}
              >
                View Details & Register
              </motion.button>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Past Events */}
      <h3 style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Past Events</h3>
      {pastEvents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <p>No past events found.</p>
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="card-grid"
        >
          {pastEvents.map(event => (
            <motion.div
              key={event.id}
              variants={item}
              className="glass-panel"
              style={{ backgroundColor: 'var(--input-bg)', opacity: 0.8, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              whileHover={{ y: -4, opacity: 1 }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>{event.name}</h4>
                  <span className={`badge ${event.restrict_to_members ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                    {event.restrict_to_members ? 'Members Only' : 'Open'}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.35rem' }}>{event.chapter?.name}</p>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={13} /> {new Date(event.event_date).toLocaleDateString()} (Ended)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={13} /> {event.venue || 'Not specified'}
                  </span>
                </div>
              </div>
              <motion.button
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: '0.85rem', marginTop: '1.25rem' }}
                onClick={() => navigate(`/event/${event.id}`)}
                whileTap={{ scale: 0.96 }}
              >
                View Details
              </motion.button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default StudentDashboard;
