// components/SaveChangesButton.jsx
import React from 'react';

function SaveChangesButton({ handleSaveChanges, statusMessage, isError }) {
  return (
    <div>
      <hr />
      <h3 style={{ color: 'red' ,textAlign: 'center'}}>
        เช็คข้อมูลให้ถูกต้องครบถ้วนก่อน save
      </h3>
      <hr />
      <button onClick={handleSaveChanges} className="save-button scanner-save-button">
        Save Changes
      </button>
      {statusMessage && (
        <p className={`status-message ${isError ? 'status-message-error' : 'status-message-success'}`}>
          {statusMessage}
        </p>
      )}
    </div>
  );
}

export default SaveChangesButton;