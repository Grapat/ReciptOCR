import sys
import os
from PIL import Image
import io
import pytesseract
import re
import cv2
import numpy as np # Still needed for initial image_pil to np.array if extract_data expects it
import json
from datetime import datetime
import importlib

# OCR Language Setting (Thai and English)
OCR_LANGUAGES = 'eng+tha'

# Folder to save processed/debug images
PROCESSED_UPLOAD_FOLDER = os.path.join(
    os.path.dirname(__file__), '../processed_uploads')
os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)


def dynamic_parse_ocr(image_pil, receipt_type="generic", original_filename="unknown"): # Added original_filename arg
    """
    Performs dynamic OCR parsing on a given PIL image, attempting to extract
    various fields from a receipt, including EGAT specific information.

    Args:
        image_pil (PIL.Image.Image): The input receipt image as a PIL Image object.
        receipt_type (str): The type of receipt (e.g., "KBPTT", "KTBCP"), used to load specific extractor logic.
        original_filename (str): The original filename for debug output.

    Returns:
        tuple: A tuple containing:
            - dict: A dictionary of parsed data (e.g., merchant_name, total_amount, egat_address_th).
            - numpy.ndarray: An OpenCV image with bounding boxes drawn for debugging.
            - str: The full extracted OCR text, now processed to be lowercase with no spaces.
    """
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

    # Initialize debug_image_cv2 and parsed_data here with their default values
    debug_image_cv2 = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)
    parsed_data = initial_result.copy()

    # --- Preprocessing Improvements Start (REMOVED FROM HERE) ---
    # The preprocessing will now happen inside the extractor module
    # --- Preprocessing Improvements End ---

    # --- ADD THIS SECTION FOR DEBUGGING PREPROCESSED IMAGE (REMOVE OR MOVE) ---
    # This debugging block for preprocessed image should likely be moved
    # into the extractor module, as that's where preprocessing now happens.
    # For now, let's remove it from here.
    # timestamp = datetime.now().strftime("%Y%m%d")
    # preprocessed_debug_image_path = os.path.join(
    #     PROCESSED_UPLOAD_FOLDER, f'debug_preprocessed_{receipt_type}_{timestamp}_{os.path.basename(original_filename)}')
    # processed_image_for_ocr.save(preprocessed_debug_image_path)
    # sys.stderr.write(
    #     f"Preprocessed debug image saved to: {preprocessed_debug_image_path}\n")
    # --- END ADDITION ---


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
        # Pass the original PIL image to the extractor
        parsed_data, debug_image_cv2, cleaned_extracted_text_for_matching = \
            extractor_module.extract_data(image_pil, original_filename, initial_result) # Pass original_filename
    else:
        # Fallback for generic OCR if no specific extractor is found
        # In this case, you'd perform a basic OCR here with generic preprocessing
        # or just on the raw image if you prefer to have a "generic_extractor.py"
        # For simplicity, let's assume a basic generic process if no extractor
        img_np_fallback = np.array(image_pil)
        img_cv_gray_fallback = cv2.cvtColor(img_np_fallback, cv2.COLOR_RGB2GRAY)
        # Use simple adaptive thresholding for generic fallback
        img_thresh_fallback = cv2.adaptiveThreshold(img_cv_gray_fallback, 255,
                                                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                                cv2.THRESH_BINARY, 11, 2)
        processed_image_for_ocr_fallback = Image.fromarray(img_thresh_fallback)

        tesseract_config = r'--oem 1 --psm 3' # Generic default PSM
        data_fallback = pytesseract.image_to_data(processed_image_for_ocr_fallback, lang=OCR_LANGUAGES, output_type=pytesseract.Output.DICT, config=tesseract_config)
        raw_ocr_text_fallback = pytesseract.image_to_string(processed_image_for_ocr_fallback, lang=OCR_LANGUAGES, config=tesseract_config)
        cleaned_extracted_text_for_matching = raw_ocr_text_fallback.replace(' ', '').lower()
        # parsed_data remains initial_result.copy()
        # debug_image_cv2 remains as the initial conversion
        sys.stderr.write("Falling back to generic OCR with basic processing.\n")


    # Final cleanup: Change any remaining "N/A" to None for database compatibility
    for field in parsed_data:
        if parsed_data[field] == "N/A":
            parsed_data[field] = None

    return parsed_data, debug_image_cv2, cleaned_extracted_text_for_matching

# --- Main script execution ---
if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.stderr.write(json.dumps(
            {"error": "Missing arguments. Usage: python ocr_processor.py <receipt_type> <filename>"}) + "\n")
        sys.exit(1)

    receipt_type = sys.argv[1]
    original_filename = sys.argv[2] # Now passed to dynamic_parse_ocr

    try:
        # Read image bytes from stdin (as sent by Node.js multer)
        image_bytes = sys.stdin.buffer.read()
        original_image_pil = Image.open(io.BytesIO(image_bytes))

        # Perform dynamic OCR parsing and get the parsed data, debug image, AND the globally cleaned extracted text
        # Pass original_filename here
        parsed_data, debug_image_cv2, extracted_text = dynamic_parse_ocr(
            original_image_pil, receipt_type, original_filename)

        # Save the debug image with bounding boxes
        debug_image_path = os.path.join(
            PROCESSED_UPLOAD_FOLDER, f'debug_dynamic_{receipt_type}_{original_filename}')
        cv2.imwrite(debug_image_path, debug_image_cv2)

        # Prepare the final result dictionary to be sent back to Node.js as JSON
        result = {
            'message': 'Image processed dynamically!',
            'extracted_text': extracted_text,
            'parsed_data': parsed_data,
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