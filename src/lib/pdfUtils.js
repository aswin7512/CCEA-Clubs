import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateAttendancePDF = (event, registrations) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`Attendance Report: ${event.name}`, 14, 22);
  
  const chapterName = event.chapter?.name || 'N/A';
  const eventDateStr = event.event_date ? new Date(event.event_date).toLocaleDateString() : 'N/A';
  
  let headerMetaText = `Chapter: ${chapterName} | Date: ${eventDateStr}`;
  if (!event.is_during_class_hours && event.start_time && event.end_time) {
    const formatTime12Hr = (t) => {
      if (!t) return '';
      const p = t.split(':');
      if (p.length < 2) return t;
      let hours = parseInt(p[0], 10);
      const minutes = p[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    };
    headerMetaText += ` (${formatTime12Hr(event.start_time)} - ${formatTime12Hr(event.end_time)})`;
  }
  
  doc.setFontSize(12);
  doc.text(headerMetaText, 14, 30);

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
      margin: { bottom: 20 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.cell.raw === 'Present') {
            data.cell.styles.textColor = [16, 185, 129]; // Green (#10b981)
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'Absent') {
            data.cell.styles.textColor = [239, 68, 68]; // Red (#ef4444)
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
  });

  doc.save(`${event.name.replace(/\\s+/g, '_')}_Attendance.pdf`);
};
