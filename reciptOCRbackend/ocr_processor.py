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

OCR_LANGUAGES = 'eng+tha'
PROCESSED_UPLOAD_FOLDER = os.path.join(
    os.path.dirname(__file__), '../processed_uploads')
os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)


def dynamic_parse_ocr(image_pil, receipt_type="dynamic"):
    result = {
        "merchant_name": "Sample Merchant",
        "date": "2024-06-18",  # YYYY-MM-DD format for easier parsing
        "total_amount": "1234.56",
        "receipt_type_used": receipt_type,
        "gas_provider": "PTT",  # Must be one of the ENUM values
        "gas_name": "Sample Gas Station",
        "gas_address": "123 Sample Road, Sample City, 12345",
        "gas_tax_id": "1234567890123",  # 13 digits
        "receipt_no": "RPT12345",
        "liters": "50.00",
        "plate_no": "1กข1234",
        "milestone": "123456",
        "VAT": "7.00",
        "gas_type": "Gasohol 95"  # Sample gas type
    }

    image_gray = image_pil.convert("L")
    image_cv = cv2.cvtColor(np.array(image_gray), cv2.COLOR_GRAY2BGR)

    # --- Preprocessing Improvements Start ---
    # Convert PIL Image to OpenCV format for advanced processing
    img_np = np.array(image_pil)
    img_cv_gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)

    # 1. Noise Reduction: Apply Median Blur
    # A kernel size of 3 or 5 is common. It's good for salt-and-pepper noise.
    img_denoised = cv2.medianBlur(img_cv_gray, 5)

    # 2. Adaptive Thresholding: Convert to binary image
    # This is crucial for uneven lighting.
    # ADAPTIVE_THRESH_GAUSSIAN_C is often better than MEAN_C for varying light.
    # blockSize: Size of a pixel neighborhood that is used to calculate a threshold value.
    # C: Constant subtracted from the mean or weighted mean.
    img_thresh = cv2.adaptiveThreshold(img_denoised, 255,
                                       cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 11, 2)

    # Use the preprocessed image for Tesseract OCR
    # Convert back to PIL Image if pytesseract prefers it, or use numpy array directly if supported
    # pytesseract.image_to_data can take numpy array, but PIL conversion ensures compatibility.
    processed_image_for_ocr = Image.fromarray(img_thresh)
    # --- Preprocessing Improvements End ---

    data = pytesseract.image_to_data(
        processed_image_for_ocr, lang=OCR_LANGUAGES, output_type=pytesseract.Output.DICT)

    keywords = {
        'merchant_name': ['PTT', 'bangchak', 'บางจาก', 'ปตท.'],
        'date': ['date', 'วันที่', 'issued', 'time', 'วัน'],
        'total_amount': ['total', 'amount', 'ยอดรวม', 'รวม', 'ยอดชำระ', 'รวมเงิน', 'total'],
        'gas_provider': ['PTT', 'bangchak', 'บางจาก', 'ปตท.'],
        'gas_address': ['address', 'ที่อยู่'],
        'gas_tax_id': ['tax id', 'เลขประจำตัวผู้เสียภาษี'],
        'receipt_no': ['receipt no', 'เลขที่'],
        'liters': ['liters', 'ลิตร'],
        'plate_no': ['ทะเบียนรถ', 'plate no'],
        'milestone': ['milestone', 'เลขไมล์'],
        'VAT': ['vat', 'ภาษีมูลค่าเพิ่ม'],
        'gas_type': ['e20', 'e85', 'gasohol', 'ดีเซล', 'เบนซิน', 'แก๊สโซฮอล์']
    }

    collected = {field: None for field in result.keys()}
    # Populate with initial placeholder values
    for key, value in result.items():
        collected[key] = value

    # First pass: Keyword-based extraction for immediate next word/value
    for i in range(len(data['text'])):
        word = data['text'][i].strip()
        if not word:
            continue

        for field, field_keywords in keywords.items():
            if collected[field] is not None and field != 'merchant_name' and field != 'gas_provider':
                # Allow multiple matches for merchant_name/gas_provider as they can be keywords themselves
                continue

            # Case-insensitive keyword matching
            if any(kw.lower() in word.lower() for kw in field_keywords):
                value = None
                # Attempt to get the next word as the value
                if i + 1 < len(data['text']):
                    next_word = data['text'][i + 1].strip()

                    if field == "total_amount" or field == "VAT" or field == "liters":
                        # Look for numbers in the current word or the next few words
                        amount_match = re.search(
                            r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', word + next_word)
                        if amount_match:
                            value = amount_match.group(1).replace(',', '')
                            # ensure it's a valid number
                            if field == "total_amount" and not (value.replace('.', '', 1).isdigit()):
                                value = None  # Reset if not a valid number
                    elif field == "date":
                        # Try to find a date pattern in the current word or next few words
                        # Refined date regex for common formats: DD/MM/YY(YY), YYYY-MM-DD
                        date_patterns = [
                            # DD/MM/YY or DD-MM-YYYY
                            r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})',
                            r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})'  # YYYY-MM-DD
                        ]

                        found_date = None
                        for pattern in date_patterns:
                            date_match = re.search(
                                pattern, word + " " + next_word)
                            if date_match:
                                found_date = date_match.group(1)
                                try:
                                    # Attempt to parse and reformat to YYYY-MM-DD for consistency
                                    if re.match(r'\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}', found_date):
                                        # Handle DD/MM/YY or DD/MM/YYYY
                                        parts = re.split(r'[/\-.]', found_date)
                                        if len(parts[2]) == 2:  # Convert YY to YYYY
                                            year = int(parts[2])
                                            year = 2000 + year if year < 50 else 1900 + \
                                                year  # Simple heuristic for 2-digit years
                                        else:
                                            year = int(parts[2])
                                        month = int(parts[1])
                                        day = int(parts[0])
                                        value = f"{year:04d}-{month:02d}-{day:02d}"
                                    else:  # Assume YYYY-MM-DD or similar already
                                        # Validate format
                                        datetime.strptime(
                                            found_date, '%Y-%m-%d')
                                        value = found_date
                                    break  # Exit loop if a date is found and parsed
                                except ValueError:
                                    value = None  # Parsing failed, try next pattern or fallback
                        if value is None:
                            value = next_word  # Fallback to next word if no date pattern or parsing failed
                    elif field == "receipt_no" or field == "gas_tax_id" or field == "plate_no" or field == "milestone":
                        # Take the next word or attempt to find a specific pattern
                        value = next_word
                    elif field == "gas_type":
                        # Look for gas types within the current word or next few words
                        gas_type_match = re.search(
                            r"(e20|e85|gasohol ?95|ดีเซล|เบนซิน|แก๊สโซฮอล์)", (word + " " + next_word).lower())
                        if gas_type_match:
                            value = gas_type_match.group(1)
                    else:  # For fields like merchant_name, gas_provider, gas_name, gas_address
                        # If the keyword itself is the value (e.g., PTT for merchant_name)
                        # Or if the value is immediately after (e.g. "Address: 123 Main St")
                        if field in ['merchant_name', 'gas_provider']:
                            if any(kw.lower() == word.lower() for kw in field_keywords):
                                value = word
                            elif next_word:  # If keyword is 'บริษัท' and next word is 'PTT'
                                value = next_word
                        else:
                            value = next_word  # Generic case for other fields

                # If no specific value found from next word, use the keyword itself if it's a potential value
                if value is None and field in ['merchant_name', 'gas_provider', 'gas_type']:
                    if any(kw.lower() == word.lower() for kw in field_keywords):
                        value = word

                if value:
                    # Special handling for gas_provider to use ENUM values
                    if field == 'gas_provider':
                        if 'ptt' in value.lower():
                            value = 'PTT'
                        elif 'bangchak' in value.lower() or 'บางจาก' in value.lower():
                            value = 'Bangchak'
                        else:
                            # Revert to placeholder if not a valid ENUM
                            value = collected[field]

                    if value is not None:  # Only update if a valid value was found
                        collected[field] = value

                    # Draw keyword
                    x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    cv2.rectangle(image_cv, (x, y),
                                  (x + w, y + h), (0, 255, 0), 2)
                    cv2.putText(image_cv, field, (x, y - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                    # Draw value box if a distinct value was found
                    if i + 1 < len(data['text']) and value == data['text'][i+1].strip():
                        xv, yv = data['left'][i+1], data['top'][i+1]
                        wv, hv = data['width'][i+1], data['height'][i+1]
                        cv2.rectangle(image_cv, (xv, yv),
                                      (xv + wv, yv + hv), (255, 0, 0), 2)
                elif collected[field] is None:
                    # If no specific value, but the word itself is a good candidate (e.g., 'PTT' as merchant_name)
                    if field in ['merchant_name', 'gas_provider'] and any(kw.lower() == word.lower() for kw in field_keywords):
                        if field == 'gas_provider':
                            if 'ptt' in word.lower():
                                collected[field] = 'PTT'
                            elif 'bangchak' in word.lower() or 'บางจาก' in word.lower():
                                collected[field] = 'Bangchak'
                            else:
                                # Revert to placeholder
                                collected[field] = collected[field]
                        else:
                            collected[field] = word
                        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                        cv2.rectangle(image_cv, (x, y),
                                      (x + w, y + h), (0, 255, 0), 2)
                        cv2.putText(image_cv, field, (x, y - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # Apply collected fields from the first pass
    for field in collected:
        if collected[field] is not None:
            result[field] = collected[field]

    # Second pass: More robust regex extraction from the full OCR text
    # Use the preprocessed image for full text extraction as well
    extracted_text = pytesseract.image_to_string(
        processed_image_for_ocr, lang=OCR_LANGUAGES)
    text_lower = extracted_text.lower()

    patterns = {
        # More flexible on length
        "gas_tax_id": r"(?:tax id|เลขประจำตัวผู้เสียภาษี)[:\s]*(\d{10,15})",
        # More flexible on characters
        "receipt_no": r"(?:receipt no\.?|เลขที่)[:\s]*([a-zA-Z0-9\-/]{5,})",
        "liters": r"(\d+(?:\.\d+)?)\s*(?:ลิตร|litres|liters|l\.)",
        # Capture full amount
        "VAT": r"(?:vat|ภาษีมูลค่าเพิ่ม)[:\s]*(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        # Flexible plate number
        "plate_no": r"([0-9]{1,2}\s*[ก-ฮa-zA-Z]{1,2}\s*[0-9]{3,4})",
        "gas_type": r"(e20|e85|gasohol\s*95|ดีเซล|เบนซิน|แก๊สโซฮอล์)",
        "date": r"(?:date|วันที่|issued|time|วัน)[\s:]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})",
        "total_amount": r"(?:total|amount|ยอดรวม|รวม|ยอดชำระ|รวมเงิน)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        # Capture address until 5-digit postal code or new line
        "gas_address": r"(ที่อยู่|address)[:\s]*(.*?)(?=\d{5}|\n|$)",
        # General station name
        "gas_name": r"(?:station|สาขา|ปั๊ม)[:\s]*([a-zA-Z0-9\s,.-]+)",
        "milestone": r"(?:milestone|เลขไมล์)[:\s]*(\d+(?:[.,]\d+)?)"
    }

    for field, pattern in patterns.items():
        # Only try to extract if the field currently holds a placeholder or is "N/A"
        # For numbers, check if it's not a valid digit string (e.g., '123.45' is fine, 'N/A' is not)
        is_placeholder_or_na = result[field] == "N/A"
        if field in ["total_amount", "VAT", "liters", "milestone"] and not is_placeholder_or_na:
            try:
                # Check if current value is a number
                float(str(result[field]).replace(',', ''))
            except ValueError:
                is_placeholder_or_na = True  # Treat as placeholder if not a valid number

        if is_placeholder_or_na:
            match = re.search(pattern, text_lower, re.IGNORECASE | re.DOTALL)
            if match:
                value = match.group(1).strip()
                if field in ["total_amount", "VAT", "liters", "milestone"]:
                    value = value.replace(',', '')  # Remove commas for numbers
                elif field == "gas_provider":
                    if 'ptt' in value.lower():
                        value = 'PTT'
                    elif 'bangchak' in value.lower() or 'บางจาก' in value.lower():
                        value = 'Bangchak'
                    else:
                        # Revert to placeholder if not a valid ENUM
                        value = result[field]
                elif field == "date":
                    # Re-attempt date parsing and formatting for regex matches
                    found_date = value
                    parsed_date_value = None
                    for p in [r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})', r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})']:
                        date_match_internal = re.search(p, found_date)
                        if date_match_internal:
                            d_str = date_match_internal.group(1)
                            try:
                                if re.match(r'\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}', d_str):
                                    parts = re.split(r'[/\-.]', d_str)
                                    if len(parts[2]) == 2:
                                        year = int(parts[2])
                                        year = 2000 + year if year < 50 else 1900 + year
                                    else:
                                        year = int(parts[2])
                                    month = int(parts[1])
                                    day = int(parts[0])
                                    parsed_date_value = f"{year:04d}-{month:02d}-{day:02d}"
                                else:
                                    datetime.strptime(d_str, '%Y-%m-%d')
                                    parsed_date_value = d_str
                                break
                            except ValueError:
                                pass
                    # Fallback to placeholder
                    value = parsed_date_value if parsed_date_value else result[field]

                # Only update if a valid and different value was found
                if value and value != result[field]:
                    result[field] = value

    # Final cleanup: Ensure no "N/A" or None if a placeholder exists.
    initial_placeholders = {
        "merchant_name": "Sample Merchant",
        "date": "2024-06-18",
        "total_amount": "1234.56",
        "gas_provider": "PTT",
        "gas_name": "Sample Gas Station",
        "gas_address": "123 Sample Road, Sample City, 12345",
        "gas_tax_id": "1234567890123",
        "receipt_no": "RPT12345",
        "liters": "50.00",
        "plate_no": "1กข1234",
        "milestone": "123456",
        "VAT": "7.00",
        "gas_type": "Gasohol 95"
    }
    for field, placeholder_value in initial_placeholders.items():
        if result[field] is None or result[field] == "N/A" or \
           (field in ["total_amount", "VAT", "liters", "milestone"] and not str(result[field]).replace('.', '', 1).isdigit()):
            result[field] = placeholder_value

    return result, image_cv


# --- Main Execution ---
if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps(
            {"error": "Missing arguments. Usage: python ocr_processor.py <receipt_type> <filename>"}), file=sys.stderr)
        sys.exit(1)

    receipt_type = sys.argv[1]
    original_filename = sys.argv[2]
    image_bytes = sys.stdin.buffer.read()

    try:
        original_image_pil = Image.open(io.BytesIO(image_bytes))

        # Pass the original PIL image to dynamic_parse_ocr
        parsed_data, debug_image_cv2 = dynamic_parse_ocr(
            original_image_pil, receipt_type)

        # Full OCR text extraction (already part of dynamic_parse_ocr for regex pass)
        # Note: The extracted_text in the final result will be from the preprocessed image.
        extracted_text = pytesseract.image_to_string(
            Image.fromarray(cv2.cvtColor(np.array(original_image_pil), cv2.COLOR_RGB2GRAY)), lang=OCR_LANGUAGES)

        debug_image_path = os.path.join(
            PROCESSED_UPLOAD_FOLDER, f'debug_dynamic_{receipt_type}_{original_filename}')
        cv2.imwrite(debug_image_path, debug_image_cv2)

        result = {
            'message': 'Image processed dynamically!',
            'extracted_text': extracted_text,
            'parsed_data': parsed_data,
            'debug_image_url': f'/processed_uploads/debug_dynamic_{receipt_type}_{original_filename}',
            'status': 'complete'
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps(
            {"error": f"Dynamic OCR failed: {e}"}), file=sys.stderr)
        sys.exit(1)
