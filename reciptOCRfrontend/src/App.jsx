// App.jsx
import React, { useState, useCallback, useRef } from 'react';
import './app.css';

import Header from './components/Header';
import ReceiptTypeSelect from './components/ReceiptTypeSelect';
import ImageUpload from './components/ImageUpload';
import ProcessButton from './components/ProcessButton';
import ParsedDataDisplay from './components/ParsedDataDisplay';
import ExtractedTextDisplay from './components/ExtractedTextDisplay';
import SaveChangesButton from './components/SaveChangesButton';
import AdminPage from './assets/pages/AdminPage'; // Import the new AdminPage component

function App() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [parsedData, setParsedData] = useState(null);
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
  const [currentPage, setCurrentPage] = useState('scanner'); // New state for navigation: 'scanner' or 'admin'

  // Ref for the hidden file input
  const fileInputRef = useRef(null);

  const clearAllData = useCallback(() => {
    setImagePreviewUrl(null);
    setSelectedFile(null);
    setStatusMessage('');
    setIsError(false);
    setIsProcessing(false);
    setExtractedText('');
    setParsedData(null); // Clear parsed data
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
      fileInputRef.current.value = ''; // Clear the file input
    }
  }, []);

  const handleImageChange = useCallback((event) => {
    const file = event.target.files[0];
    clearAllData(); // Always clear state when a new file selection attempt is made

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
      const response = await fetch('http://localhost:5000/api/receipts/process-image', {
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
      setStatusMessage('No receipt data to save or no ID found.');
      setIsError(true);
      return;
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
      if (dataToSend[key] === '' || dataToSend[key] === 'N/A') {
        dataToSend[key] = null;
      }
      // Convert numbers that might have commas or are strings from input fields
      if (['amount', 'liters', 'VAT'].includes(key) && typeof dataToSend[key] === 'string') {
        dataToSend[key] = parseFloat(dataToSend[key].replace(/,/g, '')) || null;
      }
    });

    console.log("Saving changes for ID:", receiptId, "Data:", dataToSend);

    try {
      const response = await fetch(`http://localhost:5000/api/receipts/${receiptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes.');
      }

      const result = await response.json();
      console.log("Updated Receipt:", result.receipt);
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
  }, [parsedData, editableFields]);


  return (
    <>
      <div className="app-container">
        {/* Navigation Buttons */}
        <div className="navigation-bar">
          <button
            onClick={() => setCurrentPage('scanner')}
            className={`nav-button ${currentPage === 'scanner' ? 'active' : ''}`}
          >
            Receipt Scanner
          </button>
          <button
            onClick={() => setCurrentPage('admin')}
            className={`nav-button ${currentPage === 'admin' ? 'active' : ''}`}
          >
            Admin Page
          </button>
        </div>

        {currentPage === 'scanner' && (
          <div className="main-content-layout">
            {/* Left Column: Image Upload and Controls */}
            <div className="upload-section-container card-container">
              <Header />
              <ReceiptTypeSelect
                receiptType={receiptType}
                handleReceiptTypeChange={handleReceiptTypeChange}
              />
              <ImageUpload
                imagePreviewUrl={imagePreviewUrl}
                handleImageChange={handleImageChange}
                statusMessage={statusMessage}
                isError={isError}
              />
              <ProcessButton
                handleProcessReceipt={handleProcessReceipt}
                selectedFile={selectedFile}
                isProcessing={isProcessing}
              />
            </div>

            {/* Right Column: Vertically stacked Form and Raw Output sections */}
            <div className="right-content-column">
              <div className="form-section-container card-container">
                {parsedData ? (
                  <>
                    <ParsedDataDisplay
                      editableFields={editableFields}
                      handleFieldChange={handleFieldChange}
                    />
                    <SaveChangesButton handleSaveChanges={handleSaveChanges} />
                  </>
                ) : (
                  <div className="placeholder-box top">
                    <p className="placeholder-text">ข้อมูลใบเสร็จที่ถูกดึงจะปรากฏที่นี่</p>
                  </div>
                )}
              </div>

              <div className="raw-output-section-container card-container">
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
        )}

        {currentPage === 'admin' && (
          <AdminPage /> // Render the AdminPage component
        )}
      </div>
    </>
  );
}

export default App;