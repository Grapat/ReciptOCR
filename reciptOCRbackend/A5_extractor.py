import re
from datetime import datetime
import cv2
import numpy as np
import logging
import os

# This will create a 'logs_a5' folder right next to A5_extractor.py
LOG_FOLDER = os.path.join(os.path.dirname(__file__), 'logs_a5')
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

# Helper functions for common extraction logic


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

    # Look for these keywords before extracting dates
    date_keywords = ["วันที่", "date", "วันที่ขาย",
                     "วันที่พิมพ์", "วัน", "ออกใบ", "มือจ่าย"]

    # If any keyword exists, only search in the portion *after* the first match
    keyword_found = False
    for keyword in date_keywords:
        if keyword.lower() in text_to_search.lower():
            idx = text_to_search.lower().find(keyword.lower())
            # Keep only text after keyword
            text_to_search = text_to_search[idx:]
            keyword_found = True
            break  # Stop at the first keyword found

    if not keyword_found:
        logger.debug("No date-related keyword found.")
        return None

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


def _extract_liters(text_to_search):
    liters_match = re.search(
        r'(\d{1,}(?:[.,]\d{1,})?)\s*(?:ลิตร|liters|litre|L)', text_to_search, re.IGNORECASE
    )
    if liters_match:
        value = liters_match.group(1).replace(',', '')
        try:
            return float(value)
        except ValueError:
            return None
    logger.debug(f"No liters found in '{text_to_search}'")
    return None


def _extract_vat(text_to_search):
    vat_match = re.search(
        r'(?:VAT|ภาษีมูลค่าเพิ่ม)[\s:]*(\d{1,}(?:[.,]\d{2})?)', text_to_search, re.IGNORECASE)
    if vat_match:
        value = vat_match.group(1).replace(',', '')
        try:
            return float(value)
        except ValueError:
            return None
    logger.debug(f"No VAT found in '{text_to_search}'")
    return None


def _extract_plate_no(text_to_search):
    plate_no_match = re.search(
        # Thai or English plate number
        r'[ก-ฮa-zA-Z]{1,2}\s*\d{1,4}[ก-ฮa-zA-Z]{0,3}', text_to_search)
    if plate_no_match:
        return plate_no_match.group(0).replace(" ", "")
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


