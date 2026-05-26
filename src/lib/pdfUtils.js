import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateAttendancePDF = (event, registrations) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`Attendance Report: ${event.name}`, 14, 22);
  
  const chapterName = event.chapter?.name || 'N/A';
  const eventDateStr = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'N/A';
  
  doc.setFontSize(12);
  doc.text(`Chapter: ${chapterName} | Date: ${eventDateStr}`, 14, 30);

  const approvedRegs = (registrations || []).filter(r => r.status === 'approved');
  
  // Group by department
  const byDept = {};
  approvedRegs.forEach(reg => {
    const dept = reg.profiles?.department || 'Other / Not Specified';
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(reg);
  });

  let currentY = 40;

  Object.keys(byDept).sort().forEach(dept => {
    // Add Dept Header
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246); // var(--primary-color) equivalent
    doc.text(`Department: ${dept}`, 14, currentY);
    currentY += 5;

    const regs = byDept[dept].sort((a, b) => {
      const prpA = a.profiles?.prp_code || '';
      const prpB = b.profiles?.prp_code || '';
      return prpA.localeCompare(prpB);
    });
    const body = [];
    let headRow = [];

    if (event.is_during_class_hours) {
      const hours = event.class_hours || [];
      headRow = ['Name of Participant', 'PRP Code', 'Roll Number', ...hours.map(h => `Hour ${h}`)];
      
      regs.forEach(reg => {
        const attended = Array.isArray(reg.attended_hours) ? reg.attended_hours : [];
        
        const row = [
          reg.profiles?.name || 'Unknown',
          reg.profiles?.prp_code || 'N/A',
          reg.profiles?.roll_number || 'N/A'
        ];

        hours.forEach(h => {
          if (attended.includes(h)) {
            row.push('Present');
          } else {
            row.push('Absent');
          }
        });
        
        body.push(row);
      });
    } else {
      headRow = ['Name of Participant', 'PRP Code', 'Roll Number', 'Attendance'];
      regs.forEach(reg => {
        body.push([
          reg.profiles?.name || 'Unknown',
          reg.profiles?.prp_code || 'N/A',
          reg.profiles?.roll_number || 'N/A',
          reg.is_present ? 'Present' : 'Absent'
        ]);
      });
    }

    autoTable(doc, {
      startY: currentY,
      head: [headRow],
      body: body,
      headStyles: { fillColor: [59, 130, 246] },
      margin: { bottom: 20 }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
  });

  doc.save(`${event.name.replace(/\\s+/g, '_')}_Attendance.pdf`);
};
