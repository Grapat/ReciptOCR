import re
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
import pytesseract

def _extract_amount(text_to_search):
    amount_match = re.search(
        r'(\d{1,3}(?:,\d{3})*\\.\\d{2}(?!\\d))', text_to_search)
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
    text_to_search = re.sub(r'\\s+', ' ', text_to_search).strip()

    date_patterns = [
        (r'(\\d{1,2}/\\d{1,2}/\\d{4})', ['%d/%m/%Y']),
        (r'(\\d{1,2}-\\d{1,2}-(\\d{4}))', ['%d-%m-%Y']),
        (r'(\\d{1,2}\\s+(?:ม.ค.|มค|ก.พ.|กพ|มี.ค.|มีค|เม.ย.|เมย|พ.ค.|พค|มิ.ย.|มิย|ก.ค.|กค|ส.ค.|สค|ก.ย.|กย|ต.ค.|ตค|พ.ย.|พย|ธ.ค.|ธค)\\s+(\\d{4}))',
         ['%d %b %Y']),
        (r'(\\d{1,2}\\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+(\\d{4}))',
         ['%d %b %Y']),
    ]
    for pattern, formats in date_patterns:
        match = re.search(pattern, text_to_search, re.IGNORECASE)
        if not match:
            continue
        date_str = match.group(1).strip()
        
        for fmt in formats:
            try:
                # Assuming Buddhist year for Thai dates (25xx)
                if '25' in date_str and ('%b' in fmt or '%B' in fmt):
                    year = int(match.group(2))
                    gregorian_year = year - 543
                    return datetime.strptime(date_str.replace(str(year), str(gregorian_year)), fmt).strftime('%Y-%m-%d')
                
                # Check for Buddhist year without month conversion
                parts = re.split('[-/]', date_str)
                if len(parts) == 3:
                    day, month, year = parts
                    if int(year) > datetime.now().year + 50:
                        gregorian_year = int(year) - 543
                        return f"{gregorian_year}-{month.zfill(2)}-{day.zfill(2)}"
                
                # Default conversion
                return datetime.strptime(date_str, fmt).strftime('%Y-%m-%d')
            except ValueError:
                continue
    return None

def extract_all(text_to_search):
    patterns = {
        "gasProvider": r'(bangchak|ptt|or)',
        "transactionDate": r'(?:วันที่|วัน|date)\s*[:]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4})',
        "taxInvNo": r'(?:Tax inv no)\s*[:]?\s*([A-Za-z0-9-]+)',
        "egatAddress": r'(?:electricity|53).*?11130',
        "egatTaxId": r'0994000244843',
        "milestone": r'(เลขไมล์|Milestone|เลขระยะทาง(km)|(km))\s*([0-9,]+)',
        "amount": r'(?:amount thb|รวมเงิน|Total|Amount)\s*([0-9,.]+)บาท',
        "liters": r'(?:จำนวนลิตร|ปริมาณ|liter)\s*([0-9,.]+)',
        "pricePerLiter": r'(?:ราคาต่อลิตร|bht/ltr.)\s*([0-9,.]+)',
        "VAT": r'(?:ภาษีมูลค่าเพิ่ม|VAT|vat)\s*([0-9,.]+)',
        "gasType": r'(diesel|gasohol|e85|ngv|hi deiesel|biodiesel)',
        "plateNo": r'(?:เลขทะเบียน|Plate No|ทะเบียนรถ)\s*([\\u0E00-\\u0E7F\s\d-]+)',
        "original": r'(ต้นฉบับ)',
        "signature": r'(ลายเซ็น)',
    }
    
    result = {
        "plateNo": None, "gasProvider": None, "transactionDate": None, "taxInvNo": None,
        "egatAddress": None, "egatTaxId": None, "milestone": None, "amount": None,
        "liters": None, "pricePerLiter": None, "VAT": None, "gasType": None,
        "original": False, "signature": False
    }

    for field, pattern in patterns.items():
        match = re.search(pattern, text_to_search, re.IGNORECASE)
        if match:
            if field == "amount":
                result[field] = _extract_amount(match.group(1))
            elif field == "transactionDate":
                result[field] = _extract_date(match.group(2))
            elif field in ["original", "signature"]:
                result[field] = True
            else:
                value = match.group(1).strip() if len(match.groups()) > 0 else match.group(0).strip()
                result[field] = value if value else None
        
    return result