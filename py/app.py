import os
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image
import io
from flask_cors import CORS
import pytesseract
import re

app = Flask(__name__)
CORS(app)

# --- Configuration ---
PROCESSED_UPLOAD_FOLDER = 'processed_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

app.config['PROCESSED_UPLOAD_FOLDER'] = PROCESSED_UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024

os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)

# --- OCR Language Setting ---
OCR_LANGUAGES = 'eng+tha'

# --- Helper Function for File Type Validation ---
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Data Parsing Function (Now with conditional logic) ---
def parse_receipt_data(text, receipt_type="PTT-Kbank"):
    """
    Parses the raw OCR text to extract structured receipt data based on type.
    This is a basic rule-based parsing and can be significantly improved
    with more advanced NLP or machine learning models.
    """
    parsed_data = {
        "merchant_name": "N/A",
        "date": "N/A",
        "total_amount": "N/A",
        "receipt_type_used": receipt_type # For debugging, shows which config was used
    }

    lines = text.split('\n')
    non_empty_lines = [line.strip() for line in lines if line.strip()]

    # --- Generic Parsing Logic (Fallback) ---
    if non_empty_lines:
        parsed_data["merchant_name"] = non_empty_lines[0]

    # Attempt to extract Date
    date_patterns = [
        r'\d{1,2}/\d{1,2}/\d{2,4}',
        r'\d{1,2}-\d{1,2}-\d{2,4}',
        r'\d{4}-\d{1,2}-\d{1,2}',
        r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? \d{2,4}', # Added .? for abbreviation
        r'\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{2,4}'
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
    total_patterns_generic = [
        r'(?:Total|TOTAL|Sum|Amount|Balance|Grand Total|Net Amount|TOTAL THB)[:\s]*(\$?|\€|£|฿|USD|EUR|THB)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)',
        r'(\$?|\€|£|฿|USD|EUR|THB)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)'
    ]

    # --- Conditional Parsing Logic based on receipt_type ---
    if receipt_type == "Bangchak-Kbank":
        # Example: For grocery receipts, we might look for "GROCERY TOTAL" or similar
        # and prioritize different patterns.
        # This is a placeholder for more sophisticated logic.
        total_patterns_grocery = [
            r'(?:GROCERY TOTAL|SUBTOTAL|TOTAL)[:\s]*(\$?|\€|£|฿|USD|EUR|THB)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)',
            r'GRAND TOTAL[:\s]*(\$?|\€|£|฿|USD|EUR|THB)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)'
        ]
        # Try grocery specific patterns first
        for line in reversed(non_empty_lines):
            for pattern in total_patterns_grocery:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    currency = match.group(1).strip() if match.group(1) else ""
                    amount = match.group(2).replace(',', '')
                    if not currency:
                        if '฿' in line or 'THB' in line: currency = '฿'
                        elif '$' in line or 'USD' in line: currency = '$'
                        elif '€' in line or 'EUR' in line: currency = '€'
                        elif '£' in line or 'GBP' in line: currency = '£'
                    parsed_data["total_amount"] = amount
                    parsed_data["currency"] = currency if currency else "N/A"
                    return parsed_data # Return immediately if found

    # Fallback to generic total parsing if specific type didn't find it or for generic type
    for line in reversed(non_empty_lines):
        for pattern in total_patterns_generic:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                currency = match.group(1).strip() if match.group(1) else ""
                amount = match.group(2).replace(',', '')
                parsed_data["total_amount"] = amount
                parsed_data["currency"] = currency if currency else "N/A"
                return parsed_data # Return immediately if found

    return parsed_data

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
    receipt_type = request.form.get('receipt_type', 'generic') # Get receipt type, default to 'generic'

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        try:
            image_bytes = file.read()
            image = Image.open(io.BytesIO(image_bytes))

            # --- Image Pre-processing ---
            processed_image = image.convert('L')
            max_dim = 1024
            if processed_image.width > max_dim or processed_image.height > max_dim:
                processed_image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            # --- Perform OCR ---
            extracted_text = pytesseract.image_to_string(processed_image, lang=OCR_LANGUAGES)

            # --- Data Parsing (now passes receipt_type) ---
            parsed_data = parse_receipt_data(extracted_text, receipt_type)

            return jsonify({
                'message': 'Image processed, text extracted, and data parsed successfully!',
                'extracted_text': extracted_text,
                'parsed_data': parsed_data,
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
