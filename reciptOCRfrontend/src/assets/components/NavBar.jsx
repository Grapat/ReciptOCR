import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext'; // Assuming AuthContext is in ../context/AuthContext
// Removed lucide-react import

// Main navigation component
const Navbar = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth(); // Get user and logout function from AuthContext
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State for mobile menu visibility

    // Function to handle logout
    const handleLogout = () => {
        logout(); // Call the logout function from AuthContext
        navigate('/login'); // Redirect to login page after logout
        setIsMobileMenuOpen(false); // Close mobile menu on logout
    };

    // Function to toggle mobile menu visibility
    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    // Navigation items configuration
    const navItems = [
        { name: 'Home', path: '/home', icon: '🏠', show: true }, // Using emoji for Home icon
        { name: 'Admin', path: '/admin', icon: '⚙️', show: user?.userType === 'admin' }, // Using emoji for Admin icon
    ];

    return (
        <nav className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 shadow-lg">
            <div className="container mx-auto flex justify-between items-center">
                {/* Logo/Brand */}
                <div className="text-white text-2xl font-bold rounded-md px-3 py-1 bg-blue-700 hover:bg-blue-900 transition duration-300 cursor-pointer"
                    onClick={() => navigate(user ? (user.userType === 'admin' ? '/admin' : '/home') : '/login')}>
                    ReciptOCR
                </div>

                {/* Mobile menu button (hamburger icon) */}
                <div className="md:hidden">
                    <button onClick={toggleMobileMenu} className="text-white focus:outline-none">
                        {isMobileMenuOpen ? <span className="text-3xl">✖️</span> : <span className="text-3xl">☰</span>} {/* Emojis for close/menu */}
                    </button>
                </div>

                {/* Desktop navigation links */}
                <div className="hidden md:flex items-center space-x-6">
                    {navItems.map((item) => (
                        item.show && (
                            <button
                                key={item.name}
                                onClick={() => {
                                    navigate(item.path);
                                    setIsMobileMenuOpen(false); // Close mobile menu if clicked from desktop (just in case)
                                }}
                                className="text-white hover:text-blue-200 transition duration-300 flex items-center space-x-2 text-lg font-medium px-3 py-2 rounded-md hover:bg-blue-700"
                            >
                                <span className="text-xl">{item.icon}</span> {/* Render emoji icon */}
                                <span>{item.name}</span>
                            </button>
                        )
                    ))}

                    {/* Conditional Login/Logout Button */}
                    {user ? (
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 text-white hover:bg-red-600 transition duration-300 px-4 py-2 rounded-md shadow-md flex items-center space-x-2 text-lg font-medium"
                        >
                            <span className="text-xl">➡️</span> {/* Emoji for Logout icon */}
                            <span>Logout</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                navigate('/login');
                                setIsMobileMenuOpen(false);
                            }}
                            className="bg-green-500 text-white hover:bg-green-600 transition duration-300 px-4 py-2 rounded-md shadow-md flex items-center space-x-2 text-lg font-medium"
                        >
                            <span className="text-xl">⬅️</span> {/* Emoji for Login icon */}
                            <span>Login</span>
                        </button>
                    )}
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

                    {/* Conditional Login/Logout Button for Mobile */}
                    {user ? (
                        <button
                            onClick={handleLogout}
                            className="block w-full text-left px-4 py-3 text-white bg-red-500 hover:bg-red-600 transition duration-300 mt-2 flex items-center space-x-3 text-lg font-medium"
                        >
                            <span className="text-xl">➡️</span> {/* Emoji for Logout icon */}
                            <span>Logout</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                navigate('/login');
                                setIsMobileMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-3 text-white bg-green-500 hover:bg-green-600 transition duration-300 mt-2 flex items-center space-x-3 text-lg font-medium"
                        >
                            <span className="text-xl">⬅️</span> {/* Emoji for Login icon */}
                            <span>Login</span>
                        </button>
                    )}
                </div>
            )}
        </nav>
    );
};

export default Navbar;
