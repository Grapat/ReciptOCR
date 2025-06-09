import React, { useState } from 'react';
import './App.css'; // This line imports your external App.css file

function App() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); // To store the actual file object for backend upload
  const [statusMessage, setStatusMessage] = useState(''); // For user feedback messages
  const [isError, setIsError] = useState(false); // To style status messages (error/success)
  const [isProcessing, setIsProcessing] = useState(false); // To indicate loading state during backend processing
  const [extractedText, setExtractedText] = useState(''); // To display the text extracted by OCR
  const [parsedData, setParsedData] = useState(null); // To display the structured parsed data
  // State for editable form fields, initialized with empty strings or parsed data
  const [editableFields, setEditableFields] = useState({
    merchant_name: '',
    date: '',
    total_amount: '',
    currency: ''
  });

  /**
   * Handles the file input change event.
   * Clears previous data and sets up image preview and file storage.
   * Also resets editable fields when a new image is selected.
   * @param {Event} event - The DOM event from the file input.
   */
  const handleImageChange = (event) => {
    const file = event.target.files[0];

    // Clear all previous results/messages and reset form when a new file is selected
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
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
      setSelectedFile(file);
    }
  };

  /**
   * Handles changes in the editable input fields.
   * Updates the `editableFields` state.
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
   * Handles sending the selected image to the Flask backend for pre-processing and OCR.
   * Updates the UI with extracted text and initializes the editable form.
   */
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
    setEditableFields({ merchant_name: '', date: '', total_amount: '', currency: '' });

    const formData = new FormData();
    formData.append('receipt_image', selectedFile);

    try {
      const response = await fetch('http://127.0.0.1:5000/process-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMessage(data.message);
        setIsError(false);
        setExtractedText(data.extracted_text || 'No text extracted.');
        setParsedData(data.parsed_data); // Store original parsed data
        setEditableFields(data.parsed_data); // Initialize editable fields with parsed data
      } else {
        const errorData = await response.json();
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
      setIsProcessing(false);
    }
  };

  // Optional: Function to handle saving changes (e.g., sending back to backend)
  const handleSaveChanges = () => {
    setStatusMessage('Changes saved locally! (Not sent to backend in this version)');
    setIsError(false);
    console.log("Editable Fields:", editableFields);
    // In a real application, you would send `editableFields` to your backend
    // for storage or further processing here.
  };

  return (
    <div className="app-container">
      <div className="card-container">
        <h1 className="header-title">
          Receipt Scanner
        </h1>
        <p className="header-description">
          Upload an image of your receipt to extract details.
        </p>

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
            Choose Receipt Image
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
            <p className="image-preview-placeholder">Your selected image will appear here</p>
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
            'Process Receipt'
          )}
        </button>

        {/* Parsed Data Display Area - Now with editable inputs */}
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
                value={editableFields.merchant_name}
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
                value={editableFields.date}
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
                value={editableFields.total_amount}
                onChange={handleFieldChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="currency" className="form-label">Currency:</label>
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
              Save Changes
            </button>
          </div>
        )}

        {/* Raw Extracted Text Display Area (Optional, for debugging/full view) */}
        {extractedText && (
          <div className="extracted-text-container">
            <h3 className="extracted-text-title">Raw Extracted Text:</h3>
            <p className="extracted-text-content">{extractedText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
