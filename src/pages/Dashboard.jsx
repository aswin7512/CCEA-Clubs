import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import SuperAdminDashboard from '../components/dashboards/SuperAdminDashboard';
import StudentDashboard from '../components/dashboards/StudentDashboard';
import FacultyDashboard from '../components/dashboards/FacultyDashboard';

const Dashboard = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (!profile) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>Welcome, {profile.name}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Role: {profile.role}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => navigate('/profile')} className="btn btn-primary animate-hover" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            My Profile
          </button>
          <button onClick={handleLogout} className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div className="glass-panel">
        {profile.role === 'super_admin' && (
          <SuperAdminDashboard />
        )}

        {profile.role === 'faculty' && (
          <FacultyDashboard />
        )}

        {profile.role === 'student' && (
          <StudentDashboard />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
