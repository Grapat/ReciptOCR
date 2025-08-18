import sys
from PIL import Image
import io
import pytesseract
import json
import importlib
import cv2
import numpy as np

# Assuming the Extractor module is in the same directory
import Extractor

# OCR Language Setting (Thai and English)
OCR_LANGUAGES = 'eng+tha'

def dynamic_parse_ocr(image_pil, original_filename="unknown"):
    initial_result = {
        "plateNo": "N/A",
        "gasProvider": "N/A",
        "transactionDate": "N/A",
        "taxInvNo": "N/A",
        "egatAddress": "N/A",
        "egatTaxId": "N/A",
        "milestone": "N/A",
        "amount": "N/A",
        "liters": "N/A",
        "pricePerLiter": "N/A",
        "VAT": "N/A",
        "gasType": "N/A",
        "original": False,
        "signature": False,
    }

    parsed_data = initial_result.copy()
    extracted_text = ""

    try:
        # Pre-process image if needed (e.g., convert to grayscale)
        image_cv2 = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)
        
        # Get extracted text using Tesseract
        extracted_text = pytesseract.image_to_string(image_cv2, lang=OCR_LANGUAGES).strip()

        # Assuming a unified extractor for now, as receipt_type is removed
        parsed_data = Extractor.extract_all(extracted_text)

    except Exception as e:
        sys.stderr.write(json.dumps(
            {"error": f"Error during OCR processing: {str(e)}"}) + "\n")
        return parsed_data, extracted_text

    return parsed_data, extracted_text

def main():
    if len(sys.argv) < 2:
        sys.stderr.write(json.dumps(
            {"error": "Usage: python ocr_processor.py <filename>"}) + "\n")
        sys.exit(1)

    original_filename = sys.argv[1]

    try:
        # Read image bytes from stdin
        image_bytes = sys.stdin.buffer.read()
        if not image_bytes:
             raise ValueError("Input stream is empty. No image bytes were received.")
        
        original_image_pil = Image.open(io.BytesIO(image_bytes))

        # Perform dynamic OCR parsing
        parsed_data, extracted_text = dynamic_parse_ocr(original_image_pil, original_filename)

        # Prepare the final result dictionary
        result = {
            'message': 'Image processed dynamically!',
            'extracted_text': extracted_text,
            'parsed_data': parsed_data,
            'status': 'complete'
        }
        # Print the JSON result to stdout
        print(json.dumps(result))

    except pytesseract.TesseractNotFoundError:
        sys.stderr.write(json.dumps(
            {"error": "Tesseract OCR engine not found. Please install it and ensure its path is correct."}) + "\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(json.dumps(
            {"error": f"An error occurred: {str(e)}"}) + "\n")
        sys.exit(1)

if __name__ == '__main__':
    main()