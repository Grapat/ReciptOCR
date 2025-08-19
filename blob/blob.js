function convertToBlob() {
    // Get the image element from the HTML
    const imageElement = document.getElementById('myImage');

    // Create a new canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions to match the image
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;

    // Draw the image onto the canvas
    ctx.drawImage(imageElement, 0, 0);

    // Convert the canvas content to a blob
    canvas.toBlob((blob) => {
        if (blob) {
            console.log("Blob created successfully!");
            console.log(blob);
            // Now you can work with the blob, for example, upload it to a server
            // or create a downloadable link
            const blobUrl = URL.createObjectURL(blob);
            console.log("Blob URL:", blobUrl);
        } else {
            console.error("Failed to create blob.");
        }
    }, 'image/jpeg'); // Specify the MIME type
}