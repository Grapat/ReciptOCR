// components/ProcessButton.jsx

function ProcessButton({ handleProcessReceipt, selectedFile, isProcessing }) {
  return (
    <button
      onClick={handleProcessReceipt}
      className="process-button"
      disabled={!selectedFile || isProcessing}
    >
      {isProcessing ? (
        <>
          <span className="spinner"></span> Processing...
        </>
      ) : (
        'ดึงข้อมูล'
      )}
    </button>
  );
}

export default ProcessButton;