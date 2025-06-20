import re
from datetime import datetime
import cv2
import numpy as np

# Helper functions for common extraction logic


def _extract_amount(text_to_search):
    # Regex corrected: removed extra backslashes, ensuring \d and \. are interpreted correctly
    amount_match = re.search(
        r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', text_to_search)
    if amount_match:
        # <--- เปลี่ยนตรงนี้ให้คืนค่า group(1) ที่เป็น string
        value = amount_match.group(1)
        cleaned_value = value.replace(',', '')

        # Ensure proper handling of decimal points for cleaning
        # This logic ensures that if there's a decimal, it's followed by 0 or 2 digits,
        # otherwise, it treats it as a thousand separator.
        if '.' in cleaned_value:
            parts = cleaned_value.split('.')
            # If more than one dot or a single dot followed by non-0/2 digits, treat dot as separator
            if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) not in [0, 2]):
                cleaned_value = cleaned_value.replace('.', '')
            # e.g., "123." -> "123"
            elif len(parts) == 2 and len(parts[1]) == 0:
                cleaned_value = parts[0]

        # Final check to ensure the cleaned value is a valid number before returning
        if cleaned_value.replace('.', '', 1).isdigit():
            return cleaned_value
    return None


def _extract_vat(text_to_search):
    # Regex corrected: removed extra backslashes, ensuring \d and \. are interpreted correctly
    vat_match = re.search(
        r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', text_to_search)
    if vat_match:
        # <--- เปลี่ยนตรงนี้ให้คืนค่า group(1) ที่เป็น string
        value = vat_match.group(1)
        cleaned_value = value.replace(',', '')

        if '.' in cleaned_value:
            parts = cleaned_value.split('.')
            if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) not in [0, 2]):
                cleaned_value = cleaned_value.replace('.', '')
            elif len(parts) == 2 and len(parts[1]) == 0:
                cleaned_value = parts[0]

        if cleaned_value.replace('.', '', 1).isdigit():
            return cleaned_value
    return None


def _extract_liters(text_to_search):
    liters_match = re.search(
        r'(\d+(?:\.\d+)?)\s*(?:l|ลิตร|litres|liters)', text_to_search, re.IGNORECASE)
    if liters_match:
        return liters_match.group(1)
    return None


def _extract_date(text_to_search):
    date_patterns = [
        r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})',  # DD/MM/YY or DD/MM/YYYY
        r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})'  # YYYY/MM/DD
    ]
    parsed_date_value = None
    for pattern in date_patterns:
        date_matches = re.findall(pattern, text_to_search)
        if date_matches:
            for d_str in date_matches:
                # Try parsing with different year formats (YY, YYYY)
                for fmt in ['%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%Y/%m/%d', '%Y-%m-%d', '%Y.%m.%d']:
                    try:
                        dt_obj = datetime.strptime(d_str, fmt)
                        # Assume 2-digit years like '24' are in 2000s, convert to 4-digit if not already
                        if '%y' in fmt and dt_obj.year > datetime.now().year + 10:  # Adjust for future dates if needed
                            dt_obj = dt_obj.replace(year=dt_obj.year - 100)

                        # Special handling for Buddhist Era (BE) year conversion if it's a 4-digit year
                        if '%Y' in fmt or '%y' not in fmt:  # If year is 4 digits
                            year = dt_obj.year
                            # Convert to Gregorian from BE if it's a BE year (e.g., > 2500 for current era)
                            if year > datetime.now().year + 200:  # Heuristic for BE year (current Gregorian year + 543 = current BE year)
                                year -= 543
                            dt_obj = dt_obj.replace(year=year)

                        parsed_date_value = dt_obj.strftime('%Y-%m-%d')
                        break  # Exit loop once a date format is matched and parsed
                    except ValueError:
                        pass  # Continue to next date format pattern if parsing fails
                if parsed_date_value:
                    break
        if parsed_date_value:
            break
    return parsed_date_value


