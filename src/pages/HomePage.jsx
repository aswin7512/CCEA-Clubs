import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { isEventOver } from '../lib/eventUtils';
import AnimatedPage from '../components/AnimatedPage';
import AnimatedCounter from '../components/AnimatedCounter';
import { Calendar, MapPin, Users, Zap, Award, ArrowRight } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

const HomePage = () => {
  const { user } = useAuth();
  const [topClubs, setTopClubs] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicStats();
  }, []);

  const fetchPublicStats = async () => {
    try {
      // 1. Fetch upcoming events
      const { data: eventsData } = await supabase.from('events').select('*');
      const allEvents = eventsData || [];
      const upcoming = allEvents.filter(e => !isEventOver(e));
      
      upcoming.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

      const chapterIds = [...new Set(upcoming.map(e => e.chapter_id))];
      let chapterMap = {};
      if (chapterIds.length > 0) {
        const { data: chapters } = await supabase.from('club_chapters').select('id, name').in('id', chapterIds);
        if (chapters) chapters.forEach(c => { chapterMap[c.id] = c.name; });
      }

      const enrichedUpcoming = upcoming.slice(0, 6).map(e => ({
        ...e,
        chapterName: chapterMap[e.chapter_id] || 'Unknown Club',
        isToday: isSameDay(new Date(e.event_date), new Date()),
      }));
      setUpcomingEvents(enrichedUpcoming);

      // 2. Fetch top clubs by member count
      const { data: approvedChapters } = await supabase.from('club_chapters').select('id, name').eq('status', 'approved');
      const { data: approvedMembers } = await supabase.from('club_members').select('chapter_id').eq('status', 'approved');

      if (approvedChapters && approvedMembers) {
        const clubsWithCounts = approvedChapters.map(c => {
          const count = approvedMembers.filter(m => m.chapter_id === c.id).length;
          return { id: c.id, name: c.name, memberCount: count };
        });
        clubsWithCounts.sort((a, b) => b.memberCount - a.memberCount);
        setTopClubs(clubsWithCounts.slice(0, 5));
      }

    } catch (err) {
      console.error('Failed to fetch public stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <AnimatedPage>
      {/* ═══ HERO ═══ */}
      <section className="hero">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <motion.h1 variants={item} className="hero-title">
            Maker Clubs
          </motion.h1>

          <motion.p variants={item} className="hero-subtitle">
            Find clubs. Join events. Build things.
          </motion.p>

          <motion.div variants={item} className="hero-actions">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary">
                Go to Dashboard <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary">
                  Get Started <ArrowRight size={18} />
                </Link>
                <Link to="/login" className="btn btn-outline">
                  Sign In
                </Link>
              </>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ ROSTER (Replaces Stats) ═══ */}
      <section className="stats-section container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="section-label">The Clubs</p>
          <h2 className="section-title">Who's Building What</h2>
        </motion.div>

        <motion.div
          className="club-roster"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
        >
          {topClubs.map((club, index) => (
            <Link to={`/club/${club.id}`} key={club.id} style={{ textDecoration: 'none' }}>
              <motion.div variants={item} className="club-roster-item" whileHover={{ scale: 1.02, backgroundColor: 'var(--input-bg)' }}>
                <div className="club-roster-rank">#{index + 1}</div>
                <div className="club-roster-name">{club.name}</div>
                <div className="club-roster-count">
                  <Users size={16} />
                  {club.memberCount}
                </div>
              </motion.div>
            </Link>
          ))}
          {topClubs.length === 0 && !loading && (
            <div className="empty-state">No active clubs yet.</div>
          )}
        </motion.div>
      </section>

      {/* ═══ UPCOMING / LIVE EVENTS ═══ */}
      {upcomingEvents.length > 0 && (
        <section className="events-section container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
          >
            <p className="section-label" style={{ textAlign: 'center' }}>Events</p>
            <h2 className="section-title" style={{ textAlign: 'center' }}>Coming Up</h2>
          </motion.div>

          <motion.div
            className="events-grid"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-50px' }}
          >
            {upcomingEvents.map((event) => (
              <motion.div
                key={event.id}
                variants={item}
                whileHover="hover"
                initial="rest"
                animate="rest"
              >
                <motion.div className="event-card" variants={cardHover}>
                  <div>
                    <div className="event-card-header">
                      <h4 className="event-card-title">{event.name}</h4>
                      {event.isToday ? (
                        <span className="badge badge-live">LIVE</span>
                      ) : (
                        <span className="badge badge-success">Upcoming</span>
                      )}
                    </div>
                    <p className="event-card-club">{event.chapterName}</p>
                    <div className="event-card-meta">
                      <span>
                        <Calendar size={14} />
                        {formatDate(event.event_date)}
                      </span>
                      {event.venue && (
                        <span>
                          <MapPin size={14} />
                          {event.venue}
                        </span>
                      )}
                      {event.is_during_class_hours ? (
                        <span>
                          <Zap size={14} />
                          Class Hours: {event.class_hours?.join(', ')}
                        </span>
                      ) : event.start_time && (
                        <span>
                          <Zap size={14} />
                          {event.start_time} – {event.end_time}
                        </span>
                      )}
                    </div>
                  </div>

                  {user ? (
                    <Link
                      to={`/event/${event.id}`}
                      className="btn btn-outline"
                      style={{ width: '100%', fontSize: '0.875rem', textDecoration: 'none' }}
                    >
                      View Details & Register
                    </Link>
                  ) : (
                    <Link
                      to="/login"
                      className="btn btn-ghost"
                      style={{ width: '100%', fontSize: '0.875rem', textDecoration: 'none' }}
                    >
                      Sign in to Register
                    </Link>
                  )}
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* ═══ FOOTER ═══ */}
      <footer className="footer" style={{ textAlign: 'center', padding: '2rem', borderTop: '1px solid var(--input-border)', marginTop: '4rem' }}>
        <p className="footer-text" style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          <span>CCEA</span> — Maker Clubs
        </p>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Made by Lunarmist-byte
          <span style={{ margin: '0 8px' }}>|</span>
          <a href="https://github.com/Lunarmist-byte" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>GitHub</a>
          <span style={{ margin: '0 8px' }}>|</span>
          <a href="https://www.linkedin.com/in/amal-s-kumar-ba69a1290/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>LinkedIn</a>
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          and aswin7512
          <span style={{ margin: '0 8px' }}>|</span>
          <a href="https://github.com/aswin7512/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>GitHub</a>
          <span style={{ margin: '0 8px' }}>|</span>
          <a href="https://www.linkedin.com/in/aswinrd/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>LinkedIn</a>
        </div>
      </footer>
    </AnimatedPage>
  );
};

export default HomePage;
