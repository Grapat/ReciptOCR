import React from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import useLocation to determine active link
import '../../App.css'; // Assuming app.css contains styles for nav-button

function NavigationBar() {
  const location = useLocation(); // Get the current location object

  return (
    <div className="navigation-bar">
      <Link
        to="/"
        className={`nav-button ${location.pathname === '/' ? 'active' : ''}`}
      >
        Receipt Scanner
      </Link>
      <Link
        to="/admin"
        className={`nav-button ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
      >
        Admin Page
      </Link>
    </div>
  );
}

export default NavigationBar;