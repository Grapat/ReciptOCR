import React, { useState } from 'react';
import './App.css';

function App() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); // To store the actual file object
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // New state for loading indicator

  /**
   * Handles the change event when a file is selected in the input.
   * Reads the selected file and sets its Data URL to state for preview.
   * Also stores the File object.
   * @param {Event} event - The DOM event object.
   */
  const handleImageChange = (event) => {
    const file = event.target.files[0]; // Get the first selected file

    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setStatusMessage('Please select an image file (PNG, JPG, JPEG, GIF, WEBP).');
        setIsError(true);
        setImagePreviewUrl(null); // Clear previous preview
        setSelectedFile(null); // Clear selected file
        return;
      }

      // Create a FileReader to read the file content
      const reader = new FileReader();

      // When the reader finishes loading the file
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result); // Set the image source to state for preview
        setStatusMessage(''); // Clear any previous status messages
        setIsError(false);
      };

      // Read the file as a Data URL (base64 encoded string)
      reader.readAsDataURL(file);
      setSelectedFile(file); // Store the file object itself
    } else {
      // If no file is selected, clear the preview and status
      setImagePreviewUrl(null);
      setSelectedFile(null);
      setStatusMessage('');
      setIsError(false);
    }
  };

  /**
   * Handles sending the selected image to the backend for processing.
   */
  const handleProcessReceipt = async () => {
    if (!selectedFile) {
      setStatusMessage('Please upload an image first.');
      setIsError(true);
      return;
    }

    setIsProcessing(true); // Show loading state
    setStatusMessage('Processing image...');
    setIsError(false);

    const formData = new FormData();
    formData.append('receipt_image', selectedFile); // Append the actual file object

    try {
      // Make sure your Flask backend is running on http://127.0.0.1:5000
      const response = await fetch('http://127.0.0.1:5000/process-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMessage(data.message);
        setIsError(false);
        
      } else {
        const errorData = await response.json();
        setStatusMessage(`Error: ${errorData.error || 'Unknown error during processing.'}`);
        setIsError(true);
      }
    } catch (error) {
      console.error('Network or processing error:', error);
      setStatusMessage('Failed to connect to the backend or process image. Please check console for details.');
      setIsError(true);
    } finally {
      setIsProcessing(false); // Hide loading state
    }
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

          {/* File Upload Section */}
          <div className="file-input-wrapper">
            <input
              type="file"
              id="imageUpload"
              className="file-input-hidden"
              accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
              onChange={handleImageChange}
            />
            <label
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
              Choose Receipt Image
            </label>
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

          {/* Process Button - now functional */}
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
        </div>
      </div>
    </>
  );
}

export default App;
