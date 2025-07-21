// components/ExtractedTextDisplay.jsx

function ExtractedTextDisplay({ extractedText }) {
  return (
    <div className="extracted-text-container">
      <h3 className="extracted-text-title">ข้อมูลดิบ :</h3>
      <p className="extracted-text-content">{extractedText}</p>
    </div>
  );
}

export default ExtractedTextDisplay;