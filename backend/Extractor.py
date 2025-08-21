import re
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
import pytesseract

def _extract_amount(text_to_search):
    # This regex is more flexible and looks for numbers with optional commas and a dot
    amount_match = re.search(r'([0-9,.]+)', text_to_search)
    if amount_match:
        value = amount_match.group(1)
        # Remove commas and other non-numeric characters except for the dot
        cleaned_value = re.sub(r'[^0-9.]', '', value)
        try:
            return float(cleaned_value)
        except ValueError:
            return None
    return None

def _extract_date(text_to_search):
    # Normalize whitespace
    text_to_search = re.sub(r'\s+', ' ', text_to_search).strip()

    date_patterns = [
        # Match dd/mm/yy and dd/mm/yyyy
        (r'(\d{1,2}/\d{1,2}/\d{2,4})', ['%d/%m/%Y', '%d/%m/%y']),
        # Match dd-mm-yy and dd-mm-yyyy
        (r'(\d{1,2}-\d{1,2}-\d{2,4})', ['%d-%m-%Y', '%d-%m-%y']),
        # Thai month abbreviations (case-insensitive)
        (r'(\d{1,2}\s+(?:ม.ค.|มค|ก.พ.|กพ|มี.ค.|มีค|เม.ย.|เมย|พ.ค.|พค|มิ.ย.|มิย|ก.ค.|กค|ส.ค.|สค|ก.ย.|กย|ต.ค.|ตค|พ.ย.|พย|ธ.ค.|ธค)\s+(\d{4}))', ['%d %b %Y']),
        # English month abbreviations (case-insensitive)
        (r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4}))', ['%d %b %Y'])
    ]

    for pattern, formats in date_patterns:
        match = re.search(pattern, text_to_search, re.IGNORECASE)
        if not match:
            continue
        
        date_str = match.group(1).strip()
        
        # Correctly handle Thai Buddhist year conversion for dd/mm/yy or dd-mm-yy formats
        parts = re.split('[/-]', date_str)
        if len(parts) == 3:
            day, month, year = parts
            if len(year) == 2:
                # Add century to two-digit year
                current_year_full = datetime.now().year
                current_century = (current_year_full // 100) * 100
                year_full = int(year) + current_century
                # Handle years that might be in the future (e.g., 99 -> 1999)
                if year_full > current_year_full:
                    year_full -= 100
                date_str = f"{day}/{month}/{year_full}" if '/' in date_str else f"{day}-{month}-{year_full}"

        # Handle Buddhist year for four-digit years
        if re.search(r'\d{4}', date_str):
            four_digit_year = int(re.search(r'\d{4}', date_str).group(0))
            if four_digit_year > datetime.now().year + 50:
                gregorian_year = four_digit_year - 543
                date_str = date_str.replace(str(four_digit_year), str(gregorian_year))

        for fmt in formats:
            try:
                # Attempt to parse with the format
                date_obj = datetime.strptime(date_str, fmt)
                return date_obj.strftime('%Y-%m-%d')
            except ValueError:
                continue

    return None

def extract_all(text_to_search):
    patterns = {
        "gasProvider": r'(?i)(?:Bangchak|Caltex|PTT|Shell|Esso)',
        "transactionDate": r'(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})',
        "taxInvNo": r'(?i)(?:Tax Inv No|เลขที่|NO\.)\s*[:]?\s*([0-9-]+)',
        "egatAddress": r'(?i)(?:ELECTRICITY GENERATING AUTHORITY OF THAI LAND|การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|NONTHABURI)',
        "egatTaxId": r'(?i)(?:TAX ID|ID\.)\s*[:]?\s*([0-9-]+)',
        "milestone": r'(?i)(?:เลขระยะทาง|Milestone|เลขไมล์|ODO)\s*([0-9,.]+)',
        "amount": r'(?i)(?:TOTAL|AMOUNT|รวมเงิน|THB)\s*([0-9,.]+)',
        "liters": r'(?i)(?:จำนวนลิตร|ปริมาณ|LITER)\s*([0-9,.]+)',
        "pricePerLiter": r'(?i)(?:ราคาต่อลิตร|BHT/LTR.)\s*([0-9,.]+)',
        "VAT": r'(?i)(?:ภาษีมูลค่าเพิ่ม|VAT 7%|VAT)\s*([0-9,.]+)',
        "gasType": r'(?i)(diesel|gasohol|e85|ngv|hi deiesel|biodiesel)',
        "plateNo": r'(?i)(?:เลขทะเบียน|ทะเบียนรถ|Plate No|\(km\))\s*([\u0E00-\u0E7F\s\d-]+)',
        "original": r'(ต้นฉบับ)',
        "signature": r'(ลายเซ็น)',
    }
    
    result = {
        "plateNo": None, "gasProvider": None, "transactionDate": None, "taxInvNo": None,
        "egatAddress": None, "egatTaxId": None, "milestone": None, "amount": None,
        "liters": None, "pricePerLiter": None, "VAT": None, "gasType": None,
        "original": False, "signature": False
    }

    numerical_fields = ["amount", "liters", "pricePerLiter", "milestone", "VAT"]

    for field, pattern in patterns.items():
        match = re.search(pattern, text_to_search, re.IGNORECASE)
        if match:
            if field in numerical_fields:
                result[field] = _extract_amount(match.group(1))
            elif field == "transactionDate":
                result[field] = _extract_date(match.group(1))
            elif field in ["original", "signature"]:
                result[field] = True
            else:
                value = match.group(1).strip() if len(match.groups()) > 0 else match.group(0).strip()
                result[field] = value if value else None
        
    return result