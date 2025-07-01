import re
from datetime import datetime
import cv2
import numpy as np
import logging
import os
from PIL import Image  # Make sure PIL is imported for image_pil handling
import pytesseract  # Import pytesseract

# This will create a 'logs_a5' folder right next to A5_extractor.py
LOG_FOLDER = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(LOG_FOLDER, exist_ok=True)
LOG_FILE_PATH = os.path.join(LOG_FOLDER, 'a5_extractor.log')

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

file_handler = logging.FileHandler(
    LOG_FILE_PATH, encoding='utf-8')  # Add encoding='utf-8'
file_handler.setLevel(logging.DEBUG)

formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)

if not logger.handlers:
    logger.addHandler(file_handler)
# --- Logging Configuration End ---

# --- Global settings for OCR (can be passed from ocr_processor if preferred) ---
OCR_LANGUAGES = 'eng+tha'
# Assuming PROCESSED_UPLOAD_FOLDER is relative to the backend's root
# This will be used to save debug preprocessed images
PROCESSED_UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), 'processed_uploads')
os.makedirs(PROCESSED_UPLOAD_FOLDER, exist_ok=True)
# --- End Global settings ---


# Helper functions for common extraction logic (unchanged from your file)
def _extract_amount(text_to_search):
    amount_match = re.search(
        r'(\d{1,3}(?:,\d{3})*\.\d{2}(?!\d))', text_to_search)
    if amount_match:
        value = amount_match.group(1)
        cleaned_value = value.replace(',', '')

        if '.' in cleaned_value:
            parts = cleaned_value.split('.')
            if len(parts[1]) == 1:  # Only one digit after the decimal point
                cleaned_value += '0'  # Add a zero to make it two decimal places
            # Ensure it's a valid float conversion, if not, return None
            try:
                return float(cleaned_value)
            except ValueError:
                return None
        # If no decimal point, treat as integer and convert to float
        try:
            return float(cleaned_value)
        except ValueError:
            return None
    logger.debug(f"No amount found in '{text_to_search}'")
    return None


def _extract_date(text_to_search):
    logger.debug(f"Attempting to extract date from: '{text_to_search}'")
    text_to_search = re.sub(r'\s+', ' ', text_to_search).strip()

    date_patterns = [
        (r'(\d{1,2}/\d{1,2}/\d{4})', ['%d/%m/%Y'])
    ]

    for pattern, formats in date_patterns:
        match = re.search(pattern, text_to_search)
        if not match:
            continue

        date_str = match.group(1).strip()

        for fmt in formats:
            try:
                parsed = datetime.strptime(date_str, fmt)
                return parsed.strftime('%d-%m-%Y')
            except ValueError:
                continue

    logger.debug(f"No valid date found in '{text_to_search}' after keyword.")
    return None


def _extract_id(text_to_search, min_len=10, max_len=15):
    # Regex to find sequences of digits that could be a tax ID or receipt number
    id_match = re.search(r'\b\d{' + str(min_len) + r',' +
                         str(max_len) + r'}\b', text_to_search)
    if id_match:
        logger.debug(f"Extracted ID: {id_match.group(0)}")
        return id_match.group(0)
    logger.debug(
        f"No ID (length {min_len}-{max_len}) found in '{text_to_search}'")
    return None


def _extract_plate_no(text_to_search):
    plate_no_match = re.search(
        r'(?:ทะเบียนรถ|เบียนรถ)[:\s]*(.{8})', text_to_search, re.IGNORECASE)
    if plate_no_match:
        logger.debug(
            f"Extracted plate number: {plate_no_match.group(1).replace(' ', '')}")
        return plate_no_match.group(1).replace(" ", "")
    logger.debug(f"No plate number found in '{text_to_search}'")
    return None


