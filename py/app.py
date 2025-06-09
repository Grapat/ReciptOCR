import os
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image # Import Pillow for image processing
import io # To handle image in memory
from flask_cors import CORS # Import Flask-CORS to handle Cross-Origin Resource Sharing
import pytesseract # Import pytesseract for OCR
import re # Import regular expressions for data parsing

app = Flask(__name__)
CORS(app) # Enable CORS

# --- Configuration ---
PROCESSED_UPLOAD_FOLDER = 'processed_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

app.config['PROCESSED_UPLOAD_FOLDER'] = PROCESSED_UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # Max upload size: 20 MB

# Create the processed_uploads directory if it doesn't exist
os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)

# --- Tesseract OCR Configuration (IMPORTANT for Windows users) ---
# If Tesseract is not in your system's PATH, you need to specify its path.
# Example for Windows:
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# For macOS/Linux, Tesseract is usually found in PATH, so this line might not be needed
# or you can set it to the path if it's installed in a non-standard location.

# --- OCR Language Setting ---
# You can specify multiple languages by joining their codes with a '+'
# 'eng' is for English, 'tha' is for Thai. Make sure you have installed
# the corresponding language data packs for Tesseract.
OCR_LANGUAGES = 'eng+tha'

# --- Helper Function for File Type Validation ---
def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Data Parsing Function ---
def parse_receipt_data(text):
    """
    Parses the raw OCR text to extract structured receipt data.
    This is a basic rule-based parsing and can be significantly improved
    with more advanced NLP or machine learning models.
    """
    parsed_data = {
        "merchant_name": "N/A",
        "date": "N/A",
        "total_amount": "N/A",
        "currency": "N/A"
    }

    lines = text.split('\n')
    non_empty_lines = [line.strip() for line in lines if line.strip()]

    # Attempt to extract Merchant Name: Simple approach - first non-empty line
    if non_empty_lines:
        parsed_data["merchant_name"] = non_empty_lines[0]

    # Attempt to extract Date
    # Common date formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, etc.)
    # This regex is a starting point; real-world receipts are complex
    date_patterns = [
        r'\d{1,2}/\d{1,2}/\d{2,4}',  # DD/MM/YY or DD/MM/YYYY
        r'\d{1,2}-\d{1,2}-\d{2,4}',  # DD-MM-YY or DD-MM-YYYY
        r'\d{4}-\d{1,2}-\d{1,2}',  # YYYY-MM-DD
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{2,4}', # Month DD, YYYY
        r'\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{2,4}' # DD Month YYYY
    ]
    for line in non_empty_lines:
        for pattern in date_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                parsed_data["date"] = match.group(0)
                break
        if parsed_data["date"] != "N/A":
            break

    # Attempt to extract Total Amount and Currency
    # This regex tries to find "Total", "Amount", "Balance" etc., followed by currency symbols and numbers.
    # It prioritizes lines with "Total" or "TOTAL"
    total_patterns = [
        r'(?:Total|TOTAL|Sum|Amount|Balance|Grand Total|Net Amount)[:\s]*(\$?|\€|£|฿|USD|EUR|THB)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)',
        r'(\$?|\€|£|฿|USD|EUR|THB)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)' # Currency then number
    ]

    for line in reversed(non_empty_lines): # Search from bottom up, as total is usually at the end
        for pattern in total_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                # Group 1 is currency symbol/code, Group 2 is the number
                currency = match.group(1).strip() if match.group(1) else ""
                amount = match.group(2).replace(',', '') # Remove commas for consistency

                # Basic currency mapping for display
                if not currency:
                    # Try to infer from common symbols/words if not explicitly found
                    if '฿' in line or 'THB' in line:
                        currency = '฿'
                    elif '$' in line or 'USD' in line:
                        currency = '$'
                    elif '€' in line or 'EUR' in line:
                        currency = '€'
                    elif '£' in line or 'GBP' in line:
                        currency = '£'

                parsed_data["total_amount"] = amount
                parsed_data["currency"] = currency if currency else "N/A"
                return parsed_data # Return immediately once a total is found

    return parsed_data # Return parsed data even if no total is found

# --- Routes ---

@app.route('/process-image', methods=['POST'])
def process_image():
    """
    Handles image upload from the frontend, performs pre-processing and OCR,
    then parses the extracted text, and returns the results.
    """
    if 'receipt_image' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['receipt_image']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        try:
            # Read the image into memory
            image_bytes = file.read()
            image = Image.open(io.BytesIO(image_bytes))

            # --- Step 2: Image Pre-processing ---
            processed_image = image.convert('L') # Convert to grayscale
            max_dim = 1024 # pixels
            if processed_image.width > max_dim or processed_image.height > max_dim:
                processed_image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            # --- Step 3: Perform OCR ---
            extracted_text = pytesseract.image_to_string(processed_image, lang=OCR_LANGUAGES)

            # --- Step 4: Data Parsing ---
            parsed_data = parse_receipt_data(extracted_text)

            return jsonify({
                'message': 'Image processed, text extracted, and data parsed successfully!',
                'extracted_text': extracted_text,
                'parsed_data': parsed_data, # Include the structured parsed data
                'status': 'complete'
            }), 200

        except pytesseract.TesseractNotFoundError:
            return jsonify({'error': 'Tesseract OCR engine not found. Please install it on your system and ensure its path is correctly configured if necessary.'}), 500
        except Exception as e:
            print(f"Error during image processing, OCR, or parsing: {e}")
            return jsonify({'error': f'Failed to process image, perform OCR, or parse data: {e}'}), 500
    else:
        return jsonify({'error': 'File type not allowed or file is missing'}), 400

# --- Run the Flask App ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)
