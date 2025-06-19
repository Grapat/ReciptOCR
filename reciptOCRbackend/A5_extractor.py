import re
from datetime import datetime
import cv2
import numpy as np

# Note: OCR_LANGUAGES is generally set in the main processor,
# but can be here for testing/independent use if needed.
# OCR_LANGUAGES = 'eng+tha'


def extract_with_keywords(data, image_cv, result):
    """
    Performs keyword-based extraction from Tesseract's image_to_data output
    specifically for the A5 receipt type (EGAT Gas).
    """
    keywords = {
        'merchant_name': ['บริษัท สยามยามาโมโต จำกัด', 'PTT', 'BANGCHAK'],
        'date': ['วันที่ขาย', 'DATE'],
        'total_amount': ['รวมเป็นเงิน', 'รวมเงิน', 'TOTAL'],
        'receipt_no': ['เลขที่ใบกำกับภาษี', 'RECEIPT/TAX INVOICE', 'RD #'],
        'liters': ['Liters', 'L', 'Ltrs'],
        'plate_no': ['ทะเบียนรถ'],
        'milestone': ['เลขไมล์'],
        'VAT': ['ภาษีมูลค่าเพิ่ม'],
        # Based on A5.jpg showing 'DIESEL'
        'gas_type': ['DIESEL', 'E20', 'E85', 'GASOHOL'],
        'egat_address_th': ['การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย', 'กฟผ.', 'กฟผ', 'นนทบุรี', 'บางกรวย'],
        'egat_address_eng': ['ELECTRICITY GENERATING AUTHORITY OF THAILAND', 'EGAT', 'NONTHABURI', 'BANGKRUAI'],
        # TID is used for tax ID on this receipt
        'egat_tax_id': ['เลขประจำตัวผู้เสียภาษี', 'TID'],
        # Can be inferred from merchant name later
        'gas_provider': ['PTT', 'BANGCHAK']
    }

    collected = {field: result[field] if result[field]
                 is not None else "N/A" for field in result.keys()}

    for i in range(len(data['text'])):
        word = data['text'][i].strip()
        if not word:
            continue

        for field, field_keywords in keywords.items():
            if collected[field] != "N/A" and field not in ['merchant_name', 'gas_provider', 'gas_address', 'egat_address_th', 'egat_address_eng']:
                continue

            if any(kw.lower() in word.lower() for kw in field_keywords):
                value = None
                next_word_idx = i + 1

                if field in ["total_amount", "VAT", "liters", "milestone"]:
                    # Look for number near the keyword
                    text_to_search = " ".join(
                        data['text'][i:min(i+5, len(data['text']))])
                    amount_match = re.search(
                        r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', text_to_search)
                    if amount_match:
                        value = amount_match.group(1).replace(',', '')
                        if not (value.replace('.', '', 1).isdigit()):
                            value = None
                    elif field == "liters":
                        # Specific for liters, sometimes the number is before the 'L'
                        liters_match = re.search(
                            r'(\d+(?:\.\d+)?)\s*L', text_to_search, re.IGNORECASE)
                        if liters_match:
                            value = liters_match.group(1)

                elif field == "date":
                    text_to_search = " ".join(
                        data['text'][i:min(i+5, len(data['text']))])
                    date_patterns = [
                        # DD/MM/YY or DD/MM/YYYY
                        r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})',
                        r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})'   # YYYY-MM-DD
                    ]
                    for pattern in date_patterns:
                        date_match = re.search(pattern, text_to_search)
                        if date_match:
                            d_str = date_match.group(1)
                            try:
                                if re.match(r'\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}', d_str):
                                    parts = re.split(r'[/\-.]', d_str)
                                    year = int(parts[2])
                                    year = 2000 + year if year < 50 else 1900 + year
                                    month = int(parts[1])
                                    day = int(parts[0])
                                    value = f"{year:04d}-{month:02d}-{day:02d}"
                                else:
                                    datetime.strptime(d_str, '%Y-%m-%d')
                                    value = d_str
                                break
                            except ValueError:
                                value = None

                elif field == "receipt_no":
                    text_to_search = " ".join(
                        data['text'][i:min(i+3, len(data['text']))])
                    # Adjust length based on A5.jpg
                    receipt_no_match = re.search(
                        r'([A-Z0-9\-/]{8,20})', text_to_search)
                    if receipt_no_match:
                        value = receipt_no_match.group(1)
                    # Specifically for TID
                    elif 'TID' in word and next_word_idx < len(data['text']):
                        tid_match = re.search(
                            r'(\d{8,20})', data['text'][next_word_idx])
                        if tid_match:
                            value = tid_match.group(1)

                elif field in ["gas_tax_id", "egat_tax_id"]:
                    text_to_search = " ".join(
                        data['text'][i:min(i+3, len(data['text']))])
                    tax_id_match = re.search(r'(\d{10,15})', text_to_search)
                    if tax_id_match:
                        value = tax_id_match.group(0)
                    # TID as tax ID for EGAT on this receipt
                    elif 'TID' in word and next_word_idx < len(data['text']):
                        tid_match = re.search(
                            r'(\d{10,15})', data['text'][next_word_idx])
                        if tid_match:
                            value = tid_match.group(1)

                elif field == "plate_no":
                    text_to_search = " ".join(
                        data['text'][i:min(i+3, len(data['text']))])
                    plate_match = re.search(
                        r'[0-9]{1,2}\s*[ก-ฮa-zA-Z]{1,2}\s*[0-9]{3,4}', text_to_search)
                    if plate_match:
                        value = plate_match.group(0)

                elif field == "milestone":
                    text_to_search = " ".join(
                        data['text'][i:min(i+3, len(data['text']))])
                    milestone_match = re.search(
                        # 'กิโลเมตร' is present
                        r'(\d+(?:[.,]\d+)?)\s*กิโลเมตร', text_to_search)
                    if milestone_match:
                        value = milestone_match.group(1)

                elif field == "gas_type":
                    text_to_search = " ".join(
                        data['text'][i:min(i+3, len(data['text']))])
                    gas_type_match = re.search(
                        r"(DIESEL|E20|E85|GASOHOL)", text_to_search, re.IGNORECASE)
                    if gas_type_match:
                        value = gas_type_match.group(
                            1).upper()  # Normalize to uppercase

                elif field in ['merchant_name', 'gas_provider', 'gas_name']:
                    if any(kw.lower() == word.lower() for kw in field_keywords):
                        value = word
                    elif next_word_idx < len(data['text']) and data['text'][next_word_idx].strip():
                        value = data['text'][next_word_idx].strip()
                    # Specific logic for A5.jpg's merchant name
                    if 'สยามยามาโมโต' in value:
                        value = 'บริษัท สยามยามาโมโต จำกัด'
                    elif 'ptt' in value.lower():
                        value = 'PTT'
                    elif 'bangchak' in value.lower() or 'บางจาก' in value.lower():
                        value = 'Bangchak'
                    else:
                        value = "N/A"

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
                            r'\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email)', '', value, flags=re.IGNORECASE).strip()
                    else:
                        value = "N/A"

                if value is not None and value != "N/A" and collected[field] == "N/A":
                    collected[field] = value

                    x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    if 0 <= x < x + w <= image_cv.shape[1] and 0 <= y < y + h <= image_cv.shape[0]:
                        cv2.rectangle(image_cv, (x, y),
                                      (x + w, y + h), (0, 255, 0), 2)
                        cv2.putText(image_cv, field, (x, y - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                    if next_word_idx < len(data['text']):
                        xv, yv = data['left'][next_word_idx], data['top'][next_word_idx]
                        wv, hv = data['width'][next_word_idx], data['height'][next_word_idx]
                        if 0 <= xv < xv + wv <= image_cv.shape[1] and 0 <= yv < yv + hv <= image_cv.shape[0]:
                            cv2.rectangle(image_cv, (xv, yv),
                                          (xv + wv, yv + hv), (255, 0, 0), 2)

    for field in collected:
        if collected[field] != "N/A":
            result[field] = collected[field]
    return result, image_cv


def extract_with_regex_patterns(extracted_text, result):
    patterns = {
        # EGAT Information (Primary focus for A5)
        # MUST DO: Update patterns to NOT expect spaces where characters should be contiguous.
        # Ensure 'taxid' in the pattern matches the no-space 'taxid' if used in the text.
        "egat_address_th": r"(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.)(?:[\s\S]*?)(\d{4}[\-.]\d{1,2}[\-.]\d{1,2}\s*(?:\d{1,2}:\d{1,2}:\d{1,2})?)?([\s\S]*?)(?=\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|taxid|$)|(?:phone|fax|เลขประจำตัวผู้เสียภาษี|taxid|$))",
        "egat_address_eng": r"(?:electricitygeneratingauthorityofthailand|egat)[:\s]*([\s\S]*?)(?=\d{5}\s*(?:|phone|fax|web|email|taxid|$)|(?:โทร|โทรสาร|เลขประจำตัวผู้เสียภาษี|taxid|$))",
        "egat_tax_id": r"(?:เลขประจำตัวผู้เสียภาษี|taxid)[:\s]*(\d{10,15})",

        # Gas Station Information (Secondary/if relevant)
        # MUST DO: For merchant name, remove \s+
        "merchant_name": r"(บริษัทสยามยามาโมโตจำกัด)",  # REMOVED \s+
        # gas_address might still use some spaces if it's a multi-word address, adjust as needed.
        # If the OCR outputs "123 Main Street" as "1 2 3 M a i n S t r e e t"
        # and after global cleaning it's "123mainstreet", then your regex for gas_address
        # must match "123mainstreet" as well.
        "gas_address": r"(ที่อยู่|address)[:\s]*(.*?)(?=\d{5}|\n|$)",
        "gas_tax_id": r"(?:taxid|เลขประจำตัวผู้เสียภาษี)[:\s]*(\d{10,15})",

        # Receipt Details
        # MUST DO: Check these patterns as well. If "receipt no" became "receiptno", adjust.
        # Lowercase 'rd'
        "receipt_no": r"(?:เลขที่ใบกำกับภาษี|receiptno\.?|rd#)[:\s]*([a-z0-9\-/]{8,20})",
        # Dates usually don't have spaces within
        "date": r"(?:วันที่ขาย|date|issued)[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})",
        "total_amount": r"(?:รวมเป็นเงิน|รวมเงิน|total|amount)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        # 'l' lowercase
        "liters": r"(\d+(?:\.\d+)?)\s*(?:l|ลิตร|litres|liters)",
        "VAT": r"(?:ภาษีมูลค่าเพิ่ม|vat)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",

        # Vehicle Information
        # MUST DO: plate_no might need significant adjustment if spaces are gone.
        # "([0-9]{1,2}[ก-ฮa-z]{1,2}[0-9]{3,4})" would be the new pattern if all spaces are gone.
        # Removed internal \s*
        "plate_no": r"ทะเบียนรถ[:\s]*([0-9]{1,2}[ก-ฮa-za-z]{1,2}[0-9]{3,4})",
        "milestone": r"เลขไมล์[:\s]*(\d+(?:[.,]\d+)?)\s*กิโลเมตร"
    }

    for field, pattern in patterns.items():
        is_placeholder_or_na = result[field] is None or result[field] == "N/A"
        if field in ["total_amount", "VAT", "liters", "milestone", "egat_tax_id", "gas_tax_id"] and not is_placeholder_or_na:
            try:
                float(str(result[field]).replace(',', '').replace('-', ''))
            except ValueError:
                is_placeholder_or_na = True

        if is_placeholder_or_na:
            # *** MUST DO: SIMPLIFY RE.SEARCH CALLS ***
            # Now 'extracted_text' itself is already lowercase and has no spaces.
            match = re.search(pattern, extracted_text,
                              re.IGNORECASE | re.DOTALL)

            if match:
                if field == "egat_address_th":
                    value = match.group(2).strip() if len(
                        match.groups()) > 1 else "N/A"
                elif field in ["total_amount", "VAT", "liters", "milestone", "egat_tax_id", "gas_tax_id"]:
                    value = match.group(1).replace(',', '').strip() if len(
                        match.groups()) > 0 else match.group(0).replace(',', '').strip()
                else:
                    value = match.group(1).strip() if len(
                        match.groups()) > 0 else match.group(0).strip()

                if field == "date":
                    parsed_date_value = None
                    for p in [r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})', r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})']:
                        date_match_internal = re.search(p, value)
                        if date_match_internal:
                            d_str = date_match_internal.group(1)
                            try:
                                if re.match(r'\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}', d_str):
                                    parts = re.split(r'[/\-.]', d_str)
                                    year = int(parts[2])
                                    year = 2000 + year if year < 50 else 1900 + year
                                    month = int(parts[1])
                                    day = int(parts[0])
                                    parsed_date_value = f"{year:04d}-{month:02d}-{day:02d}"
                                else:
                                    datetime.strptime(d_str, '%Y-%m-%d')
                                    parsed_date_value = d_str
                                break
                            except ValueError:
                                pass
                    value = parsed_date_value if parsed_date_value else "N/A"
                elif field == "merchant_name":
                    # After matching 'บริษัทสยามยามาโมโตจำกัด'
                    # You might want to re-insert spaces for the final display
                    if 'สยามยามาโมโต' in value:  # This check is still okay for validation
                        value = 'บริษัท สยามยามาโมโต จำกัด'  # Re-format for display
                elif field == "gas_type":
                    # Add gas_type to your patterns if it's not there.
                    value = value.upper()

                if value != "N/A" and value != result[field]:
                    result[field] = value
    return result
