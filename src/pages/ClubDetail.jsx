import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const ClubDetail = () => {
  const { chapterId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [chapter, setChapter] = useState(null);
  const [events, setEvents] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab State: 'events' | 'members' | 'requests'
  const [activeTab, setActiveTab] = useState('events');

  // Member editing state
  const [editingMember, setEditingMember] = useState(null);
  const [editRole, setEditRole] = useState('member');
  const [editDesignation, setEditDesignation] = useState('');
  const [updatingMemberId, setUpdatingMemberId] = useState(null);

  // Faculty assignment state
  const [showAssignFacultyModal, setShowAssignFacultyModal] = useState(false);
  const [facultyList, setFacultyList] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [assignDesignation, setAssignDesignation] = useState('');
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [submittingFaculty, setSubmittingFaculty] = useState(false);

  useEffect(() => {
    fetchClubData();
  }, [chapterId, user]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch Chapter Info
      const { data: chapterData, error: chapterError } = await supabase
        .from('club_chapters')
        .select('*, lead:campus_lead_id(name, email, department, roll_number)')
        .eq('id', chapterId)
        .single();

      if (chapterError) throw chapterError;
      setChapter(chapterData);

      // 2. Fetch all members / applications for this club
      const { data: membersData, error: membersError } = await supabase
        .from('club_members')
        .select('*, profiles:user_id(name, email, department, roll_number)')
        .eq('chapter_id', chapterId);

      if (membersError) throw membersError;
      setMemberships(membersData || []);

      // 3. Fetch events under this club
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('event_date', { ascending: false });

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load club details');
    } finally {
      setLoading(false);
    }
  };

  // Determine current user's membership details
  const myMembership = memberships.find(m => m.user_id === user?.id);
  const isCampusLead = chapter?.campus_lead_id === user?.id;
  const isFaculty = profile?.role === 'faculty' || profile?.role === 'super_admin';
  const isApprovedMember = isCampusLead || myMembership?.status === 'approved' || isFaculty;
  const isSuperAdmin = false;
  const isLeader = isSuperAdmin || isCampusLead || (myMembership?.status === 'approved' && ['lead', 'core_team', 'faculty_coordinator'].includes(myMembership?.role));
  const canManageRoles = isSuperAdmin || isCampusLead || (myMembership?.status === 'approved' && ['core_team', 'faculty_coordinator'].includes(myMembership?.role));

  const handleApply = async () => {
    try {
      const { error } = await supabase
        .from('club_members')
        .insert([{
          chapter_id: chapterId,
          user_id: user?.id,
          role: 'member',
          status: 'pending'
        }]);

      if (error) throw error;
      alert('Application submitted successfully!');
      await fetchClubData();
    } catch (err) {
      alert('Failed to apply: ' + err.message);
    }
  };

  // Handle Request Actions
  const handleRequestAction = async (membershipId, newStatus) => {
    try {
      const { error: updateError } = await supabase
        .from('club_members')
        .update({ status: newStatus })
        .eq('id', membershipId);

      if (updateError) throw updateError;
      alert(`Request successfully ${newStatus === 'approved' ? 'approved' : 'rejected'}!`);
      // Refresh data
      await fetchClubData();
    } catch (err) {
      alert(`Failed to update request: ${err.message}`);
    }
  };

  const handleUpdateMemberRole = async (e) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      setUpdatingMemberId(editingMember.id);
      
      const { error: updateError } = await supabase
        .from('club_members')
        .update({
          role: editRole,
          designation: editDesignation || null
        })
        .eq('id', editingMember.id);

      if (updateError) throw updateError;

      // Update local state to avoid full refetch
      setMemberships(prev => prev.map(m => m.id === editingMember.id ? { ...m, role: editRole, designation: editDesignation || null } : m));
      setEditingMember(null);
      alert('Member updated successfully!');
    } catch (err) {
      alert('Failed to update member: ' + err.message);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleOpenAssignFaculty = async () => {
    try {
      setLoadingFaculty(true);
      setShowAssignFacultyModal(true);
      
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, name, email, department')
        .eq('role', 'faculty');
        
      if (fetchErr) throw fetchErr;
      
      // Filter out faculty members who are already in memberships for this chapter
      const existingUserIds = memberships.map(m => m.user_id);
      const availableFaculty = (data || []).filter(f => !existingUserIds.includes(f.id));
      
      setFacultyList(availableFaculty);
      if (availableFaculty.length > 0) {
        setSelectedFacultyId(availableFaculty[0].id);
      } else {
        setSelectedFacultyId('');
      }
    } catch (err) {
      alert('Failed to load faculty list: ' + err.message);
    } finally {
      setLoadingFaculty(false);
    }
  };

  const handleAssignFacultySubmit = async (e) => {
    e.preventDefault();
    if (!selectedFacultyId) {
      alert('Please select a faculty member.');
      return;
    }
    try {
      setSubmittingFaculty(true);
      
      const { error: insertErr } = await supabase
        .from('club_members')
        .insert({
          chapter_id: chapterId,
          user_id: selectedFacultyId,
          role: 'faculty_coordinator',
          status: 'approved',
          designation: assignDesignation || null,
          assigned_by: user.id
        });
        
      if (insertErr) throw insertErr;
      
      alert('Faculty coordinator assigned successfully!');
      setShowAssignFacultyModal(false);
      setAssignDesignation('');
      // Refresh club data
      await fetchClubData();
    } catch (err) {
      alert('Failed to assign faculty coordinator: ' + err.message);
    } finally {
      setSubmittingFaculty(false);
    }
  };

  const getRoleBadgeStyle = (role) => {
    if (['lead', 'core_team', 'faculty_coordinator'].includes(role)) {
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        color: 'var(--primary-color)'
      };
    }
    if (role === 'volunteer') {
      return {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        color: 'var(--secondary-color)'
      };
    }
    return {
      backgroundColor: 'rgba(255,255,255,0.05)',
      color: 'var(--text-color)'
    };
  };

  const isEventOver = (event) => {
    if (!event.event_date) return false;
    const now = new Date();
    const eventEnd = new Date(event.event_date);
    if (event.end_time) {
      const [hours, minutes] = event.end_time.split(':');
      eventEnd.setHours(parseInt(hours), parseInt(minutes), 0);
    } else {
      eventEnd.setHours(23, 59, 59);
    }
    return now > eventEnd;
  };

  const upcomingEvents = events
    .filter(e => !isEventOver(e))
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

  const pastEvents = events
    .filter(e => isEventOver(e))
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

  let approvedMembers = memberships.filter(m => m.status === 'approved');
  // If the campus lead is not in the club_members table, append them virtually
  if (chapter?.lead && !approvedMembers.some(m => m.user_id === chapter.campus_lead_id)) {
    approvedMembers = [
      {
        id: 'virtual-lead',
        user_id: chapter.campus_lead_id,
        role: 'lead',
        status: 'approved',
        profiles: chapter.lead
      },
      ...approvedMembers
    ];
  }
  const pendingRequests = memberships.filter(m => m.status === 'pending');
  const rejectedRequests = memberships.filter(m => m.status === 'rejected');

  const facultyCoordinators = approvedMembers
    .filter(m => m.role === 'faculty_coordinator' || m.profiles?.role === 'faculty')
    .sort((a, b) => (a.profiles?.name || '').localeCompare(b.profiles?.name || ''));

  const studentMembers = approvedMembers.filter(m => m.role !== 'faculty_coordinator' && m.profiles?.role !== 'faculty');

  // Core Team = Lead + Core Team members
  const coreTeamMembers = studentMembers.filter(m => m.role === 'lead' || m.role === 'core_team');
  coreTeamMembers.sort((a, b) => {
    if (a.role === 'lead' && b.role !== 'lead') return -1;
    if (b.role === 'lead' && a.role !== 'lead') return 1;
    return (a.profiles?.name || '').localeCompare(b.profiles?.name || '');
  });

  // Sub Team (Volunteer Team)
  const volunteerTeamMembers = studentMembers
    .filter(m => m.role === 'volunteer')
    .sort((a, b) => (a.profiles?.name || '').localeCompare(b.profiles?.name || ''));

  // Members
  const generalMembers = studentMembers
    .filter(m => m.role === 'member' || !m.role)
    .sort((a, b) => (a.profiles?.name || '').localeCompare(b.profiles?.name || ''));

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container flex-center" style={{ minHeight: '60vh' }}>
        <div className="glass-panel text-center">
          <h2 style={{ color: 'var(--danger-color)' }}>Error</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '1000px' }}>
      {/* Back button */}
      <button 
        className="btn btn-outline" 
        style={{ marginBottom: '1.5rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} 
        onClick={() => navigate('/dashboard')}
      >
        &larr; Back to Dashboard
      </button>

      {/* Chapter Details Banner */}
      {chapter && (
        <div className="glass-panel" style={{ marginBottom: '2rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: '0 0 0.5rem 0' }}>{chapter.name}</h2>
              <p style={{ color: 'var(--primary-color)', fontWeight: 'bold', margin: '0 0 1rem 0' }}>
                Academic Year: {chapter.academic_year}
              </p>
              <p style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                {chapter.description || 'No description provided.'}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {!user ? (
                <button 
                  className="btn btn-outline animate-hover" 
                  onClick={() => navigate('/login')}
                >
                  Sign in to Join
                </button>
              ) : profile?.role === 'student' && (
                <div>
                  {!myMembership ? (
                    <button 
                      className="btn btn-primary animate-hover" 
                      onClick={handleApply}
                    >
                      Apply to Join Club
                    </button>
                  ) : myMembership.status === 'pending' ? (
                    <span style={{ 
                      padding: '0.5rem 1rem', 
                      borderRadius: '1rem', 
                      fontSize: '0.875rem', 
                      fontWeight: 'bold',
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      Application Pending
                    </span>
                  ) : myMembership.status === 'rejected' ? (
                    <span style={{ 
                      padding: '0.5rem 1rem', 
                      borderRadius: '1rem', 
                      fontSize: '0.875rem', 
                      fontWeight: 'bold',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      color: 'var(--danger-color)',
                      border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                      Application Rejected
                    </span>
                  ) : null}
                </div>
              )}

              {isLeader && (
                <button 
                  className="btn btn-primary animate-hover" 
                  onClick={() => navigate(`/host-event?chapterId=${chapterId}`)}
                >
                  Host Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs Menu */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--input-border)', marginBottom: '2rem', gap: '0.5rem' }}>
        <button 
          className={`btn ${activeTab === 'events' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: activeTab === 'events' ? '2px solid var(--primary-color)' : 'none' }}
          onClick={() => setActiveTab('events')}
        >
          Events ({events.length})
        </button>
        <button 
          className={`btn ${activeTab === 'members' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: activeTab === 'members' ? '2px solid var(--primary-color)' : 'none' }}
          onClick={() => setActiveTab('members')}
        >
          Members ({studentMembers.length})
        </button>
        {isLeader && (
          <button 
            className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: activeTab === 'requests' ? '2px solid var(--primary-color)' : 'none' }}
            onClick={() => setActiveTab('requests')}
          >
            Pending ({pendingRequests.length}) & Rejected ({rejectedRequests.length})
          </button>
        )}
      </div>

      {/* Tab Contents: Events */}
      {activeTab === 'events' && (
        <div>
          <h3 style={{ marginBottom: '1.5rem' }}>Events Organized</h3>
          
          {/* Upcoming Events */}
          <h4 style={{ marginBottom: '1rem', color: 'var(--primary-color)' }}>Upcoming Events</h4>
          {upcomingEvents.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>No upcoming events scheduled.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', marginBottom: '2.5rem' }}>
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
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Date: {new Date(event.event_date).toLocaleDateString()}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Venue: {event.venue || 'Not specified'}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button 
                      className="btn btn-outline" 
                      style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }}
                      onClick={() => navigate(`/event/${event.id}`)}
                    >
                      View Details
                    </button>
                    {isLeader && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }}
                        onClick={() => navigate(`/manage-event/${event.id}`)}
                      >
                        Manage Attendance
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Past Events */}
          <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Past Events</h4>
          {pastEvents.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No past events.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {pastEvents.map(event => (
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
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Date: {new Date(event.event_date).toLocaleDateString()}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Venue: {event.venue || 'Not specified'}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button 
                      className="btn btn-outline" 
                      style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }}
                      onClick={() => navigate(`/event/${event.id}`)}
                    >
                      View Details
                    </button>
                    {isLeader && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }}
                        onClick={() => navigate(`/manage-event/${event.id}`)}
                      >
                        Manage Attendance
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Members */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Faculty Coordinators Section */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Faculty Coordinator</h3>
              {(isCampusLead || isSuperAdmin) && (
                <button 
                  className="btn btn-primary" 
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  onClick={handleOpenAssignFaculty}
                >
                  + Assign Faculty Coordinator
                </button>
              )}
            </div>
            {facultyCoordinators.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No faculty coordinator assigned yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--input-border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.75rem' }}>Name</th>
                      <th style={{ padding: '0.75rem' }}>Email</th>
                      <th style={{ padding: '0.75rem' }}>Department</th>
                      <th style={{ padding: '0.75rem' }}>Designation</th>
                      {canManageRoles && <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {facultyCoordinators.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.name || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.email || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.department || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <span style={{ 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '0.5rem', 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold',
                            ...getRoleBadgeStyle('faculty_coordinator')
                          }}>
                            {m.designation || 'Faculty Coordinator'}
                          </span>
                        </td>
                        {canManageRoles && (
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            {m.id !== 'virtual-lead' && (
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setEditingMember(m);
                                  setEditRole(m.role || 'faculty_coordinator');
                                  setEditDesignation(m.designation || '');
                                }}
                              >
                                Manage Role
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Members Section */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Active Members</h3>
            {studentMembers.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No active student members found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Core Team Section */}
                {coreTeamMembers.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary-color)' }}></span>
                      Core Team
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--input-border)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.75rem' }}>Name</th>
                            <th style={{ padding: '0.75rem' }}>Email</th>
                            <th style={{ padding: '0.75rem' }}>Department</th>
                            <th style={{ padding: '0.75rem' }}>Role</th>
                            {canManageRoles && <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {coreTeamMembers.map(m => (
                            <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.name || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.email || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.department || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>
                                <span style={{ 
                                  padding: '0.25rem 0.5rem', 
                                  borderRadius: '0.5rem', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 'bold',
                                  ...getRoleBadgeStyle(m.role)
                                }}>
                                  {m.role === 'lead' ? 'Campus Lead' : (m.designation || 'Core Team')}
                                </span>
                              </td>
                              {canManageRoles && (
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                  {m.user_id !== chapter?.campus_lead_id && m.id !== 'virtual-lead' && (
                                    (isCampusLead || isSuperAdmin || ['member', 'volunteer'].includes(m.role)) && (
                                      <button 
                                        className="btn btn-outline" 
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        onClick={() => {
                                          setEditingMember(m);
                                          setEditRole(m.role || 'member');
                                          setEditDesignation(m.designation || '');
                                        }}
                                      >
                                        Manage Role
                                      </button>
                                    )
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sub Team Section */}
                {volunteerTeamMembers.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--secondary-color)' }}></span>
                      Sub Team
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--input-border)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.75rem' }}>Name</th>
                            <th style={{ padding: '0.75rem' }}>Email</th>
                            <th style={{ padding: '0.75rem' }}>Department</th>
                            <th style={{ padding: '0.75rem' }}>Role</th>
                            {canManageRoles && <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {volunteerTeamMembers.map(m => (
                            <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.name || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.email || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.department || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>
                                <span style={{ 
                                  padding: '0.25rem 0.5rem', 
                                  borderRadius: '0.5rem', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 'bold',
                                  ...getRoleBadgeStyle(m.role)
                                }}>
                                  {m.designation || 'Volunteer'}
                                </span>
                              </td>
                              {canManageRoles && (
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                  {m.user_id !== chapter?.campus_lead_id && m.id !== 'virtual-lead' && (
                                    (isCampusLead || isSuperAdmin || ['member', 'volunteer'].includes(m.role)) && (
                                      <button 
                                        className="btn btn-outline" 
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        onClick={() => {
                                          setEditingMember(m);
                                          setEditRole(m.role || 'member');
                                          setEditDesignation(m.designation || '');
                                        }}
                                      >
                                        Manage Role
                                      </button>
                                    )
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* General Members Section */}
                {generalMembers.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '1rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-color)' }}></span>
                      Members
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--input-border)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '0.75rem' }}>Name</th>
                            <th style={{ padding: '0.75rem' }}>Email</th>
                            <th style={{ padding: '0.75rem' }}>Department</th>
                            <th style={{ padding: '0.75rem' }}>Role</th>
                            {canManageRoles && <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {generalMembers.map(m => (
                            <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.name || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.email || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>{m.profiles?.department || 'N/A'}</td>
                              <td style={{ padding: '0.75rem' }}>
                                <span style={{ 
                                  padding: '0.25rem 0.5rem', 
                                  borderRadius: '0.5rem', 
                                  fontSize: '0.75rem', 
                                  fontWeight: 'bold',
                                  ...getRoleBadgeStyle(m.role)
                                }}>
                                  Member
                                  {m.designation && ` (${m.designation})`}
                                </span>
                              </td>
                              {canManageRoles && (
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                  {m.user_id !== chapter?.campus_lead_id && m.id !== 'virtual-lead' && (
                                    (isCampusLead || isSuperAdmin || ['member', 'volunteer'].includes(m.role)) && (
                                      <button 
                                        className="btn btn-outline" 
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        onClick={() => {
                                          setEditingMember(m);
                                          setEditRole(m.role || 'member');
                                          setEditDesignation(m.designation || '');
                                        }}
                                      >
                                        Manage Role
                                      </button>
                                    )
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <form onSubmit={handleUpdateMemberRole} className="glass-panel" style={{
            maxWidth: '450px',
            width: '100%',
            padding: '2rem',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <button 
              type="button"
              onClick={() => setEditingMember(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-color)',
                fontSize: '1.5rem',
                cursor: 'pointer',
                opacity: 0.7
              }}
            >
              &times;
            </button>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--input-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
              Manage Club Member
            </h3>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Updating role and designation for <strong>{editingMember.profiles?.name}</strong>.
            </p>

            {editingMember.profiles?.role === 'faculty' || editingMember.role === 'faculty_coordinator' ? (
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Faculty Designation / Title</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Club Advisor, Coordinator" 
                  value={editDesignation}
                  onChange={e => setEditDesignation(e.target.value)}
                />
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Assign a specific title or designation for this faculty coordinator.
                </small>
              </div>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Club Role</label>
                  <select 
                    className="form-control" 
                    value={editRole} 
                    onChange={e => setEditRole(e.target.value)}
                    required
                  >
                    <option value="member">Member</option>
                    <option value="volunteer">Volunteer</option>
                    {(isCampusLead || isSuperAdmin) && (
                      <option value="core_team">Core Team</option>
                    )}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Custom Designation</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Technical Lead, Event Head" 
                    value={editDesignation}
                    onChange={e => setEditDesignation(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                    Optional. Give them a specific title within the club.
                  </small>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ flex: 1 }} 
                onClick={() => setEditingMember(null)}
                disabled={updatingMemberId !== null}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                disabled={updatingMemberId !== null}
              >
                {updatingMemberId !== null ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Faculty Coordinator Modal */}
      {showAssignFacultyModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <form onSubmit={handleAssignFacultySubmit} className="glass-panel" style={{
            maxWidth: '450px',
            width: '100%',
            padding: '2rem',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <button 
              type="button"
              onClick={() => {
                setShowAssignFacultyModal(false);
                setAssignDesignation('');
              }}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-color)',
                fontSize: '1.5rem',
                cursor: 'pointer',
                opacity: 0.7
              }}
            >
              &times;
            </button>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--input-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>
              Assign Faculty Coordinator
            </h3>

            {loadingFaculty ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <div className="loader" style={{ width: '30px', height: '30px' }}></div>
              </div>
            ) : facultyList.length === 0 ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  No available faculty members found to assign (either none exist or all are already assigned to this club).
                </p>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ width: '100%', marginTop: '1rem' }} 
                  onClick={() => setShowAssignFacultyModal(false)}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Select Faculty Member</label>
                  <select 
                    className="form-control" 
                    value={selectedFacultyId} 
                    onChange={e => setSelectedFacultyId(e.target.value)}
                    required
                  >
                    {facultyList.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.department}) - {f.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Faculty Designation / Title</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Club Advisor, Coordinator" 
                    value={assignDesignation}
                    onChange={e => setAssignDesignation(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                    Optional. Assign a specific title for this coordinator.
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    style={{ flex: 1 }} 
                    onClick={() => {
                      setShowAssignFacultyModal(false);
                      setAssignDesignation('');
                    }}
                    disabled={submittingFaculty}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    disabled={submittingFaculty}
                  >
                    {submittingFaculty ? 'Assigning...' : 'Assign Coordinator'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {/* Tab Contents: Requests (Leaders Only) */}
      {activeTab === 'requests' && isLeader && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Pending Requests */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: '#f59e0b' }}>Pending Applications</h3>
            {pendingRequests.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No pending applications.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--input-border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.75rem' }}>Name</th>
                      <th style={{ padding: '0.75rem' }}>Email</th>
                      <th style={{ padding: '0.75rem' }}>Roll Number</th>
                      <th style={{ padding: '0.75rem' }}>Department</th>
                      <th style={{ padding: '0.75rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.name || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.email || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.roll_number || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.department || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                              onClick={() => handleRequestAction(m.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                              onClick={() => handleRequestAction(m.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rejected Requests */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--danger-color)' }}>Rejected Applications</h3>
            {rejectedRequests.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No rejected applications.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--input-border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.75rem' }}>Name</th>
                      <th style={{ padding: '0.75rem' }}>Email</th>
                      <th style={{ padding: '0.75rem' }}>Roll Number</th>
                      <th style={{ padding: '0.75rem' }}>Department</th>
                      <th style={{ padding: '0.75rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedRequests.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.name || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.email || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.roll_number || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>{m.profiles?.department || 'N/A'}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                            onClick={() => handleRequestAction(m.id, 'approved')}
                          >
                            Reconsider (Approve)
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubDetail;
