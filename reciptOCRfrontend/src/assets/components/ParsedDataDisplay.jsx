// components/ParsedDataDisplay.jsx
import React, { useState, useEffect, useCallback } from 'react';

// Utility function to convert Buddhist year to Gregorian year
// Assumes input dateString is in "dd-MM-yyyy" format (e.g., "09-06-2568")
const convertBuddhistToGregorian = (dateString) => {
    if (!dateString) return '';

    const parts = dateString.split('-');
    if (parts.length === 3) {
        let day = parts[0];
        let month = parts[1];
        let year = parseInt(parts[2], 10);

        // Simple heuristic: if year is greater than current Gregorian year + 50 (approx), assume Buddhist year
        // The current year is 2025, so a year like 2568 is clearly Buddhist.
        const currentGregorianYear = new Date().getFullYear();
        if (year > currentGregorianYear + 50) { // Adjust threshold if needed
            year = year - 543; // Convert Buddhist year to Gregorian year
        }

        // Ensure month and day are two digits for consistent formatting
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');

        // Return in "yyyy-MM-dd" format
        return `${year}-${month}-${day}`;
    }
    return dateString; // Return original if format is not as expected
};

function ParsedDataDisplay({ editableFields, handleFieldChange, validEgatAddrTH = [], validEgatAddrEng = [] }) {
    // State for Thai address data
    const [thaiAddressData, setThaiAddressData] = useState([]);
    const [provincesList, setProvincesList] = useState([]);
    const [amphuresList, setAmphuresList] = useState([]);
    const [tambonsList, setTambonsList] = useState([]);

    // State for selected IDs from the dropdowns for gas_address
    const [selectedProvinceId, setSelectedProvinceId] = useState('');
    const [selectedAmphureId, setSelectedAmphureId] = useState('');
    const [selectedTambonId, setSelectedTambonId] = useState('');

    // Internal state to manage the display value of the date field
    // This allows the input to show the original format if desired,
    // while the actual stored value is Gregorian.
    const [displayDate, setDisplayDate] = useState(editableFields.date || '');

    // Effect to update displayDate when editableFields.date changes externally
    useEffect(() => {
        // Detect if input is in Buddhist format and convert
        if (editableFields.date && editableFields.date.includes('-') && editableFields.date.length === 10) {
            const parts = editableFields.date.split('-');
            if (parts[2] && parseInt(parts[2], 10) > 2500) {
                const converted = convertBuddhistToGregorian(editableFields.date);
                handleFieldChange({ target: { name: 'date', value: converted } });
            }
        }
    }, [editableFields.date, handleFieldChange]);



    // Fetch Thai province data on component mount
    useEffect(() => {
        fetch("https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_province_with_amphure_tambon.json")
            .then(response => response.json())
            .then(data => {
                setThaiAddressData(data);
                setProvincesList(data); // Initial set for provinces
            })
            .catch(error => console.error("Error fetching Thai province data:", error));
    }, []);

    // Function to update gas_address field based on selections
    const updateGasAddressField = useCallback(() => {
        let combinedAddress = '';
        const province = provincesList.find(p => p.id === Number(selectedProvinceId));
        const amphure = province?.amphure.find(a => a.id === Number(selectedAmphureId));
        const tambon = amphure?.tambon.find(t => t.id === Number(selectedTambonId));

        if (tambon) combinedAddress += tambon.name_th;
        if (amphure) combinedAddress += (combinedAddress ? ' ' : '') + amphure.name_th;
        if (province) combinedAddress += (combinedAddress ? ' ' : '') + province.name_th;

        // Update the gas_address in the parent component's state
        handleFieldChange({ target: { name: 'gas_address', value: combinedAddress.trim() } });
    }, [selectedProvinceId, selectedAmphureId, selectedTambonId, provincesList, handleFieldChange]);

    // Effect to update amphures and tambons when province/amphure selection changes
    useEffect(() => {
        if (selectedProvinceId) {
            const selectedProvince = thaiAddressData.find(p => p.id === Number(selectedProvinceId));
            setAmphuresList(selectedProvince ? selectedProvince.amphure : []);
            setSelectedAmphureId(''); // Reset amphure when province changes
            setSelectedTambonId(''); // Reset tambon when province changes
        } else {
            setAmphuresList([]);
            setTambonsList([]);
            setSelectedAmphureId('');
            setSelectedTambonId('');
        }
    }, [selectedProvinceId, thaiAddressData]);

    useEffect(() => {
        if (selectedAmphureId) {
            const selectedProvince = thaiAddressData.find(p => p.id === Number(selectedProvinceId));
            const selectedAmphure = selectedProvince?.amphure.find(a => a.id === Number(selectedAmphureId));
            setTambonsList(selectedAmphure ? selectedAmphure.tambon : []);
            setSelectedTambonId(''); // Reset tambon when amphure changes
        } else {
            setTambonsList([]);
            setSelectedTambonId('');
        }
    }, [selectedAmphureId, selectedProvinceId, thaiAddressData]);

    useEffect(() => {
        updateGasAddressField();
    }, [selectedProvinceId, selectedAmphureId, selectedTambonId, updateGasAddressField]);


    // Custom handler for date input to perform conversion
    const handleDateChange = (e) => {
        const inputValue = e.target.value;
        setDisplayDate(inputValue); // Update the display value immediately

        const convertedValue = convertBuddhistToGregorian(inputValue);
        // Pass the converted Gregorian date back to the parent's handleFieldChange
        handleFieldChange({ target: { name: 'date', value: convertedValue } });
    };

    // Handle Province selection
    const handleProvinceChange = (event) => {
        const id = event.target.value;
        setSelectedProvinceId(id);
        setSelectedAmphureId(''); // Reset district and tambon
        setSelectedTambonId('');
        if (id) {
            const province = thaiAddressData.find(p => p.id === Number(selectedProvinceId));
            setAmphuresList(province ? province.amphure : []);
            setTambonsList([]); // Clear tambons when province changes
        } else {
            setAmphuresList([]);
            setTambonsList([]);
        }
    };

    // Handle District selection
    const handleAmphureChange = (event) => {
        const id = event.target.value;
        setSelectedAmphureId(id);
        setSelectedTambonId(''); // Reset tambon
        if (id) {
            const amphure = amphuresList.find(a => a.id === Number(id));
            setTambonsList(amphure ? amphure.tambon : []);
        } else {
            setTambonsList([]);
        }
    };

    // Handle Sub-district selection
    const handleTambonChange = (event) => {
        const id = event.target.value;
        setSelectedTambonId(id);
    };


    return (
        <div className="parsed-data-container">
            <h3 className="parsed-data-title">Parsed Data:</h3>
            <div className="form-group">
                <label htmlFor="merchant_name" className="form-label">
                    ชื่อปั้มน้ำมัน:
                </label>
                <input
                    type="text"
                    id="merchant_name"
                    name="merchant_name"
                    className="form-input"
                    value={editableFields.merchant_name || ''}
                    onChange={handleFieldChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="date" className="form-label">
                    วันที่:
                </label>
                <input
                    type="date"
                    id="date"
                    name="date"
                    className="form-input"
                    value={editableFields.date || ''}
                    onChange={(e) => {
                        const gregorianValue = e.target.value;
                        handleFieldChange({ target: { name: 'date', value: gregorianValue } });
                    }}
                />
            </div>
            <div className="form-group">
                <label htmlFor="total_amount" className="form-label">
                    จำนวนเงิน:
                </label>
                <input
                    type="text"
                    id="total_amount"
                    name="total_amount"
                    className="form-input"
                    value={editableFields.total_amount || ''}
                    onChange={handleFieldChange}
                />
            </div>

            {/* New dropdowns for Province, District, Sub-district */}
            <div className="form-group">
                <label htmlFor="province-select" className="form-label">
                    จังหวัด (Province):
                </label>
                <select
                    id="province-select"
                    className="form-input"
                    value={selectedProvinceId}
                    onChange={handleProvinceChange}
                >
                    <option value="">เลือกจังหวัด...</option>
                    {provincesList.map(province => (
                        <option key={province.id} value={province.id}>
                            {province.name_th} ({province.name_en})
                        </option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="amphure-select" className="form-label">
                    อำเภอ/เขต (District):
                </label>
                <select
                    id="amphure-select"
                    className="form-input"
                    value={selectedAmphureId}
                    onChange={handleAmphureChange}
                    disabled={!selectedProvinceId}
                >
                    <option value="">เลือกอำเภอ/เขต...</option>
                    {amphuresList.map(amphure => (
                        <option key={amphure.id} value={amphure.id}>
                            {amphure.name_th} ({amphure.name_en})
                        </option>
                    ))}
                </select>
            </div>

            <div className="form-group">
                <label htmlFor="tambon-select" className="form-label">
                    ตำบล/แขวง (Sub-district):
                </label>
                <select
                    id="tambon-select"
                    className="form-input"
                    value={selectedTambonId}
                    onChange={handleTambonChange}
                    disabled={!selectedAmphureId}
                >
                    <option value="">เลือกตำบล/แขวง...</option>
                    {tambonsList.map(tambon => (
                        <option key={tambon.id} value={tambon.id}>
                            {tambon.name_th} ({tambon.name_en})
                        </option>
                    ))}
                </select>
            </div>

            {/* gas_address field now gets updated by the dropdowns */}
            <div className="form-group">
                <label htmlFor="gas_address" className="form-label">
                    ที่อยู่แก๊ส (Gas Address):
                </label>
                <input
                    type="text"
                    id="gas_address"
                    name="gas_address"
                    className="form-input"
                    value={editableFields.gas_address || ''}
                    onChange={handleFieldChange} // Still allow manual edit if needed
                    placeholder="ที่อยู่จะปรากฏที่นี่จากการเลือกด้านบน"
                />
            </div>
            <div className="form-group">
                <label htmlFor="gas_tax_id" className="form-label">
                    รหัสผู้เสียภาษีของปั้ม:
                </label>
                <input
                    type="text"
                    id="gas_tax_id"
                    name="gas_tax_id"
                    className="form-input"
                    value={editableFields.gas_tax_id || ''}
                    onChange={handleFieldChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="receipt_no" className="form-label">
                    หมายเลขใบเสร็จ:
                </label>
                <input
                    type="text"
                    id="receipt_no"
                    name="receipt_no"
                    className="form-input"
                    value={editableFields.receipt_no || ''}
                    onChange={handleFieldChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="liters" className="form-label">
                    จำนวนลิตร:
                </label>
                <input
                    type="text"
                    id="liters"
                    name="liters"
                    className="form-input"
                    value={editableFields.liters || ''}
                    onChange={handleFieldChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="plate_no" className="form-label">
                    เลขทะเบียน:
                </label>
                <input
                    type="text"
                    id="plate_no"
                    name="plate_no"
                    className="form-input"
                    value={editableFields.plate_no || ''}
                    onChange={handleFieldChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="milestone" className="form-label">
                    Milestone (km):
                </label>
                <input
                    type="text"
                    id="milestone"
                    name="milestone"
                    className="form-input"
                    value={editableFields.milestone || ''}
                    onChange={handleFieldChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="VAT" className="form-label">
                    ภาษีมูลค่าเพิ่ม:
                </label>
                <input
                    type="text"
                    id="VAT"
                    name="VAT"
                    className="form-input"
                    value={editableFields.VAT || ''}
                    onChange={handleFieldChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="gas_type" className="form-label">
                    ประเภทน้ำมัน:
                </label>
                <input
                    type="text"
                    id="gas_type"
                    name="gas_type"
                    className="form-input"
                    value={editableFields.gas_type || ''}
                    onChange={handleFieldChange}
                />
            </div>

            {/* New EGAT-specific Fields */}
            <div className="form-group">
                <label htmlFor="egat_address_th" className="form-label">
                    ที่อยู่EGAT (Thai):
                </label>
                <select
                    id="egat_address_th"
                    name="egat_address_th"
                    className="form-input"
                    value={editableFields.egat_address_th || ''}
                    onChange={handleFieldChange}
                >
                    <option value={editableFields.egat_address_th}>
                        {editableFields.egat_address_th}
                    </option>
                    {validEgatAddrTH.map((type, index) => (
                        <option key={index} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="egat_address_eng" className="form-label">
                    ที่อยู่EGAT (English):
                </label>
                <select
                    type="text"
                    id="egat_address_eng"
                    name="egat_address_eng"
                    className="form-input"
                    value={editableFields.egat_address_eng || ''}
                    onChange={handleFieldChange}
                >
                    <option value={editableFields.egat_address_eng}>
                        {editableFields.egat_address_eng}
                    </option>
                    {validEgatAddrEng.map((type, index) => (
                        <option key={index} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="egat_tax_id" className="form-label">
                    รหัสผู้เสียภาษีของ EGAT:
                </label>
                <input
                    type="text"
                    id="egat_tax_id"
                    name="egat_tax_id"
                    className="form-input"
                    value={editableFields.egat_tax_id || ''}
                    onChange={handleFieldChange}
                />
            </div>
        </div>
    );
}

export default ParsedDataDisplay;