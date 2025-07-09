import re
from datetime import datetime
import cv2
import numpy as np
import os
from PIL import Image
import pytesseract

def _extract_amount(text_to_search):
    amount_match = re.search(
        r'(\d{1,3}(?:,\d{3})*\.\d{2}(?!\d))', text_to_search)
    if amount_match:
        value = amount_match.group(1)
        cleaned_value = value.replace(',', '')

        if '.' in cleaned_value:
            parts = cleaned_value.split('.')
            if len(parts[1]) == 1:
                cleaned_value += '0'
            try:
                return float(cleaned_value)
            except ValueError:
                return None
        try:
            return float(cleaned_value)
        except ValueError:
            return None
    return None


def _extract_date(text_to_search):
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
    return None


def _extract_id(text_to_search, min_len=10, max_len=15):
    id_match = re.search(r'\b\d{' + str(min_len) + r',' +
                         str(max_len) + r'}\b', text_to_search)
    if id_match:
        return id_match.group(0)
    return None


def _extract_plate_no(text_to_search):
    plate_no_match = re.search(
        r'(?:ทะเบียนรถ|เบียนรถ)[:\s]*(.{8})', text_to_search, re.IGNORECASE)
    if plate_no_match:
        return plate_no_match.group(1).replace(" ", "")
    return None


def _extract_milestone(text_to_search):
    milestone_match = re.search(
        r'(\d{1,}(?:[.,]\d{1,})?)\s*(?:km|กม|ก.ม.)', text_to_search, re.IGNORECASE
    )
    if milestone_match:
        value = milestone_match.group(1).replace(',', '')
        try:
            return float(value)
        except ValueError:
            return None
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


def extract_data(image_pil, original_filename, initial_result):
    result = {field: (initial_result[field] if initial_result[field]
                      != "N/A" else None) for field in initial_result.keys()}

    result["receipt_type_used"] = "A5"

    img_np = np.array(image_pil)
    img_cv_gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    img_denoised = cv2.medianBlur(img_cv_gray, 1)
    img_thresh = cv2.adaptiveThreshold(img_denoised, 255,
                                       cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                       cv2.THRESH_BINARY, 31, 10)

    processed_image_for_ocr = Image.fromarray(img_thresh)

    OCR_LANGUAGES = 'eng+tha'
    tesseract_config = r'--oem 1 --psm 3'

    data = pytesseract.image_to_data(
        processed_image_for_ocr, lang=OCR_LANGUAGES, output_type=pytesseract.Output.DICT, config=tesseract_config)

    raw_ocr_text = pytesseract.image_to_string(
        processed_image_for_ocr, lang=OCR_LANGUAGES, config=tesseract_config)

    cleaned_extracted_text_for_matching = raw_ocr_text.replace(' ', '').lower()

    global_regex_patterns = {
        "date": r"(?:วันที่พิมพ์|มือจ่าย|วันที่ขาย)\s*(\d{1,2}/\d{1,2}/\d{4})",
        "egat_address_th": r"(ที่อยู่(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.).*?\s.*?1130)",
        "egat_address_eng": r"((?:electricitygenerating).*?\s.*?1130)",
        "egat_tax_id": r"(099\d{10,15})",
        "gas_tax_id": r'(?:เสียภาษี)[:\s]*(\d{10,15})',
        "merchant_name": r"(บริษัท.*?กัด)|(ห้างหุ้น.*?กัด)",
        "total_amount": r"fleet.*?:(?P<money_amount>\d{1,3}(?:,\d{3})*\.\d{2})",
        "gas_type": r"(DIESEL|E20|E85|GASOHOL|HI DIESEL)",
        "gas_address": r"(?:ที่อยู่|address)[:\s]*(?P<captured_text>.*?\b\d{5}\b)",
        "plate_no": r'(?:ทะเบียนรถ|เบียนรถ)[:\s]*(?P<plate_no>(?:[ก-ฮ]{1,2}|[1-9])(?:[ก-ฮ]{1,2}|\d{1,4}){1,2})',
        "milestone": r'(?:เลขไมล์|ไมล์)[:\s]*(.{6})',
        "receipt_no": r"(?:เลขที่ใบกํากับภาษี)[\s:#(]*((?:TIO)?\d{18}|\d{18}|\d{6}|[A-Z0-9\-/]{5,20})",
        "liters": r"(?:ราคา/หน่วยปริมาณ|unitprice)[:\s]*(\d+\.\d{2})",
    }

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

    fields_to_extract_order = [
        "date", "total_amount", "receipt_no", "liters", "plate_no", "milestone",
        "VAT", "gas_type", "gas_address", "merchant_name", "egat_address_th",
        "egat_address_eng", "egat_tax_id", "gas_provider", "gas_tax_id"
    ]

    for field in fields_to_extract_order:
        if result[field] is not None:
            continue

        extracted_value = None

        if field in keyword_mappings:
            for i in range(len(data['text'])):
                word = data['text'][i].strip()
                if not word:
                    continue

                if any(kw.lower() in word.lower() for kw in keyword_mappings[field]):
                    text_to_search = " ".join(
                        data['text'][i:min(i+5, len(data['text']))])

                    if field == "date":
                        extracted_value = _extract_date(text_to_search)
                    elif field == "total_amount":
                        extracted_value = _extract_amount(text_to_search)
                    elif field == "VAT":
                        extracted_value = _extract_amount(text_to_search)
                    elif field == "liters":
                        extracted_value = _extract_amount(text_to_search)
                    elif field == "plate_no":
                        extracted_value = _extract_plate_no(text_to_search)
                    elif field == "milestone":
                        extracted_value = _extract_milestone(text_to_search)
                    elif field == "gas_type":
                        extracted_value = _normalize_gas_type(text_to_search)
                    elif field == "gas_provider":
                        lower_text = text_to_search.lower()
                        if "ptt" in lower_text:
                            extracted_value = "PTT"
                        else:
                            extracted_value = "Bangchak"

                    if extracted_value is not None:
                        result[field] = extracted_value
                        break

        if result[field] is None and field in global_regex_patterns:
            match = re.search(
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
                        value_from_regex = val
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

                if value_from_regex is not None:
                    result[field] = value_from_regex

        if result[field] is None:
            result[field] = "N/A"
    return result, cleaned_extracted_text_for_matching
