import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateAttendancePDF } from '../lib/pdfUtils';
import avatarDb from '../assets/db.json';

const ManageEvent = () => {
  const { eventId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStudentReg, setSelectedStudentReg] = useState(null);
  const [scrapedAvatars, setScrapedAvatars] = useState([]);
  
  // To allow quick saving without massive payload
  const [savingAttendance, setSavingAttendance] = useState(false);

  useEffect(() => {
    fetchEventData();
  }, [eventId, user, profile]);

  const fetchEventData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*, chapter:club_chapters(name)')
        .eq('id', eventId)
        .single();
        
      if (eventError) throw eventError;
      setEvent(eventData);

      // Check authorization (creator, co-host, super_admin, or leader)
      const isCreator = eventData.created_by === user.id;
      const isCoHost = (eventData.co_hosts || []).includes(user.id);
      const isSuperAdmin = false;

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

      if (!isCreator && !isCoHost && !isSuperAdmin && !isChapterLeader) {
        throw new Error('You do not have permission to manage this event.');
      }

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

  const handleJSONUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (readerEvent) => {
      try {
        const json = JSON.parse(readerEvent.target.result);
        const scrapedNames = json.scraped_names || json.attendees || [];
        const classHoursToLog = json.class_hours || [];
        
        if (scrapedNames.length === 0) {
          alert('No names found in the JSON file.');
          return;
        }

        setSavingAttendance(true);
        let updatedCount = 0;

        const updates = registrations.map(async (reg) => {
          if (reg.status !== 'approved') return reg;
          
          const regName = (reg.profiles?.name || "").toLowerCase().trim();
          
          const isMatch = scrapedNames.some(person => {
             // Handle both old string format and new object format
             const nameStr = (typeof person === 'string' ? person : person.name).toLowerCase().trim();
             const avatarUrl = typeof person === 'object' ? person.avatar_url : null;
             
             // 1. Exact Match via Avatar URL mapping (if exists)
             if (avatarUrl && avatarDb[avatarUrl]) {
                 const mappedFullName = avatarDb[avatarUrl].toLowerCase().trim();
                 if (regName === mappedFullName) {
                     return true;
                 }
             }

             // 2. Fallback: Fuzzy Name Match
             return regName.includes(nameStr) || nameStr.includes(regName);
          });

          if (isMatch) {
            let updatedReg = { ...reg };
            
            if (event.is_during_class_hours && classHoursToLog.length > 0) {
                const currentHours = Array.isArray(reg.attended_hours) ? reg.attended_hours : [];
                const mergedHours = Array.from(new Set([...currentHours, ...classHoursToLog])).sort((a,b)=>a-b);
                
                const { error } = await supabase
                  .from('event_registrations')
                  .update({ attended_hours: mergedHours })
                  .eq('id', reg.id);
                  
                if (!error) {
                   updatedReg.attended_hours = mergedHours;
                   updatedCount++;
                }
            } else {
                const { error } = await supabase
                  .from('event_registrations')
                  .update({ is_present: true })
                  .eq('id', reg.id);
                  
                if (!error) {
                   updatedReg.is_present = true;
                   updatedCount++;
                }
            }
            return updatedReg;
          }
          return reg;
        });

        const newRegistrations = await Promise.all(updates);
        setRegistrations(newRegistrations);
        alert(`Successfully auto-logged attendance for ${updatedCount} participant(s)!`);
      } catch (err) {
        alert('Failed to parse JSON or update attendance: ' + err.message);
      } finally {
        setSavingAttendance(false);
        e.target.value = null; // Reset input
      }
    };
    reader.readAsText(file);
  };

  const exportAttendancePDF = () => {
    generateAttendancePDF(event, registrations);
  };

  const exportSubmissionCSV = () => {
    try {
      // 1. Prepare Headers
      const headers = [
        'Submission Date',
        'Participant Name',
        'Participant Email',
        'Department',
        'Roll Number',
        'PRP Code',
        'Status',
        'Attendance Details'
      ];
      
      // Add custom fields as headers
      customFields.forEach(field => {
        headers.push(field.field_label);
      });

      // 2. Prepare Rows
      const rows = registrations.map(reg => {
        let attendanceDetails = '';
        if (reg.status === 'approved') {
          if (event.is_during_class_hours) {
            attendanceDetails = Array.isArray(reg.attended_hours) && reg.attended_hours.length > 0
              ? `Attended Hours: ${reg.attended_hours.join(', ')}`
              : 'None';
          } else {
            attendanceDetails = reg.is_present ? 'Present' : 'Absent';
          }
        } else {
          attendanceDetails = 'N/A (Not Approved)';
        }

        const row = [
          new Date(reg.created_at).toLocaleString(),
          reg.profiles?.name || '',
          reg.profiles?.email || '',
          reg.profiles?.department || '',
          reg.profiles?.roll_number || '',
          reg.profiles?.prp_code || '',
          reg.status,
          attendanceDetails
        ];

        // Add values for custom fields
        customFields.forEach(field => {
          const answer = reg.custom_data?.[field.id];
          if (Array.isArray(answer)) {
            row.push(answer.join('; '));
          } else {
            row.push(answer || '');
          }
        });

        return row;
      });

      // Helper to escape values for CSV
      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const stringVal = String(val);
        if (stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('"')) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      };

      // 3. Construct CSV Content
      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n');

      // 4. Download Trigger
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${event.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_submissions.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to export CSV: ' + err.message);
      console.error(err);
    }
  };

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
        <div className="glass-panel text-center" style={{ maxWidth: '500px' }}>
          <h2 style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!event) return <div className="container flex-center" style={{ minHeight: '80vh' }}>Event not found</div>;

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <button className="btn btn-outline" style={{ marginBottom: '1rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => navigate('/dashboard')}>
        &larr; Back to Dashboard
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>Manage Event: {event.name}</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Date: {new Date(event.event_date).toLocaleDateString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            Auto-Log JSON
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleJSONUpload} disabled={savingAttendance} />
          </label>
          <button onClick={exportSubmissionCSV} className="btn btn-secondary">
            Export Submissions to CSV
          </button>
          <button onClick={exportAttendancePDF} className="btn btn-primary">
            Export Attendance to PDF
          </button>
        </div>
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
                    <div 
                      style={{ fontWeight: 'bold', cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'underline' }}
                      onClick={() => setSelectedStudentReg(reg)}
                      title="Click to view details"
                    >
                      {reg.profiles?.name}
                    </div>
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

      <div className="glass-panel" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
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
                    <div 
                      style={{ fontWeight: 'bold', cursor: 'pointer', color: 'var(--primary-color)', textDecoration: 'underline' }}
                      onClick={() => setSelectedStudentReg(reg)}
                      title="Click to view details"
                    >
                      {reg.profiles?.name}
                    </div>
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

      {scrapedAvatars.length > 0 && (
        <div className="glass-panel" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Scraped Avatars (Unmatched Attendance)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {scrapedAvatars.map((src, idx) => (
              <div key={idx} style={{ textAlign: 'center' }}>
                <img 
                  src={src} 
                  alt="avatar" 
                  style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-color)' }} 
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Student Detail Modal */}
      {selectedStudentReg && (
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
          <div className="glass-panel" style={{
            maxWidth: '550px',
            width: '100%',
            padding: '2rem',
            position: 'relative',
            maxHeight: '85vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <button 
              onClick={() => setSelectedStudentReg(null)}
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
              Student Submission Profile
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Personal Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div><strong>Name:</strong> {selectedStudentReg.profiles?.name}</div>
                  <div><strong>Email:</strong> {selectedStudentReg.profiles?.email}</div>
                  <div><strong>Roll Number:</strong> {selectedStudentReg.profiles?.roll_number || 'N/A'}</div>
                  <div><strong>Department:</strong> {selectedStudentReg.profiles?.department || 'N/A'}</div>
                  <div><strong>PRP Code:</strong> {selectedStudentReg.profiles?.prp_code || 'N/A'}</div>
                  <div><strong>Status:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem', color: selectedStudentReg.status === 'approved' ? 'var(--secondary-color)' : selectedStudentReg.status === 'rejected' ? 'var(--danger-color)' : '#f59e0b' }}>{selectedStudentReg.status}</span></div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '1.5rem 0 0.5rem 0' }}>Custom Submission Answers</h4>
                {customFields.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No custom fields were configured for this event.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem' }}>
                    {customFields.map(field => {
                      const answer = selectedStudentReg.custom_data?.[field.id];
                      return (
                        <div key={field.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{field.field_label}</div>
                          <div style={{ marginTop: '0.25rem', fontSize: '0.95rem' }}>
                            {Array.isArray(answer) ? answer.join(', ') : answer || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No answer provided</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            <button 
              className="btn btn-secondary" 
              onClick={() => setSelectedStudentReg(null)}
              style={{ width: '100%', marginTop: '1.5rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageEvent;
