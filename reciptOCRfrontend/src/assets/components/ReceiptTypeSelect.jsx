// components/ReceiptTypeSelect.jsx

function ReceiptTypeSelect({ receiptType, handleReceiptTypeChange }) {
  return (
    <div className="form-group receipt-type-select">
      <label htmlFor="receiptType" className="form-label">
        โปรดเลือกประเภทของใบเสร็จ:
      </label>
      <select
        id="receiptType"
        name="receiptType"
        className="form-input"
        value={receiptType}
        onChange={handleReceiptTypeChange}
      >
        <option value="generic"> </option>
        <option value="PTT-Kbank">ปตท. กสิกร</option>
        <option value="Bangchak-Kbank">บางจาก กสิกร</option>
        <option value="Bangchak-Krungthai">บางจาก กรุงไทย</option>
        <option value="A5">ใบเสร็จแบบ A5</option>
      </select>
    </div>
  );
}

export default ReceiptTypeSelect;