// components/ImageUpload.jsx
import React, { useRef } from 'react';

function ImageUpload({ imagePreviewUrl, handleImageChange, statusMessage, isError }) {
  const fileInputRef = useRef(null); // Create a ref

  const handleButtonClick = () => {
    fileInputRef.current.click(); // Programmatically click the hidden input
  };

  return (
    <>
      <div className="file-input-wrapper">
        <input
          type="file"
          id="imageUpload"
          className="file-input-hidden"
          accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
          onChange={handleImageChange}
          ref={fileInputRef}
        />
        <button
          className="file-input-button"
          onClick={handleButtonClick} // Add an onClick handler to the button
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
    </>
  );
}

export default ImageUpload;