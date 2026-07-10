import React from 'react';
import { motion } from 'framer-motion';
import SuperAdminDashboard from '../components/dashboards/SuperAdminDashboard';
import AnimatedPage from '../components/AnimatedPage';

const SuperAdminPage = () => {
  return (
    <AnimatedPage>
      <div className="container" style={{ padding: '2rem 1.5rem' }}>
        <motion.div
          className="dashboard-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div>
            <h2 style={{ marginBottom: '0.2rem' }}>Super Admin Panel</h2>
            <p className="text-secondary">Manage and review all club chapter applications.</p>
          </div>
        </motion.div>

        <motion.div
          className="glass-panel"
          style={{ marginTop: '1.5rem' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        >
          <SuperAdminDashboard />
        </motion.div>
      </div>
    </AnimatedPage>
  );
};

export default SuperAdminPage;
