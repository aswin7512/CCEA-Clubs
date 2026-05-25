import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateAttendancePDF } from '../lib/pdfUtils';

const EventDetail = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
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

  useEffect(() => {
    fetchEventDetails();
  }, [eventId, user]);

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
      const { data: allRegsData } = await supabase
        .from('event_registrations')
        .select('*, profiles:user_id(name, email, department, roll_number, prp_code)')
        .eq('event_id', eventId);
        
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

  const isEventOver = () => {
    if (!event) return false;

    const eventDate = new Date(event.event_date);
    const now = new Date();
    
    // Compare dates ignoring time
    eventDate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    if (eventDate < today) return true;
    if (eventDate > today) return false;
    
    // If it's today, check the time
    if (event.is_during_class_hours) {
      const hours = event.class_hours || [];
      if (hours.length === 0) return true;
      const maxHour = Math.max(...hours);
      
      let endHour = 10;
      if (maxHour === 1) endHour = 10;
      else if (maxHour === 2) endHour = 11;
      else if (maxHour === 3) endHour = 12;
      else if (maxHour === 4) endHour = 14; // 2pm
      else if (maxHour === 5) endHour = 15; // 3pm
      else if (maxHour === 6) endHour = 16; // 4pm
      
      return now.getHours() >= endHour;
    } else {
      if (!event.end_time) return true;
      const [endH, endM] = event.end_time.split(':').map(Number);
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      
      if (currentHour > endH) return true;
      if (currentHour === endH && currentMin >= endM) return true;
      return false;
    }
  };

  if (loading) return <div className="container flex-center" style={{ minHeight: '80vh' }}>Loading...</div>;
  if (!event) return <div className="container flex-center" style={{ minHeight: '80vh' }}>Event not found</div>;

  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '800px' }}>
      <button className="btn btn-outline" style={{ marginBottom: '1rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => navigate('/dashboard')}>
        &larr; Back to Dashboard
      </button>

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>{event.name}</h2>
        <p style={{ color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '1.5rem' }}>Hosted by {event.chapter?.name}</p>
        
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

          {applicationStatus === 'approved' && isEventOver() && (
            <button 
              className="btn btn-primary" 
              style={{ marginTop: '1rem' }}
              onClick={() => generateAttendancePDF(event, allRegistrations)}
            >
              Download Attendance Sheet
            </button>
          )}

          {applicationStatus === 'approved' && !isEventOver() && (
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
