<?php
header('Content-Type: application/json');

$uploadDir = 'uploads/';
$base_url = 'https://placeholder.com/' . $uploadDir;

// Function to generate a unique filename
function generateUniqueFilename($originalName)
{
    $extension = pathinfo($originalName, PATHINFO_EXTENSION);
    // Renames the file to 'rc' + current timestamp
    $filename = 'rc' . time() . '.' . $extension;
    return $filename;
}

// Check if a file was uploaded via POST
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['error' => 'No file uploaded or an upload error occurred.']);
    http_response_code(400); // Bad Request
    exit;
}

$tempFilePath = $_FILES['image']['tmp_name'];
$originalName = $_FILES['image']['name'];

// Generate a unique filename to prevent overwriting existing files
$uniqueFilename = generateUniqueFilename($originalName);
$destination = $uploadDir . $uniqueFilename;

// Attempt to move the uploaded file to the destination
if (move_uploaded_file($tempFilePath, $destination)) {
    $imageUrl = $base_url . $uniqueFilename;
    echo json_encode([
        'message' => 'File uploaded successfully!',
        'imageUrl' => $imageUrl,
        'filename' => $uniqueFilename
    ]);
    http_response_code(200); // OK
} else {
    echo json_encode(['error' => 'Failed to save the uploaded file. Check directory permissions.']);
    http_response_code(500);
}
