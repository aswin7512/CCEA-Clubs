import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Sun, Moon, LogOut, User, LayoutDashboard, Shield } from 'lucide-react';

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="nav-brand">
        <div className="nav-brand-icon">M</div>
        Maker Clubs
      </Link>

      <button
        className={`nav-hamburger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
        <Link
          to="/"
          className={`nav-link ${isActive('/') ? 'active' : ''}`}
        >
          Home
        </Link>
        <Link
          to="/clubs-details"
          className={`nav-link ${isActive('/clubs-details') ? 'active' : ''}`}
        >
          Clubs
        </Link>
        <Link
          to="/funding"
          className={`nav-link ${isActive('/funding') ? 'active' : ''}`}
        >
          Funding
        </Link>
        <Link
          to="/contact"
          className={`nav-link ${isActive('/contact') ? 'active' : ''}`}
        >
          Contact
        </Link>

        {user ? (
          <>
            <Link
              to="/dashboard"
              className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
            >
              <LayoutDashboard size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Dashboard
            </Link>
            {profile?.role === 'super_admin' && (
              <Link
                to="/admin"
                className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
              >
                <Shield size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Admin Panel
              </Link>
            )}
            <Link
              to="/profile"
              className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
            >
              <User size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="btn btn-ghost"
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            >
              <LogOut size={15} />
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className={`nav-link ${isActive('/login') ? 'active' : ''}`}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn btn-primary"
              style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem', textDecoration: 'none' }}
            >
              Get Started
            </Link>
          </>
        )}

        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
