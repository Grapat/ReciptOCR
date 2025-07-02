// App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './app.css';

import NavigationBar from './assets/components/NavigationBar';
import ScannerPage from './assets/pages/ScannerPage';
import AdminPage from './assets/pages/AdminPage';
import EditReceiptPage from './assets/pages/EditReceiptPage';

function App() {
  return (
    <Router>
      <div className="app-container">
        <NavigationBar />
        <Routes>
          <Route path="/" element={<ScannerPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/edit/:id" element={<EditReceiptPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;