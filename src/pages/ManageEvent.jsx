import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateAttendancePDF } from '../lib/pdfUtils';

const ManageEvent = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // To allow quick saving without massive payload
  const [savingAttendance, setSavingAttendance] = useState(false);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      setLoading(true);
      
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*, chapter:club_chapters(name)')
        .eq('id', eventId)
        .single();
        
      if (eventError) throw eventError;
      setEvent(eventData);

      const { data: fieldsData, error: fieldsError } = await supabase
        .from('event_custom_fields')
        .select('*')
        .eq('event_id', eventId)
        .order('order_index', { ascending: true });

      if (fieldsError) throw fieldsError;
      setCustomFields(fieldsData || []);

      const { data: regData, error: regError } = await supabase
        .from('event_registrations')
        .select('*, profiles:user_id(name, email, department, roll_number, prp_code)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (regError) throw regError;
      setRegistrations(regData || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRegistrationStatus = async (regId, status) => {
    try {
      const { error } = await supabase
        .from('event_registrations')
        .update({ status })
        .eq('id', regId);
      
      if (error) throw error;
      setRegistrations(registrations.map(r => r.id === regId ? { ...r, status } : r));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleAttendanceChangeClassHours = async (regId, hour) => {
    const reg = registrations.find(r => r.id === regId);
    let currentHours = Array.isArray(reg.attended_hours) ? reg.attended_hours : [];
    
    if (currentHours.includes(hour)) {
      currentHours = currentHours.filter(h => h !== hour);
    } else {
      currentHours = [...currentHours, hour].sort();
    }

    try {
      setSavingAttendance(true);
      const { error } = await supabase
        .from('event_registrations')
        .update({ attended_hours: currentHours })
        .eq('id', regId);

      if (error) throw error;
      setRegistrations(registrations.map(r => r.id === regId ? { ...r, attended_hours: currentHours } : r));
    } catch (err) {
      alert('Failed to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleAttendanceChangeTime = async (regId, isPresent) => {
    try {
      setSavingAttendance(true);
      const { error } = await supabase
        .from('event_registrations')
        .update({ is_present: isPresent })
        .eq('id', regId);

      if (error) throw error;
      setRegistrations(registrations.map(r => r.id === regId ? { ...r, is_present: isPresent } : r));
    } catch (err) {
      alert('Failed to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  const exportAttendancePDF = () => {
    generateAttendancePDF(event, registrations);
  };

  if (loading) return <div className="container flex-center" style={{ minHeight: '80vh' }}>Loading...</div>;
  if (!event) return <div className="container flex-center" style={{ minHeight: '80vh' }}>Event not found</div>;

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <button className="btn btn-outline" style={{ marginBottom: '1rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => navigate('/dashboard')}>
        &larr; Back to Dashboard
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>Manage Event: {event.name}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Date: {new Date(event.event_date).toLocaleDateString()}</p>
        </div>
        <button onClick={exportAttendancePDF} className="btn btn-primary">
          Export Attendance to PDF
        </button>
      </div>

      <div className="glass-panel" style={{ marginBottom: '2rem', overflowX: 'auto' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Registrations & Admissions</h3>
        
        {registrations.length === 0 ? (
          <p>No registrations yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--input-border)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Participant</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map(reg => (
                <tr key={reg.id} style={{ borderBottom: '1px solid var(--input-border)' }}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{reg.profiles?.name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{reg.profiles?.email}</div>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '0.5rem', 
                      fontSize: '0.75rem', 
                      backgroundColor: reg.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : reg.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: reg.status === 'approved' ? 'var(--secondary-color)' : reg.status === 'rejected' ? 'var(--danger-color)' : '#f59e0b'
                    }}>
                      {reg.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {reg.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleUpdateRegistrationStatus(reg.id, 'approved')}>Approve</button>
                        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} onClick={() => handleUpdateRegistrationStatus(reg.id, 'rejected')}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Attendance Tracking</h3>
        
        {registrations.filter(r => r.status === 'approved').length === 0 ? (
          <p>No approved participants to track.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--input-border)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Participant</th>
                {event.is_during_class_hours ? (
                  (event.class_hours || []).map(hour => (
                    <th key={hour} style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Hour {hour}</th>
                  ))
                ) : (
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Present?</th>
                )}
              </tr>
            </thead>
            <tbody>
              {registrations.filter(r => r.status === 'approved').map(reg => (
                <tr key={reg.id} style={{ borderBottom: '1px solid var(--input-border)' }}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontWeight: 'bold' }}>{reg.profiles?.name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{reg.profiles?.roll_number || 'No Roll No'}</div>
                  </td>
                  
                  {event.is_during_class_hours ? (
                    (event.class_hours || []).map(hour => {
                      const attended = Array.isArray(reg.attended_hours) ? reg.attended_hours : [];
                      return (
                        <td key={hour} style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={attended.includes(hour)}
                            onChange={() => handleAttendanceChangeClassHours(reg.id, hour)}
                            disabled={savingAttendance}
                            style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                          />
                        </td>
                      );
                    })
                  ) : (
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={reg.is_present || false}
                        onChange={(e) => handleAttendanceChangeTime(reg.id, e.target.checked)}
                        disabled={savingAttendance}
                        style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ManageEvent;
