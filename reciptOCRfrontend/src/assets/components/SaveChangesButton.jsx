// components/SaveChangesButton.jsx
import React from 'react';

function SaveChangesButton({ handleSaveChanges, statusMessage, isError }) {
  return (
    <div>
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