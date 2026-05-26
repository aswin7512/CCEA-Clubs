import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateAttendancePDF } from '../lib/pdfUtils';
import { isEventOver } from '../lib/eventUtils';

const EventDetail = () => {
  const { eventId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Registration State
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState('');
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [isHostOrLeader, setIsHostOrLeader] = useState(false);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId, user, profile]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*, chapter:club_chapters(name)')
        .eq('id', eventId)
        .single();
         
      if (eventError) throw eventError;
      setEvent(eventData);

      // Check if user is host or leader
      const isCreator = eventData.created_by === user.id;
      const isCoHost = (eventData.co_hosts || []).includes(user.id);
      const isSuperAdmin = profile?.role === 'super_admin';

      let isChapterLeader = false;
      const { data: leaderMember, error: leaderError } = await supabase
        .from('club_members')
        .select('role, status')
        .eq('chapter_id', eventData.chapter_id)
        .eq('user_id', user.id)
        .single();

      if (!leaderError && leaderMember?.status === 'approved' && ['core_team', 'lead', 'faculty_coordinator'].includes(leaderMember?.role)) {
        isChapterLeader = true;
      }

      const isAuthorized = isCreator || isCoHost || isSuperAdmin || isChapterLeader;
      setIsHostOrLeader(isAuthorized);

      // Check if student is enrolled in the chapter of this event (only if event is restricted to members)
      if (profile?.role === 'student' && eventData.restrict_to_members) {
        const { data: memberData, error: memberError } = await supabase
          .from('club_members')
          .select('*')
          .eq('chapter_id', eventData.chapter_id)
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .maybeSingle();

        if (memberError) throw memberError;
        // Leaders and co-hosts are allowed to access members-only events regardless of normal enrollment checks
        if (!memberData && !isAuthorized) {
          throw new Error('Access Denied: This event is restricted to approved club members only.');
        }
      }

      // 2. Fetch Custom Fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('event_custom_fields')
        .select('*')
        .eq('event_id', eventId)
        .order('order_index', { ascending: true });

      if (fieldsError) throw fieldsError;
      setCustomFields(fieldsData || []);

      // Initialize form data state
      const initialData = {};
      (fieldsData || []).forEach(f => {
        initialData[f.id] = f.field_type === 'checklist' ? [] : '';
      });
      setFormData(initialData);

      // 3. Check if user already applied
      const { data: regData, error: regError } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (regData) {
        setHasApplied(true);
        setApplicationStatus(regData.status);
      }
      
      // 4. Fetch all registrations for PDF export if needed
      const { data: allRegsData, error: regsError } = await supabase
        .from('event_registrations')
        .select('*, profiles:user_id(name, email, department, roll_number, prp_code)')
        .eq('event_id', eventId);
        
      if (regsError) {
        console.error("Error fetching all registrations:", regsError);
      }
      if (allRegsData) {
        setAllRegistrations(allRegsData);
      }

    } catch (err) {
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldId, value, type) => {
    setFormData(prev => {
      if (type === 'checklist') {
        const currentArr = prev[fieldId] || [];
        if (currentArr.includes(value)) {
          return { ...prev, [fieldId]: currentArr.filter(v => v !== value) };
        } else {
          return { ...prev, [fieldId]: [...currentArr, value] };
        }
      }
      return { ...prev, [fieldId]: value };
    });
  };

  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError('');

      // Validation
      for (const field of customFields) {
        if (field.is_required) {
          const val = formData[field.id];
          if (!val || (Array.isArray(val) && val.length === 0)) {
            throw new Error(`Field "${field.field_label}" is required.`);
          }
        }
      }

      // Determine initial status based on admission type
      let initialStatus = 'pending';
      if (event.admission_type === 'auto_accept') initialStatus = 'approved';

      const { error: submitError } = await supabase
        .from('event_registrations')
        .insert([{
          event_id: eventId,
          user_id: user.id,
          status: initialStatus,
          custom_data: formData
        }]);

      if (submitError) throw submitError;

      setHasApplied(true);
      setApplicationStatus(initialStatus);
      alert('Registration successful!');
    } catch (err) {
      setError(err.message || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
      </div>
    );
  }
  if (error && error.includes('Access Denied')) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-panel text-center" style={{ maxWidth: '500px', width: '100%' }}>
          <h2 style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  if (!event) return <div className="container flex-center" style={{ minHeight: '80vh' }}>Event not found</div>;

  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '800px' }}>
      <button className="btn btn-outline" style={{ marginBottom: '1.5rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => navigate('/dashboard')}>
        &larr; Back to Dashboard
      </button>

      {isHostOrLeader && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem', border: '1px dashed var(--primary-color)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--primary-color)' }}>Host Controls</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>You are authorized to manage this event.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => navigate(`/manage-event/${event.id}`)}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              Manage Attendance
            </button>
            <button 
              className="btn btn-outline" 
              onClick={() => navigate(`/edit-event/${event.id}`)}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              Edit Event
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>{event.name}</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--primary-color)', fontWeight: 'bold', margin: 0 }}>Hosted by {event.chapter?.name}</p>
          <span style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.5rem',
            backgroundColor: event.restrict_to_members ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: event.restrict_to_members ? 'var(--danger-color)' : 'var(--secondary-color)',
            border: `1px solid ${event.restrict_to_members ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
          }}>
            {event.restrict_to_members ? 'Members Only' : 'Open to All'}
          </span>
        </div>
        
        <div style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem 0' }}><strong>Date:</strong> {new Date(event.event_date).toLocaleDateString()}</p>
          {event.is_during_class_hours ? (
            <p style={{ margin: 0 }}><strong>Class Hours:</strong> {event.class_hours?.join(', ')}</p>
          ) : (
            <p style={{ margin: 0 }}><strong>Time:</strong> {event.start_time} - {event.end_time}</p>
          )}
        </div>

        <h4 style={{ marginBottom: '0.5rem' }}>About this Event</h4>
        <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{event.description}</p>
      </div>

      {!hasApplied ? (
        isEventOver(event) ? (
          <div className="glass-panel text-center">
            <h3>Event Concluded</h3>
            <p style={{ margin: '1rem 0', color: 'var(--text-secondary)' }}>
              This event has already ended. Registration is closed.
            </p>
          </div>
        ) : (
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1.5rem' }}>Registration Form</h3>
            
            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--danger-color)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitRegistration}>
              {customFields.map((field) => (
                <div key={field.id} className="form-group">
                  <label className="form-label">
                    {field.field_label} {field.is_required && <span style={{ color: 'var(--danger-color)' }}>*</span>}
                  </label>

                  {field.field_type === 'text' && (
                    <input type="text" className="form-control" value={formData[field.id] || ''} onChange={e => handleFieldChange(field.id, e.target.value, 'text')} required={field.is_required} />
                  )}

                  {field.field_type === 'paragraph' && (
                    <textarea className="form-control" rows="3" value={formData[field.id] || ''} onChange={e => handleFieldChange(field.id, e.target.value, 'paragraph')} required={field.is_required} />
                  )}

                  {field.field_type === 'option' && (
                    <select className="form-control" value={formData[field.id] || ''} onChange={e => handleFieldChange(field.id, e.target.value, 'option')} required={field.is_required}>
                      <option value="">Select an option</option>
                      {(field.options || []).map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.field_type === 'checklist' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(field.options || []).map((opt, i) => (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={(formData[field.id] || []).includes(opt)}
                            onChange={() => handleFieldChange(field.id, opt, 'checklist')}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Register for Event'}
              </button>
            </form>
          </div>
        )
      ) : (
        <div className="glass-panel text-center">
          <h3>Registration Submitted</h3>
          <p style={{ margin: '1rem 0' }}>
            Your application status is: 
            <span style={{ 
              marginLeft: '0.5rem',
              padding: '0.25rem 0.75rem', 
              borderRadius: '1rem', 
              fontSize: '0.875rem', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              backgroundColor: applicationStatus === 'approved' ? 'rgba(16, 185, 129, 0.2)' : applicationStatus === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              color: applicationStatus === 'approved' ? 'var(--secondary-color)' : applicationStatus === 'rejected' ? 'var(--danger-color)' : '#f59e0b'
            }}>
              {applicationStatus}
            </span>
          </p>

          {applicationStatus === 'approved' && isEventOver(event) && (
            <button 
              className="btn btn-primary" 
              style={{ marginTop: '1rem' }}
              onClick={() => {
                try {
                  generateAttendancePDF(event, allRegistrations);
                } catch (err) {
                  alert("Failed to generate PDF: " + err.message);
                  console.error(err);
                }
              }}
            >
              Download Attendance Sheet
            </button>
          )}

          {applicationStatus === 'approved' && !isEventOver(event) && (
            <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              The attendance sheet will be available to download after the event concludes.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EventDetail;
