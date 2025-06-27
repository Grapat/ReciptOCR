// App.jsx
import React, { useState } from 'react';
import './app.css';

function App() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [editableFields, setEditableFields] = useState({
    merchant_name: '',
    date: '',
    total_amount: '',
    gas_provider: '',
    gas_name: '',
    gas_address: '',
    gas_tax_id: '',
    receipt_no: '',
    liters: '',
    plate_no: '',
    milestone: '',
    VAT: '',
    gas_type: '',
    egat_address_th: '',
    egat_address_eng: '',
    egat_tax_id: ''
  });
  const [receiptType, setReceiptType] = useState('generic');

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    clearAllData(); // Always clear state when a new file selection attempt is made

    if (file) {
      if (!file.type.startsWith('image/')) {
        setStatusMessage('Please select an image file (PNG, JPG, JPEG, GIF, WEBP).');
        setIsError(true);
        // Do not proceed with setting file or preview if invalid
        return;
      }
      // If file is valid, proceed
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result);
      reader.readAsDataURL(file);
      setSelectedFile(file);
    }
    // If no file (user cancelled), clearAllData() already took care of it
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setEditableFields(prevFields => ({ ...prevFields, [name]: value }));
  };

  const handleReceiptTypeChange = (e) => {
    setReceiptType(e.target.value);
    setStatusMessage('');
    setIsError(false);
    setExtractedText('');
    setParsedData(null);
    // Reset all editable fields when receipt type changes
    setEditableFields({
      merchant_name: '',
      date: '',
      total_amount: '',
      gas_provider: '',
      gas_name: '',
      gas_address: '',
      gas_tax_id: '',
      receipt_no: '',
      liters: '',
      plate_no: '',
      milestone: '',
      VAT: '',
      gas_type: '',
      egat_address_th: '',
      egat_address_eng: '',
      egat_tax_id: ''
    });
  };

  const handleProcessReceipt = async () => {
    if (!selectedFile) {
      setStatusMessage('Please upload an image first.');
      setIsError(true);
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Processing image and performing OCR...');
    setIsError(false);
    setExtractedText('');
    setParsedData(null);
    // Reset editable fields before new processing starts
    setEditableFields({
      merchant_name: '',
      date: '',
      total_amount: '',
      gas_provider: '',
      gas_name: '',
      gas_address: '',
      gas_tax_id: '',
      receipt_no: '',
      liters: '',
      plate_no: '',
      milestone: '',
      VAT: '',
      gas_type: '',
      egat_address_th: '',
      egat_address_eng: '',
      egat_tax_id: ''
    });

    const formData = new FormData();
    formData.append('receipt_image', selectedFile);
    formData.append('receipt_type', receiptType);

    try {
      // This URL is now consistent with your error message
      console.log(formData)
      const response = await fetch('http://localhost:5000/api/receipts/process-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMessage(data.message);
        setIsError(false);
        setExtractedText(data.extracted_text || 'No text extracted.');
        setParsedData(data.parsed_data);
        // Use the spread operator to correctly update all fields from parsed_data
        // ensuring new fields are included and existing ones are updated.
        setEditableFields(prevFields => ({
          ...prevFields, // Keep existing fields
          ...data.parsed_data // Overlay with new parsed data
        }));
      } else {
        const errorData = await response.json();
        setStatusMessage(`Error: ${errorData.error || 'Unknown error during processing.'}`);
        setIsError(true);
        setExtractedText('');
        setParsedData(null);
        setEditableFields({ // Reset to initial state on error
          merchant_name: '',
          date: '',
          total_amount: '',
          gas_provider: '',
          gas_name: '',
          gas_address: '',
          gas_tax_id: '',
          receipt_no: '',
          liters: '',
          plate_no: '',
          milestone: '',
          VAT: '',
          gas_type: '',
          egat_address_th: '',
          egat_address_eng: '',
          egat_tax_id: ''
        });
      }
    } catch (error) {
      console.error('Network or processing error:', error);
      setStatusMessage('Failed to connect to the backend or process image. Please check console for details.');
      setIsError(true);
      setExtractedText('');
      setParsedData(null);
      setEditableFields({ // Reset to initial state on network/processing error
        merchant_name: '',
        date: '',
        total_amount: '',
        gas_provider: '',
        gas_name: '',
        gas_address: '',
        gas_tax_id: '',
        receipt_no: '',
        liters: '',
        plate_no: '',
        milestone: '',
        VAT: '',
        gas_type: '',
        egat_address_th: '',
        egat_address_eng: '',
        egat_tax_id: ''
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!parsedData || !parsedData.db_receipt_id) {
      setStatusMessage('No receipt to save. Process an image first.');
      setIsError(true);
      return;
    }

    setStatusMessage('Saving changes...');
    setIsError(false);

    // --- CRITICAL CHANGE: Map frontend field names to backend/DB field names ---
    const dataToSend = {
      ...editableFields,
      amount: editableFields.total_amount, // Map total_amount from frontend to 'amount' for DB
      transactionDate: editableFields.date, // Map date from frontend to 'transactionDate' for DB
    };
    // Remove the old keys if they are not needed in the backend
    delete dataToSend.total_amount;
    delete dataToSend.date;
    // --- END CRITICAL CHANGE ---

    try {
      const response = await fetch(`http://localhost:5000/api/receipts/${parsedData.db_receipt_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editableFields),
      });

      if (response.ok) {
        const result = await response.json();
        setStatusMessage(result.message);
        setIsError(false);
        console.log("Updated Receipt:", result.receipt);
        // --- Added: Clear all data after successful save ---
        clearAllData();
        // --- End Added ---
      } else {
        const errorData = await response.json();
        setStatusMessage(`Error saving changes: ${errorData.error || 'Unknown error.'}`);
        setIsError(true);
      }
    } catch (error) {
      console.error('Network error during save:', error);
      setStatusMessage('Failed to connect to the backend to save changes.');
      setIsError(true);
    }
  };

  const clearAllData = () => {
    setImagePreviewUrl(null);
    setSelectedFile(null);
    setStatusMessage('');
    setIsError(false);
    setIsProcessing(false);
    setExtractedText('');
    setParsedData(null);
    setEditableFields({
      merchant_name: '',
      date: '',
      total_amount: '',
      gas_provider: '',
      gas_name: '',
      gas_address: '',
      gas_tax_id: '',
      receipt_no: '',
      liters: '',
      plate_no: '',
      milestone: '',
      VAT: '',
      gas_type: '',
      egat_address_th: '',
      egat_address_eng: '',
      egat_tax_id: ''
    });
  };

  return (
    <>
      <div className="app-container">
        <div className="card-container">
          <h1 className="header-title">
            Receipt Scanner
          </h1>
          <p className="header-description">
            Upload an image of your receipt to extract details.
          </p>

          <div className="form-group receipt-type-select">
            <label htmlFor="receiptType" className="form-label">Select Receipt Type:</label>
            <select
              id="receiptType"
              name="receiptType"
              className="form-input"
              value={receiptType}
              onChange={handleReceiptTypeChange}
            >
              <option value="generic">Generic Receipt</option>
              <option value="PTT-Kbank">PTT-Kbank</option>
              <option value="Bangchak-Kbank">Bangchak-Kbank</option>
              <option value="Bangchak-Krungthai">Bangchak-Krungthai</option>
              <option value="A5">A5</option>
            </select>
          </div>

          <div className="file-input-wrapper">
            <input
              type="file"
              id="imageUpload"
              className="file-input-hidden"
              accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
              onChange={handleImageChange}
            />
            <button
              htmlFor="imageUpload"
              className="file-input-button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="file-input-icon"
              >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="M12 16V9" />
                <path d="M18 14l-6-6-6 6" />
              </svg>
              Choose Receipt Image
            </button>
          </div>

          {statusMessage && (
            <p className={`status-message ${isError ? 'status-message-error' : 'status-message-success'}`}>
              {statusMessage}
            </p>
          )}

          <div className="image-preview-container">
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt="Receipt Preview"
                className="image-preview"
              />
            ) : (
              <p className="image-preview-placeholder">Your selected image will appear here</p>
            )}
          </div>

          <button
            onClick={handleProcessReceipt}
            className="process-button"
            disabled={!selectedFile || isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="spinner"></span> Processing...
              </>
            ) : (
              'Process Receipt'
            )}
          </button>

          {parsedData && (
            <div className="parsed-data-container">
              <h3 className="parsed-data-title">Parsed Data:</h3>
              <div className="form-group">
                <label htmlFor="merchant_name" className="form-label">Merchant Name:</label>
                <input
                  type="text"
                  id="merchant_name"
                  name="merchant_name"
                  className="form-input"
                  value={editableFields.merchant_name || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="date" className="form-label">Date:</label>
                <input
                  type="text"
                  id="date"
                  name="date"
                  className="form-input"
                  value={editableFields.date || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="total_amount" className="form-label">Total Amount:</label>
                <input
                  type="text"
                  id="total_amount"
                  name="total_amount"
                  className="form-input"
                  value={editableFields.total_amount || ''}
                  onChange={handleFieldChange}
                />
              </div>

              {/* New Gas-specific Fields */}
              <div className="form-group">
                <label htmlFor="gas_provider" className="form-label">Gas Provider:</label>
                <input
                  type="text"
                  id="gas_provider"
                  name="gas_provider"
                  className="form-input"
                  value={editableFields.gas_provider || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gas_address" className="form-label">Gas Station Address:</label>
                <input
                  type="text"
                  id="gas_address"
                  name="gas_address"
                  className="form-input"
                  value={editableFields.gas_address || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gas_tax_id" className="form-label">Gas Station Tax ID:</label>
                <input
                  type="text"
                  id="gas_tax_id"
                  name="gas_tax_id"
                  className="form-input"
                  value={editableFields.gas_tax_id || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="receipt_no" className="form-label">Receipt No.:</label>
                <input
                  type="text"
                  id="receipt_no"
                  name="receipt_no"
                  className="form-input"
                  value={editableFields.receipt_no || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="liters" className="form-label">Liters:</label>
                <input
                  type="text"
                  id="liters"
                  name="liters"
                  className="form-input"
                  value={editableFields.liters || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="plate_no" className="form-label">Plate No.:</label>
                <input
                  type="text"
                  id="plate_no"
                  name="plate_no"
                  className="form-input"
                  value={editableFields.plate_no || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="milestone" className="form-label">Milestone (km):</label>
                <input
                  type="text"
                  id="milestone"
                  name="milestone"
                  className="form-input"
                  value={editableFields.milestone || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="VAT" className="form-label">VAT:</label>
                <input
                  type="text"
                  id="VAT"
                  name="VAT"
                  className="form-input"
                  value={editableFields.VAT || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="gas_type" className="form-label">Gas Type:</label>
                <input
                  type="text"
                  id="gas_type"
                  name="gas_type"
                  className="form-input"
                  value={editableFields.gas_type || ''}
                  onChange={handleFieldChange}
                />
              </div>

              {/* New EGAT-specific Fields */}
              <div className="form-group">
                <label htmlFor="egat_address_th" className="form-label">EGAT Address (Thai):</label>
                <input
                  type="text"
                  id="egat_address_th"
                  name="egat_address_th"
                  className="form-input"
                  value={editableFields.egat_address_th || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="egat_address_eng" className="form-label">EGAT Address (English):</label>
                <input
                  type="text"
                  id="egat_address_eng"
                  name="egat_address_eng"
                  className="form-input"
                  value={editableFields.egat_address_eng || ''}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="egat_tax_id" className="form-label">EGAT Tax ID:</label>
                <input
                  type="text"
                  id="egat_tax_id"
                  name="egat_tax_id"
                  className="form-input"
                  value={editableFields.egat_tax_id || ''}
                  onChange={handleFieldChange}
                />
              </div>

              <button
                onClick={handleSaveChanges}
                className="save-button"
              >
                Save Changes
              </button>
            </div>
          )}

          {extractedText && (
            <div className="extracted-text-container">
              <h3 className="extracted-text-title">Raw Extracted Text:</h3>
              <p className="extracted-text-content">{extractedText}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
