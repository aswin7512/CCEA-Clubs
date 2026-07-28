import React, { useState } from 'react';
import { 
  Code, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  TrendingUp, 
  Users, 
  FileCode,
  Edit3,
  Award
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { evaluateLeetCodeSubmission } from '../lib/leetcodeScraper';
import { extractLeetCodeUsername, extractSlugsFromTaskLinks, formatStudentClass } from '../lib/integrations';

const LeetCodeActivityTab = ({ 
  chapter, 
  members = [], 
  tasks = [], 
  completions = [], 
  classTutors = [],
  onRefreshData,
  openPublicProfile
}) => {
  const { user, profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTask, setFilterTask] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [verifyingUserId, setVerifyingUserId] = useState(null);
  const [batchVerifying, setBatchVerifying] = useState(false);
  const [editingMemberHandle, setEditingMemberHandle] = useState(null);
  const [newHandleInput, setNewHandleInput] = useState('');
  const [savingHandle, setSavingHandle] = useState(false);

  // Helper to get effective LeetCode target slug(s) for a task
  const getTaskTargetSlug = (t) => {
    if (t.target_slug && t.target_slug.trim() !== '') return t.target_slug;
    return extractSlugsFromTaskLinks(t.task_link).join(', ');
  };

  // Extract all student members
  const allStudentMembers = members.filter(m => m.role !== 'faculty_coordinator' && m.profiles?.role !== 'faculty');

  // Determine if current user is an assigned Tutor for specific class(es)
  const tutorRecordsForUser = classTutors.filter(ct => ct.tutor_id === user?.id);
  const assignedClassNames = tutorRecordsForUser.map(ct => ct.class_name);
  
  const isCampusLead = chapter?.campus_lead_id === user?.id;
  const userMembership = members.find(m => m.user_id === user?.id);
  const isClubLeader = isCampusLead || (userMembership?.status === 'approved' && ['lead', 'core_team', 'faculty_coordinator'].includes(userMembership?.role));
  const isSuperAdmin = profile?.role === 'super_admin';

  // If user is a tutor and NOT a lead/super_admin, restrict view to their assigned classes
  const isRestrictedTutor = assignedClassNames.length > 0 && !isClubLeader && !isSuperAdmin;

  // Aggregate distinct student classes
  const allClassesSet = new Set();
  allStudentMembers.forEach(m => {
    allClassesSet.add(formatStudentClass(m.profiles));
  });
  const availableClasses = Array.from(allClassesSet).sort();

  // Filter student members by class
  const studentMembers = allStudentMembers.filter(m => {
    const studentClass = formatStudentClass(m.profiles);

    if (isRestrictedTutor) {
      if (selectedClass === 'all') {
        return assignedClassNames.includes(studentClass);
      }
      return studentClass === selectedClass && assignedClassNames.includes(studentClass);
    }

    if (selectedClass !== 'all') {
      return studentClass === selectedClass;
    }
    return true;
  });

  // Filter tasks that have target slugs (assigned LeetCode tasks)
  const leetcodeTasks = tasks.filter(t => getTaskTargetSlug(t).trim() !== '');

  // Calculate Overall Statistics
  const totalTasks = leetcodeTasks.length;
  const totalStudents = studentMembers.length;
  const totalPossibleSubmissions = totalStudents * totalTasks;

  let totalCompleted = 0;
  let totalAttempted = 0;

  // Build task stats breakdown map
  const taskStatsMap = {};
  leetcodeTasks.forEach(t => {
    taskStatsMap[t.id] = { completed: 0, attempted: 0, notDone: 0 };
  });

  studentMembers.forEach(m => {
    leetcodeTasks.forEach(t => {
      const comp = completions.find(c => c.task_id === t.id && c.user_id === m.user_id);
      const status = comp?.verification_status || (comp?.is_completed ? 'completed' : 'not_done');

      if (status === 'completed') {
        totalCompleted++;
        if (taskStatsMap[t.id]) taskStatsMap[t.id].completed++;
      } else if (status === 'attempted') {
        totalAttempted++;
        if (taskStatsMap[t.id]) taskStatsMap[t.id].attempted++;
      } else {
        if (taskStatsMap[t.id]) taskStatsMap[t.id].notDone++;
      }
    });
  });

  const overallCompletionRate = totalPossibleSubmissions > 0 
    ? Math.round((totalCompleted / totalPossibleSubmissions) * 100) 
    : 0;

  const membersWithHandle = studentMembers.filter(m => m.leetcode_username && m.leetcode_username.trim());

  // Helper to determine if a task for a student requires re-verification:
  // - Skip if already completed
  // - Skip if student has not visited the link (no completion record or is_visited is false and no attempt made)
  // - ONLY verify if link has been visited / attempted AND is not completed yet
  const shouldVerifyTaskForStudent = (task, member) => {
    const comp = completions.find(c => c.task_id === task.id && c.user_id === member.user_id);
    if (!comp) return false; // Never visited / no interaction
    if (comp.is_completed || comp.verification_status === 'completed') return false; // Already completed
    if (comp.is_visited || comp.visited_at || comp.verification_status) return true; // Visited or attempted
    return false;
  };

  // Handle single student verification trigger (Client-Side)
  const handleVerifyStudent = async (member) => {
    if (!member.leetcode_username) {
      alert(`Member ${member.profiles?.name || ''} does not have a LeetCode handle registered.`);
      return;
    }

    if (leetcodeTasks.length === 0) {
      alert('No LeetCode tasks assigned for this club chapter yet.');
      return;
    }

    const tasksToVerify = leetcodeTasks.filter(t => shouldVerifyTaskForStudent(t, member));

    if (tasksToVerify.length === 0) {
      alert(`No visited, uncompleted tasks found for ${member.profiles?.name || 'this member'}.\n\n• Completed tasks are skipped.\n• Unvisited tasks require the student to open the task link first.`);
      return;
    }

    try {
      setVerifyingUserId(member.user_id);

      for (const task of tasksToVerify) {
        const targetSlug = getTaskTargetSlug(task);
        const evalResult = await evaluateLeetCodeSubmission(member.leetcode_username, targetSlug);
        
        // Upsert completion record
        await supabase
          .from('club_task_completions')
          .upsert({
            task_id: task.id,
            user_id: member.user_id,
            is_completed: evalResult.verificationStatus === 'completed',
            verification_status: evalResult.verificationStatus,
            raw_status_display: evalResult.rawStatusDisplay,
            last_verified_at: new Date().toISOString()
          }, { onConflict: 'task_id,user_id' });
      }

      if (onRefreshData) await onRefreshData();
    } catch (err) {
      console.error('Error verifying student LeetCode tasks:', err);
      alert('Error verifying student LeetCode status: ' + err.message);
    } finally {
      setVerifyingUserId(null);
    }
  };

  // Handle Batch Verification for all students (Client-Side)
  const handleBatchVerifyAll = async () => {
    if (membersWithHandle.length === 0) {
      alert('No members with valid LeetCode handles found.');
      return;
    }
    if (leetcodeTasks.length === 0) {
      alert('No LeetCode tasks assigned yet.');
      return;
    }

    // Collect all (member, task) pairs that qualify for verification
    const pendingItems = [];
    for (const member of membersWithHandle) {
      for (const task of leetcodeTasks) {
        if (shouldVerifyTaskForStudent(task, member)) {
          pendingItems.push({ member, task });
        }
      }
    }

    if (pendingItems.length === 0) {
      alert('No pending visited tasks to re-verify!\n\n• Completed tasks are already verified and skipped.\n• Unvisited tasks require students to visit the task link first.');
      return;
    }

    if (!window.confirm(`Run client-side LeetCode verification for ${pendingItems.length} visited task submission(s)?`)) {
      return;
    }

    try {
      setBatchVerifying(true);

      for (const { member, task } of pendingItems) {
        const targetSlug = getTaskTargetSlug(task);
        const evalResult = await evaluateLeetCodeSubmission(member.leetcode_username, targetSlug);
        
        await supabase
          .from('club_task_completions')
          .upsert({
            task_id: task.id,
            user_id: member.user_id,
            is_completed: evalResult.verificationStatus === 'completed',
            verification_status: evalResult.verificationStatus,
            raw_status_display: evalResult.rawStatusDisplay,
            last_verified_at: new Date().toISOString()
          }, { onConflict: 'task_id,user_id' });
      }

      alert('Batch verification complete!');
      if (onRefreshData) await onRefreshData();
    } catch (err) {
      console.error('Batch verification error:', err);
      alert('Batch verification failed: ' + err.message);
    } finally {
      setBatchVerifying(false);
    }
  };

  // Handle updating member's LeetCode handle
  const handleSaveMemberHandle = async (memberId) => {
    if (!newHandleInput.trim()) return;
    try {
      setSavingHandle(true);
      const cleanHandle = extractLeetCodeUsername(newHandleInput);

      const { error } = await supabase
        .from('club_members')
        .update({ leetcode_username: cleanHandle })
        .eq('id', memberId);

      if (error) throw error;

      alert('LeetCode handle updated successfully!');
      setEditingMemberHandle(null);
      setNewHandleInput('');
      if (onRefreshData) await onRefreshData();
    } catch (err) {
      alert('Failed to update handle: ' + err.message);
    } finally {
      setSavingHandle(false);
    }
  };

  // Filter student members list for Matrix table
  const filteredStudents = studentMembers.filter(member => {
    const nameMatch = (member.profiles?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const rollMatch = (member.profiles?.roll_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const handleMatch = (member.leetcode_username || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!(nameMatch || rollMatch || handleMatch)) return false;

    if (filterTask !== 'all') {
      const comp = completions.find(c => c.task_id === filterTask && c.user_id === member.user_id);
      const status = comp?.verification_status || (comp?.is_completed ? 'completed' : 'not_done');
      if (filterStatus !== 'all' && status !== filterStatus) return false;
    }

    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Banner & Batch Action */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem' }}>
            <Code style={{ color: 'var(--primary-color)' }} /> Activity & Student Tracking Dashboard
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>
            {isRestrictedTutor ? (
              <span>Assigned Faculty Tutor View • Showing class statistics for: <strong>{assignedClassNames.join(', ')}</strong></span>
            ) : (
              <span>Automated ground-truth verification dashboard for Faculty, Tutors, and Core Team members.</span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Class Filter Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Class:</span>
            <select
              className="form-control"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              style={{ fontSize: '0.85rem', width: '160px', padding: '0.4rem 0.6rem' }}
            >
              <option value="all">{isRestrictedTutor ? 'All My Classes' : 'All Classes'}</option>
              {(isRestrictedTutor ? assignedClassNames : availableClasses).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <button 
            className="btn btn-primary animate-hover" 
            onClick={handleBatchVerifyAll}
            disabled={batchVerifying || membersWithHandle.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} className={batchVerifying ? 'spin' : ''} />
            {batchVerifying ? 'Evaluating All...' : 'Re-verify All Members'}
          </button>
        </div>
      </div>

      {/* Summary View Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <span>Completion Rate</span>
            <TrendingUp size={18} style={{ color: 'var(--primary-color)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem 0', color: 'var(--primary-color)' }}>
            {overallCompletionRate}%
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${overallCompletionRate}%`, height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <span>LeetCode Tasks</span>
            <FileCode size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem 0' }}>
            {leetcodeTasks.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Total assigned problem sets
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <span>Registered Handles</span>
            <Users size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem 0', color: '#10b981' }}>
            {membersWithHandle.length} / {totalStudents}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Students with active handles
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <span>Solved Questions</span>
            <Award size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem 0', color: '#f59e0b' }}>
            {totalCompleted}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {totalAttempted} Attempted • {totalPossibleSubmissions - totalCompleted - totalAttempted} Pending
          </div>
        </div>

      </div>

      {/* Task Breakdown Cards */}
      {leetcodeTasks.length > 0 && (
        <div className="glass-panel">
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Task Completion Breakdown</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {leetcodeTasks.map(task => {
              const stats = taskStatsMap[task.id] || { completed: 0, attempted: 0, notDone: 0 };
              const taskCompRate = totalStudents > 0 ? Math.round((stats.completed / totalStudents) * 100) : 0;

              return (
                <div 
                  key={task.id} 
                  style={{ 
                    padding: '1rem', 
                    borderRadius: '0.5rem', 
                    backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)' 
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{task.title}</div>
                    <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                      {getTaskTargetSlug(task)}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {stats.completed} Done</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚡ {stats.attempted} Attempted</span>
                    <span style={{ color: 'var(--text-secondary)' }}>○ {stats.notDone} Pending</span>
                  </div>

                  <div style={{ marginTop: '0.5rem', width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${taskCompRate}%`, height: '100%', backgroundColor: '#10b981' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Member Breakdown Matrix Table */}
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Member Breakdown Matrix</h4>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '200px' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search member..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>

            {leetcodeTasks.length > 0 && (
              <select 
                className="form-control" 
                value={filterTask}
                onChange={e => setFilterTask(e.target.value)}
                style={{ fontSize: '0.85rem', width: '160px' }}
              >
                <option value="all">All Tasks</option>
                {leetcodeTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            )}

            <select 
              className="form-control" 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ fontSize: '0.85rem', width: '140px' }}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="attempted">Attempted</option>
              <option value="not_done">Not Done</option>
            </select>
          </div>
        </div>

        {studentMembers.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No student members in this club yet.
          </p>
        ) : filteredStudents.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No members match your search criteria.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--input-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Member Info</th>
                  <th style={{ padding: '0.75rem' }}>LeetCode Handle</th>
                  {leetcodeTasks.map(t => (
                    <th style={{ padding: '0.75rem', textAlign: 'center' }} key={t.id}>
                      {t.title}
                      <div style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>
                        {getTaskTargetSlug(t)}
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(member => {
                  return (
                    <tr key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      
                      {/* Member Info */}
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span 
                            onClick={() => openPublicProfile && openPublicProfile(member.profiles, chapter?.additional_field_label, member.additional_field_value)}
                            style={{ cursor: 'pointer', color: 'var(--primary-color)' }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {member.profiles?.name || 'N/A'}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '0.25rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.12)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.25)'
                          }}>
                            {formatStudentClass(member.profiles)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {member.profiles?.roll_number ? `${member.profiles.roll_number} • ` : ''}{member.profiles?.email}
                        </div>
                      </td>

                      {/* LeetCode Handle */}
                      <td style={{ padding: '0.75rem' }}>
                        {editingMemberHandle === member.id ? (
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              className="form-control" 
                              style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: '130px' }}
                              value={newHandleInput}
                              onChange={e => setNewHandleInput(e.target.value)}
                              placeholder="Handle or URL"
                            />
                            <button 
                              className="btn btn-primary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                              onClick={() => handleSaveMemberHandle(member.id)}
                              disabled={savingHandle}
                            >
                              Save
                            </button>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                              onClick={() => setEditingMemberHandle(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : member.leetcode_username ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <a 
                              href={`https://leetcode.com/u/${member.leetcode_username}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              {member.leetcode_username} <ExternalLink size={12} />
                            </a>
                            <button 
                              onClick={() => {
                                setEditingMemberHandle(member.id);
                                setNewHandleInput(member.leetcode_username || '');
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.1rem' }}
                              title="Edit handle"
                            >
                              <Edit3 size={12} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: 'var(--danger-color)', fontStyle: 'italic', fontSize: '0.8rem' }}>Missing Handle</span>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', height: 'auto' }}
                              onClick={() => {
                                setEditingMemberHandle(member.id);
                                setNewHandleInput('');
                              }}
                            >
                              + Add
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Status per task */}
                      {leetcodeTasks.map(t => {
                        const comp = completions.find(c => c.task_id === t.id && c.user_id === member.user_id);
                        const status = comp?.verification_status || (comp?.is_completed ? 'completed' : 'not_done');

                        return (
                          <td style={{ padding: '0.75rem', textAlign: 'center' }} key={t.id}>
                            {status === 'completed' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
                                <CheckCircle size={13} /> Completed
                              </span>
                            ) : status === 'attempted' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontWeight: 600, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
                                <Clock size={13} /> Attempted
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem' }}>
                                ○ Not done
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => handleVerifyStudent(member)}
                          disabled={verifyingUserId === member.user_id || !member.leetcode_username}
                          title="Re-verify LeetCode submissions for this member"
                        >
                          <RefreshCw size={12} className={verifyingUserId === member.user_id ? 'spin' : ''} />
                          {verifyingUserId === member.user_id ? 'Evaluating...' : 'Verify'}
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default LeetCodeActivityTab;
