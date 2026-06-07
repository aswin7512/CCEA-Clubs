import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Edit2, Save, Printer, X, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const initialContactsData = [
  { id: 1, role: 'Chief Coordinator', name: 'John Doe', email: 'john@makerclubs.edu', phone: '+1 234 567 8900' },
  { id: 2, role: 'Faculty Advisor', name: 'Dr. Smith', email: 'smith@makerclubs.edu', phone: '+1 234 567 8901' },
];

const ContactUsPage = () => {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState(initialContactsData);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState([]);

  const isSuperAdmin = profile?.role === 'super_admin';
  const canPrint = profile?.role === 'faculty' || profile?.role === 'super_admin';

  const handleEdit = () => {
    setEditData([...contacts]);
    setIsEditing(true);
  };

  const handleSave = () => {
    setContacts([...editData]);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleChange = (id, field, value) => {
    setEditData(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddContact = () => {
    const newId = editData.length > 0 ? Math.max(...editData.map(c => c.id)) + 1 : 1;
    setEditData([...editData, { id: newId, role: '', name: '', email: '', phone: '' }]);
  };

  const handleRemoveContact = (id) => {
    setEditData(prev => prev.filter(c => c.id !== id));
  };

  const handlePrint = () => {
    const doc = new jsPDF();
    doc.text("Maker Clubs - Contact Directory", 14, 15);
    
    const tableColumn = ["Role", "Name", "Email", "Phone Number"];
    const tableRows = [];

    contacts.forEach(contact => {
      tableRows.push([contact.role, contact.name, contact.email, contact.phone]);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 25,
      theme: 'grid',
      headStyles: { fillColor: [52, 152, 219] },
    });

    doc.save(`contacts_directory_${new Date().getTime()}.pdf`);
  };

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
            <h2>Contact Directory</h2>
            <p className="text-secondary">Reach out to our club coordinators and faculty advisors.</p>
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

        <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {(isEditing ? editData : contacts).map((contact) => (
            <div key={contact.id} className="card" style={{ backgroundColor: 'var(--bg-secondary)', position: 'relative' }}>
              {isEditing && (
                <button 
                  onClick={() => handleRemoveContact(contact.id)}
                  style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}
                  title="Remove Contact"
                >
                  <Trash2 size={18} />
                </button>
              )}
              
              <div style={{ marginBottom: '1rem' }}>
                <label className="text-secondary" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Role</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={contact.role} 
                    onChange={(e) => handleChange(contact.id, 'role', e.target.value)}
                    className="form-control"
                    placeholder="Role"
                  />
                ) : (
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary-color)' }}>{contact.role || '-'}</div>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="text-secondary" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Name</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={contact.name} 
                    onChange={(e) => handleChange(contact.id, 'name', e.target.value)}
                    className="form-control"
                    placeholder="Name"
                  />
                ) : (
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{contact.name || '-'}</div>
                )}
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <label className="text-secondary" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Email</label>
                {isEditing ? (
                  <input 
                    type="email" 
                    value={contact.email} 
                    onChange={(e) => handleChange(contact.id, 'email', e.target.value)}
                    className="form-control"
                    placeholder="Email Address"
                  />
                ) : (
                  <div><a href={`mailto:${contact.email}`} style={{ color: 'var(--text-primary)' }}>{contact.email || '-'}</a></div>
                )}
              </div>

              <div>
                <label className="text-secondary" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Phone</label>
                {isEditing ? (
                  <input 
                    type="tel" 
                    value={contact.phone} 
                    onChange={(e) => handleChange(contact.id, 'phone', e.target.value)}
                    className="form-control"
                    placeholder="Phone Number"
                  />
                ) : (
                  <div>{contact.phone || '-'}</div>
                )}
              </div>
            </div>
          ))}

          {isEditing && (
            <div 
              className="card flex-center" 
              style={{ backgroundColor: 'transparent', border: '2px dashed var(--border-color)', cursor: 'pointer', minHeight: '250px' }}
              onClick={handleAddContact}
            >
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Plus size={40} style={{ margin: '0 auto 1rem' }} />
                <p>Add New Contact</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ContactUsPage;
