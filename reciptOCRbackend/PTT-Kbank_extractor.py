import re
from datetime import datetime
import cv2
import numpy as np


def extract_with_keywords(data, image_cv, result):
    """
    Performs keyword-based extraction from Tesseract's image_to_data output
    specifically for KBPTT (KBank - PTT) receipts.
    """
    keywords = {
        'merchant_name': ['PTTstation', 'KBank', 'PTTST.D'],
        'date': ['DATE', 'วันที่', 'Date'],
        'total_amount': ['TOTAL THB', 'AMOUNT THB', 'รวมเงิน', 'BAHT'],
        'gas_provider': ['PTTstation', 'PTT'],
        # Parts of the address
        'gas_address': ['SINPHATTHONG', 'KANCHANA', 'KANCHANABURI'],
        'gas_tax_id': ['TAX ID', 'เลขประจำตัวผู้เสียภาษี'],
        'receipt_no': ['TID', 'TRACE'],  # TID and TRACE are prominent
        'liters': ['LITER', 'Ltrs'],
        'plate_no': ['ทะเบียนรถ'],
        'milestone': ['ระยะทาง', 'KM', '(KM)'],
        'VAT': ['VAT'],
        'gas_type': ['DIESEL', 'E20', 'E85', 'GASOHOL'],
        'egat_address_th': ['การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย', 'กฟผ', 'กฟผ.', 'นนทบุรี', 'บางกรวย'],
        'egat_address_eng': ['ELECTRICITY GENERATING AUTHORITY OF THAILAND', 'EGAT', 'NONTHABURI', 'BANGKRUAI'],
        'egat_tax_id': ['TAX ID', 'เลขประจำตัวผู้เสียภาษี'],
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
                    text_to_search = " ".join(
                        data['text'][i:min(i+5, len(data['text']))])
                    amount_match = re.search(
                        r'(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)', text_to_search)
                    if amount_match:
                        value = amount_match.group(1).replace(',', '')
                        if not (value.replace('.', '', 1).isdigit()):
                            value = None
                elif field == "date":
                    text_to_search = " ".join(
                        data['text'][i:min(i+4, len(data['text']))])
                    date_patterns = [
                        r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})',
                        r'(\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2})'
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
                    if 'TID' in word and next_word_idx < len(data['text']):
                        tid_match = re.search(
                            r'(\d{6,})', data['text'][next_word_idx])
                        if tid_match:
                            value = tid_match.group(1)
                    elif 'TRACE' in word and next_word_idx < len(data['text']):
                        trace_match = re.search(
                            r'(\d{6,})', data['text'][next_word_idx])
                        if trace_match:
                            value = trace_match.group(1)
                    else:
                        receipt_no_match = re.search(
                            r'[A-Z0-9\-/]{5,}', text_to_search)
                        if receipt_no_match:
                            value = receipt_no_match.group(0)

                elif field in ["gas_tax_id", "egat_tax_id"]:
                    text_to_search = " ".join(
                        data['text'][i:min(i+3, len(data['text']))])
                    tax_id_match = re.search(r'(\d{10,15})', text_to_search)
                    if tax_id_match:
                        value = tax_id_match.group(0)
                    elif 'TAX ID' in word and next_word_idx < len(data['text']):
                        tid_val = data['text'][next_word_idx].strip().replace(
                            " ", "").replace("-", "")
                        if re.match(r'^\d{10,15}$', tid_val):
                            value = tid_val

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
                        r'(\d+(?:\.\d+)?)\s*(?:กิโลเมตร|KM)', text_to_search, re.IGNORECASE)
                    if milestone_match:
                        value = milestone_match.group(1)

                elif field == "gas_type":
                    text_to_search = " ".join(
                        data['text'][i:min(i+3, len(data['text']))])
                    gas_type_match = re.search(
                        r"(DIESEL|E20|E85|GASOHOL)", text_to_search, re.IGNORECASE)
                    if gas_type_match:
                        value = gas_type_match.group(1).upper()

                elif field in ['merchant_name', 'gas_name', 'gas_provider']:
                    if any(kw.lower() == word.lower() for kw in field_keywords):
                        value = word
                    elif next_word_idx < len(data['text']) and data['text'][next_word_idx].strip():
                        value = data['text'][next_word_idx].strip()

                    if 'ptt' in value.lower():
                        value = 'PTT'
                    elif 'kbank' in value.lower():
                        if collected['gas_provider'] == "N/A":
                            # KBank is a payment method/bank, not a gas provider.
                            collected['gas_provider'] = 'KBank'
                        if collected['merchant_name'] == "N/A":
                            # Combine for clarity
                            collected['merchant_name'] = 'PTT - KBank'
                        value = None
                    elif 'sinphatthong' in value.lower() or 'kanchanaburi' in value.lower():  # Part of address
                        if collected['gas_address'] == "N/A":
                            # Capture for address
                            collected['gas_address'] = value
                        value = None
                    else:
                        value = "N/A"
                    # Prioritize PTT as the provider if found
                    if 'ptt' in word.lower() and collected['gas_provider'] == "N/A":
                        collected['gas_provider'] = 'PTT'

                elif field in ['gas_address', 'egat_address_th', 'egat_address_eng']:
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
    """
    Performs regex-based extraction from the full OCR text
    specifically for KBPTT (KBank - PTT) receipts.
    """
    text_lower = extracted_text.lower()

    patterns = {
        "merchant_name": r"(pttstation\s*\|\s*kbank|pttsd\s*sinphatthong\s*br)",
        "date": r"(?:date|วันที่|วันขาย|issued)[:\s]*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})",
        "total_amount": r"(?:total thb|amount thb|รวมเป็นเงิน|รวมเงิน)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        "gas_provider": r"(pttstation|ptt)",
        "gas_address": r"(?:sinphatthong\s*ltd|part\s*branch\s*number\s*\d{4}|kanchanaburi\s*\d{5})",
        "gas_tax_id": r"(?:tax id|เลขประจำตัวผู้เสียภาษี)[:\s]*(\d{10,15})",
        "receipt_no": r"(?:tid|trace)[:\s]*([A-Z0-9\-/]{6,})",
        "liters": r"(\d+(?:\.\d+)?)\s*(?:ltrs|liter|l\.)",
        "plate_no": r"ทะเบียนรถ[:\s]*([0-9]{1,2}\s*[ก-ฮa-zA-Z]{1,2}\s*[0-9]{3,4})",
        "milestone": r"(?:ระยะทาง|km)[:\s]*(\d+(?:[.,]\d+)?)\s*(?:กม|km)",
        "VAT": r"(?:vat)[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        "gas_type": r"(diesel|e20|e85|gasohol)",

        # EGAT Info (if present, usually at the bottom)
        "egat_address_th": r"(?:การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย|กฟผ|กฟผ\.)(?:[\s\S]*?)(\d{4}[\-.]\d{1,2}[\-.]\d{1,2}\s+(?:\d{1,2}:\d{1,2}:\d{1,2})?\s+)?([\s\S]*?)(?=\d{5}\s*(?:|โทร|tel|fax|โทรสาร|เว็บไซต์|web|email|เลขประจำตัวผู้เสียภาษี|tax id|$)|(?:phone|fax|เลขประจำตัวผู้เสียภาษี|tax id|$))",
        "egat_address_eng": r"(?:electricity generating authority of thailand|egat)[:\s]*([\s\S]*?)(?=\d{5}\s*(?:|phone|fax|web|email|tax id|$)|(?:โทร|โทรสาร|เลขประจำตัวผู้เสียภาษี|tax id|$))",
        "egat_tax_id": r"(?:tax id)[:\s]*(\d{10,15})",
    }

    for field, pattern in patterns.items():
        is_placeholder_or_na = result[field] is None or result[field] == "N/A"
        if field in ["total_amount", "VAT", "liters", "milestone", "egat_tax_id", "gas_tax_id"] and not is_placeholder_or_na:
            try:
                float(str(result[field]).replace(',', '').replace('-', ''))
            except ValueError:
                is_placeholder_or_na = True

        if is_placeholder_or_na:
            match = re.search(pattern, extracted_text,
                              re.IGNORECASE | re.DOTALL)
            if match:
                if field == "egat_address_th":  # Special handling for egat_address_th as it has multiple groups
                    value = match.group(3).strip() if match.group(3) else "N/A"
                else:
                    value = match.group(1).strip()

                if field in ["total_amount", "VAT", "liters", "milestone", "egat_tax_id", "gas_tax_id"]:
                    value = value.replace(',', '')
                elif field == "date":
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
                    if 'pttstation' in value.lower() and 'kbank' in value.lower():
                        value = 'PTT Station | KBank'
                    elif 'ptt' in value.lower():
                        value = 'PTT'
                elif field == "gas_provider":
                    if 'ptt' in value.lower():
                        value = 'PTT'
                elif field == "gas_type":
                    value = value.upper()

                if value != "N/A" and value != result[field]:
                    result[field] = value
    return result
