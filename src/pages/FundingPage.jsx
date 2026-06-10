import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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

  const isSuperAdmin = profile?.role === 'super_admin';
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
        const initialFundingData = {
          totalFund: 50000,
          breakdown: [
            { name: 'Robotics Workshop', value: 15000 },
            { name: 'Annual Hackathon', value: 20000 },
            { name: 'Design Sprint', value: 5000 },
            { name: 'Guest Lectures', value: 8000 },
            { name: 'Miscellaneous', value: 2000 },
          ]
        };
        await supabase.from('funding_overview').insert({ id: 1, total_fund: initialFundingData.totalFund });
        await supabase.from('funding_breakdown').insert(initialFundingData.breakdown);
        
        overviewData = { total_fund: initialFundingData.totalFund };
        const { data: newBreakdown } = await supabase.from('funding_breakdown').select('*').order('id', { ascending: true });
        breakdownData = newBreakdown;
      }
      
      setFunding({
        totalFund: overviewData?.total_fund || 0,
        breakdown: breakdownData || []
      });
    } catch (error) {
      console.error('Error fetching funding data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setEditData({ 
      totalFund: funding.totalFund, 
      breakdown: [...funding.breakdown] 
    });
    setBreakdownsToDelete([]);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await supabase.from('funding_overview').upsert({ id: 1, total_fund: editData.totalFund, updated_at: new Date() });
      
      for (const id of breakdownsToDelete) {
        await supabase.from('funding_breakdown').delete().eq('id', id);
      }
      
      for (const item of editData.breakdown) {
        if (item.id && typeof item.id === 'string' && item.id.startsWith('new-')) {
          await supabase.from('funding_breakdown').insert({
            name: item.name,
            value: item.value
          });
        } else {
          await supabase.from('funding_breakdown').upsert({
            id: item.id,
            name: item.name,
            value: item.value
          });
        }
      }
      
      await fetchFundingData();
      setIsEditing(false);
      setBreakdownsToDelete([]);
    } catch (error) {
      console.error('Error saving funding data:', error);
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

  const handleTotalChange = (value) => {
    setEditData(prev => ({ ...prev, totalFund: parseInt(value) || 0 }));
  };

  const handleAddBreakdown = () => {
    const newId = `new-${Date.now()}`;
    setEditData(prev => ({
      ...prev,
      breakdown: [...prev.breakdown, { id: newId, name: '', value: 0 }]
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
    const doc = new jsPDF();
    doc.text("Maker Clubs - Funding Report", 14, 15);
    doc.text(`Total Funds Spent: ₹${funding.totalFund.toLocaleString('en-IN')}`, 14, 25);
    
    const tableColumn = ["Category/Activity/Club", "Amount Spent"];
    const tableRows = [];

    funding.breakdown.forEach(item => {
      tableRows.push([item.name, `₹${item.value.toLocaleString('en-IN')}`]);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [0, 196, 159] },
    });

    doc.save(`funding_report_${new Date().getTime()}.pdf`);
  };

  const activeData = isEditing ? editData : funding;

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'center' }}>
          {/* Chart Section */}
          <div style={{ height: '400px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Expenditure Distribution</h3>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={activeData.breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {activeData.breakdown.map((entry, index) => (
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
                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '0.5rem' }}>₹</span>
                    <input 
                      type="number" 
                      value={editData.totalFund} 
                      onChange={(e) => handleTotalChange(e.target.value)}
                      className="form-control"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', fontSize: '2rem', padding: '0.5rem' }}
                    />
                  </div>
                ) : (
                  `₹${funding.totalFund.toLocaleString('en-IN')}`
                )}
              </div>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '1rem' }}>Category</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeData.breakdown.map((item, index) => (
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
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        {isEditing ? (
                          <input 
                            type="number" 
                            value={item.value} 
                            onChange={(e) => handleChange(item.id, 'value', parseInt(e.target.value))}
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
