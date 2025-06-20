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
PROCESSED_UPLOAD_FOLDER = os.path.join(
    os.path.dirname(__file__), '../processed_uploads')
os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)


def dynamic_parse_ocr(image_pil, receipt_type="generic"):
    """
    Performs dynamic OCR parsing on a given PIL image, attempting to extract
    various fields from a receipt, including EGAT specific information.

    Args:
        image_pil (PIL.Image.Image): The input receipt image as a PIL Image object.
        receipt_type (str): The type of receipt (e.g., "KBPTT", "KTBCP"), used to load specific extractor logic.

    Returns:
        tuple: A tuple containing:
            - dict: A dictionary of parsed data (e.g., merchant_name, total_amount, egat_address_th).
            - numpy.ndarray: An OpenCV image with bounding boxes drawn for debugging.
            - str: The full extracted OCR text, now processed to be lowercase with no spaces.
    """
    # Initialize result dictionary with "N/A" for all fields.
    result = {
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

    # Convert PIL Image to OpenCV format for drawing bounding boxes later
    image_cv = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)

    # --- Preprocessing Improvements Start ---
    img_np = np.array(image_pil)
    img_cv_gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    img_denoised = cv2.medianBlur(img_cv_gray, 5)
    img_thresh = cv2.adaptiveThreshold(img_denoised, 255,
                                       cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 11, 2)
    processed_image_for_ocr = Image.fromarray(img_thresh)
    # --- Preprocessing Improvements End ---

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

    # Perform OCR to get detailed word-by-word data (for keyword-based extraction)
    # NOTE: pytesseract.image_to_data's output structure might still be useful
    # even with global space removal for string matching.
    data = pytesseract.image_to_data(
        processed_image_for_ocr, lang=OCR_LANGUAGES, output_type=pytesseract.Output.DICT)

    # Perform OCR to get the full text
    raw_ocr_text = pytesseract.image_to_string(
        processed_image_for_ocr, lang=OCR_LANGUAGES)

    # *** NEW GLOBAL CLEANING STEP ***
    # Remove all spaces and convert to lowercase for consistent matching
    cleaned_extracted_text_for_matching = raw_ocr_text.replace(' ', '').lower()
    # This will be the 'extracted_text' returned and used by extractors

    # Perform keyword-based extraction
    # Pass the globally cleaned text for consistency
    if extractor_module and hasattr(extractor_module, 'extract_with_keywords'):
        # If your extract_with_keywords uses the full string, pass the cleaned_extracted_text_for_matching
        # Otherwise, if it only relies on 'data' dict, no change needed here.
        # Assuming it *might* use the full string, adjust as necessary:
        # May need to add cleaned_extracted_text_for_matching if used
        result, image_cv = extractor_module.extract_with_keywords(
            data, debug_image_cv2, extracted_text, result)
    else:
        pass  # Placeholder for generic keyword extraction

    # Perform regex-based extraction
    # Pass the globally cleaned text for consistency
    if extractor_module and hasattr(extractor_module, 'extract_with_regex_patterns'):
        result = extractor_module.extract_with_regex_patterns(
            extracted_text, result)
    else:
        pass  # Placeholder for generic regex extraction

    # Final cleanup: Change any remaining "N/A" to None for database compatibility
    for field in result:
        if result[field] == "N/A":
            result[field] = None

    # Return the globally cleaned text (no spaces, lowercase)
    return result, image_cv, cleaned_extracted_text_for_matching


# --- Main script execution ---
if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.stderr.write(json.dumps(
            {"error": "Missing arguments. Usage: python ocr_processor.py <receipt_type> <filename>"}) + "\n")
        sys.exit(1)

    receipt_type = sys.argv[1]
    original_filename = sys.argv[2]

    try:
        # Read image bytes from stdin (as sent by Node.js multer)
        image_bytes = sys.stdin.buffer.read()
        original_image_pil = Image.open(io.BytesIO(image_bytes))

        # Perform dynamic OCR parsing and get the parsed data, debug image, AND the globally cleaned extracted text
        parsed_data, debug_image_cv2, extracted_text = dynamic_parse_ocr(
            original_image_pil, receipt_type)

        # Save the debug image with bounding boxes
        debug_image_path = os.path.join(
            PROCESSED_UPLOAD_FOLDER, f'debug_dynamic_{receipt_type}_{original_filename}')
        cv2.imwrite(debug_image_path, debug_image_cv2)

        # Prepare the final result dictionary to be sent back to Node.js as JSON
        result = {
            'message': 'Image processed dynamically!',
            'extracted_text': extracted_text,    # This is now lowercase and has no spaces
            'parsed_data': parsed_data,          # Structured parsed data
            'debug_image_url': f'/processed_uploads/debug_dynamic_{receipt_type}_{original_filename}',
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
