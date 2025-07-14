// components/ImageUpload.jsx
import React, { useRef } from 'react';
import '../../App.css';

function ImageUpload({ imagePreviewUrl, handleImageChange, statusMessage, isError }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    // This now just calls the handleImageChange prop from ScannerPage
    handleImageChange(event);
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="file-input-wrapper">
        <input
          type="file"
          id="imageUpload"
          className="file-input-hidden"
          accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
          onChange={handleFileSelect}
          ref={fileInputRef}
        />
        <button
          className="scanner-save-button"
          onClick={handleButtonClick}
        >
          เลือกใบเสร็จ
        </button>
      </div>

      {statusMessage && (
        <p className={`status-message ${isError ? 'status-message-error' : 'status-message-success'}`}>
          {statusMessage}
        </p>
      )}

      <div className="image-preview-container">
        {imagePreviewUrl ? (
          <img src={imagePreviewUrl} alt="Receipt Preview" className="image-preview" />
        ) : (
          <p className="image-preview-placeholder">รูปของคุณจะปรากฏที่นี่</p>
        )}
      </div>
    </div>
  );
}

export default ImageUpload;