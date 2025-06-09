import os
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image # Import Pillow for image processing
import io # To handle image in memory
from flask_cors import CORS # Import Flask-CORS to handle Cross-Origin Resource Sharing

app = Flask(__name__)
# Enable CORS for all routes, allowing your React app (running on a different port/origin)
# to make requests to this Flask backend. In production, you would restrict this to
# your React app's specific origin for security.
CORS(app)

# --- Configuration ---
# Define a directory to save processed files (optional, for demonstration)
PROCESSED_UPLOAD_FOLDER = 'processed_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

app.config['PROCESSED_UPLOAD_FOLDER'] = PROCESSED_UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # Max upload size: 20 MB

# Create the processed_uploads directory if it doesn't exist
os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)

# --- Helper Function for File Type Validation ---
def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Routes ---

@app.route('/process-image', methods=['POST'])
def process_image():
    """
    Handles image upload from the frontend, performs basic pre-processing,
    and saves the processed image.
    """
    if 'receipt_image' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['receipt_image']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        # Securely get filename
        filename = secure_filename(file.filename)
        # Construct a unique filename for the processed image
        base, ext = os.path.splitext(filename)
        processed_filename = f"{base}_processed{ext}"
        filepath = os.path.join(app.config['PROCESSED_UPLOAD_FOLDER'], processed_filename)

        try:
            # Read the image into memory
            image_bytes = file.read()
            image = Image.open(io.BytesIO(image_bytes))

            # --- Step 2: Image Pre-processing ---
            # 1. Convert to grayscale: Often improves OCR accuracy by removing color noise.
            #    'L' mode is for grayscale.
            processed_image = image.convert('L')

            # 2. Resize image: Standardizing dimensions can help, and reducing large images
            #    can speed up subsequent OCR. Choose a sensible max dimension.
            max_dim = 1024 # pixels
            if processed_image.width > max_dim or processed_image.height > max_dim:
                processed_image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            # --- End Pre-processing ---

            # Save the processed image (for demonstration purposes)
            processed_image.save(filepath)
            print(f"Processed image saved to: {filepath}")

            return jsonify({
                'message': 'Image processed successfully!',
                'processed_filename': processed_filename,
                'status': 'preprocessed'
            }), 200

        except Exception as e:
            print(f"Error processing image: {e}")
            return jsonify({'error': f'Failed to process image: {e}'}), 500
    else:
        return jsonify({'error': 'File type not allowed or file is missing'}), 400

# --- Run the Flask App ---
if __name__ == '__main__':
    # It's important that this Flask app runs on a different port than your Vite app (e.g., 5000 vs 5173).
    # Also, ensure debug=True only for development.
    app.run(debug=True, port=5000)
