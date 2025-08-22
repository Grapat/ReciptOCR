import re
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
import pytesseract

# New function to clean the extracted text
def clean_text(text):
    cleaned_text = re.sub(r'[\x00-\x1F\x7F]', '', text)
    cleaned_text = cleaned_text.replace('’', "'").replace('“', '"').replace('”', '"')
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    return cleaned_text

def _extract_amount(text_to_search):
    amount_match = re.search(r'([0-9,.]+)', text_to_search)
    if amount_match:
        value = amount_match.group(1)
        cleaned_value = re.sub(r'[^0-9.]', '', value)
        try:
            return float(cleaned_value)
        except ValueError:
            return None
    return None

def _extract_date(text_to_search):
    text_to_search = re.sub(r'\s+', ' ', text_to_search).strip()
    date_patterns = [
        (r'(\d{1,2}/\d{1,2}/\d{2,4})', ['%d/%m/%Y', '%d/%m/%y']),
        (r'(\d{1,2}-\d{1,2}-\d{2,4})', ['%d-%m-%Y', '%d-%m-%y']),
    ]
    
    for pattern, formats in date_patterns:
        match = re.search(pattern, text_to_search)
        if match:
            date_str = match.group(1)
            for fmt in formats:
                try:
                    dt_obj = datetime.strptime(date_str, fmt)
                    return dt_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue
    return None

def extract_all(text_to_search):
    # Call the cleaning function here
    cleaned_text = clean_text(text_to_search)
    
    patterns = {
        "gasProvider": r'(?i)(?:Bangchak|Caltex|PTT|Shell|Esso)',
        "transactionDate": r'(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})',
        "taxInvNo": r'(?i)(?:TaxInvNo|เลขที่|NO\.)\s*[:]?\s*([0-9-]{7})',
        "egatAddress": r'(?i)(generating.*?130|53หมู่.*?130)',
        "egatTaxId": r'(?i)(?:TAXID|TID)\s*[:]?\s*([0-9-]{13})|(099.*?843)',
        "milestone": r'(?i)(?:เลขระยะทาง|Milestone|เลขไมล์:)\s*([0-9,.]+)',
        "amount": r'(?i)(?:TOTAL|AMOUNT|รวมเงิน|THB|รวมเป็นเงิน)\s*([0-9,.]+)',
        "liters": r'(?i)(?:จำนวนลิตร|ปริมาณ|LITER)\s*([0-9,.]+)|(\d+\.\d{3})L',
        "pricePerLiter": r'(?i)(?:ราคาต่อลิตร|BHT/LTR.)\s*([0-9,.]+)',
        "VAT": r'(?i)VAT7%\)(\d{1,3}(?:,\d{3})*\.\d{2})|(?:ภาษีมูลค่าเพิ่ม|VAT)\s*([0-9,.]+)',
        "gasType": r'(?i)(hidiesel|gasohol|e85|ngv|diesel|biodiesel)',
        "plateNo": r'(?i)(?:เลขทะเบียน|ทะเบียนรถ|PlateNo)\s*([\\u0E00-\\u0E7F\s\d-]+)',
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
        match = re.search(pattern, cleaned_text, re.IGNORECASE)
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