def _extract_id(text_to_search, min_len=10, max_len=15):
    # Regex to find a sequence of digits
    # It also handles potential spaces or hyphens within the ID, often seen in tax IDs
    id_matches = re.findall(r'\b\d[\d\s-]*\d\b', text_to_search)
    best_match = None
    for id_str in id_matches:
        cleaned_id = re.sub(r'[\s-]', '', id_str)  # Remove spaces and hyphens
        if min_len <= len(cleaned_id) <= max_len and cleaned_id.isdigit():
            # Prioritize matches that are exactly 13 digits for tax ID
            if len(cleaned_id) == 13:
                return cleaned_id
            if best_match is None or len(cleaned_id) > len(best_match):
                best_match = cleaned_id
    return best_match


def _extract_plate_no(text_to_search):
    # Enhanced regex to capture various Thai plate number formats
    # XX 1234, XXX 1234 (Thai), XX 1234 (Eng), XXX 1234 (Eng)
    # Also handles formats where provinces might be part of the OCR text nearby
    plate_match = re.search(
        r'([ก-ฮ]{1,2}\s*[ก-ฮ]{0,1}\s*\d{1,4}|\b[A-Z]{1,3}\s*\d{1,4})', text_to_search, re.IGNORECASE
    )
    if plate_match:
        plate = plate_match.group(1).strip()
        # Further clean by removing potential non-plate characters around it
        plate = re.sub(r'[^\w\d\s]', '', plate).replace(' ', '')
        return plate.upper()
    return None


def _extract_milestone(text_to_search):
    # Regex for numerical value that looks like a mileage (e.g., 5 digits, possibly with commas/periods)
    milestone_match = re.search(r'(\d{1,3}(?:[.,]\d{3})*)', text_to_search)
    if milestone_match:
        # Clean the value by removing commas/periods used as thousand separators
        return milestone_match.group(1).replace('.', '').replace(',', '')
    return None


def _normalize_gas_type(text_to_search):
    # Standardize gas types
    text_to_search = text_to_search.upper()
    if "DIESEL" in text_to_search:
        return "DIESEL"
    elif "E20" in text_to_search:
        return "E20"
    elif "E85" in text_to_search:
        return "E85"
    elif "GASOHOL" in text_to_search:
        return "GASOHOL"
    elif "HI DIESEL" in text_to_search:
        return "HI DIESEL"
    return "N/A"


