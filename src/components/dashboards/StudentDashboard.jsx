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
  const [hostedEvents, setHostedEvents] = useState([]);
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

      // Fetch hosted events (if user is lead/core_team)
      const leaderChapterIds = (memberships || [])
        .filter(m => ['core_team', 'lead', 'faculty_coordinator'].includes(m.role) && m.status === 'approved')
        .map(m => m.chapter_id);
        
      let myHostedEvents = [];
      if (leaderChapterIds.length > 0) {
        const { data: hEvents, error: hEventsError } = await supabase
          .from('events')
          .select('*, chapter:club_chapters(name)')
          .in('chapter_id', leaderChapterIds)
          .order('event_date', { ascending: false });
        if (!hEventsError) myHostedEvents = hEvents || [];
      }

      // Fetch user's event registrations
      const { data: userRegistrations, error: registrationsError } = await supabase
        .from('event_registrations')
        .select('event_id')
        .eq('user_id', user.id);
        
      if (registrationsError) throw registrationsError;
      const registeredEventIds = (userRegistrations || []).map(r => r.event_id);

      const upcoming = (events || []).filter(e => !isEventOver(e));
      const past = (events || []).filter(e => isEventOver(e) && registeredEventIds.includes(e.id)).reverse();

      const approvedChapterIds = (memberships || [])
        .filter(m => m.status === 'approved')
        .map(m => m.chapter_id);

      const filteredChapters = (chapters || []).filter(c => !approvedChapterIds.includes(c.id));

      setActiveChapters(filteredChapters);
      setMyMemberships(memberships || []);
      setUpcomingEvents(upcoming);
      setPastEvents(past);
      setHostedEvents(myHostedEvents);
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
              <h4>{mem.chapter.name} ({mem.chapter.academic_year})</h4>
              <p style={{ fontSize: '0.875rem' }}>
                Role: <strong>{mem.role}</strong> {mem.designation && `(${mem.designation})`}
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

      {hostedEvents.length > 0 && (
        <>
          <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>Manage Hosted Events</h3>
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {hostedEvents.map(event => (
              <div key={event.id} style={{ padding: '1.5rem', border: '1px solid var(--input-border)', borderRadius: '0.5rem', backgroundColor: 'var(--bg-color)' }}>
                <h4 style={{ margin: '0 0 0.25rem 0' }}>{event.name}</h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '0.5rem' }}>{event.chapter?.name}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Date: {new Date(event.event_date).toLocaleDateString()}
                </p>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', fontSize: '0.875rem' }}
                  onClick={() => window.location.href = `/manage-event/${event.id}`}
                >
                  Manage Attendance
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>Explore Active Clubs</h3>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {activeChapters.map(chapter => {
          const hasApplied = myMemberships.find(m => m.chapter_id === chapter.id);
          
          return (
            <div key={chapter.id} style={{ padding: '1.5rem', border: '1px solid var(--input-border)', borderRadius: '0.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>{chapter.name}</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{chapter.description}</p>
              <button 
                className={`btn ${hasApplied ? 'btn-outline' : 'btn-primary'}`} 
                onClick={() => handleApply(chapter.id)}
                disabled={hasApplied}
              >
                {hasApplied ? 'Already Applied' : 'Apply to Join'}
              </button>
            </div>
          );
        })}
      </div>

      <h3 style={{ marginBottom: '1.5rem', marginTop: '3rem' }}>Upcoming Events</h3>
      {upcomingEvents.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No upcoming public events found.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {upcomingEvents.map(event => (
            <div key={event.id} style={{ padding: '1.5rem', border: '1px solid var(--input-border)', borderRadius: '0.5rem', backgroundColor: 'var(--input-bg)' }}>
              <h4 style={{ margin: '0 0 0.25rem 0' }}>{event.name}</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '0.5rem' }}>{event.chapter?.name}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Date: {new Date(event.event_date).toLocaleDateString()}
              </p>
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', fontSize: '0.875rem' }}
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
            <div key={event.id} style={{ padding: '1.5rem', border: '1px solid var(--input-border)', borderRadius: '0.5rem', backgroundColor: 'var(--input-bg)', opacity: 0.85 }}>
              <h4 style={{ margin: '0 0 0.25rem 0' }}>{event.name}</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>{event.chapter?.name}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Date: {new Date(event.event_date).toLocaleDateString()} (Ended)
              </p>
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', fontSize: '0.875rem', borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)' }}
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
