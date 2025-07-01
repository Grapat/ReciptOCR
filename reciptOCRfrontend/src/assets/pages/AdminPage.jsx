// components/AdminPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import '../css/AdminPage.css';

function AdminPage() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/receipts');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setReceipts(data);
    } catch (err) {
      console.error("Failed to fetch receipts:", err);
      setError("Failed to load receipts. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllReceipts();
  }, [fetchAllReceipts]);

  const handleDeleteReceipt = useCallback(async (id) => {
    if (!window.confirm(`Are you sure you want to delete receipt ID: ${id}?`)) {
      return;
    }

    setLoading(true); // Show loading while deleting
    try {
      const response = await fetch(`http://localhost:5000/api/receipts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete receipt.');
      }

      // If delete is successful, re-fetch all receipts to update the list
      await fetchAllReceipts();
      alert('Receipt deleted successfully!'); // Use alert for simple confirmation
    } catch (err) {
      console.error("Error deleting receipt:", err);
      setError(`Failed to delete receipt: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchAllReceipts]);

  // Note: For actual admin page, you'd implement an Edit functionality
  // which might navigate to a specific edit form or open a modal.
  const handleEditReceipt = (id) => {
    alert(`Edit functionality for ID: ${id} not yet implemented.`);
    // You would typically navigate to an edit page or open a modal here
  };


  return (
    <div className="admin-page-container card-container">
      <h2 className="admin-page-title">Admin Dashboard - All Receipts</h2>

      {loading && <p className="status-message">Loading receipts...</p>}
      {error && <p className="status-message error">{error}</p>}

      {!loading && !error && receipts.length === 0 && (
        <p className="status-message">No receipts found in the database.</p>
      )}

      {!loading && !error && receipts.length > 0 && (
        <div className="receipts-table-wrapper">
          <table className="receipts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Merchant Name</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Gas Provider</th>
                {/* Add more columns as needed */}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td>{receipt.id.substring(0, 8)}...</td> {/* Show truncated ID */}
                  <td>{receipt.merchantName || 'N/A'}</td>
                  <td>{receipt.transactionDate ? new Date(receipt.transactionDate).toLocaleDateString() : 'N/A'}</td>
                  <td>{receipt.amount !== null ? parseFloat(receipt.amount).toLocaleString() : 'N/A'}</td>
                  <td>{receipt.gasProvider || 'N/A'}</td>
                  {/* Add more columns here */}
                  <td className="actions-cell">
                    <button onClick={() => handleEditReceipt(receipt.id)} className="action-button edit-button">Edit</button>
                    <button onClick={() => handleDeleteReceipt(receipt.id)} className="action-button delete-button">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminPage;