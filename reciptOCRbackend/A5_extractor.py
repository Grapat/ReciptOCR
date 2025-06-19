import re
from datetime import datetime
import cv2
import numpy as np
import logging
import os

# --- Logging Configuration for A5_extractor.py Start ---
# This will create a 'logs_a5' folder right next to A5_extractor.py
LOG_FOLDER = os.path.join(os.path.dirname(__file__), 'logs_a5')
os.makedirs(LOG_FOLDER, exist_ok=True)
LOG_FILE_PATH = os.path.join(LOG_FOLDER, 'a5_extractor.log')

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

file_handler = logging.FileHandler(LOG_FILE_PATH)
file_handler.setLevel(logging.DEBUG)

formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
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
            if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) not in [0, 2]):
                cleaned_value = cleaned_value.replace('.', '')
            elif len(parts) == 2 and len(parts[1]) == 0:
                cleaned_value = parts[0]
        
        if cleaned_value.replace('.', '', 1).isdigit():
            logger.debug(f"Extracted amount '{value}' -> cleaned to '{cleaned_value}'")
            return cleaned_value
    logger.debug(f"No amount found in '{text_to_search}'")
    return None

def _extract_vat(text_to_search):
    vat_match = re.search(
        r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', text_to_search)
    if vat_match:
        value = vat_match.group(1)
        cleaned_value = value.replace(',', '')

        if '.' in cleaned_value:
            parts = cleaned_value.split('.')
            if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) not in [0, 2]):
                cleaned_value = cleaned_value.replace('.', '')
            elif len(parts) == 2 and len(parts[1]) == 0:
                cleaned_value = parts[0]

        if cleaned_value.replace('.', '', 1).isdigit():
            logger.debug(f"Extracted VAT '{value}' -> cleaned to '{cleaned_value}'")
            return cleaned_value
    logger.debug(f"No VAT found in '{text_to_search}'")
    return None


def _extract_liters(text_to_search):
    liters_match = re.search(
        r'(\d+(?:\.\d+)?)\s*(?:l|ลิตร|litres|liters)', text_to_search, re.IGNORECASE)
    if liters_match:
        logger.debug(f"Extracted liters: {liters_match.group(1)}")
        return liters_match.group(1)
    logger.debug(f"No liters found in '{text_to_search}'")
    return None