def _extract_milestone(text_to_search):
    # Regex to find numbers followed by "km" or "กม" (kilometers)
    milestone_match = re.search(
        r'(\d{1,}(?:[.,]\d{1,})?)\s*(?:km|กม|ก.ม.)', text_to_search, re.IGNORECASE
    )
    if milestone_match:
        value = milestone_match.group(1).replace(',', '')
        try:
            return float(value)
        except ValueError:
            return None
    logger.debug(f"No milestone found in '{text_to_search}'")
    return None


def _normalize_gas_type(text):
    text = text.upper().replace(" ", "").replace("-", "")
    if "DIESEL" in text:
        return "DIESEL"
    elif "E20" in text:
        return "E20"
    elif "E85" in text:
        return "E85"
    elif "GASOHOL" in text:
        return "GASOHOL"
    elif "HIDIESEL" in text:
        return "HI DIESEL"
    return None


# Modified extract_data function to include preprocessing and OCR
def extract_data(image_pil, original_filename, initial_result):  # New signature
    logger.info("Starting combined keyword and regex extraction for A5 type.")
    # Initialize result dictionary with values from initial_result, converting "N/A" to None
    result = {field: (initial_result[field] if initial_result[field]
                      != "N/A" else None) for field in initial_result.keys()}

    # Ensure receipt_type_used is set
    result["receipt_type_used"] = "A5"

    # --- Preprocessing specific to A5 receipt type starts here ---
    img_np = np.array(image_pil)
    # Convert to BGR for OpenCV drawing if the original is RGB
    debug_image_cv2 = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    img_cv_gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)

    # Denoising: Median Blur is good for thermal receipts
    # Kernel size 3 is a good starting point
    img_denoised = cv2.medianBlur(img_cv_gray, 1)

    # Adaptive Thresholding: Crucial for varied lighting. Experiment with blockSize and C
    # For A5.jpg (clear image), blockSize 21 and C=5 or C=2 should work well
    img_thresh = cv2.adaptiveThreshold(img_denoised, 255,
                                       cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 21, 10)  # <--- TWEAK THESE VALUES FOR A5 TYPE

    # Optional: Morphological operations (uncomment and adjust as needed)
    # kernel = np.ones((2,2), np.uint8) # Define kernel here if uncommenting
    # img_thresh = cv2.morphologyEx(img_thresh, cv2.MORPH_OPEN, kernel, iterations=1) # Remove small noise
    # img_thresh = cv2.dilate(img_thresh, kernel, iterations=1) # Thicken thin text slightly

    # Convert the processed OpenCV image (numpy array) back to PIL for pytesseract
    processed_image_for_ocr = Image.fromarray(img_thresh)

    # --- Optional: Save preprocessed debug image from within the extractor ---
    timestamp = datetime.now().strftime(
        "%Y%m%d_%H%M%S")  # Include time for uniqueness
    # Use original_filename for more context in debug file
    base_original_filename = os.path.basename(original_filename)
    preprocessed_debug_image_path = os.path.join(
        PROCESSED_UPLOAD_FOLDER, f'debug_preprocessed_A5_{timestamp}_{base_original_filename}')
    processed_image_for_ocr.save(preprocessed_debug_image_path)
    logger.debug(
        f"Preprocessed debug image saved to: {preprocessed_debug_image_path}")
    # --- Preprocessing specific to A5 receipt type ends here ---

    # --- Tesseract OCR specific to A5 receipt type starts here ---
    # Define Tesseract configuration string
    # For A5.jpg, `--psm 6` (single uniform block) or `--psm 4` (single column) are good starting points.
    # Keep `--oem 1` for the LSTM engine.
    tesseract_config = r'--oem 1 --psm 3'  # <--- TWEAK THIS FOR A5 TYPE

    # Perform OCR to get detailed word-by-word data
    data = pytesseract.image_to_data(
        processed_image_for_ocr, lang=OCR_LANGUAGES, output_type=pytesseract.Output.DICT, config=tesseract_config)

    # Perform OCR to get the full raw text
    raw_ocr_text = pytesseract.image_to_string(
        processed_image_for_ocr, lang=OCR_LANGUAGES, config=tesseract_config)

    # Clean the extracted text for matching (lowercase, no spaces)
    cleaned_extracted_text_for_matching = raw_ocr_text.replace(' ', '').lower()
    # --- Tesseract OCR specific to A5 receipt type ends here ---

    # Define all global regex patterns here. These are used as a fallback if keyword-based fails.
    global_regex_patterns = {
        # Adjusted date regex for better capture after keywords
        "date": r"(?:วันที่พิมพ์|มือจ่าย)\s*(\d{1,2}/\d{1,2}/\d{4})",
        "egat_address_th": r"(ที่อยู่(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.).*?\s.*?1130)",
        "egat_address_eng": r"((?:electricitygeneratingauthorityofthailand|egat).*?\s.*?1130)",
        "egat_tax_id": r"(?:เสียภาษี|ภาษี)[:\s]*(\d{10,15})",
        "merchant_name": r"((บริษัท.*?กัด)|(ห้างหุ้น.*?กัด))",
        "total_amount": r"(?:fleet.*?)(?P<money_amount>\d{1,3}(?:\d{3})*\.\d{2}(?!\d))",
        "gas_type": r"(DIESEL|E20|E85|GASOHOL|HI DIESEL)",
        "gas_address": r"(?:ที่อยู่|address|addr)[:\s]*(.*?)(?:\s*\b\d{5}\b)?(?=\s*(?:โทร|tel|tax|fax|เลขประจำตัวผู้เสียภาษี|$))",
        "plate_no": r'(?:ทะเบียนรถ|เบียนรถ)[:\s]*(.{7})',
        "gas_tax_id": r'(?:เสียภาษี|ภาษี)[:\s]*(\d{10,15})',
        "milestone": r'(?:เลขไมล์|ไมล์)[:\s]*(.{6})',
        "receipt_no": r"(?:เลขที่ใบกํากับภาษี)[\s:#(]*((?:TIO)?\d{18}|\d{18}|\d{6}|[A-Z0-9\-/]{5,20})",
    }

    # Define keyword mappings for local, keyword-based extraction (unchanged from your file)
    keyword_mappings = {
        "total_amount": ["เป็นเงิน"],
        "date": ["วันที่พิมพ์", "วันที่", "date", "วันที่ขาย", "มือจ่าย"],
        "receipt_no": ["เลขที่", "เลขใบกำกับภาษี"],
        "liters": ["ลิตร", "liters", "litre", "l"],
        "plate_no": ["ทะเบียนรถ", "เบียนรถ"],
        "milestone": ["ระยะ", "km", "กม", "เลขไมล์"],
        "VAT": ["vat", "ภาษีมูลค่าเพิ่ม"],
        "gas_address": ["ที่อยู่", "อยู่"],
        "gas_type": ["ดีเซล", "เบนซิน", "e20", "e85", "gasohol", "hi-diesel"],
        "merchant_name": ["บริษัท", "จำกัด"],
        "egat_address_th": ["การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย", "กฟผ."],
        "egat_address_eng": ["electricity", "generating", "authority", "of", "thailand", "egat"],
        "egat_tax_id": ["เลขประจำตัวผู้เสียภาษี", "taxid", "099"],
        "gas_provider": ["ptt"],
        "gas_tax_id": ["เลขประจำตัวผู้เสียภาษี", "เสียภาษี"],
    }

    # Iterate through each field to extract data (unchanged from your file)
    fields_to_extract_order = [
        "date", "total_amount", "receipt_no", "liters", "plate_no", "milestone",
        "VAT", "gas_type", "gas_address", "merchant_name", "egat_address_th",
        "egat_address_eng", "egat_tax_id", "gas_provider", "gas_tax_id"
    ]

    for field in fields_to_extract_order:
        # Skip if the field already has a value from initial_result or a previous pass
        if result[field] is not None:
            continue

        extracted_value = None  # Reset for each field

        # --- Attempt 1: Keyword-based extraction (local context) ---
        # Iterate through words in the OCR data to find keywords
        if field in keyword_mappings:  # Only attempt if keywords are defined for the field
            for i in range(len(data['text'])):
                word = data['text'][i].strip()
                if not word:
                    continue

                if any(kw.lower() in word.lower() for kw in keyword_mappings[field]):
                    logger.debug(
                        f"Keyword '{word}' matched for field '{field}'. Attempting local extraction.")
                    # Define context for local extraction (current word and next 4 words)
                    text_to_search = " ".join(
                        data['text'][i:min(i+5, len(data['text']))])

                    # Apply field-specific extraction logic using helper functions
                    if field == "date":
                        extracted_value = _extract_date(text_to_search)
                    elif field == "total_amount":
                        extracted_value = _extract_amount(text_to_search)
                    elif field == "VAT":
                        extracted_value = _extract_amount(text_to_search)
                    elif field == "liters":
                        extracted_value = _extract_amount(text_to_search)
                    elif field == "receipt_no":
                        receipt_match = re.search(
                            r'((?:TIO)?\d{15}|\d{18}|\d{6}|[A-Z0-9\-/]{5,20})', text_to_search, re.IGNORECASE)
                        if receipt_match:
                            extracted_value = receipt_match.group(1).strip()
                    elif field == "plate_no":
                        extracted_value = _extract_plate_no(text_to_search)
                    elif field == "milestone":
                        extracted_value = _extract_milestone(text_to_search)
                    elif field == "gas_type":
                        extracted_value = _normalize_gas_type(text_to_search)
                    elif field == 'merchant_name':
                        # Special handling for company names with "บริษัท" and "จำกัด"
                        if any(kw.lower() == word.lower() for kw in ['บริษัท', 'จำกัด']):
                            company_name_words = []
                            # Look a few words ahead
                            for k in range(i, min(i+5, len(data['text']))):
                                w = data['text'][k].strip()
                                if w:
                                    company_name_words.append(w)
                                    if 'จำกัด' in w.lower():  # Stop if "จำกัด" is found
                                        break
                            if company_name_words:
                                full_name = " ".join(company_name_words)
                                if 'บริษัท' in full_name and 'จำกัด' in full_name:
                                    extracted_value = full_name
                    elif field in ['egat_address_th', 'egat_address_eng']:
                        # Logic to extract address lines after EGAT keywords
                        collected_address_words = []
                        current_line_num = data['line_num'][i]
                        for k in range(i + 1, len(data['text'])):
                            # Collect words on the same or next line
                            if data['text'][k].strip() and data['line_num'][k] == current_line_num:
                                collected_address_words.append(
                                    data['text'][k].strip())
                            elif data['text'][k].strip() and data['line_num'][k] == current_line_num + 1:
                                collected_address_words.append(
                                    data['text'][k].strip())
                                current_line_num += 1  # Move to the next line number if a word from it is collected
                            else:
                                break  # Stop if a gap or completely new line
                        if collected_address_words:
                            val = " ".join(collected_address_words)
                            # Clean address from trailing non-address info (zip code, phone, tax ID etc.)
                            extracted_value = re.sub(
                                r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', val, flags=re.IGNORECASE).strip()
                            if extracted_value == '':  # If cleaning made the address empty
                                extracted_value = None
                    elif field in ['egat_tax_id', 'gas_tax_id']:
                        extracted_value = _extract_id(text_to_search, 13, 13)
                    elif field == "gas_provider":
                        lower_text = text_to_search.lower()
                        if "ptt" in lower_text:
                            extracted_value = "PTT"
                        else:
                            extracted_value = "Bangchak"

                    # If a value was extracted, update result and break from word loop
                    if extracted_value is not None:
                        result[field] = extracted_value
                        logger.debug(
                            f"Keyword-based extraction successful for '{field}': '{extracted_value}'")
                        # Visual debugging: Draw bounding box around the keyword
                        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                        if 0 <= x < x + w <= debug_image_cv2.shape[1] and 0 <= y < y + h <= debug_image_cv2.shape[0]:
                            cv2.rectangle(debug_image_cv2, (x, y),
                                          (x + w, y + h), (0, 255, 0), 2)
                            cv2.putText(debug_image_cv2, field, (x, y - 10),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                        break  # Break from word loop, move to next field

        # --- Attempt 2: Global Regex if keyword-based failed OR field is better handled by global regex ---
        # This block runs only if the field is still None OR it's a field primarily extracted by global regex.
        if result[field] is None and field in global_regex_patterns:
            logger.debug(f"Attempting global regex for '{field}'.")
            match = re.search(
                # Use cleaned_extracted_text_for_matching
                global_regex_patterns[field], cleaned_extracted_text_for_matching, re.IGNORECASE | re.DOTALL)
            if match:
                value_from_regex = None

                if field == "total_amount":
                    value_from_regex = _extract_amount(
                        match.group('money_amount').strip())
                elif field == "date":
                    value_from_regex = _extract_date(
                        match.group(1).strip()
                    )
                elif field in ["egat_tax_id", "gas_tax_id"]:
                    value_from_regex = _extract_id(match.group(
                        1).strip(), 10, 15)
                elif field == "merchant_name":
                    val = match.group(0).strip()
                    if val.startswith('บริษัท') and val.endswith('จำกัด'):
                        core_name = val[len('บริษัท'):-len('จำกัด')].strip()
                        value_from_regex = f'บริษัท {core_name} จำกัด'
                    else:
                        value_from_regex = val  # Fallback to raw regex match
                elif field == "gas_type":
                    value_from_regex = _normalize_gas_type(
                        match.group(0).strip())
                elif field == "gas_address":
                    value_from_regex = match.group(1).strip()
                    if value_from_regex:
                        value_from_regex = re.sub(
                            r'\s*(?:โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid|ใบเสร็จรับเงิน).*$', '', value_from_regex, flags=re.IGNORECASE).strip()
                        if value_from_regex == '':
                            value_from_regex = None
                elif field in ["egat_address_th", "egat_address_eng"]:
                    # Group 1 for the address text
                    value_from_regex = match.group(1).strip()
                    if value_from_regex:
                        value_from_regex = re.sub(
                            r'\s*(?:โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*$', '', value_from_regex, flags=re.IGNORECASE).strip()
                        if value_from_regex == '':
                            value_from_regex = None
                elif field == "plate_no":
                    value_from_regex = match.group(1).strip().replace(" ", "")
                elif field == "receipt_no":
                    value_from_regex = match.group(1).strip()

                else:
                    value_from_regex = match.group(1).strip() if len(
                        match.groups()) > 0 else match.group(0).strip()

                # End of regex
                if value_from_regex is not None:
                    result[field] = value_from_regex
                    logger.debug(
                        f"Global regex extraction successful for '{field}': '{value_from_regex}'")
                else:
                    logger.debug(
                        f"Global regex for '{field}' matched but extracted value was empty/None.")
            else:
                logger.debug(
                    f"Global regex pattern for '{field}' did not match in full OCR text.")

        # If after both attempts, the field is still None, ensure it's marked as "N/A" for final output consistency
        if result[field] is None:
            logger.debug(
                f"Field '{field}' remains None after all extraction attempts.")
            # Set back to "N/A" for consistency if nothing found
            result[field] = "N/A"
        logger.info(f"END {field}")
    logger.info("Combined extraction completed.")

    # Return the updated parsed data, debug image, and cleaned OCR text
    return result, debug_image_cv2, cleaned_extracted_text_for_matching
