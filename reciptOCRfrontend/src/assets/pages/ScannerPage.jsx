import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReceiptTypeSelect from '../components/ReceiptTypeSelect';
import ImageUpload from '../components/ImageUpload';
import ProcessButton from '../components/ProcessButton';
import ParsedDataDisplay from '../components/ParsedDataDisplay';
import ExtractedTextDisplay from '../components/ExtractedTextDisplay';
import SaveChangesButton from '../components/SaveChangesButton';
import { API_BASE_URL } from "../../api";
import '../../App.css';

console.log(API_BASE_URL)

function ScannerPage() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [masterData, setMasterData] = useState(null);
  const [editableFields, setEditableFields] = useState({
    merchant_name: '',
    date: '',
    total_amount: '',
    gas_provider: '',
    gas_address: '',
    gas_tax_id: '',
    receipt_no: '',
    liters: '',
    plate_no: '',
    milestone: '',
    VAT: '',
    gas_type: '',
    egat_address_th: '',
    egat_address_eng: '',
    egat_tax_id: ''
  });
  const [receiptType, setReceiptType] = useState('generic');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/master`);
        if (!response.ok) throw new Error('Failed to fetch master data');
        const data = await response.json();
        setMasterData(data);
      } catch (error) {
        console.error("Error fetching master data:", error);
      }
    };

    fetchMasterData();
  }, []);

  const clearAllData = useCallback(() => {
    setImagePreviewUrl(null);
    setSelectedFile(null);
    setStatusMessage('');
    setIsError(false);
    setIsProcessing(false);
    setExtractedText('');
    setParsedData(null);
    setEditableFields({
      merchant_name: '',
      date: '',
      total_amount: '',
      gas_provider: '',
      gas_address: '',
      gas_tax_id: '',
      receipt_no: '',
      liters: '',
      plate_no: '',
      milestone: '',
      VAT: '',
      gas_type: '',
      egat_address_th: '',
      egat_address_eng: '',
      egat_tax_id: ''
    });
    setReceiptType('generic');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleImageChange = useCallback((event) => {
    const file = event.target.files[0];
    clearAllData();

    if (file) {
      if (!file.type.startsWith('image/')) {
        setStatusMessage('Please select an image file (PNG, JPG, JPEG, GIF, WEBP).');
        setIsError(true);
        return;
      }
      setSelectedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setStatusMessage(`Selected file: ${file.name}`);
      setIsError(false);
    } else {
      setStatusMessage('No file selected.');
      setIsError(true);
    }
  }, [clearAllData]);

  const handleReceiptTypeChange = useCallback((event) => {
    setReceiptType(event.target.value);
  }, []);

  const handleProcessReceipt = useCallback(async () => {
    if (!selectedFile) {
      setStatusMessage('Please select an image file first.');
      setIsError(true);
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Processing image...');
    setIsError(false);

    const formData = new FormData();
    formData.append('receipt_image', selectedFile);
    formData.append('receipt_type', receiptType);

    try {
      const response = await fetch(`${API_BASE_URL}/api/receipts/process-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process receipt.');
      }

      const result = await response.json();
      setExtractedText(result.extracted_text);
      const mappedParsedData = {
        db_receipt_id: result.parsed_data.db_receipt_id,
        merchant_name: result.parsed_data.merchant_name || '',
        date: result.parsed_data.date || '',
        total_amount: result.parsed_data.total_amount || '',
        gas_provider: result.parsed_data.gas_provider || '',
        gas_address: result.parsed_data.gas_address || '',
        gas_tax_id: result.parsed_data.gas_tax_id || '',
        receipt_no: result.parsed_data.receipt_no || '',
        liters: result.parsed_data.liters || '',
        plate_no: result.parsed_data.plate_no || '',
        milestone: result.parsed_data.milestone || '',
        VAT: result.parsed_data.VAT || '',
        gas_type: result.parsed_data.gas_type || '',
        egat_address_th: result.parsed_data.egat_address_th || '',
        egat_address_eng: result.parsed_data.egat_address_eng || '',
        egat_tax_id: result.parsed_data.egat_tax_id || '',
        receipt_type: result.parsed_data.receipt_type || receiptType,
      };

      setParsedData(mappedParsedData);
      setEditableFields(mappedParsedData);
      setStatusMessage('Receipt processed successfully!');
      setIsError(false);

    } catch (error) {
      console.error("Error during receipt processing:", error);
      setStatusMessage(`Error: ${error.message}`);
      setIsError(true);
      setParsedData(null);
      setExtractedText('');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, receiptType, clearAllData]);

  const handleFieldChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditableFields(prevFields => ({
      ...prevFields,
      [name]: value,
    }));
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!parsedData || !parsedData.db_receipt_id) {
      setStatusMessage('No receipt data to save or no ID found. Please process an image first.');
      setIsError(true);
      return;
    }

    const requiredFields = [
      { name: 'merchant_name', label: 'Merchant Name' },
      { name: 'date', label: 'Date' },
      { name: 'total_amount', label: 'Total Amount' },
      { name: 'receipt_no', label: 'Receipt No.' },
      { name: 'gas_type', label: 'Gas Type' },
      { name: 'plate_no', label: 'Plate No.' },
    ];

    for (const field of requiredFields) {
      const value = editableFields[field.name];
      if (value === null || String(value).trim() === '' || String(value).trim().toUpperCase() === 'N/A') {
        setStatusMessage(`Error: ต้องมี ชื่อปั้มน้ำมัน, วันที่, จำนวนเงิน, หมายเลขใบเสร็จ, ประเภทน้ำมัน, เลขทะเบียน โปรดกรอกให้ครบ`);
        setIsError(true);
        return;
      }
    }

    function similarity(str1, str2) {
      if (!str1 || !str2) return 0;

      str1 = str1.trim().toLowerCase();
      str2 = str2.trim().toLowerCase();

      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;

      const sameCharCount = shorter.split('').filter((char, i) => longer[i] === char).length;

      return sameCharCount / longer.length;
    }

    if (masterData) {

      const isTHValid = validEgatAddrTH.some(addr => similarity(addr, editableFields.egat_address_th) >= 0.8);
      const isENGValid = validEgatAddrEng.some(addr => similarity(addr, editableFields.egat_address_eng) >= 0.8);

      if (!isTHValid && !isENGValid) {
        setStatusMessage('Error: EGAT address is not valid enough (need at least 80% match).');
        setIsError(true);
        return;
      }

      if (!validEgatTaxid.includes(editableFields.egat_tax_id)) {
        setStatusMessage('Error: Invalid EGAT tax id.');
        setIsError(true);
        return;
      }
    }

    setIsProcessing(true);
    setStatusMessage('Saving changes...');
    setIsError(false);

    const receiptId = parsedData.db_receipt_id;
    const dataToSend = {
      merchantName: editableFields.merchant_name,
      transactionDate: editableFields.date,
      amount: editableFields.total_amount,
      gasProvider: editableFields.gas_provider,
      gasAddress: editableFields.gas_address,
      gasTaxId: editableFields.gas_tax_id,
      receiptNo: editableFields.receipt_no,
      liters: editableFields.liters,
      plateNo: editableFields.plate_no,
      milestone: editableFields.milestone,
      VAT: editableFields.VAT,
      gasType: editableFields.gas_type,
      egatAddressTH: editableFields.egat_address_th,
      egatAddressENG: editableFields.egat_address_eng,
      egatTaxId: editableFields.egat_tax_id,
      receiptType: editableFields.receipt_type,
    };

    Object.keys(dataToSend).forEach(key => {
      if (typeof dataToSend[key] === 'string') {
        const trimmedValue = dataToSend[key].trim();
        if (trimmedValue === '' || trimmedValue.toUpperCase() === 'N/A') {
          dataToSend[key] = null;
        }
      }
      if (['amount', 'liters', 'VAT'].includes(key) && dataToSend[key] !== null) {
        if (typeof dataToSend[key] === 'string') {
          dataToSend[key] = parseFloat(dataToSend[key].replace(/,/g, '')) || null;
        }
        if (isNaN(dataToSend[key])) {
          dataToSend[key] = null;
        }
      }
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/receipts/${receiptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes.');
      }

      const result = await response.json();
      setStatusMessage('Changes saved successfully!');
      setIsError(false);

      const updatedMappedData = {
        db_receipt_id: result.receipt.id,
        merchant_name: result.receipt.merchantName || '',
        date: result.receipt.transactionDate || '',
        total_amount: result.receipt.amount || '',
        gas_provider: result.receipt.gasProvider || '',
        gas_address: result.receipt.gasAddress || '',
        gas_tax_id: result.receipt.gasTaxId || '',
        receipt_no: result.receipt.receiptNo || '',
        liters: result.receipt.liters || '',
        plate_no: result.receipt.plateNo || '',
        milestone: result.receipt.milestone || '',
        VAT: result.receipt.VAT || '',
        gas_type: result.receipt.gasType || '',
        egat_address_th: result.receipt.egatAddressTH || '',
        egat_address_eng: result.receipt.egatAddressENG || '',
        egat_tax_id: result.receipt.egatTaxId || '',
        receipt_type: result.receipt.receiptType || '',
      };
      setParsedData(updatedMappedData);
      setEditableFields(updatedMappedData);
      clearAllData();

    } catch (error) {
      console.error("Error during saving changes:", error);
      setStatusMessage(`Error saving changes: ${error.message}`);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  }, [parsedData, editableFields, clearAllData]);

  if (!masterData || !Array.isArray(masterData) || masterData.length === 0) {
    return <p>Loading master data...</p>;
  }

  //const master = masterData[0] || {};
  //const validEgatAddrTH = Array.isArray(master.egatAddressTH) ? master.egatAddressTH : [];
  //const validEgatAddrEng = Array.isArray(master.egatAddressENG) ? master.egatAddressENG : [];
  //const validEgatTaxid = Array.isArray(master.egatTaxId) ? master.egatTaxId : [];

  const master = Array.isArray(masterData) && masterData.length > 0 ? masterData[0] : {};

  const validEgatAddrTH = master.egatAddressTH ? [master.egatAddressTH] : [];
  const validEgatAddrEng = master.egatAddressENG ? [master.egatAddressENG] : [];
  const validEgatTaxid = master.egatTaxId ? [master.egatTaxId] : [];

  return (
    <div className="main-content-layout">
      {/* Upload Section */}
      <div className="upload-section-container card-container fade-in">
        <div className="section-title"><i className="fas fa-upload"></i> อัปโหลดใบเสร็จ</div>
        <div>โปรดถ่ายในที่มีแสงเพียงพอ</div><br />
        <ImageUpload
          imagePreviewUrl={imagePreviewUrl}
          handleImageChange={handleImageChange}
          statusMessage={statusMessage}
          isError={isError}
          setSelectedFile={setSelectedFile}       // ✅ add this
          setImagePreviewUrl={setImagePreviewUrl} // ✅ add this
        />
        <br />
        <ReceiptTypeSelect
          receiptType={receiptType}
          handleReceiptTypeChange={handleReceiptTypeChange}
        />
        <br />
        <ProcessButton
          handleProcessReceipt={handleProcessReceipt}
          selectedFile={selectedFile}
          isProcessing={isProcessing}
          statusMessage={statusMessage}
          isError={isError}
        />
      </div>

      {/* Right Column: Form + Raw Text */}
      <div className="right-content-column">
        <div className="form-section-container card-container fade-in">
          <div className="section-title"><i className="fas fa-edit"></i> แก้ไขข้อมูลที่ตรวจจับได้</div>
          {parsedData ? (
            <>
              <ParsedDataDisplay
                editableFields={editableFields}
                handleFieldChange={handleFieldChange}
                validEgatAddrTH={validEgatAddrTH}
                validEgatAddrEng={validEgatAddrEng}
              />
              <SaveChangesButton
                handleSaveChanges={handleSaveChanges}
                statusMessage={statusMessage}
                isError={isError}
              />
            </>
          ) : (
            <div className="placeholder-box top">
              <p className="placeholder-text">ข้อมูลใบเสร็จที่ถูกดึงจะปรากฏที่นี่</p>
            </div>
          )}
        </div>

        <div className="raw-output-section-container card-container fade-in">
          <div className="section-title"><i className="fas fa-file-alt"></i> ข้อความดิบ (Raw OCR)</div>
          {extractedText ? (
            <ExtractedTextDisplay extractedText={extractedText} />
          ) : (
            <div className="placeholder-box bottom">
              <p className="placeholder-text">ข้อความดิบที่สแกนได้จาก OCR จะปรากฏที่นี่</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScannerPage;
