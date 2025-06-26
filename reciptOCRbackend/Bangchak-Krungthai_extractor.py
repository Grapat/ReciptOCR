import re
from datetime import datetime
import cv2
import numpy as np
import logging
import os

# This will create a 'logs_ptt' folder
LOG_FOLDER = os.path.join(os.path.dirname(__file__), 'logs_pptK')
os.makedirs(LOG_FOLDER, exist_ok=True)
LOG_FILE_PATH = os.path.join(LOG_FOLDER, 'pptK_extractor.log')

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

file_handler = logging.FileHandler(
    LOG_FILE_PATH, encoding='utf-8')  # Add encoding='utf-8'
file_handler.setLevel(logging.DEBUG)

formatter = logging.Formatter(
    '%(name)s - %(levelname)s - %(message)s')
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
                     "วันที่พิมพ์", "วัน", "ออกใบ", "มือจ่าย", "date:"]

    keyword_found_text = text_to_search
    keyword_found = False
    for keyword in date_keywords:
        if keyword.lower() in text_to_search.lower():
            idx = text_to_search.lower().find(keyword.lower())
            keyword_found_text = text_to_search[idx:]
            keyword_found = True
            break

    if not keyword_found:
        logger.debug(f"No date-related keyword found in '{text_to_search}'.")
        return None

    date_patterns = [
        # YYYY/MM/DD and YYYY-MM-DD
        (r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})', ['%Y/%m/%d', '%Y-%m-%d']),
        # DD/MM/YYYY and DD-MM-YYYY
        (r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})', ['%d/%m/%Y', '%d-%m-%Y']),
        # MM/DD/YYYY and MM-DD-YYYY
        (r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})', ['%m/%d/%Y', '%m-%d/%Y']),
        # DD/MM/YY and DD-MM-YY (2-digit year)
        (r'(\d{1,2}[-/]\d{1,2}[-/]\d{2})', ['%d/%m/%y', '%d-%m-%y']),
        # MM/DD/YY and MM-DD-YY (2-digit year)
        (r'(\d{1,2}[-/]\d{1,2}[-/]\d{2})', ['%m/%d/%y', '%m-%d/%y']),
    ]

    current_gregorian_year = datetime.now().year
    current_buddhist_year = current_gregorian_year + 543

    for pattern, formats in date_patterns:
        for match in re.finditer(pattern, keyword_found_text):
            date_str = match.group(1).strip()
            logger.debug(
                f"Found potential date string: '{date_str}' matching pattern: '{pattern}'")

            parsed_date_obj = None

            # --- Internal Year Conversion Logic (formerly _convert_input_year_to_gregorian_for_parsing) ---
            def _get_gregorian_year_for_parsing(year_int_from_str):
                # If it's a 4-digit year and likely a Buddhist year (e.g., 25xx)
                if len(str(year_int_from_str)) == 4 and year_int_from_str > 2400 and year_int_from_str <= current_buddhist_year + 10:
                    return year_int_from_str - 543

                # For 2-digit years, `datetime.strptime` with `%y` handles the century pivot
                # (00-68 -> 20xx, 69-99 -> 19xx). We return it as is for `strptime` to interpret.
                return year_int_from_str
            # --- End Internal Year Conversion Logic ---

            # Attempt 1: Try parsing directly (for Gregorian years or %y interpretation)
            for fmt in formats:
                try:
                    parsed_date_obj = datetime.strptime(date_str, fmt)
                    logger.debug(
                        f"Direct parse successful: '{date_str}' with format '{fmt}' to '{parsed_date_obj}'")
                    break
                except ValueError:
                    pass

            # If direct parsing failed, attempt to adjust year (assuming Buddhist input year) and retry
            if parsed_date_obj is None:
                year_part_match = re.search(
                    r'(\d{2,4})$', date_str)  # Get last 2 or 4 digits
                if year_part_match:
                    original_year_str = year_part_match.group(1)
                    try:
                        original_year_int = int(original_year_str)
                        # Use the internal helper to get a Gregorian year for parsing
                        gregorian_year_for_parsing = _get_gregorian_year_for_parsing(
                            original_year_int)

                        if gregorian_year_for_parsing is not None and gregorian_year_for_parsing != original_year_int:
                            # Reconstruct date string with Gregorian year
                            temp_date_str = re.sub(r'\d{2,4}$', str(
                                gregorian_year_for_parsing), date_str)
                            logger.debug(
                                f"Adjusted date string for parsing: '{temp_date_str}'")

                            # Try parsing with the adjusted string
                            for fmt in formats:
                                # Adjust format string if it was expecting %y but now has %Y
                                adjusted_fmt = fmt.replace('%y', '%Y')
                                try:
                                    parsed_date_obj = datetime.strptime(
                                        temp_date_str, adjusted_fmt)
                                    logger.debug(
                                        f"Adjusted parse successful: '{temp_date_str}' with format '{adjusted_fmt}' to '{parsed_date_obj}'")
                                    break
                                except ValueError:
                                    pass
                    except ValueError:
                        logger.debug(
                            f"Year part '{original_year_str}' not an integer.")

            if parsed_date_obj:
                # Convert the Gregorian year to Buddhist year for the final output string
                buddhist_year = parsed_date_obj.year + 543
                return parsed_date_obj.strftime(f'%d-%m-{buddhist_year}')

    logger.debug(
        f"No valid date found in '{keyword_found_text}' after processing all patterns.")
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
    # Regex to find "ทะเบียนรถ" followed by the plate number pattern
    # It captures the plate number in group 1
    plate_no_match = re.search(
        r'(?:ทะเบียนรถ|เบียนรถ)[:\s]*(.{8})', text_to_search, re.IGNORECASE)
    if plate_no_match:
        # Return the captured group (the plate number itself) with spaces removed
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


