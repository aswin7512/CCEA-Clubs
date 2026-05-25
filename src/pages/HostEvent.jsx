import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const HostEvent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialChapterId = searchParams.get('chapterId') || '';

  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [admissionType, setAdmissionType] = useState('auto_accept');
  const [participationType, setParticipationType] = useState('individual');
  
  // Timing State
  const [isDuringClassHours, setIsDuringClassHours] = useState(false);
  const [classHours, setClassHours] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Custom Fields State
  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    fetchEligibleChapters();
  }, [user]);

  const fetchEligibleChapters = async () => {
    try {
      // Core team, lead, or faculty_coordinator can host events
      const { data, error } = await supabase
        .from('club_members')
        .select('chapter_id, chapter:club_chapters(id, name, academic_year)')
        .eq('user_id', user.id)
        .in('role', ['core_team', 'lead', 'faculty_coordinator'])
        .eq('status', 'approved');

      if (error) throw error;
      setChapters(data || []);
      if (data && data.length > 0 && !initialChapterId) {
        setChapterId(data[0].chapter_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      if (!chapterId) throw new Error('Please select a chapter to host this event under.');
      if (isDuringClassHours && classHours.length === 0) throw new Error('Please select at least one class hour.');

      // 1. Create Event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([{
          chapter_id: chapterId,
          name,
          description,
          event_date: new Date(eventDate).toISOString(),
          admission_type: admissionType,
          participation_type: participationType,
          is_during_class_hours: isDuringClassHours,
          class_hours: isDuringClassHours ? classHours : null,
          start_time: !isDuringClassHours ? startTime : null,
          end_time: !isDuringClassHours ? endTime : null,
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
    } catch (err) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  if (loading && chapters.length === 0) return <div>Loading...</div>;

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
      <div className="glass-panel">
        <h2 style={{ marginBottom: '2rem' }}>Host a New Event</h2>

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
            <select className="form-control" value={chapterId} onChange={e => setChapterId(e.target.value)} required>
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

          {/* Admission & Participation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Admission Type</label>
              <select className="form-control" value={admissionType} onChange={e => setAdmissionType(e.target.value)}>
                <option value="auto_accept">Auto Accept All</option>
                <option value="manual_accept">Manual Review</option>
                <option value="invite_only">Invite Only (Hidden)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Participation Type</label>
              <select className="form-control" value={participationType} onChange={e => setParticipationType(e.target.value)}>
                <option value="individual">Individual</option>
                <option value="group">Group</option>
                <option value="both">Both</option>
              </select>
            </div>
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
            {loading ? 'Publishing Event...' : 'Host Event'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default HostEvent;
