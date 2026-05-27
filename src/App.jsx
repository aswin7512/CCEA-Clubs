import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import CreateChapter from './pages/CreateChapter';
import HostEvent from './pages/HostEvent';
import EventDetail from './pages/EventDetail';
import ManageEvent from './pages/ManageEvent';
import UpdatePassword from './pages/UpdatePassword';
import ClubDetail from './pages/ClubDetail';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

const App = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <Router>
      <div className="app-wrapper">
        <div className="bg-pattern"></div>
        
        <nav style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>Maker Clubs</h2>
          
          <button 
            onClick={toggleTheme} 
            className="btn btn-outline"
            style={{ padding: '0.5rem', borderRadius: '50%' }}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </nav>

        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
            <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/create-chapter" element={
              <ProtectedRoute allowedRoles={['student', 'faculty']}>
                <CreateChapter />
              </ProtectedRoute>
            } />
            <Route path="/host-event" element={
              <ProtectedRoute allowedRoles={['student', 'faculty']}>
                <HostEvent />
              </ProtectedRoute>
            } />
            <Route path="/edit-event/:eventId" element={
              <ProtectedRoute allowedRoles={['student', 'faculty']}>
                <HostEvent />
              </ProtectedRoute>
            } />
            <Route path="/event/:eventId" element={
              <ProtectedRoute allowedRoles={['student', 'faculty']}>
                <EventDetail />
              </ProtectedRoute>
            } />
            <Route path="/manage-event/:eventId" element={
              <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
                <ManageEvent />
              </ProtectedRoute>
            } />
            <Route path="/club/:chapterId" element={
              <ProtectedRoute allowedRoles={['student', 'faculty']}>
                <ClubDetail />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
                <Profile />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
