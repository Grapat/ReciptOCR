import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage'; // Make sure this exists and returns a blob
import '../css/ImageCropper.css';

const cropContainerStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px'
};

function ImageCropper({ imageSrc, onCropDone, onCancel }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [aspect, setAspect] = useState(4 / 3); // Default aspect ratio

    const onCropComplete = useCallback((_, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCrop = async () => {
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropDone(croppedImage);
        } catch (e) {
            console.error('Crop failed:', e);
        }
    };

    return (
        <div style={cropContainerStyle}>
            {/* Aspect ratio selector */}
            <div style={{ color: 'white', marginBottom: '10px' }}>
                <label style={{ marginRight: '8px' }}>Aspect Ratio:</label>
                <select onChange={(e) => setAspect(parseFloat(e.target.value))}>
                    <option value={NaN}>Free</option>
                    <option value={1}>1:1</option>
                    <option value={4 / 3}>4:3</option>
                    <option value={16 / 9}>16:9</option>
                    <option value={3 / 4}>3:4</option>
                    <option value={9 / 16}>9:16</option>
                </select>
            </div>

            {/* Cropper area */}
            <div style={{ position: 'relative', width: '90vw', height: '60vh' }}>
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={isNaN(aspect) ? undefined : aspect}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                />
            </div>

            {/* Buttons */}
            <div style={{ marginTop: '20px' }}>
                <button onClick={handleCrop} style={{ marginRight: '12px' }}>✅ Crop</button>
                <button onClick={onCancel}>❌ Cancel</button>
            </div>
        </div>
    );
}

export default ImageCropper;
