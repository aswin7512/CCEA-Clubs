import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Edit2, Save, X, Check, HelpCircle } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

const SuperAdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('chapters');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab Data States
  const [chapters, setChapters] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [funding, setFunding] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [clubsList, setClubsList] = useState([]);

  // Modals & Action States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // stores { type, data }
  const [newItem, setNewItem] = useState({});
  const [deleteConfirmation, setDeleteConfirmation] = useState(null); // { table, id }
  const [operationMessage, setOperationMessage] = useState(null); // { type: 'success' | 'error', text }

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'chapters') {
        const { data, error } = await supabase
          .from('club_chapters')
          .select(`
            id,
            name,
            description,
            academic_year,
            status,
            created_at,
            campus_lead_id,
            profiles:campus_lead_id (name, email)
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setChapters(data || []);
      } else if (activeTab === 'clubs') {
        const { data, error } = await supabase
          .from('clubs_directory')
          .select('*')
          .order('id', { ascending: true });
        if (error) throw error;
        setClubs(data || []);
      } else if (activeTab === 'funding') {
        const { data, error } = await supabase
          .from('funding_breakdown')
          .select('*')
          .order('id', { ascending: true });
        if (error) throw error;
        setFunding(data || []);

        const { data: clubsData } = await supabase
          .from('clubs_directory')
          .select('id, name')
          .order('name', { ascending: true });
        setClubsList(clubsData || []);
      } else if (activeTab === 'contacts') {
        const { data, error } = await supabase
          .from('contacts_directory')
          .select('*')
          .order('id', { ascending: true });
        if (error) throw error;
        setContacts(data || []);
      }
    } catch (err) {
      console.error(`Error fetching ${activeTab}:`, err);
      setError(err.message || `Failed to fetch ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  // Chapter handlers
  const handleUpdateChapterStatus = async (id, newStatus, leadId) => {
    try {
      const { error } = await supabase
        .from('club_chapters')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      if (newStatus === 'approved' && leadId) {
        const { error: memberError } = await supabase
          .from('club_members')
          .upsert({
            chapter_id: id,
            user_id: leadId,
            role: 'lead',
            status: 'approved'
          }, { onConflict: 'chapter_id,user_id' });

        if (memberError) console.error('Failed to add lead as member:', memberError);
      }
      setChapters(chapters.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      setOperationMessage({ type: 'error', text: 'Failed to update chapter status: ' + err.message });
    }
  };

  // Generic delete handler
  const handleDelete = (table, id) => {
    setDeleteConfirmation({ table, id });
  };

  const confirmDeleteAction = async () => {
    if (!deleteConfirmation) return;
    const { table, id } = deleteConfirmation;
    setDeleteConfirmation(null);
    setLoading(true);
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;

      setOperationMessage({ type: 'success', text: 'Entry deleted successfully.' });
      fetchData();
    } catch (err) {
      setOperationMessage({ type: 'error', text: 'Delete failed: ' + err.message });
      setLoading(false);
    }
  };

  // Generic insert handler
  const handleInsert = async (e) => {
    e.preventDefault();
    let table = '';
    let payload = {};

    try {
      if (activeTab === 'clubs') {
        table = 'clubs_directory';
        payload = {
          name: newItem.name || 'Unnamed Club',
          next_activity: newItem.next_activity || 'TBD',
          activities_count: parseInt(newItem.activities_count) || 0,
          is_active: newItem.is_active === undefined ? true : newItem.is_active
        };
      } else if (activeTab === 'funding') {
        table = 'funding_breakdown';
        payload = {
          category_name: newItem.category_name || 'General',
          amount: parseInt(newItem.amount) || 0,
          club_id: newItem.club_id || null
        };
      } else if (activeTab === 'contacts') {
        table = 'contacts_directory';
        payload = {
          role: newItem.role || '',
          name: newItem.name || '',
          email: newItem.email || '',
          phone: newItem.phone || ''
        };
      }

      const { error } = await supabase.from(table).insert([payload]);
      if (error) throw error;

      setShowAddModal(false);
      setNewItem({});
      fetchData();
    } catch (err) {
      setOperationMessage({ type: 'error', text: 'Failed to insert: ' + err.message });
    }
  };

  // Generic update handler
  const handleUpdate = async (e) => {
    e.preventDefault();
    let table = '';
    let payload = {};
    const id = editingItem.data.id;

    try {
      if (editingItem.type === 'clubs') {
        table = 'clubs_directory';
        payload = {
          name: editingItem.data.name,
          next_activity: editingItem.data.next_activity,
          activities_count: parseInt(editingItem.data.activities_count) || 0,
          is_active: editingItem.data.is_active
        };
      } else if (editingItem.type === 'funding') {
        table = 'funding_breakdown';
        payload = {
          category_name: editingItem.data.category_name,
          amount: parseInt(editingItem.data.amount) || 0,
          club_id: editingItem.data.club_id || null
        };
      } else if (editingItem.type === 'contacts') {
        table = 'contacts_directory';
        payload = {
          role: editingItem.data.role,
          name: editingItem.data.name,
          email: editingItem.data.email,
          phone: editingItem.data.phone
        };
      }

      const { error } = await supabase.from(table).update(payload).eq('id', id);
      if (error) throw error;

      setEditingItem(null);
      fetchData();
    } catch (err) {
      setOperationMessage({ type: 'error', text: 'Failed to update: ' + err.message });
    }
  };

  const openAddModal = () => {
    if (activeTab === 'clubs') {
      setNewItem({ name: '', next_activity: '', activities_count: 0, is_active: true });
    } else if (activeTab === 'funding') {
      setNewItem({ category_name: '', amount: 0, club_id: '' });
    } else if (activeTab === 'contacts') {
      setNewItem({ role: '', name: '', email: '', phone: '' });
    }
    setShowAddModal(true);
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'chapters', label: 'Club Chapters' },
          { id: 'clubs', label: 'Clubs Directory' },
          { id: 'funding', label: 'Funding Overview' },
          { id: 'contacts', label: 'Contacts Directory' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
            style={{
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              marginBottom: '-1px',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary-color)' : 'none'
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Header and Insert Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ margin: 0 }}>
          {activeTab === 'chapters' && 'Club Chapters Requests'}
          {activeTab === 'clubs' && 'Manage Clubs Directory'}
          {activeTab === 'funding' && 'Manage Funding Breakdown'}
          {activeTab === 'contacts' && 'Manage Contacts Directory'}
        </h3>

        {activeTab !== 'chapters' && (
          <motion.button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={openAddModal}
            whileTap={{ scale: 0.97 }}
          >
            <Plus size={16} /> Add Entry
          </motion.button>
        )}
      </div>

      {operationMessage && (
        <div className={`alert alert-${operationMessage.type === 'success' ? 'success' : 'danger'}`} style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{operationMessage.type === 'success' ? 'Success:' : 'Error:'}</strong> {operationMessage.text}
          </div>
          <button className="btn btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setOperationMessage(null)}><X size={16} /></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Error:</strong> {error}
            {activeTab === 'clubs' && <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>If this table does not exist, run init.sql updates in Supabase.</p>}
            {activeTab === 'funding' && <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>If this table does not exist, run init.sql updates in Supabase.</p>}
          </div>
          <button className="btn btn-ghost" style={{ padding: '0.2rem' }} onClick={() => fetchData()}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="loader-container" style={{ minHeight: '200px' }}>
          <div className="loader"></div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* CHAPTERS TAB */}
          {activeTab === 'chapters' && (
            <motion.div key="chapters" variants={container} initial="hidden" animate="show" style={{ display: 'grid', gap: '1rem' }}>
              {chapters.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏛️</div>
                  <p>No club chapters found.</p>
                </div>
              ) : (
                chapters.map(chapter => (
                  <motion.div
                    key={chapter.id}
                    variants={item}
                    style={{
                      padding: '1.25rem',
                      border: '1px solid var(--input-border)',
                      borderRadius: '1rem',
                      backgroundColor: 'var(--input-bg)',
                      transition: 'all 0.3s ease',
                    }}
                    whileHover={{ scale: 1.005, boxShadow: 'var(--glass-shadow-hover)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: '0 0 0.25rem 0' }}>{chapter.name} ({chapter.academic_year})</h4>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{chapter.description}</p>
                        <p style={{ fontSize: '0.875rem' }}>
                          <strong>Campus Lead:</strong> {chapter.profiles?.name} ({chapter.profiles?.email})
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                        <span className={`badge ${chapter.status === 'approved' ? 'badge-success' : chapter.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {chapter.status}
                        </span>

                        {chapter.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <motion.button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.85rem', fontSize: '0.85rem' }}
                              onClick={() => handleUpdateChapterStatus(chapter.id, 'approved', chapter.campus_lead_id)}
                              whileTap={{ scale: 0.95 }}
                            >
                              Approve
                            </motion.button>
                            <motion.button
                              className="btn btn-ghost"
                              style={{ padding: '0.3rem 0.85rem', fontSize: '0.85rem', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                              onClick={() => handleUpdateChapterStatus(chapter.id, 'rejected', chapter.campus_lead_id)}
                              whileTap={{ scale: 0.95 }}
                            >
                              Reject
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {/* CLUBS TAB */}
          {activeTab === 'clubs' && (
            <motion.div key="clubs" variants={container} initial="hidden" animate="show">
              {clubs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🛡️</div>
                  <p>No clubs found in the directory.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem' }}>ID</th>
                        <th style={{ padding: '0.75rem' }}>Club Name</th>
                        <th style={{ padding: '0.75rem' }}>Next Activity</th>
                        <th style={{ padding: '0.75rem' }}>Activities Count</th>
                        <th style={{ padding: '0.75rem' }}>Status</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clubs.map(club => (
                        <tr key={club.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem' }}>{club.id}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{club.name}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{club.next_activity || 'TBD'}</td>
                          <td style={{ padding: '0.75rem' }}>{club.activities_count}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span className={`badge ${club.is_active ? 'badge-success' : 'badge-warning'}`}>
                              {club.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem' }}
                                onClick={() => setEditingItem({ type: 'clubs', data: { ...club } })}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem', color: 'var(--danger-color)' }}
                                onClick={() => handleDelete('clubs_directory', club.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* FUNDING TAB */}
          {activeTab === 'funding' && (
            <motion.div key="funding" variants={container} initial="hidden" animate="show">
              {funding.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">💰</div>
                  <p>No funding entries found.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem' }}>ID</th>
                        <th style={{ padding: '0.75rem' }}>Category Name</th>
                        <th style={{ padding: '0.75rem' }}>Associated Club</th>
                        <th style={{ padding: '0.75rem' }}>Amount Spent</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funding.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.id.slice(0, 8)}...</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{item.category_name}</td>
                          <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                            {clubsList.find(c => c.id === item.club_id)?.name || <span className="text-secondary" style={{ fontStyle: 'italic' }}>General / None</span>}
                          </td>
                          <td style={{ padding: '0.75rem', color: 'var(--success-color)' }}>₹{item.amount.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem' }}
                                onClick={() => setEditingItem({ type: 'funding', data: item })}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem', color: 'var(--danger-color)' }}
                                onClick={() => handleDelete('funding_breakdown', item.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* CONTACTS TAB */}
          {activeTab === 'contacts' && (
            <motion.div key="contacts" variants={container} initial="hidden" animate="show">
              {contacts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📞</div>
                  <p>No contacts found.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem' }}>ID</th>
                        <th style={{ padding: '0.75rem' }}>Role</th>
                        <th style={{ padding: '0.75rem' }}>Name</th>
                        <th style={{ padding: '0.75rem' }}>Email</th>
                        <th style={{ padding: '0.75rem' }}>Phone</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map(contact => (
                        <tr key={contact.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem' }}>{contact.id}</td>
                          <td style={{ padding: '0.75rem', fontWeight: 600 }}>{contact.role}</td>
                          <td style={{ padding: '0.75rem' }}>{contact.name}</td>
                          <td style={{ padding: '0.75rem' }}>{contact.email || '-'}</td>
                          <td style={{ padding: '0.75rem' }}>{contact.phone || '-'}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem' }}
                                onClick={() => setEditingItem({ type: 'contacts', data: contact })}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '0.3rem', color: 'var(--danger-color)' }}
                                onClick={() => handleDelete('contacts_directory', contact.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ADD ENTRY MODAL */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <motion.div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '2rem' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Add New {activeTab === 'clubs' ? 'Club' : activeTab === 'funding' ? 'Funding Category' : 'Contact'}</h3>
              <button className="btn btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleInsert}>
              {activeTab === 'clubs' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Club Name</label>
                    <input type="text" className="form-control" required value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Art Club" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Activity</label>
                    <input type="text" className="form-control" value={newItem.next_activity} onChange={e => setNewItem({ ...newItem, next_activity: e.target.value })} placeholder="e.g. Painting Contest" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Activities Count</label>
                    <input type="number" className="form-control" value={newItem.activities_count} onChange={e => setNewItem({ ...newItem, activities_count: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                    <input type="checkbox" id="club_is_active" checked={newItem.is_active} onChange={e => setNewItem({ ...newItem, is_active: e.target.checked })} />
                    <label htmlFor="club_is_active" style={{ cursor: 'pointer' }}>Is Active</label>
                  </div>
                </>
              )}

              {activeTab === 'funding' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Category / Activity Name</label>
                    <input type="text" className="form-control" required value={newItem.category_name} onChange={e => setNewItem({ ...newItem, category_name: e.target.value })} placeholder="e.g. Lab Equipment" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Associated Club</label>
                    <select 
                      className="form-control" 
                      value={newItem.club_id || ''} 
                      onChange={e => setNewItem({ ...newItem, club_id: e.target.value || null })}
                    >
                      <option value="">General / None</option>
                      {clubsList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount spent (₹)</label>
                    <input type="number" className="form-control" required value={newItem.amount} onChange={e => setNewItem({ ...newItem, amount: parseInt(e.target.value) || 0 })} />
                  </div>
                </>
              )}

              {activeTab === 'contacts' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <input type="text" className="form-control" required value={newItem.role} onChange={e => setNewItem({ ...newItem, role: e.target.value })} placeholder="e.g. Technical Lead" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input type="text" className="form-control" required value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={newItem.email} onChange={e => setNewItem({ ...newItem, email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="text" className="form-control" value={newItem.phone} onChange={e => setNewItem({ ...newItem, phone: e.target.value })} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add Entry</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* EDIT ENTRY MODAL */}
      {editingItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <motion.div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '2rem' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Edit {editingItem.type === 'clubs' ? 'Club' : editingItem.type === 'funding' ? 'Funding' : 'Contact'}</h3>
              <button className="btn btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setEditingItem(null)}><X size={20} /></button>
            </div>

            <form onSubmit={handleUpdate}>
              {editingItem.type === 'clubs' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Club Name</label>
                    <input type="text" className="form-control" required value={editingItem.data.name} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Activity</label>
                    <input type="text" className="form-control" value={editingItem.data.next_activity} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, next_activity: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Activities Count</label>
                    <input type="number" className="form-control" value={editingItem.data.activities_count} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, activities_count: parseInt(e.target.value) || 0 } })} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                    <input type="checkbox" id="edit_club_is_active" checked={editingItem.data.is_active} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, is_active: e.target.checked } })} />
                    <label htmlFor="edit_club_is_active" style={{ cursor: 'pointer' }}>Is Active</label>
                  </div>
                </>
              )}

              {editingItem.type === 'funding' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Category Name</label>
                    <input type="text" className="form-control" required value={editingItem.data.category_name} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, category_name: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Associated Club</label>
                    <select 
                      className="form-control" 
                      value={editingItem.data.club_id || ''} 
                      onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, club_id: e.target.value || null } })}
                    >
                      <option value="">General / None</option>
                      {clubsList.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount spent (₹)</label>
                    <input type="number" className="form-control" required value={editingItem.data.amount} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, amount: parseInt(e.target.value) || 0 } })} />
                  </div>
                </>
              )}

              {editingItem.type === 'contacts' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <input type="text" className="form-control" required value={editingItem.data.role} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, role: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input type="text" className="form-control" required value={editingItem.data.name} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, name: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={editingItem.data.email || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, email: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="text" className="form-control" value={editingItem.data.phone || ''} onChange={e => setEditingItem({ ...editingItem, data: { ...editingItem.data, phone: e.target.value } })} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditingItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmation && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <motion.div
            className="glass-panel"
            style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '2rem' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--danger-color)' }}>Confirm Deletion</h3>
            <p style={{ marginBottom: '2rem' }}>Are you sure you want to delete this entry? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeleteConfirmation(null)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)', color: 'white' }} 
                onClick={confirmDeleteAction}
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
