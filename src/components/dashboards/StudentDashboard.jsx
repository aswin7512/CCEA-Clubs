import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isEventOver } from '../../lib/eventUtils';

const StudentDashboard = () => {
  const { user } = useAuth();
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
    try {
      const { error } = await supabase
        .from('club_members')
        .insert([{
          chapter_id: chapterId,
          user_id: user.id,
          role: 'member', // Default role for standard applicants
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>My Applications & Memberships</h3>
        <button 
          className="btn btn-primary" 
          onClick={() => window.location.href = '/create-chapter'}
        >
          Start a New Club Chapter
        </button>
      </div>

      {myMemberships.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>You haven't joined or applied to any clubs yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2.5rem' }}>
          {myMemberships.map(mem => (
            <div key={mem.id} style={{ padding: '1rem', border: '1px solid var(--input-border)', borderRadius: '0.5rem', backgroundColor: 'var(--input-bg)' }}>
              <h4>{mem.chapter?.name} ({mem.chapter?.academic_year})</h4>
              <p style={{ fontSize: '0.875rem' }}>
                {mem.isChapterCreation ? (
                  <span>Application to start a new club chapter as <strong>Lead</strong></span>
                ) : (
                  <span>Role: <strong>{mem.role}</strong> {mem.designation && `(${mem.designation})`}</span>
                )}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '1rem' }}>
                <span style={{ 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '0.5rem', 
                  fontSize: '0.75rem', 
                  backgroundColor: mem.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : mem.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: mem.status === 'approved' ? 'var(--secondary-color)' : mem.status === 'rejected' ? 'var(--danger-color)' : '#f59e0b'
                }}>
                  Status: {mem.status}
                </span>

                {mem.status === 'approved' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-outline" 
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                      onClick={() => window.location.href = `/club/${mem.chapter_id}`}
                    >
                      {['core_team', 'lead', 'faculty_coordinator'].includes(mem.role) ? 'Manage Club' : 'Club Details'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>Explore Active Clubs</h3>
      {activeChapters.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No other active clubs found on campus.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {activeChapters.map(chapter => (
            <div key={chapter.id} className="glass-panel animate-hover" style={{ backgroundColor: 'var(--input-bg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>{chapter.name} ({chapter.academic_year})</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  {chapter.description || 'No description provided.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }}
                  onClick={() => window.location.href = `/club/${chapter.id}`}
                >
                  View Details
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }}
                  onClick={() => handleApply(chapter.id)}
                >
                  Apply to Join
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Upcoming Events</h3>
      {upcomingEvents.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No upcoming public events found.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {upcomingEvents.map(event => (
            <div key={event.id} className="glass-panel animate-hover" style={{ backgroundColor: 'var(--input-bg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>{event.name}</h4>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '0.25rem',
                    whiteSpace: 'nowrap',
                    backgroundColor: event.restrict_to_members ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: event.restrict_to_members ? 'var(--danger-color)' : 'var(--secondary-color)',
                    border: `1px solid ${event.restrict_to_members ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    {event.restrict_to_members ? 'Members Only' : 'Open to All'}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '0.25rem' }}>{event.chapter?.name}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Date: {new Date(event.event_date).toLocaleDateString()}
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Venue: {event.venue || 'Not specified'}
                </p>
              </div>
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', fontSize: '0.875rem', marginTop: '1rem' }}
                onClick={() => window.location.href = `/event/${event.id}`}
              >
                View Details & Register
              </button>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Past Events</h3>
      {pastEvents.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No past events found.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {pastEvents.map(event => (
            <div key={event.id} className="glass-panel animate-hover" style={{ backgroundColor: 'var(--input-bg)', opacity: 0.85, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0 }}>{event.name}</h4>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '0.25rem',
                    whiteSpace: 'nowrap',
                    backgroundColor: event.restrict_to_members ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: event.restrict_to_members ? 'var(--danger-color)' : 'var(--secondary-color)',
                    border: `1px solid ${event.restrict_to_members ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    {event.restrict_to_members ? 'Members Only' : 'Open to All'}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '0.25rem' }}>{event.chapter?.name}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Date: {new Date(event.event_date).toLocaleDateString()} (Ended)
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Venue: {event.venue || 'Not specified'}
                </p>
              </div>
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', fontSize: '0.875rem', borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)', marginTop: '1rem' }}
                onClick={() => window.location.href = `/event/${event.id}`}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
