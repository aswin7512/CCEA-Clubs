export const isEventOver = (event) => {
  if (!event) return false;

  const eventDate = new Date(event.event_date);
  const now = new Date();
  
  // Compare dates ignoring time
  eventDate.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  if (eventDate < today) return true;
  if (eventDate > today) return false;
  
  // If it's today, check the time
  if (event.is_during_class_hours) {
    const hours = event.class_hours || [];
    if (hours.length === 0) return true;
    const maxHour = Math.max(...hours);
    
    let endHour = 10;
    if (maxHour === 1) endHour = 10;
    else if (maxHour === 2) endHour = 11;
    else if (maxHour === 3) endHour = 12;
    else if (maxHour === 4) endHour = 14; // 2pm
    else if (maxHour === 5) endHour = 15; // 3pm
    else if (maxHour === 6) endHour = 16; // 4pm
    
    return now.getHours() >= endHour;
  } else {
    if (!event.end_time) return true;
    const [endH, endM] = event.end_time.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    
    if (currentHour > endH) return true;
    if (currentHour === endH && currentMin >= endM) return true;
    return false;
  }
};