def _extract_date(text_to_search):
    date_patterns = [
        r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})',  # DD/MM/YY or DD/MM/YYYY
        r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})'    # YYYY-MM-DD
    ]
    for pattern in date_patterns:
        date_match = re.search(pattern, text_to_search)
        if date_match:
            d_str = date_match.group(1)
            try:
                if re.match(r'\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}', d_str):
                    parts = re.split(r'[/\-.]', d_str)
                    day = int(parts[0])
                    month = int(parts[1])
                    year = int(parts[2])

                    current_gregorian_year = datetime.now().year
                    current_be_year = current_gregorian_year + 543

                    if len(str(year)) == 2:
                        century_prefix = (current_be_year // 100) * 100
                        if year <= (current_be_year % 100) + 5:
                            year = century_prefix + year
                        else:
                            year = (century_prefix + 100) + year
                    elif len(str(year)) == 4 and year < 2500:
                        year += 543

                    formatted_date = f"{year:04d}-{month:02d}-{day:02d}"
                    logger.debug(f"Extracted date '{d_str}' -> formatted to '{formatted_date}'")
                    return formatted_date
                elif re.match(r'\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}', d_str):
                    parts = re.split(r'[/\-.]', d_str)
                    year = int(parts[0])
                    month = int(parts[1])
                    day = int(parts[2])

                    if year < 2500:
                        year += 543
                    formatted_date = f"{year:04d}-{month:02d}-{day:02d}"
                    logger.debug(f"Extracted date '{d_str}' -> formatted to '{formatted_date}'")
                    return formatted_date
            except ValueError:
                logger.debug(f"Date parsing failed for '{d_str}' with pattern '{pattern}'")
                pass
    logger.debug(f"No date found in '{text_to_search}'")
    return None


def _extract_id(text_to_search, min_len, max_len):
    id_match = re.search(
        r'([A-Z0-9\-/]{%d,%d})' % (min_len, max_len), text_to_search, re.IGNORECASE)
    if id_match:
        logger.debug(f"Extracted ID: {id_match.group(1)}")
        return id_match.group(1)
    logger.debug(f"No ID found in '{text_to_search}' (min_len={min_len}, max_len={max_len})")
    return None


def _extract_plate_no(text_to_search):
    plate_match = re.search(
        r'[0-9]{1,2}\s*[ก-ฮa-zA-Z]{1,2}\s*[0-9]{3,4}', text_to_search)
    if plate_match:
        logger.debug(f"Extracted plate number: {plate_match.group(0)}")
        return plate_match.group(0)
    logger.debug(f"No plate number found in '{text_to_search}'")
    return None


def _extract_milestone(text_to_search):
    milestone_match = re.search(
        r'(\d+(?:[.,]\d+)?)\s*(?:กิโลเมตร|km)', text_to_search, re.IGNORECASE)
    if milestone_match:
        logger.debug(f"Extracted milestone: {milestone_match.group(1)}")
        return milestone_match.group(1)
    logger.debug(f"No milestone found in '{text_to_search}'")
    return None


def _normalize_gas_type(text_to_search):
    gas_type_match = re.search(
        r"(DIESEL|E20|E85|GASOHOL|HI DIESEL)", text_to_search, re.IGNORECASE)
    if gas_type_match:
        logger.debug(f"Normalized gas type: {gas_type_match.group(1).upper()}")
        return gas_type_match.group(1).upper()
    logger.debug(f"No gas type found in '{text_to_search}'")
    return None


def extract_with_keywords(data, image_cv, result):
    logger.info("Starting keyword-based extraction.")
    keywords = {
        'merchant_name': ['บริษัท', 'จำกัด', 'PTT', 'BANGCHAK', 'บางจาก', 'สยามยามาโมโต'],
        'date': ['วันที่ขาย', 'วันที่พิมพ์', 'เวลาวางมือจ่าย'],
        'total_amount': ['รวมเป็นเงิน', 'เป็นเงิน', 'รวมเงิน'],
        'receipt_no': ['เลขที่ใบกํากับภาษี', 'RECEIPT/TAX INVOICE', 'RD#'],
        'liters': ['Liters', 'L', 'quantity', 'ลิตร'],
        'plate_no': ['ทะเบียนรถ', 'รถ'],
        'milestone': ['เลขไมล์ :', 'เลขไมล์'],
        'VAT': ['ภาษีมูลค่าเพิ่ม', 'VAT 7%)'],
        'gas_type': ['DIESEL', 'E20', 'E85', 'GASOHOL', 'HI DIESEL'],
        'egat_address_th': ['53 หมู่ 2', 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย', 'กฟผ.', 'กฟผ', 'นนทบุรี', 'บางกรวย'],
        'egat_address_eng': ['ชื่อลูกค้า:', 'electricitygeneratingauthorityofthailand', '53'],
        'egat_tax_id': ['เลขประจำตัวผู้เสียภาษี', '099'],
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

            if any(kw.lower() in word.lower() for kw in field_keywords):
                logger.debug(f"Keyword '{word}' matched for field '{field}'.")
                value = None
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
                elif field == "egat_tax_id":
                    value = _extract_id(text_to_search, 10, 15)
                    if not value and 'TID' in word and i + 1 < len(data['text']):
                        value = _extract_id(data['text'][i+1], 10, 15)
                elif field == "plate_no":
                    value = _extract_plate_no(text_to_search)
                elif field == "milestone":
                    value = _extract_milestone(text_to_search)
                elif field == "gas_type":
                    value = _normalize_gas_type(text_to_search)
                elif field == 'merchant_name':
                    if 'สยามยามาโมโต' in word:
                        value = 'บริษัท สยามยามาโมโต จำกัด'
                    elif 'ptt' in word.lower():
                        value = 'PTT'
                    elif 'bangchak' in word.lower() or 'บางจาก' in word.lower():
                        value = 'Bangchak'
                    elif any(kw.lower() == word.lower() for kw in ['บริษัท', 'จำกัด']):
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

                if value is not None and collected[field] is None:
                    collected[field] = value
                    logger.debug(f"Keyword extraction: Field '{field}' found value: '{value}'")
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


def extract_with_regex_patterns(extracted_text, result):
    logger.info("Starting regex-based extraction.")
    patterns = {
        "egat_address_th": r"(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.)(?:[\s\S]*?)(\d{4}[\-.]\d{1,2}[\-.]\d{1,2}\s*(?:\d{1,2}:\d{1,2}:\d{1,2})?)?([\s\S]*?)(?=\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid|$)|(?:phone|fax|เลขประจำตัวผู้เสียภาษี|taxid|$))",
        "egat_address_eng": r"(?:electricitygeneratingauthorityofthailand|egat)[:\s]*([\s\S]*?)(?=\d{5}\s*(?:|phone|fax|web|email|taxid|$)|(?:โทร|โทรสาร|เลขประจำตัวผู้เสียภาษี|taxid|$))",
        "egat_tax_id": r"(?:เลขประจำตัวผู้เสียภาษี|taxid)[:\s]*(\d{10,15})",
        "merchant_name": r"(บริษัท*?จำกัด)",
        "gas_address": r"(ที่อยู่|address)[:\s]*(.*?)(?=\d{5}|\n|$)",
        "gas_tax_id": r"(?:taxid|เลขประจำตัวผู้เสียภาษี)[:\s]*(\d{10,15})",
        "receipt_no": r"(?:เลขที่ใบกำกับภาษี|receiptno\.?|rd#)[:\s]*([a-z0-9\-/]{8,20})",
        "date": r"(?:วันที่ขาย|date|issued)[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})",
        "total_amount": r"(?:รวมเป็นเงิน|รวมเงิน|total|amount)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        "liters": r"(\d+(?:\.\d+)?)\s*(?:l|ลิตร|litres|liters)",
        "VAT": r"(?:ภาษีมูลค่าเพิ่ม|vat)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        "plate_no": r"ทะเบียนรถ[:\s]*([0-9]{1,2}[ก-ฮa-za-z]{1,2}[0-9]{3,4})",
        "milestone": r"เลขไมล์[:\s]*(\d+(?:[.,]\d+)?)\s*กิโลเมตร",
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
            match = re.search(pattern, extracted_text,
                              re.IGNORECASE | re.DOTALL)

            if match:
                value = None
                if field == "egat_address_th":
                    value = match.group(2).strip() if len(
                        match.groups()) > 1 else None
                    if value:
                        value = re.sub(
                            r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()
                elif field == "date":
                    value = _extract_date(match.group(1).strip())
                elif field == "total_amount":
                    value = _extract_amount(match.group(1).strip())
                elif field == "VAT":
                    value = _extract_vat(match.group(1).strip())
                elif field == "liters":
                    value = _extract_liters(match.group(0).strip())
                elif field == "milestone":
                    value = _extract_milestone(match.group(0).strip())
                elif field in ["egat_tax_id", "gas_tax_id"]:
                    value = _extract_id(match.group(1).strip(), 10, 15)
                elif field == "receipt_no":
                    value = _extract_id(match.group(1).strip(), 8, 20)
                elif field == "plate_no":
                    value = _extract_plate_no(match.group(1).strip())
                elif field == "merchant_name":
                    val = match.group(0).strip()
                    if 'สยามยามาโมโต' in val:
                        value = 'บริษัท สยามยามาโมโต จำกัด'
                    elif 'ptt' in val.lower():
                        value = 'PTT'
                    elif 'bangchak' in val.lower() or 'บางจาก' in val.lower():
                        value = 'Bangchak'
                    elif val.startswith('บริษัท') and val.endswith('จำกัด'):
                        core_name = val[len('บริษัท'):-len('จำกัด')].strip()
                        value = f'บริษัท {core_name} จำกัด'
                    else:
                        value = val
                elif field == "gas_type":
                    value = _normalize_gas_type(match.group(0).strip())
                else:
                    value = match.group(1).strip() if len(
                        match.groups()) > 0 else match.group(0).strip()

                if value is not None and value != result[field]:
                    result[field] = value
                    logger.debug(f"Regex extraction: Field '{field}' found value: '{value}'")
            else:
                logger.debug(f"Regex pattern for '{field}' did not match in text.")

    for field in result:
        if result[field] == "N/A":
            result[field] = None
    logger.info("Regex-based extraction completed.")
    return result
