import React from 'react';

const ParsedDataDisplay = ({ editableFields, handleFieldChange }) => {
    return (
        <div className="parsed-data-container">
            <h3 className="parsed-data-title">Parsed Data:</h3>
            <div className="form-group">
                <label htmlFor="gasProvider" className="form-label">ชื่อปั้มน้ำมัน:</label>
                <input type="text" id="gasProvider" name="gasProvider" className="form-input" value={editableFields.gasProvider || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="transactionDate" className="form-label">วันที่:</label>
                <input type="text" id="transactionDate" name="transactionDate" className="form-input" value={editableFields.transactionDate || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="egatAddress" className="form-label">ที่อยู่EGAT:</label>
                <input type="text" id="egatAddress" name="egatAddress" className="form-input" value={editableFields.egatAddress || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="egatTaxId" className="form-label">รหัสผู้เสียภาษีของ EGAT:</label>
                <input type="text" id="egatTaxId" name="egatTaxId" className="form-input" value={editableFields.egatTaxId || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="amount" className="form-label">จำนวนเงิน:</label>
                <input type="text" id="amount" name="amount" className="form-input" value={editableFields.amount || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="liters" className="form-label">จำนวนลิตร:</label>
                <input type="text" id="liters" name="liters" className="form-input" value={editableFields.liters || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="pricePerLiter" className="form-label">ราคาต่อลิตร:</label>
                <input type="text" id="pricePerLiter" name="pricePerLiter" className="form-input" value={editableFields.pricePerLiter || ''} onChange={handleFieldChange} />
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
                <label htmlFor="plateNo" className="form-label">เลขทะเบียน:</label>
                <input type="text" id="plateNo" name="plateNo" className="form-input" value={editableFields.plateNo || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="milestone" className="form-label">Milestone (km):</label>
                <input type="text" id="milestone" name="milestone" className="form-input" value={editableFields.milestone || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="taxInvNo" className="form-label">หมายเลขใบเสร็จ:</label>
                <input type="text" id="taxInvNo" name="taxInvNo" className="form-input" value={editableFields.taxInvNo || ''} onChange={handleFieldChange} />
            </div>
            <div className="form-group">
                <label htmlFor="original" className="form-label">ต้นฉบับ:</label>
                <input type="text" id="original" name="original" className="form-input" value={editableFields.original ? 'มี' : 'ไม่มี'} readOnly />
            </div>
            <div className="form-group">
                <label htmlFor="signature" className="form-label">ลายเซ็น:</label>
                <input type="text" id="signature" name="signature" className="form-input" value={editableFields.signature ? 'มี' : 'ไม่มี'} readOnly />
            </div>
        </div>
    );
};

export default ParsedDataDisplay;