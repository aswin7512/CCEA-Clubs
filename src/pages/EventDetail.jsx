import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateAttendancePDF } from '../lib/pdfUtils';
import { isEventOver } from '../lib/eventUtils';
import AnimatedPage from '../components/AnimatedPage';
import { ArrowLeft, Calendar, MapPin, Clock, Users, Settings, Edit, LayoutDashboard } from 'lucide-react';

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
  const [isClubMember, setIsClubMember] = useState(false);
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
      const isCreator = eventData.created_by === user?.id;
      const isCoHost = (eventData.co_hosts || []).includes(user?.id);
      const isSuperAdmin = profile?.role === 'super_admin';

      let isChapterLeader = false;
      let memberShipApproved = false;

      if (user) {
        // Query membership to check both leader status and standard membership approval
        const { data: memberData } = await supabase
          .from('club_members')
          .select('role, status')
          .eq('chapter_id', eventData.chapter_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (memberData && memberData.status === 'approved') {
          memberShipApproved = true;
          if (['core_team', 'lead', 'faculty_coordinator'].includes(memberData.role)) {
            isChapterLeader = true;
          }
        }
      }

      setIsClubMember(memberShipApproved);

      const isAuthorized = isCreator || isCoHost || isChapterLeader;
      setIsHostOrLeader(isAuthorized);

      // Check if student is enrolled in the chapter of this event (only if event is restricted to members)
      if ((profile?.role === 'student' || profile?.role === 'super_admin') && eventData.restrict_to_members) {
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
      if (user) {
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
      }
      
      // 4. Fetch all registrations for PDF export if needed
      const { data: allRegsData, error: regsError } = await supabase
        .from('event_registrations')
        .select('*, profiles:user_id(name, email, department, roll_number, prp_code, semester)')
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
      <div className="loader-container" style={{ minHeight: '60vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  if (error && error.includes('Access Denied')) {
    return (
      <AnimatedPage>
        <div className="container flex-center" style={{ minHeight: '60vh' }}>
          <motion.div
            className="glass-panel text-center"
            style={{ maxWidth: '500px', width: '100%' }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h2 style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>🔒 Access Denied</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
            <motion.button className="btn btn-primary" onClick={() => navigate('/dashboard')} whileTap={{ scale: 0.96 }}>
              Go to Dashboard
            </motion.button>
          </motion.div>
        </div>
      </AnimatedPage>
    );
  }

  if (!event) return <div className="container flex-center" style={{ minHeight: '60vh' }}>Event not found</div>;

  return (
    <AnimatedPage>
      <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '800px', margin: '0 auto' }}>
        <motion.button
          className="btn btn-ghost"
          style={{ marginBottom: '1.5rem', padding: '0.35rem 0.85rem', fontSize: '0.85rem' }}
          onClick={() => navigate('/dashboard')}
          whileTap={{ scale: 0.96 }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </motion.button>

        {isHostOrLeader && (
          <motion.div
            className="glass-panel"
            style={{ marginBottom: '1.5rem', border: '1px dashed var(--primary-color)', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div>
              <h4 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Settings size={18} /> Host Controls
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>You are authorized to manage this event.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <motion.button
                className="btn btn-secondary"
                onClick={() => navigate(`/manage-event/${event.id}`)}
                style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                whileTap={{ scale: 0.96 }}
              >
                <Users size={15} /> Manage Attendance
              </motion.button>
              <motion.button
                className="btn btn-secondary"
                onClick={() => navigate(`/event-kanban/${event.id}`)}
                style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                whileTap={{ scale: 0.96 }}
              >
                <LayoutDashboard size={15} /> Kanban Board
              </motion.button>
              <motion.button
                className="btn btn-outline"
                onClick={() => navigate(`/edit-event/${event.id}`)}
                style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}
                whileTap={{ scale: 0.96 }}
              >
                <Edit size={15} /> Edit Event
              </motion.button>
            </div>
          </motion.div>
        )}

        <motion.div
          className="glass-panel"
          style={{ marginBottom: '2rem' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>{event.name}</h2>
            <span className={`badge ${event.restrict_to_members ? 'badge-danger' : 'badge-success'}`}>
              {event.restrict_to_members ? 'Members Only' : 'Open to All'}
            </span>
          </div>
          <p style={{ color: 'var(--primary-color)', fontWeight: 600, marginBottom: '1.5rem' }}>Hosted by {event.chapter?.name}</p>

          <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.75rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} style={{ color: 'var(--primary-color)' }} />
              <strong>Date:</strong> {new Date(event.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {event.is_during_class_hours ? (
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} style={{ color: 'var(--primary-color)' }} />
                <strong>Class Hours:</strong> {event.class_hours?.join(', ')}
              </p>
            ) : (
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} style={{ color: 'var(--primary-color)' }} />
                <strong>Time:</strong> {event.start_time} - {event.end_time}
              </p>
            )}
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={16} style={{ color: 'var(--primary-color)' }} />
              <strong>Venue:</strong> {event.venue || 'Not specified'}
            </p>
          </div>

          <h4 style={{ marginBottom: '0.5rem' }}>About this Event</h4>
          <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{event.description}</p>
        </motion.div>

        {(profile?.role === 'faculty' || profile?.role === 'super_admin') && isEventOver(event) && (
          <motion.div
            className="glass-panel text-center"
            style={{ marginBottom: '2rem', border: '1px dashed var(--secondary-color)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 style={{ marginBottom: '0.5rem' }}>📊 Event Attendance</h3>
            <p style={{ margin: '0.5rem 0 1.5rem 0', color: 'var(--text-secondary)' }}>
              As a faculty member, you can download the consolidated attendance PDF for this past event.
            </p>
            <motion.button
              className="btn btn-primary"
              onClick={() => {
                try {
                  generateAttendancePDF(event, allRegistrations);
                } catch (err) {
                  alert("Failed to generate PDF: " + err.message);
                  console.error(err);
                }
              }}
              whileTap={{ scale: 0.96 }}
            >
              Download Attendance Sheet
            </motion.button>
          </motion.div>
        )}

        {profile?.role !== 'faculty' && (
          !hasApplied ? (
            isEventOver(event) ? (
              <motion.div
                className="glass-panel text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3>⏰ Event Concluded</h3>
                <p style={{ margin: '1rem 0', color: 'var(--text-secondary)' }}>
                  This event has already ended. Registration is closed.
                </p>
              </motion.div>
            ) : (
              <motion.div
                className="glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h3 style={{ marginBottom: '1.5rem' }}>📝 Registration Form</h3>

                {error && (
                  <div className="alert alert-danger">{error}</div>
                )}

                  {!user ? (
                    <motion.div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                      <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>You need to be signed in to register for this event.</p>
                      <button className="btn btn-primary" onClick={() => navigate('/login')}>Sign In to Register</button>
                    </motion.div>
                  ) : (
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
                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={(formData[field.id] || []).includes(opt)}
                                    onChange={() => handleFieldChange(field.id, opt, 'checklist')}
                                    style={{ accentColor: 'var(--primary-color)' }}
                                  />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      <motion.button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem' }}
                        disabled={submitting}
                        whileTap={{ scale: 0.97 }}
                      >
                        {submitting ? 'Submitting...' : 'Register for Event'}
                      </motion.button>
                    </form>
                  )}
                </motion.div>
            )
          ) : (
            <motion.div
              className="glass-panel text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h3>✅ Registration Submitted</h3>
              <p style={{ margin: '1rem 0' }}>
                Your application status is:
                <span
                  className={`badge ${applicationStatus === 'approved' ? 'badge-success' : applicationStatus === 'rejected' ? 'badge-danger' : 'badge-warning'}`}
                  style={{ marginLeft: '0.75rem' }}
                >
                  {applicationStatus}
                </span>
              </p>

              {applicationStatus === 'approved' && isEventOver(event) && (
                <motion.button
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
                  whileTap={{ scale: 0.96 }}
                >
                  Download Attendance Sheet
                </motion.button>
              )}

              {applicationStatus === 'approved' && !isEventOver(event) && (
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  The attendance sheet will be available to download after the event concludes.
                </p>
              )}
            </motion.div>
          )
        )}
      </div>
    </AnimatedPage>
  );
};

export default EventDetail;
