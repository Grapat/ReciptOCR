// components/SaveChangesButton.jsx
import React from 'react';

function SaveChangesButton({ handleSaveChanges }) {
  return (
    <button onClick={handleSaveChanges} className="save-button">
      Save Changes
    </button>
  );
}

export default SaveChangesButton;