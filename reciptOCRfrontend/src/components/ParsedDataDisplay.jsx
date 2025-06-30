// components/ParsedDataDisplay.jsx
import React from 'react';

function ParsedDataDisplay({ editableFields, handleFieldChange }) {
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
                    type="date" // Changed from "text" to "date"
                    id="date"
                    name="date"
                    className="form-input"
                    value={editableFields.date || ''}
                    onChange={handleFieldChange}
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

            {/* New Gas-specific Fields */}
            <div className="form-group">
                <label htmlFor="gas_provider" className="form-label">ปั้มของ:</label>
                <select
                    id="gas_provider"
                    name="gas_provider"
                    className="form-input"
                    value={editableFields.gas_provider || ''} // Use || '' to handle null/undefined
                    onChange={handleFieldChange}
                >
                    <option value="">Select Provider</option> {/* Optional placeholder */}
                    <option value="PTT">PTT</option>
                    <option value="Bangchak">Bangchak</option>
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="gas_address" className="form-label">
                    ที่อยู่ปั้ม:
                </label>
                <input
                    type="text"
                    id="gas_address"
                    name="gas_address"
                    className="form-input"
                    value={editableFields.gas_address || ''}
                    onChange={handleFieldChange}
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
                <input
                    type="text"
                    id="egat_address_th"
                    name="egat_address_th"
                    className="form-input"
                    value={editableFields.egat_address_th || ''}
                    onChange={handleFieldChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="egat_address_eng" className="form-label">
                    ที่อยู่EGAT (English):
                </label>
                <input
                    type="text"
                    id="egat_address_eng"
                    name="egat_address_eng"
                    className="form-input"
                    value={editableFields.egat_address_eng || ''}
                    onChange={handleFieldChange}
                />
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