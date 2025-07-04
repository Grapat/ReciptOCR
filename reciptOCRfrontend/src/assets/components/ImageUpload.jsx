// components/ImageUpload.jsx
import React, { useRef, useState } from 'react';
import ImageCropper from './ImageCropper'; // Make sure path is correct
import '../../App.css';

function ImageUpload({ imagePreviewUrl, handleImageChange, statusMessage, isError, setSelectedFile, setImagePreviewUrl }) {
  const fileInputRef = useRef(null);

  const [tempImageUrl, setTempImageUrl] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setTempImageUrl(previewUrl); // Show in cropper
      setShowCropper(true);        // Show cropping UI
    }
  };

  const handleCropDone = (croppedBlob) => {
    const croppedFile = new File([croppedBlob], 'cropped.jpg', { type: 'image/jpeg' });
    setSelectedFile(croppedFile); // Replace file with cropped
    const croppedUrl = URL.createObjectURL(croppedBlob);
    setImagePreviewUrl(croppedUrl);
    handleImageChange({ target: { files: [croppedFile] } }); // Trigger OCR
    setShowCropper(false);
  };

  const handleCropCancel = () => {
    setTempImageUrl(null);
    setShowCropper(false);
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
          className="save-button scanner-save-button"
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

      {/* Show cropper if needed */}
      {showCropper && tempImageUrl && (
        <ImageCropper
          imageSrc={tempImageUrl}
          onCropDone={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

export default ImageUpload;