def extract_with_keywords(data, image_cv, full_ocr_text, result):

    keywords = {
        'merchant_name': ['บริษัท', 'กัด'],
        'date': ['วันที่ขาย', 'วันที่พิมพ์', 'เวลาวางมือจ่าย'],
        'total_amount': ['รวมเป็นเงิน', 'เป็นเงิน', 'รวมเงิน'],
        'receipt_no': ['เลขที่ใบกํากับภาษี', 'RECEIPT/TAX INVOICE', 'RD#'],
        'liters': ['Liters', 'quantity', 'ลิตร'],
        'plate_no': ['ทะเบียนรถ', 'รถ'],
        'milestone': ['เลขไมล์ :', 'เลขไมล์'],
        'VAT': ['ภาษีมูลค่าเพิ่ม', 'VAT 7%)'],
        'gas_type': ['DIESEL', 'E20', 'E85', 'GASOHOL', 'HI DIESEL'],
        'egat_address_th': ['53 หมู่ 2', 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย', 'กฟผ.', 'กฟผ', 'นนทบุรี', 'บางกรวย'],
        'egat_address_eng': ['ชื่อลูกค้า:', 'electricitygeneratingauthorityofthailand', 'electricity', '11130'],
        'egat_tax_id': ['เลขประจำตัวผู้เสียภาษี', '099'],
    }

    for i in range(len(data['text'])):
        text = data['text'][i].strip()
        if not text:
            continue

        # Get bounding box for potential text block
        # (Used in debug image, not directly for extraction logic here)
        # x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]

        for field, kw_list in keywords.items():
            if result[field] is not None and result[field] != "N/A":
                continue  # Skip if already found by keyword

            found_kw = False
            for kw in kw_list:
                if kw.lower() in text.lower():
                    found_kw = True
                    break

            if found_kw:
                value = "N/A"
                if field == 'total_amount':
                    # Extract total amount from surrounding text
                    # Look for numerical values near the keyword
                    # Try to capture full lines or blocks around keyword
                    context_text = ""
                    # Grab text from this line and potentially a few lines after
                    # Look 5 lines ahead
                    for j in range(i, min(i + 5, len(data['text']))):
                        context_text += data['text'][j].strip() + " "
                    value = _extract_amount(context_text)
                    if value is None:  # If amount not found in immediate context, try broader search
                        # Pass entire cleaned OCR text
                        value = _extract_amount(full_ocr_text)
                    if value is None and "รวมเป็นเงิน" in full_ocr_text:  # Fallback for Thai
                        amount_match_th = re.search(
                            r'รวมเป็นเงิน\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', image_cv.lower())
                        if amount_match_th:
                            value = _extract_amount(amount_match_th.group(1))

                elif field == 'date':
                    value = _extract_date(text)
                    if value is None:  # Broader search for date
                        value = _extract_date(full_ocr_text)

                elif field == 'receipt_no':
                    value = _extract_id(text)
                    if value is None:  # Broader search for ID
                        value = _extract_id(full_ocr_text)

                elif field == 'liters':
                    value = _extract_liters(text)
                    if value is None:  # Broader search for liters
                        value = _extract_liters(full_ocr_text)

                elif field == 'plate_no':
                    value = _extract_plate_no(text)
                    if value is None:  # Broader search for plate no
                        value = _extract_plate_no(full_ocr_text)

                elif field == 'milestone':
                    value = _extract_milestone(text)
                    if value is None:  # Broader search for mileage
                        value = _extract_milestone(full_ocr_text)

                elif field == 'VAT':
                    value = _extract_vat(text)
                    if value is None:  # Broader search for VAT
                        value = _extract_vat(full_ocr_text)

                elif field == 'gas_type':
                    value = _normalize_gas_type(text)

                elif field == "egat_address_th":
                    # For EGAT address, try to capture a block of text around the keyword
                    context_text_egat = ""
                    for j in range(max(0, i - 2), min(i + 5, len(data['text']))):
                        context_text_egat += data['text'][j].strip() + " "
                    # Refine extraction of Thai EGAT address
                    address_match = re.search(
                        r'(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.)([\s\S]*?)(?=\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid|$))',
                        context_text_egat, re.IGNORECASE
                    )
                    if address_match:
                        value = address_match.group(1).strip()
                        # Further clean by removing numbers, phones, etc. if present
                        value = re.sub(
                            r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()
                    else:  # Fallback to broader search if not found in context
                        address_match = re.search(
                            r'(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.)([\s\S]*?)(?=\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid|$))',
                            full_ocr_text, re.IGNORECASE
                        )
                        if address_match:
                            value = address_match.group(1).strip()
                            value = re.sub(
                                r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()

                elif field == "egat_address_eng":
                    context_text_egat_eng = ""
                    for j in range(max(0, i - 2), min(i + 5, len(data['text']))):
                        context_text_egat_eng += data['text'][j].strip() + " "
                    # Regex to capture the address block after EGAT keywords
                    address_match = re.search(
                        r'(?:electricitygeneratingauthorityofthailand|egat)[\s\S]*?(.*?(?:\d{5})?)',
                        context_text_egat_eng, re.IGNORECASE
                    )
                    if address_match:
                        value = address_match.group(1).strip()
                        value = re.sub(
                            r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()
                    else:  # Fallback to broader search
                        address_match = re.search(
                            r'(?:electricitygeneratingauthorityofthailand|egat)[\s\S]*?(.*?(?:\d{5})?)',
                            full_ocr_text, re.IGNORECASE
                        )
                        if address_match:
                            value = address_match.group(1).strip()
                            value = re.sub(
                                r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()

                elif field == "egat_tax_id":
                    # EGAT tax ID is usually 13 digits
                    value = _extract_id(text, 13, 13)
                    if value is None:  # Broader search
                        value = _extract_id(full_ocr_text, 13, 13)

                # Ensure extracted value is valid before updating result
                if value is not None and value != "N/A":
                    result[field] = value
    return result


def extract_with_regex_patterns(full_ocr_text, result):
    patterns = {
        "egat_address_th": r"(ที่อยู่(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.).*?\s.*?1130)",
        "egat_address_eng": r"((?:electricitygeneratingauthorityofthailand|egat).*?\s.*?130)",
        "egat_tax_id": r"(?:เลขประจำตัวผู้เสียภาษี|taxid)[:\s]*(\d{10,15})",
        "merchant_name": r"(บริษัท.*?กัด)",
        "total_amount": r"(?:fleetcard.*?)(?P<money_amount>\d{1,3}(?:,\d{3})*\.\d{2}(?!\d))",
        "gas_address": r"x",
        "gas_tax_id": r"x",
        "receipt_no": r"x",
        "date": r"x",
        "liters": r"x",
        "VAT": r"x",
        "plate_no": r"x",
        "milestone": r"x",
        "gas_type": r"(DIESEL|E20|E85|GASOHOL|HI DIESEL)"
    }

    for field, pattern in patterns.items():
        if result[field] is not None and result[field] != "N/A":
            continue  # Skip if already found by keyword extraction

        match = re.search(pattern, full_ocr_text, re.IGNORECASE)

        if match:
            value = "N/A"  # Default if no specific handling

            # Specific handling for fields with complex extraction or helper functions
            if field == "total_amount":
                # _extract_amount now handles string values, so pass the matched group
                # match.group('money_amount') refers to the named group, or match.group(1) if it's the first unnamed one
                value = _extract_amount(match.group('money_amount').strip(
                )) if 'money_amount' in match.groupdict() else _extract_amount(match.group(1).strip())
            elif field == "VAT":
                # _extract_vat now handles string values
                value = _extract_vat(match.group(1).strip())
            elif field == "liters":
                value = _extract_liters(match.group(1).strip())
            elif field == "date":
                value = _extract_date(match.group(1).strip())
            elif field == "receipt_no":
                value = _extract_id(match.group(1).strip(), 10, 15)
            elif field == "egat_tax_id":
                value = _extract_id(match.group(1).strip(), 13, 13)
            elif field == "plate_no":
                value = _extract_plate_no(match.group(1).strip())
            # FIXED: Correctly access group(1) for egat_address_th as its regex has only one capturing group
            elif field == "egat_address_th":
                if len(match.groups()) > 0:
                    value = match.group(1).strip()
                # Fallback to full match if no capturing group defined (shouldn't happen with current regex)
                else:
                    value = match.group(0).strip()
                if value:
                    # Clean the address (remove trailing postcodes/contact info)
                    value = re.sub(
                        r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()
            elif field == "egat_address_eng":
                # Existing logic: This should work if the regex provides group(1) or group(0)
                if len(match.groups()) > 0:
                    value = match.group(1).strip()
                else:
                    value = match.group(0).strip()
                if value:
                    value = re.sub(
                        r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid).*', '', value, flags=re.IGNORECASE).strip()

            elif field == "merchant_name":
                # Use group(0) for the full match
                val = match.group(0).strip()
                if 'สยามยามาโมโต' in val:
                    value = 'บริษัท สยามยามาโมโต จำกัด'
                elif 'ptt' in val.lower():
                    value = 'PTT'
                elif 'bangchak' in val.lower() or 'บางจาก' in val.lower():
                    value = 'Bangchak'
                elif val.startswith('บริษัท') and val.endswith('จำกัด'):
                    # Ensure proper spacing for company names
                    core_name = val[len('บริษัท'):-len('จำกัด')].strip()
                    value = f'บริษัท {core_name} จำกัด'
                else:
                    value = val  # Fallback to raw regex match
            elif field == "gas_type":
                value = _normalize_gas_type(match.group(0).strip())
            else:  # For other fields where group(1) is the direct value
                value = match.group(1).strip() if len(
                    match.groups()) > 0 else match.group(0).strip()

            # Update only if a new valid value is found
            if value is not None and value != "N/A" and value != result[field]:
                result[field] = value

    # Final pass to ensure "N/A" is converted to None
    for field in result:
        if result[field] == "N/A":
            result[field] = None
    return result
