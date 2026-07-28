import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, X, Check, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatStudentClass } from '../lib/integrations';

const ManageClassTutorsModal = ({
  isOpen,
  onClose,
  chapter,
  members = [],
  classTutors = [],
  onRefreshData
}) => {
  const [facultyProfiles, setFacultyProfiles] = useState([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [selectedFacultyByClass, setSelectedFacultyByClass] = useState({});
  const [savingClass, setSavingClass] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  // Extract distinct classes from student members
  const studentMembers = members.filter(m => m.role !== 'faculty_coordinator' && m.profiles?.role !== 'faculty');
  const distinctClassesSet = new Set();
  studentMembers.forEach(m => {
    const className = formatStudentClass(m.profiles);
    distinctClassesSet.add(className);
  });
  
  // Also add any classes that already have tutors assigned even if no students present yet
  classTutors.forEach(ct => {
    if (ct.class_name) distinctClassesSet.add(ct.class_name);
  });

  const distinctClasses = Array.from(distinctClassesSet).sort();

  useEffect(() => {
    if (isOpen) {
      fetchFacultyProfiles();
    }
  }, [isOpen]);

  const fetchFacultyProfiles = async () => {
    try {
      setLoadingFaculty(true);
      setError('');
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, name, department, email, prp_code')
        .eq('role', 'faculty')
        .order('name', { ascending: true });

      if (fetchErr) throw fetchErr;
      setFacultyProfiles(data || []);
    } catch (err) {
      console.error('Error loading faculty profiles:', err);
      setError('Failed to load faculty list: ' + err.message);
    } finally {
      setLoadingFaculty(false);
    }
  };

  const handleAssignTutor = async (className) => {
    const tutorId = selectedFacultyByClass[className];
    if (!tutorId) return;

    try {
      setSavingClass(className);
      setError('');

      const { error: insertErr } = await supabase
        .from('club_class_tutors')
        .insert([{
          chapter_id: chapter.id,
          class_name: className,
          tutor_id: tutorId
        }]);

      if (insertErr) {
        if (insertErr.code === '23505') {
          alert('This faculty member is already assigned as a tutor for ' + className);
        } else {
          throw insertErr;
        }
      }

      // Reset selection
      setSelectedFacultyByClass(prev => ({ ...prev, [className]: '' }));
      if (onRefreshData) await onRefreshData();
    } catch (err) {
      console.error('Error assigning tutor:', err);
      setError('Failed to assign tutor: ' + err.message);
    } finally {
      setSavingClass(null);
    }
  };

  const handleRemoveTutor = async (tutorRecordId) => {
    try {
      setDeletingId(tutorRecordId);
      setError('');

      const { error: delErr } = await supabase
        .from('club_class_tutors')
        .delete()
        .eq('id', tutorRecordId);

      if (delErr) throw delErr;

      if (onRefreshData) await onRefreshData();
    } catch (err) {
      console.error('Error removing tutor:', err);
      setError('Failed to remove tutor assignment: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          paddingBottom: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '1.25rem'
        }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem' }}>
              <Shield size={20} style={{ color: 'var(--primary-color)' }} /> Manage Class Faculty Tutors
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Assign faculty members as Tutors for specific student classes (e.g. S7 CSE A). Tutors will see class-restricted statistics.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            {error}
          </div>
        )}

        {/* Classes & Tutor Assignment List */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {distinctClasses.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              No student classes found in this club chapter yet.
            </p>
          ) : (
            distinctClasses.map(className => {
              const assignedTutors = classTutors.filter(ct => ct.class_name === className);
              const studentCount = studentMembers.filter(m => formatStudentClass(m.profiles) === className).length;

              return (
                <div
                  key={className}
                  style={{
                    padding: '1.1rem',
                    borderRadius: '0.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={16} style={{ color: 'var(--primary-color)' }} /> Class {className}
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '0.1rem 0.5rem', borderRadius: '0.25rem' }}>
                        {studentCount} {studentCount === 1 ? 'student' : 'students'}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Tutors list */}
                  <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {assignedTutors.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No tutors assigned for this class yet.
                      </span>
                    ) : (
                      assignedTutors.map(record => (
                        <div
                          key={record.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.375rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            fontSize: '0.85rem'
                          }}
                        >
                          <div>
                            <strong style={{ color: '#60a5fa' }}>{record.profiles?.name || 'Faculty Member'}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                              ({record.profiles?.department || 'Faculty'}{record.profiles?.prp_code ? ` • ${record.profiles.prp_code}` : ''})
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveTutor(record.id)}
                            disabled={deletingId === record.id}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger-color)',
                              cursor: 'pointer',
                              padding: '0.2rem',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="Remove Tutor"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Assign New Tutor Input Row */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.85rem', flex: 1, padding: '0.4rem 0.6rem' }}
                      value={selectedFacultyByClass[className] || ''}
                      onChange={e => setSelectedFacultyByClass({ ...selectedFacultyByClass, [className]: e.target.value })}
                      disabled={loadingFaculty || savingClass === className}
                    >
                      <option value="">-- Select Faculty Tutor --</option>
                      {facultyProfiles.map(fac => (
                        <option key={fac.id} value={fac.id}>
                          {fac.name} ({fac.department}){fac.prp_code ? ` - ${fac.prp_code}` : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      className="btn btn-primary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      onClick={() => handleAssignTutor(className)}
                      disabled={!selectedFacultyByClass[className] || savingClass === className}
                    >
                      <UserPlus size={14} />
                      {savingClass === className ? 'Assigning...' : 'Assign'}
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justify: 'flex-end'
        }}>
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageClassTutorsModal;
