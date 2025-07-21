import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from "../../api";
import '../css/EditReceiptPage.css';

function EditReceiptPage() {
  const { id } = useParams(); // Get the receipt ID from the URL
  const navigate = useNavigate(); // Hook for navigation
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [editedFields, setEditedFields] = useState({
    merchantName: '',
    transactionDate: '',
    amount: '',
    gasProvider: '',
    gasAddress: '',
    gasTaxId: '',
    receiptNo: '',
    liters: '',
    plateNo: '',
    milestone: '',
    VAT: '',
    gasType: '',
    egatAddressTH: '',
    egatAddressENG: '',
    egatTaxId: '',
    receiptType: ''
  });
  // Function to fetch the specific receipt data
  const fetchReceiptData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatusMessage('');
    setIsError(false);
    try {
      const response = await fetch(`${API}/api/receipts/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch receipt for editing.');
      }
      const data = await response.json();

      // Populate editedFields with fetched data, handling nulls and formatting date
      setEditedFields({
        merchantName: data.merchantName || '',
        transactionDate: data.transactionDate ? new Date(data.transactionDate).toISOString().split('T')[0] : '',
        amount: data.amount !== null ? String(data.amount) : '',
        gasProvider: data.gasProvider || '',
        gasAddress: data.gasAddress || '',
        gasTaxId: data.gasTaxId || '',
        receiptNo: data.receiptNo || '',
        liters: data.liters !== null ? String(data.liters) : '',
        plateNo: data.plateNo || '',
        milestone: data.milestone || '',
        VAT: data.VAT !== null ? String(data.VAT) : '',
        gasType: data.gasType || '',
        egatAddressTH: data.egatAddressTH || '',
        egatAddressENG: data.egatAddressENG || '',
        egatTaxId: data.egatTaxId || '',
        receiptType: data.receiptType || ''
      });
    } catch (err) {
      console.error("Failed to fetch receipt for edit:", err);
      setError(`Error fetching receipt: ${err.message}`);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [id]); // Depend on 'id' so it re-fetches if ID in URL changes

  useEffect(() => {
    if (id) {
      fetchReceiptData();
    } else {
      setError("No receipt ID provided for editing.");
      setIsError(true);
      setLoading(false);
    }
  }, [id, fetchReceiptData]);

  const handleEditFieldChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditedFields(prevFields => ({
      ...prevFields,
      [name]: value,
    }));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    setStatusMessage('Saving changes...');
    setIsError(false);
    setLoading(true);

    // Basic validation for required fields
    const requiredFields = [
      { name: 'merchantName', label: 'Merchant Name' },
      { name: 'transactionDate', label: 'Date' },
      { name: 'amount', label: 'Total Amount' },
      { name: 'receiptNo', label: 'Receipt No.' },
    ];

    for (const field of requiredFields) {
      const value = editedFields[field.name];
      if (value === null || String(value).trim() === '' || String(value).trim().toUpperCase() === 'N/A') {
        setStatusMessage(`Error: '${field.label}' is a required field and cannot be empty.`);
        setIsError(true);
        setLoading(false);
        return;
      }
    }

    const dataToSend = { ...editedFields };

    // Convert empty strings/N/A to null, and numbers from string to float
    Object.keys(dataToSend).forEach(key => {
      if (typeof dataToSend[key] === 'string') {
        const trimmedValue = dataToSend[key].trim();
        if (trimmedValue === '' || trimmedValue.toUpperCase() === 'N/A') {
          dataToSend[key] = null;
        }
      }
      if (['amount', 'liters', 'VAT'].includes(key) && dataToSend[key] !== null) {
        if (typeof dataToSend[key] === 'string') {
          dataToSend[key] = parseFloat(dataToSend[key].replace(/,/g, '')) || null;
        }
        if (isNaN(dataToSend[key])) {
          dataToSend[key] = null;
        }
      }
    });

    try {
      const response = await fetch(`${API}/api/receipts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes.');
      }

      setStatusMessage('Changes saved successfully!');
      setIsError(false);
      // Navigate back to Admin page after successful save
      setTimeout(() => navigate('/admin'), 1500); // Give user time to see message
    } catch (err) {
      console.error("Failed to save changes:", err);
      setStatusMessage(`Error saving changes: ${err.message}`);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, [id, editedFields, navigate]);

  const handleCancelEdit = useCallback(() => {
    navigate('/admin'); // Navigate back to the Admin page
  }, [navigate]);

  if (loading) {
    return <div className="admin-page-container">Loading receipt data...</div>;
  }

  if (error) {
    return (
      <div className="admin-page-container">
        <p className="status-message status-message-error">{error}</p>
        <button onClick={() => navigate('/admin')} className="action-button cancel-button">Back to Admin</button>
      </div>
    );
  }

  return (
    <div className="admin-page-container">
      <h2>แก้ไขใบเสร็จ (ID: {id ? id.substring(0, 8) + '...' : 'N/A'})</h2>

      {statusMessage && (
        <p className={`status-message ${isError ? 'status-message-error' : 'status-message-success'}`}>
          {statusMessage}
        </p>
      )}

      <div className="edit-form-container card-container">
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="merchantName">Merchant Name:</label>
            <input
              type="text"
              id="merchantName"
              name="merchantName"
              value={editedFields.merchantName}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="transactionDate">Date:</label>
            <input
              type="date"
              id="transactionDate"
              name="transactionDate"
              value={editedFields.transactionDate}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="amount">Amount:</label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={editedFields.amount}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="receiptNo">Receipt No.:</label>
            <input
              type="text"
              id="receiptNo"
              name="receiptNo"
              value={editedFields.receiptNo}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="gasProvider">Gas Provider:</label>
            <input
              type="text"
              id="gasProvider"
              name="gasProvider"
              value={editedFields.gasProvider}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="gasAddress">Gas Address:</label>
            <input
              type="text"
              id="gasAddress"
              name="gasAddress"
              value={editedFields.gasAddress}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="gasTaxId">Gas Tax ID:</label>
            <input
              type="text"
              id="gasTaxId"
              name="gasTaxId"
              value={editedFields.gasTaxId}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="liters">Liters:</label>
            <input
              type="number"
              id="liters"
              name="liters"
              value={editedFields.liters}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="plateNo">Plate No.:</label>
            <input
              type="text"
              id="plateNo"
              name="plateNo"
              value={editedFields.plateNo}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="milestone">Milestone:</label>
            <input
              type="text"
              id="milestone"
              name="milestone"
              value={editedFields.milestone}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="VAT">VAT:</label>
            <input
              type="number"
              id="VAT"
              name="VAT"
              value={editedFields.VAT}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="gasType">Gas Type:</label>
            <input
              type="text"
              id="gasType"
              name="gasType"
              value={editedFields.gasType}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="egatAddressTH">EGAT Address TH:</label>
            <input
              type="text"
              id="egatAddressTH"
              name="egatAddressTH"
              value={editedFields.egatAddressTH}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="egatAddressENG">EGAT Address ENG:</label>
            <input
              type="text"
              id="egatAddressENG"
              name="egatAddressENG"
              value={editedFields.egatAddressENG}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="egatTaxId">EGAT Tax ID:</label>
            <input
              type="text"
              id="egatTaxId"
              name="egatTaxId"
              value={editedFields.egatTaxId}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="receiptType">Receipt Type:</label>
            <input
              type="text"
              id="receiptType"
              name="receiptType"
              value={editedFields.receiptType}
              onChange={handleEditFieldChange}
              disabled={loading}
            />
          </div>
        </div>
        <div className="edit-form-actions">
          <button onClick={handleSaveEdit} className="action-button save-button" disabled={loading}>Save Changes</button>
          <button onClick={handleCancelEdit} className="action-button cancel-button" disabled={loading}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default EditReceiptPage;