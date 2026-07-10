import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const getCurrentAcademicYear = () => {
  const now = new Date();
  const month = now.getMonth(); // 0 is January, 4 is May
  const year = now.getFullYear();
  
  if (month >= 4) { // May or later
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else { // Before May
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
};

const CreateChapter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      const { error: chapterError } = await supabase
        .from('club_chapters')
        .insert([{
          name,
          description,
          academic_year: academicYear,
          campus_lead_id: user.id,
          status: 'pending'
        }]);

      if (chapterError) throw chapterError;
      
      alert('Chapter application submitted successfully. It is pending review by the Core Admin.');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to submit chapter application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex-center" style={{ minHeight: '80vh' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Apply for a New Club Chapter</h2>
        
        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--danger-color)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Club Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              placeholder="e.g., Tinkerhub, GDSC"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Purpose</label>
            <textarea 
              className="form-control" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              required 
              rows="4"
              placeholder="What will this club do this year?"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Academic Year</label>
            <input 
              type="text" 
              className="form-control" 
              value={academicYear} 
              onChange={(e) => setAcademicYear(e.target.value)} 
              required 
              placeholder="e.g., 2026-27"
              readOnly
              style={{ backgroundColor: 'var(--bg-color)', cursor: 'not-allowed' }}
              title="Academic year is automatically calculated"
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              style={{ flex: 1 }}
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ flex: 1 }} 
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChapter;