def extract_data(data, image_cv, full_ocr_text, initial_result):
    logger.info("Starting combined keyword and regex extraction.")
    # Initialize result dictionary with values from initial_result, converting "N/A" to None
    result = {field: (initial_result[field] if initial_result[field]
                      != "N/A" else None) for field in initial_result.keys()}

    # Define all global regex patterns here. These are used as a fallback if keyword-based fails.
    global_regex_patterns = {
        "date": r"(มือจ่าย\d{2}/\d{2}/\d{4}|วันที่ขาย\d{2}/\d{2}/\d{4}|วันที่พิมพ์\d{2}/\d{2}/\d{4})",
        "egat_address_th": r"(ที่อยู่(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.).*?\s.*?1130)",
        "egat_address_eng": r"((?:electricitygeneratingauthorityofthailand|egat).*?\s.*?1130)",
        "egat_tax_id": r"(?:เลขประจำตัวผู้เสียภาษี|taxid)[:\s]*(\d{10,15})",
        "merchant_name": r"(บริษัท.*?กัด)",
        "total_amount": r"(?:fleetcard.*?)(?P<money_amount>\d{1,3}(?:,\d{3})*\.\d{2}(?!\d))",
        "gas_type": r"(DIESEL|E20|E85|GASOHOL|HI DIESEL)"
    }

    # Define keyword mappings for local, keyword-based extraction
    keyword_mappings = {
        "total_amount": ["เป็นเงิน"],
        "date": ["วันที่พิมพ์", "วันที่", "date", "วันที่ขาย", "มือจ่าย"],
        "receipt_no": ["เลขที่", "receipt", "no", "tid", "pos"],
        "liters": ["ลิตร", "liters", "litre", "l"],
        "plate_no": ["ทะเบียนรถ", "plate"],
        "milestone": ["ระยะ", "km", "กม", "เลขไมล์"],
        "VAT": ["vat", "ภาษีมูลค่าเพิ่ม"],
        "gas_type": ["ดีเซล", "เบนซิน", "e20", "e85", "gasohol", "hi-diesel"],
        "merchant_name": ["บริษัท", "จำกัด"],
        "egat_address_th": ["การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย", "กฟผ."],
        "egat_address_eng": ["electricity", "generating", "authority", "of", "thailand", "egat"],
        "egat_tax_id": ["เลขประจำตัวผู้เสียภาษี", "taxid"]
    }

    # Iterate through each field to extract data
    fields_to_extract_order = [
        "date", "total_amount", "receipt_no", "liters", "plate_no", "milestone",
        "VAT", "gas_type", "merchant_name", "egat_address_th",
        "egat_address_eng", "egat_tax_id"
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
                    if field == "date": # pass
                        extracted_value = _extract_date(text_to_search)
                    elif field == "total_amount":  # pass
                        extracted_value = _extract_amount(text_to_search)
                    elif field == "VAT":
                        extracted_value = _extract_vat(text_to_search)
                    elif field == "liters":
                        extracted_value = _extract_liters(text_to_search)
                    elif field == "receipt_no":
                        # Specific logic for 'POS' ID
                        if "pos" in word.lower():
                            pos_id_match = re.search(
                                r'\b(\d{5,7})\b', text_to_search)
                            if pos_id_match:
                                extracted_value = pos_id_match.group(1)
                                logger.debug(
                                    f"POS ID (5-7 digits) found near 'POS': {extracted_value}")
                        # Fallback to general ID extraction if POS didn't yield a result
                        if extracted_value is None:
                            extracted_value = _extract_id(
                                text_to_search, 8, 20)
                            # Additional check for 'TID' next word
                            if extracted_value is None and 'TID' in word and i + 1 < len(data['text']):
                                extracted_value = _extract_id(
                                    data['text'][i+1], 8, 20)
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
                    # egat_tax_id is mostly handled by global regex, but putting a keyword check here for consistency
                    elif field == "egat_tax_id":
                        extracted_value = _extract_id(text_to_search, 13, 13)

                    # If a value was extracted, update result and break from word loop
                    if extracted_value is not None:
                        result[field] = extracted_value
                        logger.debug(
                            f"Keyword-based extraction successful for '{field}': '{extracted_value}'")
                        # Visual debugging: Draw bounding box around the keyword
                        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                        if 0 <= x < x + w <= image_cv.shape[1] and 0 <= y < y + h <= image_cv.shape[0]:
                            cv2.rectangle(image_cv, (x, y),
                                          (x + w, y + h), (0, 255, 0), 2)
                            cv2.putText(image_cv, field, (x, y - 10),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                        break  # Break from word loop, move to next field

        # --- Attempt 2: Global Regex if keyword-based failed OR field is better handled by global regex ---
        # This block runs only if the field is still None OR it's a field primarily extracted by global regex.
        if result[field] is None and field in global_regex_patterns:
            logger.debug(f"Attempting global regex for '{field}'.")
            match = re.search(
                global_regex_patterns[field], full_ocr_text, re.IGNORECASE | re.DOTALL)
            if match:
                value_from_regex = None

                if field == "total_amount":
                    value_from_regex = _extract_amount(
                        match.group('money_amount').strip())

                elif field == "date":
                    value_from_regex = _extract_date(
                        match.group(1).strip()
                    )

                elif field == "egat_tax_id":
                    value_from_regex = _extract_id(match.group(
                        1).strip(), 10, 15)  # Group 1 for the ID
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
                elif field in ["egat_address_th", "egat_address_eng"]:
                    # Group 1 for the address text
                    value_from_regex = match.group(1).strip()
                    if value_from_regex:
                        value_from_regex = re.sub(
                            r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value_from_regex, flags=re.IGNORECASE).strip()
                        if value_from_regex == '':
                            value_from_regex = None
                # For other fields where group(1) directly holds the value
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
    return result, image_cv
