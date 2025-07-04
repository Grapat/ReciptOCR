import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from "../../api";
import '../../App.css';

function AdminPage() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();
  const fetchAllReceipts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatusMessage('');
    setIsError(false);
    try {
      const response = await fetch(`${API}/api/receipts`);
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

    setLoading(true);
    setStatusMessage('Deleting receipt...');
    setIsError(false);
    try {
      const response = await fetch(`${API}/api/receipts/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete receipt.');
      }

      await fetchAllReceipts(); // Refetch all receipts to update the list
      setStatusMessage('Receipt deleted successfully!');
      setIsError(false);
    } catch (err) {
      console.error("Failed to delete receipt:", err);
      setStatusMessage(`Error deleting receipt: ${err.message}`);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchAllReceipts]);

  // Modified handleEditReceipt to navigate to the new edit page
  const handleEditReceipt = useCallback((id) => {
    navigate(`/admin/edit/${id}`);
  }, [navigate]);

  return (
    <div className="admin-page-container">
      <h2>จัดการใบเสร็จ (Admin)</h2>

      {statusMessage && (
        <p className={`status-message ${isError ? 'status-message-error' : 'status-message-success'}`}>
          {statusMessage}
        </p>
      )}

      {loading && <p>Loading receipts...</p>}
      {error && <p className="status-message status-message-error">{error}</p>}

      {!loading && !error && (
        <div className="receipts-table-wrapper">
          <table className="receipts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Merchant Name</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Gas Provider</th>
                <th>Receipt No.</th>
                <th>Plate No.</th>
                <th>Gas Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center' }}>No receipts found.</td>
                </tr>
              ) : (
                receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>{receipt.id.substring(0, 8)}...</td>
                    <td>{receipt.merchantName || 'N/A'}</td>
                    <td>{receipt.transactionDate ? new Date(receipt.transactionDate).toLocaleDateString('th-TH') : 'N/A'}</td>
                    <td>{receipt.amount !== null ? parseFloat(receipt.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</td>
                    <td>{receipt.gasProvider || 'N/A'}</td>
                    <td>{receipt.receiptNo || 'N/A'}</td>
                    <td>{receipt.plateNo || 'N/A'}</td>
                    <td>{receipt.gasType || 'N/A'}</td>
                    <td className="actions-cell">
                      <button onClick={() => handleEditReceipt(receipt.id)} className="action-button edit-button">Edit</button>
                      <button onClick={() => handleDeleteReceipt(receipt.id)} className="action-button delete-button">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminPage;