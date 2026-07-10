import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const ClubKanban = () => {
  const { chapterId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [chapter, setChapter] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // New task form state
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', status: 'todo' });

  useEffect(() => {
    fetchData();
  }, [chapterId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Verify authorization
      const { data: chapterData, error: chapterError } = await supabase
        .from('club_chapters')
        .select('id, name, campus_lead_id')
        .eq('id', chapterId)
        .single();
        
      if (chapterError) throw chapterError;
      setChapter(chapterData);
      
      let isChapterLeader = false;
      const { data: leaderMember } = await supabase
        .from('club_members')
        .select('role, status')
        .eq('chapter_id', chapterId)
        .eq('user_id', user.id)
        .single();

      if (chapterData.campus_lead_id === user.id) {
        isChapterLeader = true;
      } else if (leaderMember?.status === 'approved' && ['core_team', 'lead', 'faculty_coordinator'].includes(leaderMember?.role)) {
        isChapterLeader = true;
      }

      // Check if super_admin or faculty globally
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userProfile?.role === 'super_admin') {
        isChapterLeader = true;
      }

      if (!isChapterLeader) {
        throw new Error('Access Denied: You do not have permission to view tasks for this club.');
      }

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('club_tasks')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: false });

      if (tasksError && tasksError.code !== '42P01') { 
         throw tasksError;
      }
      
      setTasks(tasksData || []);
    } catch (err) {
      if (err.code === '42P01') {
         setError('The club tasks table has not been created yet in the database. Please run the provided SQL in your Supabase SQL editor.');
      } else {
         setError(err.message || 'Failed to load Kanban board');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const { data, error } = await supabase
        .from('club_tasks')
        .insert([{
          chapter_id: chapterId,
          title: newTask.title,
          description: newTask.description,
          status: newTask.status
        }])
        .select()
        .single();

      if (error) throw error;
      setTasks([data, ...tasks]);
      setNewTask({ title: '', description: '', status: 'todo' });
      setShowNewTaskForm(false);
    } catch (err) {
      alert('Failed to create task: ' + err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      const { error } = await supabase.from('club_tasks').delete().eq('id', taskId);
      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      alert('Failed to delete task: ' + err.message);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      // Optimistic update
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      
      const { error } = await supabase
        .from('club_tasks')
        .update({ status: newStatus, updated_at: new Date() })
        .eq('id', taskId);
        
      if (error) throw error;
    } catch (err) {
      alert('Failed to update task status: ' + err.message);
      // Revert on error
      fetchData();
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      updateTaskStatus(taskId, status);
    }
  };

  const renderColumn = (status, title, accentColor) => {
    const columnTasks = tasks.filter(t => t.status === status);
    
    return (
      <div 
        style={{ 
          flex: 1, 
          minWidth: '280px',
          backgroundColor: 'var(--input-bg)',
          borderRadius: '0.75rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          borderTop: `4px solid ${accentColor}`
        }}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
          <span style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            padding: '0.2rem 0.5rem', 
            borderRadius: '1rem', 
            fontSize: '0.8rem',
            color: 'var(--text-secondary)'
          }}>
            {columnTasks.length}
          </span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minHeight: '100px' }}>
          {columnTasks.map(task => (
            <motion.div 
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e, task.id)}
              style={{
                backgroundColor: 'var(--bg-color)',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--input-border)',
                cursor: 'grab',
                position: 'relative'
              }}
              whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
              <h4 style={{ margin: '0 0 0.5rem 0', paddingRight: '1.5rem', fontSize: '0.95rem' }}>{task.title}</h4>
              {task.description && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {task.description}
                </p>
              )}
              
              <button 
                onClick={() => handleDeleteTask(task.id)}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
                title="Delete Task"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
          {columnTasks.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 'auto' }}>
              Drag tasks here
            </div>
          )}
        </div>
        
        <button 
          className="btn btn-ghost" 
          style={{ width: '100%', marginTop: '1rem', fontSize: '0.85rem', border: '1px dashed var(--input-border)' }}
          onClick={() => {
            setNewTask({ title: '', description: '', status });
            setShowNewTaskForm(true);
          }}
        >
          <Plus size={16} style={{ marginRight: '0.25rem' }} /> Add Task
        </button>
      </div>
    );
  };

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;

  if (error) {
    return (
      <div className="container flex-center" style={{ minHeight: '60vh' }}>
        <div className="glass-panel text-center" style={{ maxWidth: '500px' }}>
          <h2 style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>Notice</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate(`/club/${chapterId}`)}>
            Back to Club
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '1200px' }}>
      <button 
        className="btn btn-outline" 
        style={{ marginBottom: '1.5rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} 
        onClick={() => navigate(`/club/${chapterId}`)}
      >
        <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Back to Club
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>Club Kanban Board</h2>
        <p style={{ color: 'var(--primary-color)', margin: 0, fontWeight: 600 }}>{chapter?.name}</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '1rem' }}>
        {renderColumn('todo', 'To Do', '#3b82f6')}
        {renderColumn('processing', 'Processing', '#f59e0b')}
        {renderColumn('whats_next', "What's Next", '#10b981')}
      </div>

      {showNewTaskForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Create New Task</h3>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label className="form-label">Task Title <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  required 
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea 
                  className="form-control" 
                  rows="3"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowNewTaskForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubKanban;
