// App.jsx
import React, { useState, useCallback, useRef } from 'react'; // Import useCallback and useRef
import './app.css';

import Header from './components/Header';
import ReceiptTypeSelect from './components/ReceiptTypeSelect';
import ImageUpload from './components/ImageUpload';
import ProcessButton from './components/ProcessButton';
import ParsedDataDisplay from './components/ParsedDataDisplay';
import ExtractedTextDisplay from './components/ExtractedTextDisplay';
import SaveChangesButton from './components/SaveChangesButton';

function App() {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [parsedData, setParsedData] = useState(null); // This will now contain db_receipt_id after process
  const [editableFields, setEditableFields] = useState({
    merchant_name: '',
    date: '',
    total_amount: '',
    gas_provider: '',
    gas_name: '',
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

  // Refactor: clearAllData as a useCallback for stability
  const clearAllData = useCallback(() => {
    setImagePreviewUrl(null);
    setSelectedFile(null);
    setStatusMessage('');
    setIsError(false);
    setIsProcessing(false);
    setExtractedText('');
    setParsedData(null);
    setEditableFields({
      merchant_name: '', date: '', total_amount: '', gas_provider: '',
      gas_name: '', gas_address: '', gas_tax_id: '', receipt_no: '',
      liters: '', plate_no: '', milestone: '', VAT: '', gas_type: '',
      egat_address_th: '', egat_address_eng: '', egat_tax_id: ''
    });
  }, []);

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    clearAllData();

    if (file) {
      if (!file.type.startsWith('image/')) {
        setStatusMessage('Please select an image file (PNG, JPG, JPEG, GIF, WEBP).');
        setIsError(true);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result);
      reader.readAsDataURL(file);
      setSelectedFile(file);
    }
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setEditableFields(prevFields => ({ ...prevFields, [name]: value }));
  };

  const handleReceiptTypeChange = (e) => {
    setReceiptType(e.target.value);
    setStatusMessage('');
    setIsError(false);
    setExtractedText('');
    setParsedData(null);
    setEditableFields({
      merchant_name: '', date: '', total_amount: '', gas_provider: '',
      gas_name: '', gas_address: '', gas_tax_id: '', receipt_no: '',
      liters: '', plate_no: '', milestone: '', VAT: '', gas_type: '',
      egat_address_th: '', egat_address_eng: '', egat_tax_id: ''
    });
  };

  const handleProcessReceipt = async () => {
    if (!selectedFile) {
      setStatusMessage('Please upload an image first.');
      setIsError(true);
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Processing image and performing OCR...');
    setIsError(false);
    setExtractedText('');
    setParsedData(null);
    setEditableFields({
      merchant_name: '', date: '', total_amount: '', gas_provider: '',
      gas_name: '', gas_address: '', gas_tax_id: '', receipt_no: '',
      liters: '', plate_no: '', milestone: '', VAT: '', gas_type: '',
      egat_address_th: '', egat_address_eng: '', egat_tax_id: ''
    });

    const formData = new FormData();
    formData.append('receipt_image', selectedFile);
    formData.append('receipt_type', receiptType);

    try {
      console.log(formData)
      // This POST request sends the image for processing.
      // Your backend's process-image endpoint is now expected to
      // create a new DB record at this point and return its db_receipt_id.
      const response = await fetch('http://localhost:5000/api/receipts/process-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMessage(data.message);
        setIsError(false);
        setExtractedText(data.extracted_text || 'No text extracted.');
        setParsedData(data.parsed_data); // parsed_data should now contain db_receipt_id from backend.
        setEditableFields(prevFields => ({
          ...prevFields,
          // Ensure that parsed data coming from backend (which is snake_case from python)
          // is mapped to editableFields (also snake_case in state)
          // before any further processing.
          merchant_name: data.parsed_data.merchant_name || '',
          date: data.parsed_data.date || '',
          total_amount: data.parsed_data.total_amount || '',
          gas_provider: data.parsed_data.gas_provider || '',
          gas_name: data.parsed_data.gas_name || '',
          gas_address: data.parsed_data.gas_address || '',
          gas_tax_id: data.parsed_data.gas_tax_id || '',
          receipt_no: data.parsed_data.receipt_no || '',
          liters: data.parsed_data.liters || '',
          plate_no: data.parsed_data.plate_no || '',
          milestone: data.parsed_data.milestone || '',
          VAT: data.parsed_data.VAT || '',
          gas_type: data.parsed_data.gas_type || '',
          egat_address_th: data.parsed_data.egat_address_th || '',
          egat_address_eng: data.parsed_data.egat_address_eng || '',
          egat_tax_id: data.parsed_data.egat_tax_id || '',
        }));
      } else {
        const errorData = await response.json();
        setStatusMessage(`Error: ${errorData.error || 'Unknown error during processing.'}`);
        setIsError(true);
        setExtractedText('');
        setParsedData(null);
        setEditableFields({
          merchant_name: '', date: '', total_amount: '', gas_provider: '',
          gas_name: '', gas_address: '', gas_tax_id: '', receipt_no: '',
          liters: '', plate_no: '', milestone: '', VAT: '', gas_type: '',
          egat_address_th: '', egat_address_eng: '', egat_tax_id: ''
        });
      }
    } catch (error) {
      console.error('Network or processing error:', error);
      setStatusMessage('Failed to connect to the backend or process image. Please check console for details.');
      setIsError(true);
      setExtractedText('');
      setParsedData(null);
      setEditableFields({
        merchant_name: '', date: '', total_amount: '', gas_provider: '',
        gas_name: '', gas_address: '', gas_tax_id: '', receipt_no: '',
        liters: '', plate_no: '', milestone: '', VAT: '', gas_type: '',
        egat_address_th: '', egat_address_eng: '', egat_tax_id: ''
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveChanges = async () => {
    console.log("Save Changes button clicked!");
    // This function now expects parsedData.db_receipt_id to be available for updating.
    if (!parsedData || !parsedData.db_receipt_id) {
      setStatusMessage('No receipt ID found to save changes. Process an image first.');
      setIsError(true);
      return;
    }

    setStatusMessage('Saving changes...');
    setIsError(false);

    // Map frontend snake_case fields to backend camelCase fields
    // and clean/parse numbers before sending
    const dataToSend = {
      // No need for 'id' here, it's in the URL for PUT request
      merchantName: editableFields.merchant_name,
      transactionDate: editableFields.date,
      // Convert total_amount to a clean float
      amount: editableFields.total_amount ? parseFloat(String(editableFields.total_amount).replace(/,/g, '')) : null,
      gasProvider: editableFields.gas_provider,
      gasName: editableFields.gas_name,
      gasAddress: editableFields.gas_address,
      gasTaxId: editableFields.gas_tax_id,
      receiptNo: editableFields.receipt_no,
      // Convert liters to a clean float
      liters: editableFields.liters ? parseFloat(String(editableFields.liters).replace(/,/g, '')) : null,
      plateNo: editableFields.plate_no,
      milestone: editableFields.milestone,
      // Convert VAT to a clean float
      VAT: editableFields.VAT ? parseFloat(String(editableFields.VAT).replace(/,/g, '')) : null,
      gasType: editableFields.gas_type,
      egatAddressTH: editableFields.egat_address_th,
      egatAddressENG: editableFields.egat_address_eng,
      egatTaxId: editableFields.egat_tax_id,
      // Add other fields from parsedData if they are relevant for update and not in editableFields
      // e.g., receiptType: parsedData.receipt_type_used,
      // rawExtractedText: parsedData.extracted_text,
      // debugImagePath: parsedData.debug_image_path,
    };

    // Filter out undefined or empty string values (can adjust this logic as needed)
    // to only send fields that have a meaningful value, or explicitly send nulls.
    // Backend controller handles mapping, but this ensures no 'undefined' values are sent.
    Object.keys(dataToSend).forEach(key => {
      // If a field is explicitly an empty string, set it to null for DB consistency
      // or if it's 'N/A' from OCR
      if (dataToSend[key] === '' || dataToSend[key] === 'N/A') {
        dataToSend[key] = null;
      }
    });


    console.log("Saving changes for ID:", parsedData?.db_receipt_id, "Data:", dataToSend);
    try {
      // This is now a PUT request to UPDATE an existing receipt record in the DB.
      const response = await fetch(`http://localhost:5000/api/receipts/${parsedData.db_receipt_id}`, {
        method: 'PUT', // Changed back to PUT for updating
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        const result = await response.json();
        setStatusMessage(result.message || 'Changes saved successfully!');
        setIsError(false);
        console.log("Updated Receipt:", result.receipt);
        clearAllData(); // Optionally clear data after successful save
      } else {
        const errorData = await response.json();
        setStatusMessage(`Error saving changes: ${errorData.error || 'Unknown error.'}`);
        setIsError(true);
      }
    } catch (error) {
      console.error('Network error during save:', error);
      setStatusMessage('Failed to connect to the backend to save changes.');
      setIsError(true);
    }
  };

  return (
    <>
      <div className="app-container">
        <div className="main-content-layout">
          {/* Left Column: Upload Section */}
          <div className="upload-section-container card-container">

            <Header /> {/* Your Header component */}
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
              {parsedData && ( // Only render if parsedData exists
                <>
                  <ParsedDataDisplay
                    editableFields={editableFields}
                    handleFieldChange={handleFieldChange}
                  />
                  <SaveChangesButton handleSaveChanges={handleSaveChanges} />
                </>
              )}
            </div>

            <div className="raw-output-section-container card-container">
              {extractedText && <ExtractedTextDisplay extractedText={extractedText} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;