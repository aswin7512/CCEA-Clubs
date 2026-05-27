import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const HostEvent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useParams();
  const isEditMode = !!eventId;
  const searchParams = new URLSearchParams(location.search);
  const initialChapterId = searchParams.get('chapterId') || '';

  const [chapters, setChapters] = useState([]);
  const [chapterMembers, setChapterMembers] = useState([]);
  const [coHosts, setCoHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [admissionType, setAdmissionType] = useState('auto_accept');
  
  // Timing State
  const [isDuringClassHours, setIsDuringClassHours] = useState(false);
  const [classHours, setClassHours] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [restrictToMembers, setRestrictToMembers] = useState(false);

  // Custom Fields State
  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    fetchEligibleChapters();
    if (isEditMode) {
      fetchEventDetails();
    }
  }, [user, eventId]);

  useEffect(() => {
    if (chapterId) {
      fetchChapterMembers(chapterId);
    } else {
      setChapterMembers([]);
    }
  }, [chapterId]);

  const fetchChapterMembers = async (cId) => {
    try {
      const { data, error } = await supabase
        .from('club_members')
        .select('*, profiles:user_id(id, name, email, role)')
        .eq('chapter_id', cId)
        .eq('status', 'approved');

      if (error) throw error;
      setChapterMembers(data || []);
    } catch (err) {
      console.error('Error fetching chapter members:', err);
    }
  };

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
         
      if (eventError) throw eventError;

      // Check authorization
      const { data: memberships, error: memberError } = await supabase
        .from('club_members')
        .select('role, status')
        .eq('chapter_id', event.chapter_id)
        .eq('user_id', user.id)
        .single();
         
      const isApprovedLeader = !memberError && memberships?.status === 'approved' && ['core_team', 'lead', 'faculty_coordinator'].includes(memberships?.role);
      const isCoHost = (event.co_hosts || []).includes(user.id);
      const isCreator = event.created_by === user.id;

      if (!isCreator && !isCoHost && !isApprovedLeader) {
        throw new Error('You do not have permission to edit this event.');
      }
      
      setName(event.name || '');
      setDescription(event.description || '');
      setVenue(event.venue || '');
      if (event.event_date) {
        const dateObj = new Date(event.event_date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        setEventDate(`${yyyy}-${mm}-${dd}`);
      }
      setAdmissionType(event.admission_type || 'auto_accept');
      setIsDuringClassHours(event.is_during_class_hours || false);
      setClassHours(event.class_hours || []);
      setStartTime(event.start_time || '');
      setEndTime(event.end_time || '');
      setRestrictToMembers(event.restrict_to_members || false);
      setCoHosts(event.co_hosts || []);
      setChapterId(event.chapter_id || '');

      const { data: fields, error: fieldsError } = await supabase
        .from('event_custom_fields')
        .select('*')
        .eq('event_id', eventId)
        .order('order_index', { ascending: true });
         
      if (fieldsError) throw fieldsError;
      setCustomFields((fields || []).map(f => ({
        id: f.id,
        field_type: f.field_type,
        field_label: f.field_label,
        is_required: f.is_required,
        options: f.options || ['']
      })));

    } catch (err) {
      setError(err.message || 'Failed to fetch event details');
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleChapters = async () => {
    try {
      const { data, error } = await supabase
        .from('club_members')
        .select('chapter_id, chapter:club_chapters(id, name, academic_year)')
        .eq('user_id', user.id)
        .in('role', ['core_team', 'lead', 'faculty_coordinator'])
        .eq('status', 'approved');

      if (error) throw error;
      setChapters(data || []);
      if (data && data.length > 0 && !initialChapterId && !isEditMode) {
        setChapterId(data[0].chapter_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isEditMode) setLoading(false);
    }
  };

  const handleClassHourToggle = (hour) => {
    setClassHours(prev => 
      prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour].sort()
    );
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { 
      id: Date.now().toString(), 
      field_type: 'text', 
      field_label: '', 
      is_required: false, 
      options: [''] 
    }]);
  };

  const updateCustomField = (id, key, value) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeCustomField = (id) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const handleCoHostToggle = (memberUserId) => {
    setCoHosts(prev => 
      prev.includes(memberUserId) 
        ? prev.filter(id => id !== memberUserId) 
        : [...prev, memberUserId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      if (!chapterId) throw new Error('Please select a chapter to host this event under.');
      if (isDuringClassHours && classHours.length === 0) throw new Error('Please select at least one class hour.');

      if (isEditMode) {
        // 1. Update Event
        const { error: eventError } = await supabase
          .from('events')
          .update({
            chapter_id: chapterId,
            name,
            description,
            venue: venue || null,
            event_date: new Date(eventDate).toISOString(),
            admission_type: admissionType,
            is_during_class_hours: isDuringClassHours,
            class_hours: isDuringClassHours ? classHours : null,
            start_time: !isDuringClassHours ? startTime : null,
            end_time: !isDuringClassHours ? endTime : null,
            restrict_to_members: restrictToMembers,
            co_hosts: coHosts
          })
          .eq('id', eventId);

        if (eventError) throw eventError;

        // 2. Clear old fields
        const { error: deleteError } = await supabase
          .from('event_custom_fields')
          .delete()
          .eq('event_id', eventId);

        if (deleteError) throw deleteError;

        // 3. Insert new custom fields if any
        if (customFields.length > 0) {
          const fieldsToInsert = customFields.map((field, index) => ({
            event_id: eventId,
            field_type: field.field_type,
            field_label: field.field_label,
            is_required: field.is_required,
            options: ['option', 'checklist'].includes(field.field_type) ? field.options : null,
            order_index: index
          }));

          const { error: fieldsError } = await supabase
            .from('event_custom_fields')
            .insert(fieldsToInsert);

          if (fieldsError) throw fieldsError;
        }

        alert('Event updated successfully!');
        navigate(`/event/${eventId}`);
      } else {
        // 1. Create Event
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .insert([{
            chapter_id: chapterId,
            name,
            description,
            venue: venue || null,
            event_date: new Date(eventDate).toISOString(),
            admission_type: admissionType,
            is_during_class_hours: isDuringClassHours,
            class_hours: isDuringClassHours ? classHours : null,
            start_time: !isDuringClassHours ? startTime : null,
            end_time: !isDuringClassHours ? endTime : null,
            restrict_to_members: restrictToMembers,
            co_hosts: coHosts,
            created_by: user.id
          }])
          .select()
          .single();

        if (eventError) throw eventError;

        // 2. Add Custom Fields if any
        if (customFields.length > 0) {
          const fieldsToInsert = customFields.map((field, index) => ({
            event_id: eventData.id,
            field_type: field.field_type,
            field_label: field.field_label,
            is_required: field.is_required,
            options: ['option', 'checklist'].includes(field.field_type) ? field.options : null,
            order_index: index
          }));

          const { error: fieldsError } = await supabase
            .from('event_custom_fields')
            .insert(fieldsToInsert);

          if (fieldsError) throw fieldsError;
        }

        alert('Event hosted successfully!');
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  if (loading && chapters.length === 0) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="container" style={{ padding: '2rem 0' }}>
        <div className="glass-panel text-center">
          <h3>Access Denied</h3>
          <p>You must be a Core Team member, Lead, or Faculty Coordinator of an approved chapter to host an event.</p>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '800px' }}>
      <button className="btn btn-outline" style={{ marginBottom: '1.5rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => navigate(-1)}>
        &larr; Back
      </button>

      <div className="glass-panel">
        <h2 style={{ marginBottom: '2rem' }}>{isEditMode ? 'Edit Event Details' : 'Host a New Event'}</h2>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--danger-color)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* General Info */}
          <h4 style={{ borderBottom: '1px solid var(--input-border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>General Details</h4>
          
          <div className="form-group">
            <label className="form-label">Host Under Chapter</label>
            <select className="form-control" value={chapterId} onChange={e => setChapterId(e.target.value)} required disabled={isEditMode}>
              {chapters.map(c => (
                <option key={c.chapter_id} value={c.chapter_id}>{c.chapter.name} ({c.chapter.academic_year})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Event Name</label>
            <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-control" value={description} onChange={e => setDescription(e.target.value)} rows="3" required />
          </div>

          <div className="form-group">
            <label className="form-label">Venue (Optional)</label>
            <input 
              type="text" 
              className="form-control" 
              value={venue} 
              onChange={e => setVenue(e.target.value)} 
              placeholder="e.g. Seminar Hall, Lab 3, Online"
            />
          </div>

          {/* Co-hosts Selection */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Event Co-hosts</label>
            {chapterMembers.filter(m => m.profiles && m.profiles.role !== 'faculty' && m.role !== 'faculty_coordinator' && m.user_id !== user?.id).length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No other approved student members available in this chapter.</p>
            ) : (
              <div>
                <select 
                  className="form-control" 
                  value="" 
                  onChange={e => {
                    if (e.target.value) {
                      handleCoHostToggle(e.target.value);
                    }
                  }}
                  style={{ marginBottom: '0.75rem' }}
                >
                  <option value="">Select a member to add as co-host...</option>
                  {chapterMembers
                    .filter(m => m.profiles && m.profiles.role !== 'faculty' && m.role !== 'faculty_coordinator' && m.user_id !== user?.id && !coHosts.includes(m.user_id))
                    .sort((a, b) => (a.profiles?.name || '').localeCompare(b.profiles?.name || ''))
                    .map(m => (
                      <option key={m.id} value={m.user_id}>
                        {m.profiles.name} ({m.profiles.email})
                      </option>
                    ))
                  }
                </select>
 
                {/* Render Selected Co-host Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {coHosts
                    .map(userId => chapterMembers.find(m => m.user_id === userId))
                    .filter(member => member && member.profiles)
                    .sort((a, b) => (a.profiles?.name || '').localeCompare(b.profiles?.name || ''))
                    .map(member => {
                      const userId = member.user_id;
                      return (
                        <div 
                          key={userId} 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '1rem', 
                            backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                            color: 'var(--danger-color)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            fontSize: '0.875rem' 
                          }}
                        >
                          <span>{member.profiles.name}</span>
                          <button 
                            type="button" 
                            onClick={() => handleCoHostToggle(userId)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: 'var(--danger-color)', 
                              cursor: 'pointer', 
                              fontWeight: 'bold',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.1rem',
                              lineHeight: 1
                            }}
                            title="Remove co-host"
                          >
                            &times;
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Admission Type */}
          <div className="form-group">
            <label className="form-label">Admission Type</label>
            <select className="form-control" value={admissionType} onChange={e => setAdmissionType(e.target.value)}>
              <option value="auto_accept">Auto Accept All</option>
              <option value="manual_accept">Manual Review</option>
              <option value="invite_only">Invite Only (Hidden)</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: '1rem 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={restrictToMembers} onChange={e => setRestrictToMembers(e.target.checked)} />
              Restrict participation to club members only
            </label>
          </div>

          {/* Timing */}
          <h4 style={{ borderBottom: '1px solid var(--input-border)', paddingBottom: '0.5rem', margin: '2rem 0 1rem 0' }}>Timing & Schedule</h4>
          
          <div className="form-group">
            <label className="form-label">Event Date</label>
            <input type="date" className="form-control" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={isDuringClassHours} onChange={e => setIsDuringClassHours(e.target.checked)} />
              Is this event during class hours?
            </label>
          </div>

          {isDuringClassHours ? (
            <div className="form-group" style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '0.5rem' }}>
              <label className="form-label">Select Class Hours</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5, 6].map(hour => (
                  <label key={hour} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input type="checkbox" checked={classHours.includes(hour)} onChange={() => handleClassHourToggle(hour)} />
                    Hour {hour}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input type="time" className="form-control" value={startTime} onChange={e => setStartTime(e.target.value)} required={!isDuringClassHours} />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <input type="time" className="form-control" value={endTime} onChange={e => setEndTime(e.target.value)} required={!isDuringClassHours} />
              </div>
            </div>
          )}

          {/* Dynamic Forms */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--input-border)', paddingBottom: '0.5rem', margin: '2rem 0 1rem 0' }}>
            <h4 style={{ margin: 0 }}>Registration Form Fields</h4>
            <button type="button" className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={addCustomField}>
              + Add Field
            </button>
          </div>

          {customFields.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Only standard fields (Name, Dept, etc.) will be asked.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {customFields.map((field) => (
                <div key={field.id} style={{ padding: '1rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--input-border)', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 2 }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        placeholder="Field Label (e.g. Why do you want to join?)" 
                        value={field.field_label}
                        onChange={e => updateCustomField(field.id, 'field_label', e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <select className="form-control" value={field.field_type} onChange={e => updateCustomField(field.id, 'field_type', e.target.value)}>
                        <option value="text">Short Text</option>
                        <option value="paragraph">Paragraph</option>
                        <option value="option">Single Choice</option>
                        <option value="checklist">Multiple Choice</option>
                      </select>
                    </div>
                    <button type="button" onClick={() => removeCustomField(field.id)} className="btn btn-outline" style={{ padding: '0.5rem', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}>
                      X
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                      <input type="checkbox" checked={field.is_required} onChange={e => updateCustomField(field.id, 'is_required', e.target.checked)} />
                      Required Field
                    </label>
                  </div>

                  {['option', 'checklist'].includes(field.field_type) && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label className="form-label" style={{ fontSize: '0.875rem' }}>Options</label>
                      {(field.options && field.options.length > 0 ? field.options : ['']).map((opt, optIndex) => (
                        <div key={optIndex} style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder={`Option ${optIndex + 1}`} 
                            value={opt}
                            onChange={e => {
                              const newOptions = [...(field.options || [''])];
                              newOptions[optIndex] = e.target.value;
                              updateCustomField(field.id, 'options', newOptions);
                            }}
                            required
                          />
                          <button 
                            type="button" 
                            className="btn btn-outline" 
                            style={{ padding: '0.5rem', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                            onClick={() => {
                              const newOptions = (field.options || ['']).filter((_, i) => i !== optIndex);
                              updateCustomField(field.id, 'options', newOptions.length > 0 ? newOptions : ['']);
                            }}
                            title="Remove Option"
                          >
                            X
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ alignSelf: 'flex-start', padding: '0.25rem 0.5rem', fontSize: '0.875rem', marginTop: '0.5rem' }}
                        onClick={() => {
                          updateCustomField(field.id, 'options', [...(field.options || ['']), '']);
                        }}
                      >
                        + Add Option
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }} disabled={loading}>
            {loading ? (isEditMode ? 'Saving Changes...' : 'Publishing Event...') : (isEditMode ? 'Save Changes' : 'Host Event')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default HostEvent;
