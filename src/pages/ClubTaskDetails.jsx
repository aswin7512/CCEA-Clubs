import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AnimatedPage from '../components/AnimatedPage';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  ExternalLink, 
  Users, 
  Calendar, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Award
} from 'lucide-react';
import PublicProfileModal from '../components/PublicProfileModal';

const parseTaskLinks = (taskLinkStr) => {
  if (!taskLinkStr) return [];
  try {
    const parsed = JSON.parse(taskLinkStr);
    if (Array.isArray(parsed)) return parsed;
    return [{ url: taskLinkStr, label: 'Task Link' }];
  } catch (e) {
    return [{ url: taskLinkStr, label: 'Task Link' }];
  }
};

const ClubTaskDetails = () => {
  const { taskId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [myMembership, setMyMembership] = useState(null);
  const [myCompletion, setMyCompletion] = useState(null);
  const [allCompletions, setAllCompletions] = useState([]);
  const [studentMembers, setStudentMembers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Student task completion input
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);
  const [visitedUrls, setVisitedUrls] = useState([]);

  // Public student profile state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileData, setSelectedProfileData] = useState(null);

  const openPublicProfile = (profile) => {
    setSelectedProfileData(profile);
    setShowProfileModal(true);
  };

  useEffect(() => {
    if (user && taskId) {
      fetchTaskDetails();
      const visitedKey = `visited_links_${taskId}_${user.id}`;
      try {
        const stored = localStorage.getItem(visitedKey);
        if (stored) {
          setVisitedUrls(JSON.parse(stored));
        } else {
          setVisitedUrls([]);
        }
      } catch (e) {
        setVisitedUrls([]);
      }
    }
  }, [taskId, user, profile]);

  const fetchTaskDetails = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch Task details
      const { data: taskData, error: taskError } = await supabase
        .from('club_member_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      setTask(taskData);

      // 2. Fetch Chapter details
      const { data: chapterData, error: chapterError } = await supabase
        .from('club_chapters')
        .select('name, id')
        .eq('id', taskData.chapter_id)
        .single();

      if (chapterError) throw chapterError;
      setChapter(chapterData);

      // 3. Fetch User Membership details
      const { data: memberData, error: memberError } = await supabase
        .from('club_members')
        .select('*')
        .eq('chapter_id', taskData.chapter_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError) throw memberError;
      setMyMembership(memberData);

      // Evaluate permissions
      const isSuperAdmin = profile?.role === 'super_admin';
      const isApproved = isSuperAdmin || (memberData && memberData.status === 'approved');
      
      if (!isApproved) {
        throw new Error('Access Denied: You must be an approved member of this club to view task details.');
      }

      const isCampusLead = profile?.role === 'campus_lead';
      const canManage = isCampusLead || (memberData && memberData.status === 'approved' && ['lead', 'core_team', 'faculty_coordinator'].includes(memberData.role));

      // 4. Fetch my completion if student
      if (profile?.role === 'student') {
        const { data: compData, error: compError } = await supabase
          .from('club_task_completions')
          .select('*')
          .eq('task_id', taskId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (compError) throw compError;
        setMyCompletion(compData);
        if (compData?.feedback) {
          setFeedbackText(compData.feedback);
        }
      }

      // 5. Fetch all student memberships & task completions if leader
      if (canManage) {
        // Fetch all approved members
        const { data: allMembers, error: allMembersError } = await supabase
          .from('club_members')
          .select('*, profiles:user_id(*)')
          .eq('chapter_id', taskData.chapter_id)
          .eq('status', 'approved');

        if (allMembersError) throw allMembersError;

        // Filter for approved student members only
        const students = (allMembers || []).filter(
          m => m.role !== 'faculty_coordinator' && m.profiles?.role !== 'faculty'
        );
        setStudentMembers(students);

        // Fetch completions
        const { data: completionsData, error: completionsError } = await supabase
          .from('club_task_completions')
          .select('*')
          .eq('task_id', taskId);

        if (completionsError) throw completionsError;
        setAllCompletions(completionsData || []);
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const triggerDatabaseVisit = async () => {
    try {
      const { data, error: visitError } = await supabase
        .from('club_task_completions')
        .upsert({
          task_id: task.id,
          user_id: user.id,
          is_visited: true,
          visited_at: new Date().toISOString()
        }, { onConflict: 'task_id,user_id' })
        .select()
        .single();

      if (visitError) throw visitError;
      setMyCompletion(data);
    } catch (err) {
      console.error('Failed to log task link visit:', err);
    }
  };

  const handleVisitIndividualLink = async (linkUrl) => {
    if (!user || !task) return;

    // Redirect first
    const url = linkUrl.startsWith('http://') || linkUrl.startsWith('https://')
      ? linkUrl
      : `https://${linkUrl}`;
    window.open(url, '_blank', 'noopener,noreferrer');

    // For students, update visited links in localStorage & trigger DB visit if all visited
    if (profile?.role === 'student') {
      const visitedKey = `visited_links_${taskId}_${user.id}`;
      let nextVisited = [...visitedUrls];
      if (!nextVisited.includes(linkUrl)) {
        nextVisited = [...nextVisited, linkUrl];
        setVisitedUrls(nextVisited);
        localStorage.setItem(visitedKey, JSON.stringify(nextVisited));
      }

      // Check if all links in the task are now visited
      const parsedLinks = parseTaskLinks(task.task_link);
      const allUrls = parsedLinks.map(l => l.url);
      const allVisited = allUrls.every(url => nextVisited.includes(url));

      if (allVisited && (!myCompletion || !myCompletion.is_visited)) {
        await triggerDatabaseVisit();
      }
    }
  };

  const handleCompleteTaskSubmit = async (e) => {
    e.preventDefault();
    if (!user || !task) return;

    try {
      setSubmittingTask(true);
      
      const { data, error: completeError } = await supabase
        .from('club_task_completions')
        .upsert({
          task_id: task.id,
          user_id: user.id,
          is_completed: true,
          feedback: feedbackText,
          completed_at: new Date().toISOString()
        }, { onConflict: 'task_id,user_id' })
        .select()
        .single();

      if (completeError) throw completeError;

      setMyCompletion(data);
      alert('Task marked as completed!');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to mark task completed');
    } finally {
      setSubmittingTask(false);
    }
  };

  if (loading) {
    return (
      <div className="loader-container" style={{ minHeight: '60vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  if (error) {
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

  if (!task) return <div className="container flex-center" style={{ minHeight: '60vh' }}>Task not found</div>;

  const isSuperAdmin = profile?.role === 'super_admin';
  const isCampusLead = profile?.role === 'campus_lead';
  const canManageTasks = isCampusLead || (myMembership && myMembership.status === 'approved' && ['lead', 'core_team', 'faculty_coordinator'].includes(myMembership.role));

  // Compute metrics for leaders
  const totalStudentsCount = studentMembers.length;
  const visitedCount = allCompletions.filter(c => c.is_visited).length;
  const completedCount = allCompletions.filter(c => c.is_completed).length;
  const pendingCount = totalStudentsCount - completedCount;

  return (
    <AnimatedPage>
      <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Back Button */}
        <motion.button
          className="btn btn-ghost"
          style={{ marginBottom: '1.5rem', padding: '0.35rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => navigate(`/club/${task.chapter_id}`)}
          whileTap={{ scale: 0.96 }}
        >
          <ArrowLeft size={16} /> Back to Club Detail
        </motion.button>

        {/* Task Title Panel */}
        <motion.div
          className="glass-panel"
          style={{ marginBottom: '2rem' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <FileText size={28} style={{ color: 'var(--primary-color)' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{task.title}</h2>
                <p style={{ color: 'var(--primary-color)', fontWeight: 600, margin: '0.25rem 0 0 0' }}>Club Task • {chapter?.name}</p>
              </div>
            </div>
            
            {myCompletion?.is_completed ? (
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                <CheckCircle size={15} /> Completed
              </span>
            ) : profile?.role === 'student' ? (
              <span className="badge badge-warning" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                Pending Completion
              </span>
            ) : null}
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} style={{ color: 'var(--primary-color)' }} />
              <strong>Posted:</strong> {new Date(task.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {parseTaskLinks(task.task_link).length > 0 && (
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={14} style={{ color: 'var(--primary-color)' }} />
                <strong>Redirection Links:</strong> {parseTaskLinks(task.task_link).length}
              </p>
            )}
          </div>

          <h4 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Task Description</h4>
          <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            {task.description || 'No description provided.'}
          </p>

          {(() => {
            const parsedLinks = parseTaskLinks(task.task_link);
            if (parsedLinks.length === 0) return null;

            return (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1.05rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ExternalLink size={16} style={{ color: 'var(--primary-color)' }} /> Task Links ({parsedLinks.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {parsedLinks.map((link, idx) => {
                    const isVisited = visitedUrls.includes(link.url) || myCompletion?.is_visited;
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        flexWrap: 'wrap',
                        gap: '1rem'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '0.95rem' }}>
                            {link.label || `Link ${idx + 1}`}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            {link.url}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {profile?.role === 'student' && (
                            <span style={{
                              fontSize: '0.8rem',
                              color: isVisited ? '#10b981' : 'var(--text-secondary)',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              {isVisited ? '✓ Visited' : '○ Pending Visit'}
                            </span>
                          )}
                          <button
                            className="btn btn-outline animate-hover"
                            onClick={() => handleVisitIndividualLink(link.url)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem', height: 'auto' }}
                          >
                            Open Link <ExternalLink size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {profile?.role === 'student' && !myCompletion?.is_visited && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem', fontStyle: 'italic' }}>
                    Note: You must click "Open Link" for all of the links above to enable completion submission.
                  </p>
                )}
              </div>
            );
          })()}
        </motion.div>

        {/* Student Completion Action panel */}
        {profile?.role === 'student' && (
          <motion.div
            className="glass-panel"
            style={{ marginBottom: '2rem' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {myCompletion?.is_completed ? (
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '1rem', fontSize: '1.25rem' }}>
                  <CheckCircle size={20} /> You completed this task
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Your completion was recorded on {new Date(myCompletion.completed_at).toLocaleString('en-IN')}.
                </p>
                {myCompletion.feedback && (
                  <div style={{ padding: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', borderLeft: '3px solid #10b981' }}>
                    <strong style={{ fontSize: '0.9rem' }}>Submitted Feedback:</strong>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.925rem' }}>{myCompletion.feedback}</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 style={{ marginBottom: '1.25rem', fontSize: '1.25rem' }}>Submit Task Completion</h3>
                {parseTaskLinks(task.task_link).length > 0 && !myCompletion?.is_visited && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    padding: '1rem', 
                    borderRadius: '0.5rem', 
                    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    fontSize: '0.9rem',
                    marginBottom: '1.5rem',
                    alignItems: 'center'
                  }}>
                    <AlertCircle size={18} />
                    <span>To complete this task, you are required to click and open all the <strong>Task Links</strong> above first.</span>
                  </div>
                )}

                <form onSubmit={handleCompleteTaskSubmit}>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="form-label">Task Feedback (Optional)</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="Add any feedback, notes, or URL submission info for the core team..."
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      disabled={parseTaskLinks(task.task_link).length > 0 && !myCompletion?.is_visited}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingTask || (parseTaskLinks(task.task_link).length > 0 && !myCompletion?.is_visited)}
                  >
                    {submittingTask ? 'Submitting...' : 'Mark as Completed'}
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}

        {/* Leader dashboard panel */}
        {canManageTasks && (
          <motion.div
            className="glass-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} style={{ color: 'var(--primary-color)' }} /> Member Submissions
            </h3>

            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Members</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{totalStudentsCount}</div>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Links Visited</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem', color: 'var(--primary-color)' }}>{visitedCount}</div>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Completed</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem', color: '#10b981' }}>{completedCount}</div>
              </div>
              <div style={{ padding: '1rem', borderRadius: '0.5rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pending</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem', color: '#f59e0b' }}>{pendingCount}</div>
              </div>
            </div>

            {studentMembers.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                No approved student members in this club yet.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--input-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <th style={{ padding: '0.75rem' }}>Member Info</th>
                      <th style={{ padding: '0.75rem' }}>Link Visited</th>
                      <th style={{ padding: '0.75rem' }}>Status</th>
                      <th style={{ padding: '0.75rem' }}>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentMembers.map(student => {
                      const comp = allCompletions.find(c => c.user_id === student.user_id);
                      const hasVisited = comp?.is_visited;
                      const isDone = comp?.is_completed;

                      return (
                        <tr key={student.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 'bold' }}>
                              <span 
                                onClick={() => openPublicProfile(student.profiles)}
                                style={{ cursor: 'pointer', color: 'var(--primary-color)' }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                              >
                                {student.profiles?.name || 'N/A'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {student.profiles?.roll_number} • {student.profiles?.department}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {hasVisited ? (
                              <span style={{ color: '#10b981', fontWeight: 600 }}>
                                Yes {comp.visited_at && <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>({new Date(comp.visited_at).toLocaleDateString()})</span>}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>No</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            {isDone ? (
                              <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <CheckCircle size={14} /> Completed
                              </span>
                            ) : (
                              <span style={{ color: '#f59e0b', fontWeight: 600 }}>Pending</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {comp?.feedback ? (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{comp.feedback}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

      </div>

      {/* Public Profile Modal */}
      <PublicProfileModal
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedProfileData(null);
        }}
        profileData={selectedProfileData}
      />
    </AnimatedPage>
  );
};

export default ClubTaskDetails;
