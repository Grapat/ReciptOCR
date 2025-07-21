import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Removed useAuth and related imports as per request.
// This component will now manage a local 'isAdmin' state for demonstration.

// Main navigation component
const Navbar = () => {
  const navigate = useNavigate();
  // Local state to simulate user type for demonstration purposes
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu visibility

  // Function to toggle mobile menu visibility
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Function to toggle admin/user view
  const toggleAdminView = () => {
    setIsAdmin(!isAdmin);
    setIsMobileMenuOpen(false); // Close mobile menu when toggling view
  };

  // Navigation items configuration
  const navItems = [
    { name: 'Home', path: '/home', icon: '🏠', show: true }, // Always show Home
    // Show Admin only if isAdmin is true
    { name: 'Admin', path: '/admin', icon: '⚙️', show: isAdmin },
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo/Brand */}
        <div className="text-white text-2xl font-bold rounded-md px-3 py-1 bg-blue-700 hover:bg-blue-900 transition duration-300 cursor-pointer"
             onClick={() => navigate('/home')}> {/* Always navigate to home */}
          ReciptOCR
        </div>
        {/* Desktop navigation links and toggle button */}
        <div className="hidden md:flex items-center space-x-6">
          {navItems.map((item) => (
            item.show && (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                }}
                className="text-white hover:text-blue-200 transition duration-300 flex items-center space-x-2 text-lg font-medium px-3 py-2 rounded-md hover:bg-blue-700"
              >
                <span className="text-xl">{item.icon}</span> {/* Render emoji icon */}
                <span>{item.name}</span>
              </button>
            )
          ))}

          {/* Toggle Admin/User View Button for Desktop */}
          <button
            onClick={toggleAdminView}
            className={`px-4 py-2 rounded-md shadow-md flex items-center space-x-2 text-lg font-medium transition duration-300 ${
              isAdmin ? 'bg-yellow-500 text-black hover:bg-yellow-600' : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <span className="text-xl">{isAdmin ? '👑' : '👤'}</span>
            <span>{isAdmin ? 'Admin View' : 'User View'}</span>
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-blue-700 mt-4 py-2 rounded-lg shadow-xl">
          {navItems.map((item) => (
            item.show && (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false); // Close menu on item click
                }}
                className="block w-full text-left px-4 py-3 text-white hover:bg-blue-600 transition duration-300 flex items-center space-x-3 text-lg font-medium"
              >
                <span className="text-xl">{item.icon}</span> {/* Render emoji icon */}
                <span>{item.name}</span>
              </button>
            )
          ))}

          {/* Toggle Admin/User View Button for Mobile */}
          <button
            onClick={toggleAdminView}
            className={`block w-full text-left px-4 py-3 mt-2 flex items-center space-x-3 text-lg font-medium transition duration-300 ${
              isAdmin ? 'bg-yellow-500 text-black hover:bg-yellow-600' : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <span className="text-xl">{isAdmin ? '👑' : '👤'}</span>
            <span>{isAdmin ? 'Admin View' : 'User View'}</span>
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
