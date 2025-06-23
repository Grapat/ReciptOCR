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
        r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', text_to_search)
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
    date_patterns = [
        r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})',  # DD/MM/YY or DD/MM/YYYY
        r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})'    # YYYY/MM/DD
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text_to_search, re.IGNORECASE)
        if match:
            date_str = match.group(0)
            # Attempt to parse
            try:
                # Handle Thai years (BE to AD)
                if len(date_str.split()[-1]) == 4 and int(date_str.split()[-1]) > 2500:
                    year = int(date_str.split()[-1]) - 543
                    date_str = date_str.replace(
                        date_str.split()[-1], str(year))
                return date_str
            except Exception as e:
                logger.debug(f"Date parsing error: {e}")
                continue
    logger.debug(f"No date found in '{text_to_search}'")
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


def extract_with_keywords(data, image_cv, full_ocr_text, result):
    logger.info("Starting keyword-based extraction.")
    keywords = {
        "merchant_name": ["บริษัท", "จำกัด"],
        "total_amount": ["รวมเงิน", "ยอดรวม", "total"],
        "date": ["วันที่", "date", "วัน/เวลา"],
        "receipt_no": ["เลขที่", "receipt", "no", "tid"],
        "liters": ["ลิตร", "liters", "litre", "l"],
        "plate_no": ["ทะเบียน", "plate"],
        "milestone": ["ระยะ", "km", "กม"],
        "VAT": ["vat", "ภาษีมูลค่าเพิ่ม"],
        "gas_type": ["ดีเซล", "เบนซิน", "e20", "e85", "gasohol", "hi-diesel"],
        "egat_address_th": ["การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย", "กฟผ."],
        "egat_address_eng": ["electricity", "generating", "authority", "of", "thailand", "egat"],
        "egat_tax_id": ["เลขประจำตัวผู้เสียภาษี", "taxid"]
    }

    collected = {field: (result[field] if result[field]
                         != "N/A" else None) for field in result.keys()}
    logger.debug(f"Initial collected fields for keywords: {collected}")

    for i in range(len(data['text'])):
        word = data['text'][i].strip()
        if not word:
            continue

        for field, field_keywords in keywords.items():
            if collected[field] is not None and field not in ['merchant_name', 'gas_provider', 'gas_name', 'egat_address_th', 'egat_address_eng']:
                continue

            value = None  # Initialize value here for each field iteration

            if any(kw.lower() in word.lower() for kw in field_keywords):
                logger.debug(f"Keyword '{word}' matched for field '{field}'.")

                text_to_search = " ".join(
                    data['text'][i:min(i+5, len(data['text']))])

                if field == "total_amount":
                    value = _extract_amount(text_to_search)
                elif field == "VAT":
                    value = _extract_vat(text_to_search)
                elif field == "liters":
                    value = _extract_liters(text_to_search)
                elif field == "date":
                    value = _extract_date(text_to_search)
                elif field == "receipt_no":
                    value = _extract_id(text_to_search, 8, 20)
                    if not value and 'TID' in word and i + 1 < len(data['text']):
                        value = _extract_id(data['text'][i+1], 8, 20)
                elif field == "plate_no":
                    value = _extract_plate_no(text_to_search)
                elif field == "milestone":
                    value = _extract_milestone(text_to_search)
                elif field == "gas_type":
                    value = _normalize_gas_type(text_to_search)
                elif field == 'merchant_name':
                    if any(kw.lower() == word.lower() for kw in ['บริษัท', 'จำกัด']):
                        company_name_words = []
                        for k in range(i, min(i+5, len(data['text']))):
                            w = data['text'][k].strip()
                            if w:
                                company_name_words.append(w)
                                if 'จำกัด' in w.lower():
                                    break
                        if company_name_words:
                            full_name = " ".join(company_name_words)
                            if 'บริษัท' in full_name and 'จำกัด' in full_name:
                                value = full_name
                elif field in ['egat_address_th', 'egat_address_eng']:
                    collected_address_words = []
                    current_line_num = data['line_num'][i]
                    current_line_num += 1
                    for k in range(i + 1, len(data['text'])):
                        if data['text'][k].strip() and data['line_num'][k] == current_line_num:
                            collected_address_words.append(
                                data['text'][k].strip())
                        elif data['text'][k].strip() and data['line_num'][k] == current_line_num + 1:
                            collected_address_words.append(
                                data['text'][k].strip())
                            current_line_num += 1
                        else:
                            break
                    if collected_address_words:
                        value = " ".join(collected_address_words)
                        value = re.sub(
                            r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()
                        if value == '':
                            value = None
                elif field == "egat_tax_id":
                    value = _extract_id(word, 13, 13)
                    if value is None:
                        value = _extract_id(full_ocr_text, 13, 13)

                if value is not None and value != "N/A":
                    result[field] = value
                logger.debug(
                    f"Keyword extraction: Field '{field}' found value: '{value}'")
                x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                if 0 <= x < x + w <= image_cv.shape[1] and 0 <= y < y + h <= image_cv.shape[0]:
                    cv2.rectangle(image_cv, (x, y),
                                  (x + w, y + h), (0, 255, 0), 2)
                    cv2.putText(image_cv, field, (x, y - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                next_word_idx = i + 1
                if field not in ['egat_address_th', 'egat_address_eng', 'merchant_name'] and next_word_idx < len(data['text']):
                    xv, yv = data['left'][next_word_idx], data['top'][next_word_idx]
                    wv, hv = data['width'][next_word_idx], data['height'][next_word_idx]
                    if 0 <= xv < xv + wv <= image_cv.shape[1] and 0 <= yv < yv + hv <= image_cv.shape[0]:
                        cv2.rectangle(image_cv, (xv, yv),
                                      (xv + wv, yv + hv), (255, 0, 0), 2)

    for field in collected:
        if collected[field] is not None:
            result[field] = collected[field]
    logger.info("Keyword-based extraction completed.")
    return result, image_cv


def extract_with_regex_patterns(full_ocr_text, result):
    logger.info("Starting regex-based extraction.")
    patterns = {
        "egat_address_th": r"(ที่อยู่(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.).*?\s.*?1130)",
        "egat_address_eng": r"((?:electricitygeneratingauthorityofthailand|egat).*?\s.*?1130)",
        "egat_tax_id": r"(?:เลขประจำตัวผู้เสียภาษี|taxid)[:\s]*(\d{10,15})",
        "merchant_name": r"(บริษัท.*?กัด)",
        "total_amount": r"(?:fleetcard.*?)(?P<money_amount>\d{1,3}(?:,\d{3})*\.\d{2}(?!\d))",
        "gas_type": r"(DIESEL|E20|E85|GASOHOL|HI DIESEL)"
    }

    for field, pattern in patterns.items():
        is_placeholder_or_invalid = result[field] is None or result[field] == "N/A"
        if field in ["total_amount", "VAT", "liters", "milestone", "egat_tax_id", "gas_tax_id"] and not is_placeholder_or_invalid:
            try:
                float(str(result[field]).replace(',', ''))
            except ValueError:
                is_placeholder_or_invalid = True

        if is_placeholder_or_invalid:
            value = None  # Correctly initialized here, outside the 'if match' block
            match = re.search(pattern, full_ocr_text,
                              re.IGNORECASE | re.DOTALL)

            if match:
                if field == "egat_address_th":
                    value = match.group(1).strip()
                    if value:
                        value = re.sub(
                            r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()
                elif field == "total_amount":
                    value = _extract_amount(
                        match.group('money_amount').strip())
                elif field == "egat_tax_id":
                    value = _extract_id(match.group(1).strip(), 10, 15)
                elif field == "egat_address_eng":
                    value = match.group(1).strip()
                    if value:
                        value = re.sub(
                            r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()
                elif field == "merchant_name":
                    val = match.group(0).strip()
                    if val.startswith('บริษัท') and val.endswith('จำกัด'):
                        core_name = val[len('บริษัท'):-len('จำกัด')].strip()
                        value = f'บริษัท {core_name} จำกัด'
                    else:
                        value = val
                elif field == "gas_type":
                    value = _normalize_gas_type(match.group(0).strip())

            if value is not None and value != result[field]:
                result[field] = value
                logger.debug(
                    f"Regex extraction: Field '{field}' found value: '{value}'")
            else:
                logger.debug(
                    f"Regex pattern for '{field}' did not match in text.")

    for field in result:
        if result[field] == "N/A":
            result[field] = None
    logger.info("Regex-based extraction completed.")
    return result
