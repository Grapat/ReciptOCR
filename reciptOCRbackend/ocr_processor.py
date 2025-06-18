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

# OCR Language Setting (Thai and English)
OCR_LANGUAGES = 'eng+tha'

# Folder to save processed/debug images
PROCESSED_UPLOAD_FOLDER = os.path.join(
    os.path.dirname(__file__), '../processed_uploads')
os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)


def dynamic_parse_ocr(image_pil, receipt_type="dynamic"):
    """
    Performs dynamic OCR parsing on a given PIL image, attempting to extract
    various fields from a receipt, including EGAT specific information.

    Args:
        image_pil (PIL.Image.Image): The input receipt image as a PIL Image object.
        receipt_type (str): The type of receipt, used for potential future template-specific logic.

    Returns:
        tuple: A tuple containing:
            - dict: A dictionary of parsed data (e.g., merchant_name, total_amount, egat_address_th).
            - numpy.ndarray: An OpenCV image with bounding boxes drawn for debugging.
    """
    # Initialize result dictionary with "N/A" for all fields.
    # These will be replaced by OCR results or remain "N/A" if not found.
    result = {
        "merchant_name": "N/A",
        "date": "N/A",
        "total_amount": "N/A",
        "receipt_type_used": receipt_type, # Records which type was selected/processed
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
        "egat_address_th": "N/A",  # Extracted EGAT Thai address
        "egat_address_eng": "N/A", # Extracted EGAT English address
        "egat_tax_id": "N/A",      # Extracted EGAT Tax ID
    }

    # Convert PIL Image to OpenCV format for drawing bounding boxes later
    image_cv = cv2.cvtColor(np.array(image_pil), cv2.COLOR_RGB2BGR)

    # --- Preprocessing Improvements Start ---
    # Convert PIL Image to NumPy array for OpenCV processing
    img_np = np.array(image_pil)
    
    # Convert to grayscale
    img_cv_gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)

    # Noise Reduction: Apply Median Blur (kernel size 5)
    # Good for salt-and-pepper noise and smoothing.
    img_denoised = cv2.medianBlur(img_cv_gray, 5)

    # Adaptive Thresholding: Convert to binary image (black and white)
    # Crucial for uneven lighting conditions often found on receipts.
    # ADAPTIVE_THRESH_GAUSSIAN_C is generally robust.
    # blockSize: neighborhood size for threshold calculation. C: constant subtracted.
    img_thresh = cv2.adaptiveThreshold(img_denoised, 255,
                                       cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 11, 2)

    # Convert the preprocessed OpenCV image back to PIL Image for Tesseract
    processed_image_for_ocr = Image.fromarray(img_thresh)
    # --- Preprocessing Improvements End ---

    # Perform OCR to get detailed word-by-word data (for first pass: keyword-based)
    data = pytesseract.image_to_data(
        processed_image_for_ocr, lang=OCR_LANGUAGES, output_type=pytesseract.Output.DICT)

    # Keywords for various fields to identify them in OCR text
    keywords = {
        'merchant_name': ['PTT', 'BANGCHAK', 'บางจาก', 'ปตท.', 'PTTST', 'บริษัท', 'ห้างหุ้นส่วน'],
        'date': ['date', 'วันที่', 'issued', 'time', 'วัน'],
        'total_amount': ['total', 'amount', 'amount thb'],
        'gas_provider': ['PTTstation', 'bangchak', 'บางจาก', 'ปตท.', 'PTT'],
        'gas_address': ['ที่อยู่', 'address', 'ตําบล', 'อําเภอ', 'จังหวัด', 'ถ.', 'ถนน', 'ซอย', 'แขวง', 'เขต', 'ไปรษณีย์'],
        'gas_tax_id': ['tax id', 'เลขประจำตัวผู้เสียภาษี', 'เลขประจำตัว'],
        'receipt_no': ['receipt no', 'เลขที่', 'บิล'],
        'liters': ['liters', 'ลิตร', 'l'],
        'plate_no': ['ทะเบียนรถ', 'plate no', 'รถ'],
        'milestone': ['milestone', 'เลขไมล์', 'กม.'],
        'VAT': ['vat', 'ภาษีมูลค่าเพิ่ม'],
        'gas_type': ['e20', 'e85', 'gasohol', 'ดีเซล', 'เบนซิน', 'แก๊สโซฮอล์', '91', '95', 'diesel', 'hi disel s'],
        'egat_address_th': ['การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย', 'กฟผ', 'กฟผ.', 'นนทบุรี', 'บางกรวย'], # Keywords for EGAT TH address
        'egat_address_eng': ['Electricity Generating Authority of Thailand', 'EGAT', 'Nonthaburi', 'Bang Kruai'], # Keywords for EGAT ENG address
        'egat_tax_id': ['egat tax id', 'เลขประจำตัวผู้เสียภาษีกฟผ','tax id'], # Keywords for EGAT Tax ID
    }

    # Collect fields in this pass. Use a temporary dict for robust update logic.
    collected = {field: "N/A" for field in result.keys()} 

    # First pass: Keyword-based extraction. Look for keywords and try to extract value immediately next to it.
    for i in range(len(data['text'])):
        word = data['text'][i].strip()
        if not word:
            continue

        for field, field_keywords in keywords.items():
            # If the field is already collected and it's not a multi-word field (like address), skip.
            # Addresses can appear in multiple lines/words, so we don't skip if already found here.
            if collected[field] != "N/A" and field not in ['merchant_name', 'gas_provider', 'gas_address', 'egat_address_th', 'egat_address_eng']:
                continue

            # Check if current word (or part of it) matches any keyword for the field
            if any(kw.lower() in word.lower() for kw in field_keywords):
                value = None
                next_word_idx = i + 1
                
                # Logic to capture potential value (next word or part of current)
                if field in ["total_amount", "VAT", "liters", "milestone"]:
                    # Try to capture the number pattern from current word or next few words
                    text_to_search = " ".join(data['text'][i:min(i+3, len(data['text']))]) # Look current + 2 more words
                    amount_match = re.search(r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', text_to_search)
                    if amount_match:
                        value = amount_match.group(1).replace(',', '')
                        if not (value.replace('.', '', 1).isdigit()): # Validate if it's purely numeric
                            value = None
                elif field == "date":
                    # Look for date patterns in current and next few words
                    text_to_search = " ".join(data['text'][i:min(i+4, len(data['text']))]) # Look current + 3 more words
                    date_patterns = [
                        r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})', # DD/MM/YY or DD/MM/YYYY
                        r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})'   # YYYY-MM-DD
                    ]
                    for pattern in date_patterns:
                        date_match = re.search(pattern, text_to_search)
                        if date_match:
                            d_str = date_match.group(1)
                            try:
                                # Attempt to parse and reformat to YYYY-MM-DD for consistency
                                if re.match(r'\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}', d_str):
                                    parts = re.split(r'[/\-.]', d_str)
                                    year = int(parts[2])
                                    year = 2000 + year if year < 50 else 1900 + year # Heuristic for 2-digit years
                                    month = int(parts[1])
                                    day = int(parts[0])
                                    value = f"{year:04d}-{month:02d}-{day:02d}"
                                else: # Assume YYYY-MM-DD or similar
                                    datetime.strptime(d_str, '%Y-%m-%d')
                                    value = d_str
                                break # Exit loop if a date is found and parsed
                            except ValueError:
                                value = None # Parsing failed, try next pattern or fallback
                    
                elif field in ["receipt_no", "gas_tax_id", "plate_no", "egat_tax_id"]:
                    # For IDs and specific numbers, look for digits/alphanumeric strings
                    text_to_search = " ".join(data['text'][i:min(i+3, len(data['text']))])
                    if field == "egat_tax_id" or field == "gas_tax_id":
                        tax_id_match = re.search(r'\d{10,15}', text_to_search) # Look for 10-15 digits
                        if tax_id_match: value = tax_id_match.group(0)
                    elif field == "plate_no":
                        plate_match = re.search(r'[0-9]{1,2}\s*[ก-ฮa-zA-Z]{1,2}\s*[0-9]{3,4}', text_to_search)
                        if plate_match: value = plate_match.group(0)
                    elif field == "receipt_no":
                        receipt_no_match = re.search(r'[a-zA-Z0-9\-/]{5,}', text_to_search) # Generic alphanumeric
                        if receipt_no_match: value = receipt_no_match.group(0)
                
                elif field == "gas_type":
                    text_to_search = " ".join(data['text'][i:min(i+3, len(data['text']))])
                    gas_type_match = re.search(
                        r"(e20|e85|gasohol ?95|ดีเซล|เบนซิน|แก๊สโซฮอล์)", text_to_search.lower())
                    if gas_type_match: value = gas_type_match.group(1)
                
                elif field in ['merchant_name', 'gas_name', 'gas_provider']:
                    # If the keyword itself is the value (e.g., PTT for merchant_name)
                    # Or if the value is immediately after (e.g. "Station: PTT XYZ")
                    if any(kw.lower() == word.lower() for kw in field_keywords):
                        value = word
                    elif next_word_idx < len(data['text']) and data['text'][next_word_idx].strip():
                        value = data['text'][next_word_idx].strip()
                        
                    # Handle specific ENUM for gas_provider
                    if field == 'gas_provider' and value != "N/A":
                        if 'ptt' in value.lower(): value = 'PTT'
                        elif 'bangchak' in value.lower() or 'บางจาก' in value.lower(): value = 'Bangchak'
                        else: value = "N/A" # Default if not recognized ENUM

                elif field in ['gas_address', 'egat_address_th', 'egat_address_eng']:
                    # For addresses, collect several words/lines until next block or keyword.
                    # This is a basic attempt; robust address parsing is complex.
                    collected_address_words = []
                    current_line_num = data['line_num'][i]
                    for k in range(i + 1, len(data['text'])):
                        if data['text'][k].strip() and data['line_num'][k] == current_line_num:
                            collected_address_words.append(data['text'][k].strip())
                        elif data['text'][k].strip() and data['line_num'][k] == current_line_num + 1: # Next line part of address
                            collected_address_words.append(data['text'][k].strip())
                            current_line_num += 1
                        else:
                            break # Stop at empty lines or new block
                    
                    if collected_address_words:
                        value = " ".join(collected_address_words)
                        # Clean up common address remnants
                        value = re.sub(r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email)', '', value, flags=re.IGNORECASE).strip()
                    else:
                        value = "N/A" # Fallback if nothing found immediately after


                # Only update if a valid and different value was found and current value is placeholder
                if value is not None and value != "N/A" and collected[field] == "N/A":
                    collected[field] = value
                    
                    # Draw keyword and value boxes for debugging
                    x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    # Ensure coordinates are within image bounds before drawing
                    if 0 <= x < x + w <= image_cv.shape[1] and 0 <= y < y + h <= image_cv.shape[0]:
                        cv2.rectangle(image_cv, (x, y), (x + w, y + h), (0, 255, 0), 2) # Green for keyword
                        cv2.putText(image_cv, field, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                    # Try to draw a box around the primary value if it's identified as the next word
                    if next_word_idx < len(data['text']):
                        xv, yv = data['left'][next_word_idx], data['top'][next_word_idx]
                        wv, hv = data['width'][next_word_idx], data['height'][next_word_idx]
                        if 0 <= xv < xv + wv <= image_cv.shape[1] and 0 <= yv < yv + hv <= image_cv.shape[0]:
                             cv2.rectangle(image_cv, (xv, yv), (xv + wv, yv + hv), (255, 0, 0), 2) # Blue for value


    # Apply collected fields from the first pass to the final result
    for field in collected:
        if collected[field] != "N/A":
            result[field] = collected[field]

    # Second pass: More robust regex extraction from the full OCR text
    # This pass is good for capturing fields that might not be immediately next to keywords
    # or span multiple lines/words.
    extracted_text = pytesseract.image_to_string(processed_image_for_ocr, lang=OCR_LANGUAGES)
    text_lower = extracted_text.lower()

    patterns = {
        # Regex for EGAT Thai address. Tries to capture lines after EGAT keywords until a postal code/phone/fax/tax id.
        "egat_address_th": r"(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|egat)[:\s]*([\s\S]*?)(?=\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|tax id|$)|(?:phone|fax|เลขประจำตัวผู้เสียภาษี|tax id|$))",
        # Regex for EGAT English address. Similar logic.
        "egat_address_eng": r"(?:electricity generating authority of thailand|egat)[:\s]*([\s\S]*?)(?=\d{5}\s*(?:|phone|fax|web|email|tax id|$)|(?:โทร|โทรสาร|เลขประจำตัวผู้เสียภาษี|tax id|$))",
        # More robust tax ID pattern for EGAT.
        "egat_tax_id": r"(?:egat tax id|เลขประจำตัวผู้เสียภาษีกฟผ|เลขประจำตัวผู้เสียภาษี)\s*[:]?\s*(\d{10,15})",
        
        "gas_tax_id": r"(?:tax id|เลขประจำตัวผู้เสียภาษี)[:\s]*(\d{10,15})",
        "receipt_no": r"(?:receipt no\.?|เลขที่)[:\s]*([a-zA-Z0-9\-/]{5,})",
        "liters": r"(\d+(?:\.\d+)?)\s*(?:ลิตร|litres|liters|l\.)",
        "VAT": r"(?:vat|ภาษีมูลค่าเพิ่ม)[:\s]*(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        "plate_no": r"([0-9]{1,2}\s*[ก-ฮa-zA-Z]{1,2}\s*[0-9]{3,4})",
        "gas_type": r"(e20|e85|gasohol\s*95|ดีเซล|เบนซิน|แก๊สโซฮอล์)",
        "date": r"(?:date|วันที่|issued|time|วัน)[\s:]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})",
        "total_amount": r"(?:total|amount|ยอดรวม|รวม|ยอดชำระ|รวมเงิน)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        "gas_address": r"(ที่อยู่|address)[:\s]*(.*?)(?=\d{5}|\n|$)", # Capture address until 5-digit postal code or new line
        "gas_name": r"(?:station|สาขา|ปั๊ม)[:\s]*([a-zA-Z0-9\s,.-]+)",
        "milestone": r"(?:milestone|เลขไมล์)[:\s]*(\d+(?:[.,]\d+)?)"
    }

    for field, pattern in patterns.items():
        # Only try to extract if the field currently holds "N/A" (or if it's a number and current value is not valid)
        is_placeholder_or_na = result[field] == "N/A"
        if field in ["total_amount", "VAT", "liters", "milestone", "egat_tax_id", "gas_tax_id"] and not is_placeholder_or_na:
            try:
                # Check if current value is a valid number/ID string
                float(str(result[field]).replace(',', '').replace('-', '')) # Allow '-' for IDs
            except ValueError:
                is_placeholder_or_na = True 

        if is_placeholder_or_na:
            match = re.search(pattern, extracted_text, re.IGNORECASE | re.DOTALL)
            if match:
                value = match.group(1).strip()
                if field in ["total_amount", "VAT", "liters", "milestone", "egat_tax_id", "gas_tax_id"]:
                    value = value.replace(',', '')  # Remove commas for numbers/IDs
                elif field == "gas_provider":
                    if 'ptt' in value.lower(): value = 'PTT'
                    elif 'bangchak' in value.lower() or 'บางจาก' in value.lower(): value = 'Bangchak'
                    else: value = "N/A"
                elif field == "date":
                    parsed_date_value = None
                    for p in [r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})', r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})']:
                        date_match_internal = re.search(p, value)
                        if date_match_internal:
                            d_str = date_match_internal.group(1)
                            try:
                                if re.match(r'\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}', d_str):
                                    parts = re.split(r'[/\-.]', d_str)
                                    year = int(parts[2])
                                    year = 2000 + year if year < 50 else 1900 + year
                                    month = int(parts[1])
                                    day = int(parts[0])
                                    parsed_date_value = f"{year:04d}-{month:02d}-{day:02d}"
                                else:
                                    datetime.strptime(d_str, '%Y-%m-%d')
                                    parsed_date_value = d_str
                                break
                            except ValueError:
                                pass
                    value = parsed_date_value if parsed_date_value else "N/A"
                
                # Only update if a valid and different value was found and current value is placeholder
                if value != "N/A" and value != result[field]:
                    result[field] = value

    # Final cleanup: Change any remaining "N/A" to None for database compatibility
    for field in result:
        if result[field] == "N/A":
            result[field] = None


    return result, image_cv


