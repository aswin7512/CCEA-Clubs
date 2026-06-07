import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts';
import { Edit2, Save, Printer, X } from 'lucide-react';
import { motion } from 'framer-motion';

const initialClubsData = [
  { name: 'Robotics Club', nextActivity: 'Robo Wars Prep', activitiesCount: 15, isActive: true, activityHistory: [{v: 5}, {v: 10}, {v: 15}, {v: 8}] },
  { name: 'Coding Club', nextActivity: 'Hackathon 2026', activitiesCount: 24, isActive: true, activityHistory: [{v: 12}, {v: 20}, {v: 18}, {v: 24}] },
  { name: 'Design Club', nextActivity: 'UI/UX Workshop', activitiesCount: 8, isActive: true, activityHistory: [{v: 2}, {v: 5}, {v: 4}, {v: 8}] },
  { name: 'Debate Club', nextActivity: 'TBD', activitiesCount: 2, isActive: false, activityHistory: [{v: 1}, {v: 2}, {v: 0}, {v: 0}] }
];

const MiniGraph = ({ data, isActive }) => (
  <div style={{ width: '100px', height: '40px' }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: 'var(--bg-secondary)', border: 'none', borderRadius: '4px', padding: '2px 5px', fontSize: '10px'}}/>
        <Bar dataKey="v" fill={isActive ? 'var(--primary-color)' : 'var(--text-muted)'} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

const ClubsDetailsPage = () => {
  const { profile } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const isSuperAdmin = profile?.role === 'super_admin';
  const canPrint = profile?.role === 'faculty' || profile?.role === 'super_admin';

  useEffect(() => {
    fetchClubsData();
  }, []);

  const mapToCamelCase = (row) => ({
    id: row.id,
    name: row.name,
    nextActivity: row.next_activity,
    activitiesCount: row.activities_count,
    isActive: row.is_active,
    activityHistory: row.activity_history
  });

  const fetchClubsData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('club_statistics').select('*').order('id', { ascending: true });
      if (error) throw error;
      
      if (!data || data.length === 0) {
        const seedData = initialClubsData.map(c => ({
          name: c.name,
          next_activity: c.nextActivity,
          activities_count: c.activitiesCount,
          is_active: c.isActive,
          activity_history: c.activityHistory
        }));
        await supabase.from('club_statistics').insert(seedData);
        const { data: newData } = await supabase.from('club_statistics').select('*').order('id', { ascending: true });
        setClubs(newData ? newData.map(mapToCamelCase) : []);
      } else {
        setClubs(data.map(mapToCamelCase));
      }
    } catch (error) {
      console.error('Error fetching clubs data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setEditData([...clubs]);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      for (const club of editData) {
        await supabase.from('club_statistics').upsert({
          id: club.id,
          name: club.name,
          next_activity: club.nextActivity,
          activities_count: club.activitiesCount,
          is_active: club.isActive,
          activity_history: club.activityHistory
        });
      }
      await fetchClubsData();
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving clubs data:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleChange = (id, field, value) => {
    setEditData(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handlePrint = () => {
    const doc = new jsPDF();
    doc.text("Maker Clubs - Details Report", 14, 15);
    
    const tableColumn = ["Club Name", "Next Activity", "Activities Count", "Status"];
    const tableRows = [];

    clubs.forEach(club => {
      const clubData = [
        club.name,
        club.nextActivity,
        club.activitiesCount,
        club.isActive ? "Active" : "Inactive"
      ];
      tableRows.push(clubData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: [138, 43, 226] }, // primary color roughly
    });

    doc.save(`clubs_details_${new Date().getTime()}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="page-container flex-center" style={{ minHeight: '60vh' }}>
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <motion.div 
      className="page-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="card" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2>Club Details Directory</h2>
            <p className="text-secondary">Overview of all active and inactive clubs.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {canPrint && !isEditing && (
              <button className="btn btn-outline" onClick={handlePrint}>
                <Printer size={18} style={{ marginRight: '8px' }} />
                Print PDF
              </button>
            )}
            {isSuperAdmin && !isEditing && (
              <button className="btn btn-primary" onClick={handleEdit}>
                <Edit2 size={18} style={{ marginRight: '8px' }} />
                Edit Data
              </button>
            )}
            {isEditing && (
              <>
                <button className="btn btn-ghost" onClick={handleCancel}>
                  <X size={18} style={{ marginRight: '8px' }} />
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  <Save size={18} style={{ marginRight: '8px' }} />
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '1rem' }}>Club Name</th>
                <th style={{ padding: '1rem' }}>Next Activity</th>
                <th style={{ padding: '1rem' }}>Total Activities</th>
                <th style={{ padding: '1rem' }}>Status Trend</th>
                <th style={{ padding: '1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(isEditing ? editData : clubs).map((club) => (
                <tr key={club.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={club.name} 
                        onChange={(e) => handleChange(club.id, 'name', e.target.value)}
                        className="form-control"
                        style={{ padding: '0.5rem' }}
                      />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{club.name}</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={club.nextActivity} 
                        onChange={(e) => handleChange(club.id, 'nextActivity', e.target.value)}
                        className="form-control"
                        style={{ padding: '0.5rem' }}
                      />
                    ) : (
                      club.nextActivity
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={club.activitiesCount} 
                        onChange={(e) => handleChange(club.id, 'activitiesCount', parseInt(e.target.value))}
                        className="form-control"
                        style={{ padding: '0.5rem', width: '80px' }}
                      />
                    ) : (
                      <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        {club.activitiesCount}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <MiniGraph data={club.activityHistory} isActive={club.isActive} />
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {isEditing ? (
                      <select 
                        value={club.isActive ? 'true' : 'false'}
                        onChange={(e) => handleChange(club.id, 'isActive', e.target.value === 'true')}
                        className="form-control"
                        style={{ padding: '0.5rem' }}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    ) : (
                      <span className="badge" style={{ 
                        backgroundColor: club.isActive ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)',
                        color: club.isActive ? '#2ecc71' : '#e74c3c'
                      }}>
                        {club.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default ClubsDetailsPage;
