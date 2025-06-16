import React, { useState } from 'react';
import './App.css'; // This line imports your external App.css file

function App() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); // Stores the actual file object for backend upload
  const [statusMessage, setStatusMessage] = useState(''); // Provides user feedback messages
  const [isError, setIsError] = useState(false); // Helps style status messages (error/success)
  const [isProcessing, setIsProcessing] = useState(false); // Indicates loading state during backend processing
  const [extractedText, setExtractedText] = useState(''); // Displays the raw text extracted by OCR
  const [parsedData, setParsedData] = useState(null); // Stores the original structured data from the backend
  // Stores editable form fields, initialized with empty strings or parsed data
  const [editableFields, setEditableFields] = useState({
    merchant_name: '',
    date: '',
    total_amount: '',
    currency: ''
  });

  // Stores the user's selected receipt type, defaults to 'PTT-Kbank'
  const [receiptType, setReceiptType] = useState('PTT-Kbank');

  /**
   * Handles the file input change event.
   * Clears previous results, sets up image preview, and stores the selected file.
   * Also resets editable fields when a new image is chosen.
   * @param {Event} event - The DOM event from the file input.
   */
  const handleImageChange = (event) => {
    const file = event.target.files[0];

    // Clear all previous results/messages and reset form states
    setImagePreviewUrl(null);
    setSelectedFile(null);
    setStatusMessage('');
    setIsError(false);
    setIsProcessing(false);
    setExtractedText('');
    setParsedData(null);
    setEditableFields({ merchant_name: '', date: '', total_amount: '', currency: '' }); // Reset editable fields

    if (file) {
      if (!file.type.startsWith('image/')) {
        setStatusMessage('Please select an image file (PNG, JPG, JPEG, GIF, WEBP).');
        setIsError(true);
        return; // Exit if file is not an image
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result); // Set the Data URL for image preview
      };
      reader.readAsDataURL(file); // Read the file as a Data URL
      setSelectedFile(file); // Store the actual File object
    }
  };

  /**
   * Handles changes in the editable input fields.
   * Updates the `editableFields` state as the user types.
   * @param {Event} e - The input change event.
   */
  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setEditableFields(prevFields => ({
      ...prevFields,
      [name]: value
    }));
  };

  /**
   * Handles changes in the receipt type dropdown.
   * Updates the `receiptType` state.
   * @param {Event} e - The select change event.
   */
  const handleReceiptTypeChange = (e) => {
    setReceiptType(e.target.value);
    // Optionally, clear previous results if changing type before re-processing
    setStatusMessage('');
    setIsError(false);
    setExtractedText('');
    setParsedData(null);
    setEditableFields({ merchant_name: '', date: '', total_amount: '', currency: '' });
  };

  /**
   * Handles sending the selected image and receipt type to the Flask backend for processing.
   * Updates the UI with extracted text and initializes the editable form fields.
   */
  const handleProcessReceipt = async () => {
    if (!selectedFile) {
      setStatusMessage('Please upload an image first.');
      setIsError(true);
      return;
    }

    setIsProcessing(true); // Show loading state
    setStatusMessage('Processing image and performing OCR...'); // Inform user
    setIsError(false); // Reset error status
    setExtractedText(''); // Clear previous extracted text
    setParsedData(null); // Clear previous parsed data
    setEditableFields({ merchant_name: '', date: '', total_amount: '', currency: '' }); // Reset editable fields

    const formData = new FormData(); // Create form data to send the file
    formData.append('receipt_image', selectedFile); // Append the image file
    formData.append('receipt_type', receiptType); // Append the selected receipt type

    try {
      // Send POST request to the Flask backend
      const response = await fetch('http://127.0.0.1:5000/process-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json(); // Parse JSON response
        setStatusMessage(data.message); // Display success message
        setIsError(false);
        setExtractedText(data.extracted_text || 'No text extracted.'); // Display raw OCR text
        setParsedData(data.parsed_data); // Store original parsed data
        setEditableFields(data.parsed_data); // Initialize editable fields with parsed data
      } else {
        const errorData = await response.json(); // Parse error response
        setStatusMessage(`Error: ${errorData.error || 'Unknown error during processing.'}`);
        setIsError(true);
        setExtractedText('');
        setParsedData(null);
        setEditableFields({ merchant_name: '', date: '', total_amount: '', currency: '' });
      }
    } catch (error) {
      console.error('Network or processing error:', error);
      setStatusMessage('Failed to connect to the backend or process image. Please check console for details.');
      setIsError(true);
      setExtractedText('');
      setParsedData(null);
      setEditableFields({ merchant_name: '', date: '', total_amount: '', currency: '' });
    } finally {
      setIsProcessing(false); // Hide loading state regardless of success/failure
    }
  };

  /**
   * Placeholder function to handle saving changes made in the editable form.
   * In a real application, this would send `editableFields` to your backend for persistence.
   */
  const handleSaveChanges = () => {
    setStatusMessage('Changes saved locally! (This version does not send data to the backend.)');
    setIsError(false);
    console.log("Editable Fields:", editableFields);
    // TODO: In a real application, you would send `editableFields` to your backend
    // for storage or further processing here (e.g., via another fetch() call).
  };

  return (
    <>
      {/* EMBEDDED PURE CSS FOR THIS COMPONENT */}
      {/* This <style> block contains all the CSS for this component. */}

      <div className="app-container">
        <div className="card-container">
          <h1 className="header-title">
            Receipt Scanner
          </h1>
          <p className="header-description">
            อัปโหลดรูปใบเสร็จที่ต้องการดึงข้อมูล
          </p>

          {/* Receipt Type Selection */}
          <div className="form-group receipt-type-select">
            <label htmlFor="receiptType" className="form-label">เลือกประเภทใบเสร็จ:</label>
            <select
              id="receiptType"
              name="receiptType"
              className="form-input"
              value={receiptType}
              onChange={handleReceiptTypeChange}
            >
              <option value="PTT-Kbank">ปตท. กสิกร</option>
              <option value="Bangchak-Kbank">บางจาก กสิกร</option>
              <option value="Bangchak-Krungthai">บางจาก กรุงไทย</option>
              <option value="A5">ใบเสร็จ A5</option>
              {/* Add more specific types as needed */}
            </select>
          </div>

          {/* File Upload Section */}
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
              {/* Lucide FileUp icon */}
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
              เลือกรูปใบเสร็จ
            </button>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <p className={`status-message ${isError ? 'status-message-error' : 'status-message-success'}`}>
              {statusMessage}
            </p>
          )}

          {/* Image Preview Section */}
          <div className="image-preview-container">
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt="Receipt Preview"
                className="image-preview"
              />
            ) : (
              <p className="image-preview-placeholder">รูปที่เลือกจะมาปรากฏที่นี้</p>
            )}
          </div>

          {/* Process Button */}
          <button
            onClick={handleProcessReceipt}
            className="process-button"
            disabled={!selectedFile || isProcessing} // Disable if no file or currently processing
          >
            {isProcessing ? (
              <>
                <span className="spinner"></span> Processing...
              </>
            ) : (
              'ดึงข้อมูลจากภาพ'
            )}
          </button>

          {/* Parsed Data Display Area - Now with editable inputs */}
          {parsedData && (
            <div className="parsed-data-container">
              <h3 className="parsed-data-title">ข้อมูลหลังแยก:</h3>
              <div className="form-group">
                <label htmlFor="merchant_name" className="form-label">ชื่อผู้ขาย :</label>
                <input
                  type="text"
                  id="merchant_name"
                  name="merchant_name"
                  className="form-input"
                  value={editableFields.merchant_name}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="date" className="form-label">วันที่ :</label>
                <input
                  type="text"
                  id="date"
                  name="date"
                  className="form-input"
                  value={editableFields.date}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="total_amount" className="form-label">จำนวนเงิน :</label>
                <input
                  type="text"
                  id="total_amount"
                  name="total_amount"
                  className="form-input"
                  value={editableFields.total_amount}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="currency" className="form-label">สกุลเงิน :</label>
                <input
                  type="text"
                  id="currency"
                  name="currency"
                  className="form-input"
                  value={editableFields.currency}
                  onChange={handleFieldChange}
                />
              </div>
              <button
                onClick={handleSaveChanges}
                className="save-button"
              >
                บันทึกข้อมูล
              </button>
            </div>
          )}

          {/* Raw Extracted Text Display Area (Optional, for debugging/full view) */}
          {extractedText && (
            <div className="extracted-text-container">
              <h3 className="extracted-text-title">ข้อมูลดิบหลังแยก:</h3>
              <p className="extracted-text-content">{extractedText}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
