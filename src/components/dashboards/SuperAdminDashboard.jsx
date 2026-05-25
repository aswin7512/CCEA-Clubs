import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const SuperAdminDashboard = () => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchChapters();
  }, []);

  const fetchChapters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('club_chapters')
        .select(`
          id,
          name,
          description,
          academic_year,
          status,
          created_at,
          campus_lead_id,
          profiles:campus_lead_id (name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChapters(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, leadId) => {
    try {
      const { error } = await supabase
        .from('club_chapters')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      if (newStatus === 'approved' && leadId) {
        // Automatically assign the lead role
        const { error: memberError } = await supabase
          .from('club_members')
          .upsert({
            chapter_id: id,
            user_id: leadId,
            role: 'lead',
            status: 'approved'
          }, { onConflict: 'chapter_id,user_id' });

        if (memberError) console.error('Failed to add lead as member:', memberError);
      }
      // Optimistically update UI
      setChapters(chapters.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  if (loading) return <div>Loading chapters...</div>;
  if (error) return <div style={{ color: 'var(--danger-color)' }}>Error: {error}</div>;

  return (
    <div>
      <h3 style={{ marginBottom: '1.5rem' }}>Club Chapters Management</h3>
      
      {chapters.length === 0 ? (
        <p>No club chapters found.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {chapters.map(chapter => (
            <div key={chapter.id} style={{ padding: '1rem', border: '1px solid var(--input-border)', borderRadius: '0.5rem', backgroundColor: 'var(--input-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0' }}>{chapter.name} ({chapter.academic_year})</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{chapter.description}</p>
                  <p style={{ fontSize: '0.875rem' }}>
                    <strong>Campus Lead:</strong> {chapter.profiles?.name} ({chapter.profiles?.email})
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <span style={{ 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '1rem', 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    backgroundColor: chapter.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : chapter.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: chapter.status === 'approved' ? 'var(--secondary-color)' : chapter.status === 'rejected' ? 'var(--danger-color)' : '#f59e0b'
                  }}>
                    {chapter.status}
                  </span>
                  
                  {chapter.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                        onClick={() => handleUpdateStatus(chapter.id, 'approved', chapter.campus_lead_id)}
                      >
                        Approve
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                        onClick={() => handleUpdateStatus(chapter.id, 'rejected', chapter.campus_lead_id)}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