# --- Main script execution ---
# This part is executed when the Python script is run as a standalone process (e.g., by Node.js spawn)
if __name__ == '__main__':
    # Expected arguments from Node.js: receipt_type, original_filename
    if len(sys.argv) < 3:
        # If arguments are missing, print an error message to stderr and exit
        print(json.dumps(
            {"error": "Missing arguments. Usage: python ocr_processor.py <receipt_type> <filename>"}), file=sys.stderr)
        sys.exit(1)

    receipt_type = sys.argv[1]        # Get receipt type from command-line arguments
    original_filename = sys.argv[2]   # Get original filename from command-line arguments

    # Read image bytes from stdin (as sent by Node.js multer)
    image_bytes = sys.stdin.buffer.read()

    try:
        # Open the image using PIL (Pillow) from the received bytes
        original_image_pil = Image.open(io.BytesIO(image_bytes))

        # Perform dynamic OCR parsing and get the parsed data and debug image
        parsed_data, debug_image_cv2 = dynamic_parse_ocr(
            original_image_pil, receipt_type)

        # Extract full OCR text from the preprocessed image (useful for frontend display)
        # Note: This uses the processed image, not the raw one, for better OCR quality.
        extracted_text = pytesseract.image_to_string(
            Image.fromarray(cv2.cvtColor(np.array(original_image_pil.convert('L')), cv2.COLOR_GRAY2BGR)), # Ensure it's grayscale for full text
            lang=OCR_LANGUAGES
        )
        
        # Save the debug image with bounding boxes
        debug_image_path = os.path.join(
            PROCESSED_UPLOAD_FOLDER, f'debug_dynamic_{receipt_type}_{original_filename}')
        cv2.imwrite(debug_image_path, debug_image_cv2)

        # Prepare the final result dictionary to be sent back to Node.js as JSON
        result = {
            'message': 'Image processed dynamically!',
            'extracted_text': extracted_text,    # Full raw OCR text
            'parsed_data': parsed_data,          # Structured parsed data
            'debug_image_url': f'/processed_uploads/debug_dynamic_{receipt_type}_{original_filename}', # URL to debug image
            'status': 'complete'
        }
        # Print the JSON result to stdout, which Node.js will capture
        print(json.dumps(result))

    except pytesseract.TesseractNotFoundError:
        print(json.dumps({"error": "Tesseract OCR engine not found. Please install it and ensure its path is correct."}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        # Catch any other exceptions during processing and report them
        print(json.dumps(
            {"error": f"Dynamic OCR failed: {e}"}), file=sys.stderr)
        sys.exit(1)

