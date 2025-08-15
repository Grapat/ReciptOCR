import React, { useState, useEffect, useCallback } from 'react';

const convertBuddhistToGregorian = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        let day = parts[0];
        let month = parts[1];
        let year = parseInt(parts[2], 10);
        const currentGregorianYear = new Date().getFullYear();
        if (year > currentGregorianYear + 50) {
            year = year - 543;
        }
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return dateString;
};

function ParsedDataDisplay({ editableFields, handleFieldChange }) {
    const [thaiAddressData, setThaiAddressData] = useState([]);
    const [provincesList, setProvincesList] = useState([]);
    const [amphuresList, setAmphuresList] = useState([]);
    const [tambonsList, setTambonsList] = useState([]);
    const [selectedProvinceId, setSelectedProvinceId] = useState('');
    const [selectedAmphureId, setSelectedAmphureId] = useState('');
    const [selectedTambonId, setSelectedTambonId] = useState('');

    useEffect(() => {
        if (editableFields.transactionDate) {
            const converted = convertBuddhistToGregorian(editableFields.transactionDate);
            if (converted !== editableFields.transactionDate) {
                handleFieldChange({ target: { name: 'transactionDate', value: converted } });
            }
        }
    }, [editableFields.transactionDate, handleFieldChange]);

    useEffect(() => {
        fetch("https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_province_with_amphure_tambon.json")
            .then(response => response.json())
            .then(data => {
                setThaiAddressData(data);
                setProvincesList(data);
            })
            .catch(error => console.error("Error fetching Thai province data:", error));
    }, []);

    const updateGasAddressField = useCallback(() => {
        let combinedAddress = '';
        const province = provincesList.find(p => p.id === Number(selectedProvinceId));
        const amphure = province?.amphure.find(a => a.id === Number(selectedAmphureId));
        const tambon = amphure?.tambon.find(t => t.id === Number(selectedTambonId));
        if (tambon) combinedAddress += tambon.name_th;
        if (amphure) combinedAddress += (combinedAddress ? ' ' : '') + amphure.name_th;
        if (province) combinedAddress += (combinedAddress ? ' ' : '') + province.name_th;
        handleFieldChange({ target: { name: 'gasAddress', value: combinedAddress.trim() } });
    }, [selectedProvinceId, selectedAmphureId, selectedTambonId, provincesList, handleFieldChange]);

    useEffect(() => {
        if (selectedProvinceId) {
            const selectedProvince = thaiAddressData.find(p => p.id === Number(selectedProvinceId));
            setAmphuresList(selectedProvince ? selectedProvince.amphure : []);
            setSelectedAmphureId('');
            setSelectedTambonId('');
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
            setSelectedTambonId('');
        } else {
            setTambonsList([]);
            setSelectedTambonId('');
        }
    }, [selectedAmphureId, selectedProvinceId, thaiAddressData]);

    useEffect(() => {
        updateGasAddressField();
    }, [selectedProvinceId, selectedAmphureId, selectedTambonId, updateGasAddressField]);

    const handleAddressChange = (event) => {
        const { name, value } = event.target;
        if (name === 'province-select') {
            setSelectedProvinceId(value);
        } else if (name === 'amphure-select') {
            setSelectedAmphureId(value);
        } else if (name === 'tambon-select') {
            setSelectedTambonId(value);
        }
    };

    const handleDateChange = (e) => {
        handleFieldChange({ target: { name: 'transactionDate', value: e.target.value } });
    };

    return (
        <div className="parsed-data-container">
            <h3 className="parsed-data-title">Parsed Data:</h3>
            <div className="form-group">
                <label htmlFor="gasProvider" className="form-label">ชื่อปั้มน้ำมัน:</label>
                <input type="text" id="gasProvider" name="gasProvider" className="form-input" value={editableFields.gasProvider || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="transactionDate" className="form-label">วันที่:</label>
                <input type="date" id="transactionDate" name="transactionDate" className="form-input" value={editableFields.transactionDate || ''} onChange={handleDateChange} />
            </div>
            <div className="form-group">
                <label htmlFor="amount" className="form-label">จำนวนเงิน:</label>
                <input type="text" id="amount" name="amount" className="form-input" value={editableFields.amount || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="province-select" className="form-label">จังหวัด (Province):</label>
                <select id="province-select" name="province-select" className="form-input" value={selectedProvinceId} onChange={handleAddressChange}>
                    <option value="">เลือกจังหวัด...</option>
                    {provincesList.map(province => (
                        <option key={province.id} value={province.id}>{province.name_th} ({province.name_en})</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="amphure-select" className="form-label">อำเภอ/เขต (District):</label>
                <select id="amphure-select" name="amphure-select" className="form-input" value={selectedAmphureId} onChange={handleAddressChange} disabled={!selectedProvinceId}>
                    <option value="">เลือกอำเภอ/เขต...</option>
                    {amphuresList.map(amphure => (
                        <option key={amphure.id} value={amphure.id}>{amphure.name_th} ({amphure.name_en})</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="tambon-select" className="form-label">ตำบล/แขวง (Sub-district):</label>
                <select id="tambon-select" name="tambon-select" className="form-input" value={selectedTambonId} onChange={handleAddressChange} disabled={!selectedAmphureId}>
                    <option value="">เลือกตำบล/แขวง...</option>
                    {tambonsList.map(tambon => (
                        <option key={tambon.id} value={tambon.id}>{tambon.name_th} ({tambon.name_en})</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="gasAddress" className="form-label">ที่อยู่แก๊ส (Gas Address):</label>
                <input type="text" id="gasAddress" name="gasAddress" className="form-input" value={editableFields.gasAddress || ''} onChange={handleFieldChange} placeholder="ที่อยู่จะปรากฏที่นี่จากการเลือกด้านบน" />
            </div>
            <div className="form-group">
                <label htmlFor="gasTaxId" className="form-label">รหัสผู้เสียภาษีของปั้ม:</label>
                <input type="text" id="gasTaxId" name="gasTaxId" className="form-input" value={editableFields.gasTaxId || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="taxInvNo" className="form-label">หมายเลขใบเสร็จ:</label>
                <input type="text" id="taxInvNo" name="taxInvNo" className="form-input" value={editableFields.taxInvNo || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="liters" className="form-label">จำนวนลิตร:</label>
                <input type="text" id="liters" name="liters" className="form-input" value={editableFields.liters || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="plateNo" className="form-label">เลขทะเบียน:</label>
                <input type="text" id="plateNo" name="plateNo" className="form-input" value={editableFields.plateNo || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="milestone" className="form-label">Milestone (km):</label>
                <input type="text" id="milestone" name="milestone" className="form-input" value={editableFields.milestone || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="VAT" className="form-label">ภาษีมูลค่าเพิ่ม:</label>
                <input type="text" id="VAT" name="VAT" className="form-input" value={editableFields.VAT || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="gasType" className="form-label">ประเภทน้ำมัน:</label>
                <input type="text" id="gasType" name="gasType" className="form-input" value={editableFields.gasType || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="egatAddress" className="form-label">ที่อยู่EGAT:</label>
                <input type="text" id="egatAddress" name="egatAddress" className="form-input" value={editableFields.egatAddress || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="egatTaxId" className="form-label">รหัสผู้เสียภาษีของ EGAT:</label>
                <input type="text" id="egatTaxId" name="egatTaxId" className="form-input" value={editableFields.egatTaxId || ''} onChange={handleFieldChange} />
            </div>
        </div>
    );
}

export default ParsedDataDisplay;