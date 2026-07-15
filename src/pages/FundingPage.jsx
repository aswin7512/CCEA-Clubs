import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Edit2, Save, Printer, X } from 'lucide-react';
import { motion } from 'framer-motion';

const COLORS = ['#8A2BE2', '#00C49F', '#FFBB28', '#FF8042', '#0088FE'];

const FundingPage = () => {
  const { profile } = useAuth();
  const [funding, setFunding] = useState({ totalFund: 0, breakdown: [] });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ totalFund: 0, breakdown: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [breakdownsToDelete, setBreakdownsToDelete] = useState([]);
  const [clubsList, setClubsList] = useState([]);
  const [selectedClubFilter, setSelectedClubFilter] = useState('all');

  const isSuperAdmin = false;
  const canPrint = profile?.role === 'faculty' || profile?.role === 'super_admin';

  useEffect(() => {
    fetchFundingData();
  }, []);

  const fetchFundingData = async () => {
    setIsLoading(true);
    try {
      let { data: overviewData, error: overviewError } = await supabase.from('funding_overview').select('*').eq('id', 1).single();
      let { data: breakdownData } = await supabase.from('funding_breakdown').select('*').order('id', { ascending: true });
      
      if (overviewError && overviewError.code === 'PGRST116') {
        overviewData = { total_fund: 0 };
        breakdownData = [];
      }
      
      const { data: clubsData } = await supabase.from('clubs_directory').select('id, name').order('name', { ascending: true });
      setClubsList(clubsData || []);

      setFunding({
        totalFund: overviewData?.total_fund || 0,
        breakdown: (breakdownData || []).map(item => ({
          id: item.id,
          name: item.category_name,
          value: Number(item.amount),
          clubId: item.club_id
        }))
      });
    } catch (error) {
      console.error('Error fetching funding data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setSelectedClubFilter('all');
    setEditData({ 
      totalFund: funding.totalFund, 
      breakdown: [...funding.breakdown] 
    });
    setBreakdownsToDelete([]);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const calculatedTotalSum = editData.breakdown.reduce((sum, item) => sum + item.value, 0);
      const { error: overviewErr } = await supabase.from('funding_overview').upsert({ id: 1, total_fund: calculatedTotalSum, updated_at: new Date() });
      if (overviewErr) throw overviewErr;
      
      for (const id of breakdownsToDelete) {
        const { error: deleteErr } = await supabase.from('funding_breakdown').delete().eq('id', id);
        if (deleteErr) throw deleteErr;
      }
      
      for (const item of editData.breakdown) {
        if (item.id && typeof item.id === 'string' && item.id.startsWith('new-')) {
          const { error: insertErr } = await supabase.from('funding_breakdown').insert({
            category_name: item.name,
            amount: item.value,
            club_id: item.clubId || null
          });
          if (insertErr) throw insertErr;
        } else {
          const { error: upsertErr } = await supabase.from('funding_breakdown').upsert({
            id: item.id,
            category_name: item.name,
            amount: item.value,
            club_id: item.clubId || null
          });
          if (upsertErr) throw upsertErr;
        }
      }
      
      await fetchFundingData();
      setIsEditing(false);
      setBreakdownsToDelete([]);
      alert('Funding data updated successfully!');
    } catch (error) {
      console.error('Error saving funding data:', error);
      alert('Failed to save funding data: ' + (error.message || error));
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setBreakdownsToDelete([]);
  };

  const handleChange = (id, field, value) => {
    setEditData(prev => ({
      ...prev,
      breakdown: prev.breakdown.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const handleAddBreakdown = () => {
    const newId = `new-${Date.now()}`;
    setEditData(prev => ({
      ...prev,
      breakdown: [...prev.breakdown, { id: newId, name: '', value: 0, clubId: '' }]
    }));
  };

  const handleRemoveBreakdown = (id) => {
    setEditData(prev => ({
      ...prev,
      breakdown: prev.breakdown.filter(item => item.id !== id)
    }));
    if (typeof id !== 'string' || !id.startsWith('new-')) {
      setBreakdownsToDelete(prev => [...prev, id]);
    }
  };

  const handlePrint = () => {
    const calculatedTotalSum = funding.breakdown.reduce((sum, item) => sum + item.value, 0);
    const doc = new jsPDF();
    doc.text("Maker Clubs - Funding Report", 14, 15);
    doc.text(`Total Funds Spent: ₹${calculatedTotalSum.toLocaleString('en-IN')}`, 14, 25);
    
    const tableColumn = ["Category/Activity/Club", "Associated Club", "Amount Spent"];
    const tableRows = [];

    funding.breakdown.forEach(item => {
      const associatedClubName = clubsList.find(c => c.id === item.clubId)?.name || 'General / None';
      tableRows.push([item.name, associatedClubName, `₹${item.value.toLocaleString('en-IN')}`]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [0, 196, 159] },
    });

    doc.save(`funding_report_${new Date().getTime()}.pdf`);
  };

  const activeData = isEditing ? editData : funding;

  const filteredBreakdown = React.useMemo(() => {
    if (isEditing || selectedClubFilter === 'all') return activeData.breakdown;
    if (selectedClubFilter === 'general') return activeData.breakdown.filter(item => !item.clubId);
    return activeData.breakdown.filter(item => item.clubId === selectedClubFilter);
  }, [activeData.breakdown, selectedClubFilter, isEditing]);

  const chartData = React.useMemo(() => {
    const groupMap = {};
    const itemsToGroup = (isEditing || selectedClubFilter === 'all')
      ? activeData.breakdown
      : activeData.breakdown.filter(item => selectedClubFilter === 'general' ? !item.clubId : item.clubId === selectedClubFilter);

    itemsToGroup.forEach(item => {
      const key = (isEditing || selectedClubFilter === 'all')
        ? (clubsList.find(c => c.id === item.clubId)?.name || 'General')
        : item.name;

      if (!groupMap[key]) {
        groupMap[key] = 0;
      }
      groupMap[key] += item.value;
    });

    return Object.entries(groupMap).map(([name, value]) => ({ name, value }));
  }, [activeData.breakdown, clubsList, selectedClubFilter, isEditing]);

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
            <h2>Funding Overview</h2>
            <p className="text-secondary">Financial breakdown of all club activities.</p>
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

        {!isEditing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Filter by Club:</span>
            <select
              value={selectedClubFilter}
              onChange={e => setSelectedClubFilter(e.target.value)}
              className="form-control"
              style={{ maxWidth: '250px', padding: '0.4rem 0.75rem', borderRadius: '8px' }}
            >
              <option value="all">All Clubs & General</option>
              <option value="general">General / None</option>
              {clubsList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' }}>
          {/* Chart Section */}
          <div style={{ height: '400px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Expenditure Distribution</h3>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} contentStyle={{backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px'}}/>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Data List Section */}
          <div>
            <div className="card" style={{ backgroundColor: 'var(--primary-color)', color: 'white', marginBottom: '2rem' }}>
              <h3 style={{ opacity: 0.9, marginBottom: '0.5rem', fontSize: '1rem' }}>Total Funds Spent</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>
                ₹{filteredBreakdown.reduce((sum, item) => sum + item.value, 0).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem' }}>Category</th>
                    <th style={{ padding: '1rem' }}>Associated Club</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBreakdown.map((item, index) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isEditing && (
                          <button 
                            onClick={() => handleRemoveBreakdown(item.id)}
                            style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Remove"
                          >
                            <X size={16} />
                          </button>
                        )}
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></div>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={item.name} 
                            onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                            className="form-control"
                            placeholder="Category or Club Name"
                          />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {isEditing ? (
                          <select
                            value={item.clubId || ''}
                            onChange={(e) => handleChange(item.id, 'clubId', e.target.value || null)}
                            className="form-control"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.9rem' }}
                          >
                            <option value="">General / None</option>
                            {clubsList.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          clubsList.find(c => c.id === item.clubId)?.name || <span className="text-secondary" style={{ fontStyle: 'italic' }}>General / None</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {isEditing ? (
                          <input 
                            type="number" 
                            value={item.value} 
                            onChange={(e) => handleChange(item.id, 'value', parseInt(e.target.value) || 0)}
                            className="form-control"
                            style={{ textAlign: 'right', width: '120px', marginLeft: 'auto' }}
                          />
                        ) : (
                          `₹${item.value.toLocaleString('en-IN')}`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {isEditing && (
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', marginTop: '1rem', borderStyle: 'dashed' }}
                onClick={handleAddBreakdown}
              >
                + Add Funding Breakdown
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default FundingPage;
