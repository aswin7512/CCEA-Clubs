import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import './App.css';

import Navbar from './components/Navbar';
import ParticleBackground from './components/ParticleBackground';

import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
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
import SuperAdminPage from './pages/SuperAdminPage';

import ClubsDetailsPage from './pages/ClubsDetailsPage';
import FundingPage from './pages/FundingPage';
import ContactUsPage from './pages/ContactUsPage';

const AnimatedRoutes = () => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/clubs-details" element={<ClubsDetailsPage />} />
        <Route path="/funding" element={<FundingPage />} />
        <Route path="/contact" element={<ContactUsPage />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />

        {/* Protected */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/create-chapter" element={
          <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
            <CreateChapter />
          </ProtectedRoute>
        } />
        <Route path="/host-event" element={
          <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
            <HostEvent />
          </ProtectedRoute>
        } />
        <Route path="/edit-event/:eventId" element={
          <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
            <HostEvent />
          </ProtectedRoute>
        } />
        <Route path="/event/:eventId" element={
          <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
            <EventDetail />
          </ProtectedRoute>
        } />
        <Route path="/manage-event/:eventId" element={
          <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
            <ManageEvent />
          </ProtectedRoute>
        } />
        <Route path="/club/:chapterId" element={
          <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
            <ClubDetail />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute allowedRoles={['student', 'faculty', 'super_admin']}>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminPage />
          </ProtectedRoute>
        } />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  return (
    <Router>
      <div className="app-wrapper">
        <ParticleBackground />
        <Navbar />
        <main style={{ flex: 1 }}>
          <AnimatedRoutes />
        </main>
      </div>
    </Router>
  );
};

export default App;
