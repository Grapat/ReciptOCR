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
  const [parsedData, setParsedData] = useState(null);
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
      // This is the POST request for processing and potentially creating a new DB entry
      const response = await fetch('http://localhost:5000/api/receipts/process-image', {
        method: 'POST', // Keep this as POST for processing and initial DB creation (if backend supports)
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setStatusMessage(data.message);
        setIsError(false);
        setExtractedText(data.extracted_text || 'No text extracted.');
        setParsedData(data.parsed_data);
        setEditableFields(prevFields => ({
          ...prevFields,
          ...data.parsed_data
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
    // Check if there's parsed data to "save" (for display purposes only now)
    if (!parsedData || !parsedData.db_receipt_id) {
      setStatusMessage('No receipt to save. Process an image first.');
      setIsError(true);
      return;
    }

    // --- Database saving logic is commented out as per your request ---
    // setStatusMessage('Saving changes...');
    // setIsError(false);

    // const dataToSend = {
    //   ...editableFields,
    //   amount: editableFields.total_amount,
    //   transactionDate: editableFields.date,
    // };
    // delete dataToSend.total_amount;
    // delete dataToSend.date;

    // try {
    //   const response = await fetch(`http://localhost:5000/api/receipts/${parsedData.db_receipt_id}`, {
    //     method: 'PUT', // This would typically be a PUT request to update an existing entry
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify(dataToSend),
    //   });

    //   if (response.ok) {
    //     const result = await response.json();
    //     setStatusMessage(result.message);
    //     setIsError(false);
    //     console.log("Updated Receipt:", result.receipt);
    //     clearAllData();
    //   } else {
    //     const errorData = await response.json();
    //     setStatusMessage(`Error saving changes: ${errorData.error || 'Unknown error.'}`);
    //     setIsError(true);
    //   }
    // } catch (error) {
    //   console.error('Network error during save:', error);
    //   setStatusMessage('Failed to connect to the backend to save changes.');
    //   setIsError(true);
    // }
    // --- End of commented out database saving logic ---

    // New logic: Just display a message that saving is disabled for "Save Changes" button
    setStatusMessage('Changes are not saved to the database. Saving is disabled for this button.');
    setIsError(false); // This is a notification, not an error
    console.log('Save Changes button pressed, but database saving is explicitly disabled.');
    console.log('Attempted to "save" (not actually saving) data:', editableFields);
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
              {parsedData && (
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