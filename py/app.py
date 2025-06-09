import os
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image
import io
from flask_cors import CORS
import pytesseract
import re
import cv2  # For drawing debugging bounding boxes
import numpy as np  # For converting PIL Image to OpenCV format

app = Flask(__name__)
CORS(app)

# --- Configuration ---
PROCESSED_UPLOAD_FOLDER = 'processed_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['PROCESSED_UPLOAD_FOLDER'] = PROCESSED_UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024 # Max upload size: 20 MB
os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)

# Tesseract OCR path configuration (uncomment and set if Tesseract is not in system PATH)
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

OCR_LANGUAGES = 'eng+tha' # OCR languages

# --- Helper Function for File Type Validation ---
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Define Receipt Templates with Bounding Box Coordinates ---
# Coordinates are (x, y, width, height).
# These are illustrative; you MUST determine precise ones for your actual images.
RECEIPT_TEMPLATES = {
    "PTT-Kbank": {
        "merchant_name_box": (50, 50, 500, 50),
        "date_box": (380, 150, 240, 30),
        "total_amount_box": (450, 700, 150, 50),
    },
    "Bangchak-Kbank": {
        "merchant_name_box": (110, 350, 320, 80),
        "date_box": (40, 450, 450, 90),
        "total_amount_box": (40, 1325, 450, 60),
    },
    "Bangchak-Krungthai": {
        "merchant_name_box": (70, 40, 480, 50),
        "date_box": (380, 180, 200, 30),
        "total_amount_box": (480, 800, 120, 50),
    },
    "A5": {
        "merchant_name_box": (70, 40, 480, 50),
        "date_box": (380, 180, 200, 30),
        "total_amount_box": (480, 800, 120, 50),
    },
    "generic": { # Fallback template
        "merchant_name_box": (50, 50, 500, 50),
        "date_box": (380, 150, 240, 30),
        "total_amount_box": (450, 700, 150, 50),
    }
}

# --- Data Parsing Function (Region-based OCR) ---
def parse_receipt_data(processed_image_pil, receipt_type="PTT-Kbank"):
    parsed_data = {
        "merchant_name": "N/A",
        "date": "N/A",
        "total_amount": "N/A",
        "currency": "THB", # Currency is now always THB
        "receipt_type_used": receipt_type
    }

    template = RECEIPT_TEMPLATES.get(receipt_type, RECEIPT_TEMPLATES["generic"])

    def extract_from_box(img_pil, box_coords):
        # Convert (x, y, width, height) to (left, upper, right, lower) for PIL.Image.crop()
        x, y, w, h = box_coords
        crop_box = (x, y, x + w, y + h)

        img_width, img_height = img_pil.size
        left, upper, right, lower = crop_box
        if not (0 <= left < right <= img_width and 0 <= upper < lower <= img_height):
            print(f"Warning: Cropping coordinates {crop_box} are out of image bounds ({img_width}x{img_height}). Skipping.")
            return "N/A"

        cropped_roi = img_pil.crop(crop_box)
        text = pytesseract.image_to_string(cropped_roi, lang=OCR_LANGUAGES).strip()
        return text if text else "N/A"

    if "merchant_name_box" in template:
        parsed_data["merchant_name"] = extract_from_box(processed_image_pil, template["merchant_name_box"])

    if "date_box" in template:
        parsed_data["date"] = extract_from_box(processed_image_pil, template["date_box"])

    if "total_amount_box" in template:
        total_text = extract_from_box(processed_image_pil, template["total_amount_box"])
        # Attempt to extract only the numerical amount, removing commas
        amount_match = re.search(r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', total_text)
        if amount_match:
            parsed_data["total_amount"] = amount_match.group(1).replace(',', '')
        else:
            parsed_data["total_amount"] = total_text # Fallback to raw text if number not found

    return parsed_data

# --- Routes ---
@app.route('/process-image', methods=['POST'])
def process_image():
    if 'receipt_image' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['receipt_image']
    receipt_type = request.form.get('receipt_type', 'generic') # Get receipt type from frontend

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        try:
            image_bytes = file.read()
            original_image_pil = Image.open(io.BytesIO(image_bytes))

            # Convert PIL Image to OpenCV format for drawing debug boxes
            debug_image_cv2 = cv2.cvtColor(np.array(original_image_pil), cv2.COLOR_RGB2BGR)

            # Pre-process image for OCR (grayscale and resize)
            processed_image_pil = original_image_pil.convert('L')
            max_dim = 1024
            if processed_image_pil.width > max_dim or processed_image_pil.height > max_dim:
                processed_image_pil.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            # Draw bounding boxes for debugging
            template = RECEIPT_TEMPLATES.get(receipt_type, RECEIPT_TEMPLATES["generic"])
            thickness = 3
            colors = { # BGR format for OpenCV
                "merchant_name_box": (255, 0, 0), # Blue
                "date_box": (0, 255, 0),          # Green
                "total_amount_box": (0, 0, 255),  # Red
            }

            for field, box_coords in template.items():
                if field.endswith("_box"):
                    try:
                        x, y, w, h = box_coords
                        cv2.rectangle(debug_image_cv2, (x, y), (x + w, y + h), colors.get(field, (255,255,0)), thickness)
                        font = cv2.FONT_HERSHEY_SIMPLEX
                        cv2.putText(debug_image_cv2, field.replace('_box', '').replace('_', ' ').title(),
                                    (x, y - 10), font, 0.7, colors.get(field, (255,255,0)), 2, cv2.LINE_AA)
                    except Exception as e:
                        print(f"Error drawing box for {field} at {box_coords}: {e}")

            # Save the debug image
            debug_image_path = os.path.join(app.config['PROCESSED_UPLOAD_FOLDER'], f'debug_receipt_{receipt_type}_{file.filename}')
            cv2.imwrite(debug_image_path, debug_image_cv2)

            # Parse data using region-based OCR
            parsed_data = parse_receipt_data(processed_image_pil, receipt_type)

            # Extract full text for debugging (optional)
            extracted_text = pytesseract.image_to_string(processed_image_pil, lang=OCR_LANGUAGES)

            return jsonify({
                'message': 'Image processed, text extracted, and data parsed successfully!',
                'extracted_text': extracted_text,
                'parsed_data': parsed_data,
                'debug_image_url': f'/processed_uploads/debug_receipt_{receipt_type}_{file.filename}',
                'status': 'complete'
            }), 200

        except pytesseract.TesseractNotFoundError:
            return jsonify({'error': 'Tesseract OCR engine not found. Please install it on your system and ensure its path is correctly configured if necessary.'}), 500
        except Exception as e:
            print(f"Error during processing: {e}")
            return jsonify({'error': f'Failed to process image: {e}'}), 500
    else:
        return jsonify({'error': 'File type not allowed or file is missing'}), 400

# --- Run the Flask App ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)
