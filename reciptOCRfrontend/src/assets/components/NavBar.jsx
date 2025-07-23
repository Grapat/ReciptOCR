import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/NavBar.css'; // Import the CSS file

const Navbar = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // We no longer need isAdmin state

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navItems = [
    { name: 'Home', path: '/home', show: true },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo/Brand */}
        <div className="navbar-brand" onClick={() => navigate('/home')}>
          ReciptOCR
        </div>

        {/* Mobile menu button */}
        <div className="mobile-menu-button-wrapper">
          <button onClick={toggleMobileMenu} className="mobile-menu-button">
            &#9776; {/* Hamburger icon */}
          </button>
        </div>

        {/* Desktop navigation links and Admin button */}
        <div className="navbar-links">
          {navItems.map((item) => (
            item.show && (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                }}
                className="nav-item-button"
              >
                <span className="nav-item-icon">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            )
          ))}

          {/* Admin Page Button - Always visible and pushed to the right */}
          <button
            onClick={() => navigate('/admin')}
            className="nav-item-button admin-page-button"
          >
            <span className="nav-item-icon">👤</span> {/* Person logo */}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-dropdown">
          {navItems.map((item) => (
            item.show && (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
                className="mobile-item-button"
              >
                <span className="mobile-nav-item-icon">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            )
          ))}

          {/* Admin Page Button for Mobile */}
          <button
            onClick={() => {
              navigate('/admin');
              setIsMobileMenuOpen(false);
            }}
            className="mobile-item-button"
          >
            <span className="mobile-nav-item-icon">👤 admin</span>
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;