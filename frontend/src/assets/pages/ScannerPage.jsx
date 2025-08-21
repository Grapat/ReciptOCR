import React, { useState, useCallback, useRef, useEffect } from 'react';
import ImageCropper from '../components/ImageCropper';
import ImageUpload from '../components/ImageUpload';
import ProcessButton from '../components/ProcessButton';
import ParsedDataDisplay from '../components/ParsedDataDisplay';
import ExtractedTextDisplay from '../components/ExtractedTextDisplay';
import SaveChangesButton from '../components/SaveChangesButton';
import { API } from "../../api";
import '../css/ScannerPage.css';

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
    plateNo: '',
    gasProvider: '',
    transactionDate: '',
    taxInvNo: '',
    egatAddress: '',
    egatTaxId: '',
    milestone: '',
    amount: '',
    liters: '',
    pricePerLiter: '',
    VAT: '',
    gasType: '',
    original: false,
    signature: false,
  });
  const fileInputRef = useRef(null);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const response = await fetch(`${API}/api/master`);
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
      plateNo: '',
      gasProvider: '',
      transactionDate: '',
      taxInvNo: '',
      egatAddress: '',
      egatTaxId: '',
      milestone: '',
      amount: '',
      liters: '',
      pricePerLiter: '',
      VAT: '',
      gasType: '',
      original: false,
      signature: false,
    });
    setImageToCrop(null);
    setShowCropper(false);
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
      setStatusMessage(`Selected file: ${file.name}.`);
      setIsError(false);
    } else {
      setStatusMessage('No file selected.');
      setIsError(true);
    }
  }, [clearAllData]);

  const handleCropButtonClick = useCallback(() => {
    if (selectedFile) {
      setImageToCrop(URL.createObjectURL(selectedFile));
      setShowCropper(true);
      setStatusMessage('Please crop your image.');
      setIsError(false);
    } else {
      setStatusMessage('No image selected to crop.');
      setIsError(true);
    }
  }, [selectedFile]);

  const onCropDone = useCallback((croppedBlob) => {
    const croppedFile = new File([croppedBlob], selectedFile.name || 'cropped_image.png', { type: croppedBlob.type });
    setSelectedFile(croppedFile);
    setImagePreviewUrl(URL.createObjectURL(croppedBlob));
    setShowCropper(false);
    setImageToCrop(null);
    setStatusMessage(`Image cropped successfully.`);
    setIsError(false);
  }, [selectedFile]);

  const onCropCancel = useCallback(() => {
    setShowCropper(false);
    setImageToCrop(null);
    setStatusMessage('Image cropping cancelled. Using original image.');
    setIsError(false);
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

    try {
      const response = await fetch(`${API}/api/receipts/process-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process receipt.');
      }

      const result = await response.json();
      setExtractedText(result.extracted_text);

      // Corrected mapping to use camelCase keys
      const mappedParsedData = {
        "dbReceiptId": result.db_receipt_id || '',
        "plateNo": result.parsed_data.plateNo || '',
        "gasProvider": result.parsed_data.gasProvider || '',
        "transactionDate": result.parsed_data.transactionDate || '',
        "taxInvNo": result.parsed_data.taxInvNo || '',
        "egatAddress": result.parsed_data.egatAddress || '',
        "egatTaxId": result.parsed_data.egatTaxId || '',
        "milestone": result.parsed_data.milestone || '',
        "amount": result.parsed_data.amount || '',
        "liters": result.parsed_data.liters || '',
        "pricePerLiter": result.parsed_data.pricePerLiter || '',
        "VAT": result.parsed_data.VAT || '',
        "gasType": result.parsed_data.gasType || '',
        "original": result.parsed_data.original || false,
        "signature": result.parsed_data.signature || false,
        "rawExtractedText": result.extracted_text || '',
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
  }, [selectedFile]);

  const handleFieldChange = useCallback((e) => {
    const { name, value } = e.target;
    setEditableFields((prevFields) => ({
      ...prevFields,
      [name]: value,
    }));
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!parsedData || !parsedData.dbReceiptId) {
      setStatusMessage('No receipt data to save or no ID found. Please process an image first.');
      setIsError(true);
      return;
    }

    const requiredFields = [
      { name: 'plateNo', label: 'เลขทะเบียน' },
      { name: 'gasProvider', label: 'ชื่อปั๊มน้ำมัน' },
      { name: 'transactionDate', label: 'วันที่ทำรายการ' },
      { name: 'taxInvNo', label: 'เลขที่ใบกำกับภาษี' },
      { name: 'egatAddress', label: 'ที่อยู่ กฟผ.' },
      { name: 'egatTaxId', label: 'เลขประจำตัวผู้เสียภาษี กฟผ.' },
      { name: 'milestone', label: 'เลขไมล์' },
      { name: 'amount', label: 'จำนวนเงินรวม' },
      { name: 'liters', label: 'ปริมาณ (ลิตร)' },
      { name: 'pricePerLiter', label: 'ราคาต่อลิตร' },
      { name: 'VAT', label: 'ภาษีมูลค่าเพิ่ม' },
      { name: 'gasType', label: 'ประเภทน้ำมัน' },
      { name: 'original', label: 'ต้นฉบับ' },
      { name: 'signature', label: 'ลายเซ็น' },
    ];

    for (const field of requiredFields) {
      const value = editableFields[field.name];
      if (value === null || String(value).trim() === '' || String(value).trim().toUpperCase() === 'N/A') {
        setStatusMessage(`Error: กรุณากรอกข้อมูลในช่อง ${field.label} ให้ครบถ้วน`);
        setIsError(true);
        return;
      }
    }

    function similarity(str1, str2) {
      if (!str1 || !str2) return 0;
      str1 = String(str1).trim().toLowerCase();
      str2 = String(str2).trim().toLowerCase();
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;
      const sameCharCount = shorter.split('').filter((char, i) => longer[i] === char).length;
      return sameCharCount / longer.length;
    }

    if (masterData) {
      const master = Array.isArray(masterData) && masterData.length > 0 ? masterData[0] : {};
      const validEgatAddrTH = master.egatAddressTH ? [master.egatAddressTH] : [];
      const validEgatAddrEng = master.egatAddressENG ? [master.egatAddressENG] : [];
      const validEgatTaxid = master.egatTaxId ? [master.egatTaxId] : [];

      /*const isTHValid = validEgatAddrTH.some(addr => similarity(addr, editableFields.egatAddress) >= 0.2);
      const isENGValid = validEgatAddrEng.some(addr => similarity(addr, editableFields.egatAddress) >= 0.2);

      if (!isTHValid && !isENGValid) {
        setStatusMessage('Error: EGAT address is not valid enough (need at least 80% match).');
        setIsError(true);
        return;
      } */

      if (!validEgatTaxid.includes(editableFields.egatTaxId)) {
        setStatusMessage('Error: Invalid EGAT tax id.');
        setIsError(true);
        return;
      }
    }

    setIsProcessing(true);
    setStatusMessage('Saving changes...');
    setIsError(false);

    const receiptId = parsedData.dbReceiptId;
    const dataToSend = {
      ...editableFields,
      amount: parseFloat(String(editableFields.amount).replace(/,/g, '')) || null,
      liters: parseFloat(String(editableFields.liters).replace(/,/g, '')) || null,
      VAT: parseFloat(String(editableFields.VAT).replace(/,/g, '')) || null,
      rawExtractedText: parsedData.rawExtractedText,
    };

    try {
      const response = await fetch(`${API}/api/receipts/${receiptId}`, {
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
        dbReceiptId: result.receipt.id,
        plateNo: result.receipt.plateNo || '',
        transactionDate: result.receipt.transactionDate || '',
        taxInvNo: result.receipt.taxInvNo || '',
        egatAddress: result.receipt.egatAddress || '',
        egatTaxId: result.receipt.egatTaxId || '',
        milestone: result.receipt.milestone || '',
        amount: result.receipt.amount || '',
        liters: result.receipt.liters || '',
        pricePerLiter: result.receipt.pricePerLiter || '',
        VAT: result.receipt.VAT || '',
        gasType: result.receipt.gasType || '',
        original: result.receipt.original || false,
        signature: result.receipt.signature || false,
        rawExtractedText: parsedData.rawExtractedText,
      };
      setParsedData(updatedMappedData);
      setEditableFields(updatedMappedData);

    } catch (error) {
      console.error("Error during saving changes:", error);
      setStatusMessage(`Error saving changes: ${error.message}`);
      setIsError(true);
    } finally {
      setIsProcessing(false);
    }
  }, [parsedData, editableFields]);

  return (
    <div className="main-content-layout">
      {showCropper && imageToCrop ? (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropDone={onCropDone}
          onCancel={onCropCancel}
        />
      ) : (
        <>
          <div className="left-panel">
            <div className="section-title"><i>อัปรูปใบเสร็จ</i></div>
            <ImageUpload
              imagePreviewUrl={imagePreviewUrl}
              handleImageChange={handleImageChange}
              statusMessage={statusMessage}
              isError={isError}
            />
            {imagePreviewUrl && (
              <button onClick={handleCropButtonClick} className="crop-button">
                ตัดแต่งรูปภาพ
              </button>
            )}
            <ProcessButton
              handleProcessReceipt={handleProcessReceipt}
              selectedFile={selectedFile}
              isProcessing={isProcessing}
            />
          </div>
          <div className="right-panel">
            <div className="form-section-container">
              <div className="section-title">แบบฟอร์ม</div>
              {parsedData ? (
                <>
                  <ParsedDataDisplay
                    editableFields={editableFields}
                    handleFieldChange={handleFieldChange}
                  />
                  <SaveChangesButton
                    handleSaveChanges={handleSaveChanges}
                    statusMessage={statusMessage}
                    isError={isError}
                  />
                </>
              ) : (
                <div className="placeholder-box">
                  <p className="placeholder-text">ข้อมูลใบเสร็จที่ถูกดึงจะปรากฏที่นี่</p>
                </div>
              )}
            </div>
            <div className="raw-output-section-container">
              <div className="section-title">ข้อความดิบที่สแกนได้จาก</div>
              {extractedText ? (
                <ExtractedTextDisplay extractedText={extractedText} />
              ) : (
                <div className="placeholder-box">
                  <p className="placeholder-text">ข้อความดิบที่สแกนได้จาก OCR จะปรากฏที่นี่</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ScannerPage;