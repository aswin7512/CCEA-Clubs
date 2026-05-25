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
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  const { theme, toggleTheme } = useTheme();

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
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
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
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
