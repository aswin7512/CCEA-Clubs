import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import SuperAdminDashboard from '../components/dashboards/SuperAdminDashboard';
import StudentDashboard from '../components/dashboards/StudentDashboard';
import FacultyDashboard from '../components/dashboards/FacultyDashboard';
import AnimatedPage from '../components/AnimatedPage';

const Dashboard = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (!profile) {
    return (
      <div className="loader-container" style={{ minHeight: '60vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div className="container" style={{ padding: '2rem 1.5rem' }}>
        <motion.div
          className="dashboard-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="dashboard-welcome">
            <h2 style={{ marginBottom: '0.2rem' }}>
              Welcome back, <span style={{ color: 'var(--primary-color)' }}>{profile.name}</span>
            </h2>
            <p>
              <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                {profile.role.replace('_', ' ')}
              </span>
            </p>
          </div>
          <div className="dashboard-actions">
            <motion.button
              onClick={() => navigate('/profile')}
              className="btn btn-primary"
              whileTap={{ scale: 0.96 }}
            >
              <User size={16} /> My Profile
            </motion.button>
            <motion.button
              onClick={handleLogout}
              className="btn btn-ghost"
              whileTap={{ scale: 0.96 }}
            >
              <LogOut size={16} /> Logout
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          className="glass-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        >
          {(profile.role === 'student' || profile.role === 'super_admin') && <StudentDashboard />}
          {profile.role === 'faculty' && <FacultyDashboard />}
        </motion.div>
      </div>
    </AnimatedPage>
  );
};

export default Dashboard;
