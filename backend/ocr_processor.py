import sys
import os
from PIL import Image
import io
import pytesseract
import re
import cv2
import numpy as np
import json
from datetime import datetime
import importlib

# OCR Language Setting (Thai and English)
OCR_LANGUAGES = 'eng+tha'

# Folder to save processed/debug images
# PROCESSED_UPLOAD_FOLDER is no longer needed if no debug images are saved.
# If other processed files are saved, keep this and the os.makedirs.
# For this specific request, we will remove it.
# PROCESSED_UPLOAD_FOLDER = os.path.join(
#     os.path.dirname(__file__), '../processed_uploads')
# os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)


# Added original_filename arg
def dynamic_parse_ocr(image_pil, receipt_type="generic", original_filename="unknown"):
    initial_result = {
        "merchant_name": "N/A",
        "date": "N/A",
        "total_amount": "N/A",
        "receipt_type_used": receipt_type,
        "gas_provider": "N/A",
        "gas_name": "N/A",
        "gas_address": "N/A",
        "gas_tax_id": "N/A",
        "receipt_no": "N/A",
        "liters": "N/A",
        "plate_no": "N/A",
        "milestone": "N/A",
        "VAT": "N/A",
        "gas_type": "N/A",
        "egat_address_th": "N/A",
        "egat_address_eng": "N/A",
        "egat_tax_id": "N/A",
    }

    # Initialize parsed_data here with its default values
    parsed_data = initial_result.copy()

    # Try to dynamically load the specific extractor module
    extractor_module = None
    if receipt_type and receipt_type != "generic":
        try:
            extractor_module = importlib.import_module(
                f'{receipt_type}_extractor')
            sys.stderr.write(
                f"Successfully loaded extractor: {receipt_type}_extractor.py\n")
        except ImportError:
            sys.stderr.write(
                f"Warning: Extractor module for '{receipt_type}' not found. Falling back to generic OCR.\n")
        except Exception as e:
            sys.stderr.write(
                f"Error loading extractor module {receipt_type}_extractor: {e}. Falling back to generic OCR.\n")
    else:
        sys.stderr.write(
            "Using generic OCR processing as no specific receipt_type provided.\n")

    # Call the combined extraction function from the loaded extractor module ONLY if it exists
    if extractor_module:
        # The extractor_module.extract_data no longer returns debug_image_cv2
        parsed_data, cleaned_extracted_text_for_matching = \
            extractor_module.extract_data(
                image_pil, original_filename, initial_result)  # Pass original_filename
    else:
        # Fallback for generic OCR if no specific extractor is found
        img_np_fallback = np.array(image_pil)
        img_cv_gray_fallback = cv2.cvtColor(
            img_np_fallback, cv2.COLOR_RGB2GRAY)
        # Use simple adaptive thresholding for generic fallback
        img_thresh_fallback = cv2.adaptiveThreshold(img_cv_gray_fallback, 255,
                                                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                                    cv2.THRESH_BINARY, 11, 2)
        processed_image_for_ocr_fallback = Image.fromarray(img_thresh_fallback)

        tesseract_config = r'--oem 1 --psm 3'  # Generic default PSM
        data_fallback = pytesseract.image_to_data(
            processed_image_for_ocr_fallback, lang=OCR_LANGUAGES, output_type=pytesseract.Output.DICT, config=tesseract_config)
        raw_ocr_text_fallback = pytesseract.image_to_string(
            processed_image_for_ocr_fallback, lang=OCR_LANGUAGES, config=tesseract_config)
        cleaned_extracted_text_for_matching = raw_ocr_text_fallback.replace(
            ' ', '').lower()
        sys.stderr.write(
            "Falling back to generic OCR with basic processing.\n")

    # Final cleanup: Change any remaining "N/A" to None for database compatibility
    for field in parsed_data:
        if parsed_data[field] == "N/A":
            parsed_data[field] = None

    # No debug_image_cv2 returned here
    return parsed_data, cleaned_extracted_text_for_matching


# --- Main script execution ---
if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.stderr.write(json.dumps(
            {"error": "Missing arguments. Usage: python ocr_processor.py <receipt_type> <filename>"}) + "\n")
        sys.exit(1)

    receipt_type = sys.argv[1]
    original_filename = sys.argv[2]  # Now passed to dynamic_parse_ocr

    try:
        # Read image bytes from stdin (as sent by Node.js multer)
        image_bytes = sys.stdin.buffer.read()
        original_image_pil = Image.open(io.BytesIO(image_bytes))

        # Perform dynamic OCR parsing and get the parsed data AND the globally cleaned extracted text
        # debug_image_cv2 is no longer returned
        parsed_data, extracted_text = dynamic_parse_ocr(
            original_image_pil, receipt_type, original_filename)

        # No debug image saving needed

        # Prepare the final result dictionary to be sent back to Node.js as JSON
        result = {
            'message': 'Image processed dynamically!',
            'extracted_text': extracted_text,
            'parsed_data': parsed_data,
            # 'debug_image_url': f'/processed_uploads/debug_dynamic_{receipt_type}_{original_filename}', # No debug image URL
            'status': 'complete'
        }
        # Print the JSON result to stdout, which Node.js will capture
        print(json.dumps(result))

    except pytesseract.TesseractNotFoundError:
        sys.stderr.write(json.dumps(
            {"error": "Tesseract OCR engine not found. Please install it and ensure its path is correct."}) + "\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(json.dumps(
            {"error": f"Dynamic OCR failed: {e}"}) + "\n")
        sys.exit(1)