def extract_data(data, image_cv, full_ocr_text, initial_result):
    logger.info("Starting combined keyword and regex extraction.")
    # Initialize result dictionary with values from initial_result, converting "N/A" to None
    result = {field: (initial_result[field] if initial_result[field]
                      != "N/A" else None) for field in initial_result.keys()}

    # Define all global regex patterns here. These are used as a fallback if keyword-based fails.
    global_regex_patterns = {
        "date": r"(?:date.*?)(?P<date>\d{2}/\d{2}/\d{2})",
        "egat_address_th": r"(ที่อยู่(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.).*?\s.*?1130)",
        "egat_address_eng": r"((?:electricitygeneratingauthorityofthailand|egat).*?\s.*?1130)",
        "egat_tax_id": r"(?:เสียภาษี|ภาษี)[:\s]*(\d{10,15})",
        "merchant_name": r"(บริษัท.*?กัด)",
        "total_amount": r"(?:thb.*?)(?P<money_amount>\d{1,3}(?:,\d{3})*\.\d{2}(?!\d))",
        "gas_type": r"(DIESEL|E20|E85|GASOHOL|HI DIESEL)",
        "gas_address": r"(?:ที่อยู่|address|addr)[:\s]*(.*?)(?:\s*\b\d{5}\b)?(?=\s*(?:โทร|tel|tax|fax|เลขประจำตัวผู้เสียภาษี|$))",
        "plate_no": r'(?:ทะเบียนรถ|เบียนรถ)[:\s]*(.{7})',
        "gas_tax_id": r'(?:เสียภาษี|ภาษี)[:\s]*(\d{10,15})',
        "milestone": r'(?:เลขไมล์|ไมล์)[:\s]*(.{6})',
        "receipt_no": r"(?:เลขที่ใบกํากับภาษี)[\s:#(]*((?:TIO)?\d{18}|\d{18}|\d{6}|[A-Z0-9\-/]{5,20})",
    }

    # Define keyword mappings for local, keyword-based extraction
    keyword_mappings = {
        "total_amount": ["เป็นเงิน"],
        "date": ["วันที่พิมพ์", "วันที่", "date", "date:."],
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

    # Iterate through each field to extract data
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
                        extracted_value = _extract_vat(text_to_search)
                    elif field == "liters":
                        extracted_value = _extract_liters(text_to_search)
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
    return result, image_cv
