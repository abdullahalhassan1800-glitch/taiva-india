<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$data_dir = __DIR__ . '/data';
if (!is_dir($data_dir)) {
    mkdir($data_dir, 0755, true);
}

$upload_dir = $data_dir . '/uploads';
if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0755, true);
}

$action = $_GET['action'] ?? '';

// ===================== PUBLIC ENDPOINTS (no auth) =====================

// Get all published web products
if ($action === 'webProducts') {
    $file_path = $data_dir . '/taiva_web_products.json';
    if (!file_exists($file_path)) {
        echo json_encode(['success' => true, 'products' => []]);
        exit;
    }
    $content = file_get_contents($file_path);
    $products = json_decode($content, true);
    if (!is_array($products)) $products = [];
    echo json_encode(['success' => true, 'products' => $products]);
    exit;
}

// Get single web product by id, slug, or adminProductId
if ($action === 'webProduct') {
    $id = $_GET['id'] ?? '';
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'No id provided']);
        exit;
    }
    $file_path = $data_dir . '/taiva_web_products.json';
    if (!file_exists($file_path)) {
        echo json_encode(['success' => false, 'error' => 'No products']);
        exit;
    }
    $content = file_get_contents($file_path);
    $products = json_decode($content, true);
    if (!is_array($products)) $products = [];
    foreach ($products as $p) {
        if (($p['id'] ?? '') === $id || ($p['slug'] ?? '') === $id || ($p['adminProductId'] ?? '') === $id) {
            echo json_encode(['success' => true, 'product' => $p]);
            exit;
        }
    }
    echo json_encode(['success' => false, 'error' => 'Product not found']);
    exit;
}

// Get unique categories from published products
if ($action === 'categories') {
    $file_path = $data_dir . '/taiva_web_products.json';
    if (!file_exists($file_path)) {
        echo json_encode(['success' => true, 'categories' => []]);
        exit;
    }
    $content = file_get_contents($file_path);
    $products = json_decode($content, true);
    if (!is_array($products)) $products = [];
    $cats = [];
    foreach ($products as $p) {
        $cat = $p['category'] ?? '';
        if ($cat && !in_array($cat, $cats)) {
            $cats[] = $cat;
        }
    }
    sort($cats);
    echo json_encode(['success' => true, 'categories' => $cats]);
    exit;
}

// ===================== AUTH REQUIRED BELOW =====================

$valid_token = 'MilesToken@2026';
$token = $_REQUEST['token'] ?? '';
if ($token !== $valid_token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid token']);
    exit;
}

// Save data for a key
if ($action === 'save') {
    $key = $_GET['key'] ?? '';
    if (!$key) {
        echo json_encode(['success' => false, 'error' => 'No key provided']);
        exit;
    }
    $data_raw = $_GET['data'] ?? '';
    if (!$data_raw) {
        $input = json_decode(file_get_contents('php://input'), true);
        $data_raw = $input['data'] ?? '';
    }
    if (!$data_raw) {
        echo json_encode(['success' => false, 'error' => 'No data provided']);
        exit;
    }
    // Validate JSON if it looks like JSON
    $trimmed = ltrim($data_raw);
    if (strlen($trimmed) > 0 && ($trimmed[0] === '{' || $trimmed[0] === '[')) {
        $decoded = json_decode($data_raw);
        if (json_last_error() !== JSON_ERROR_NONE) {
            echo json_encode(['success' => false, 'error' => 'Invalid JSON data']);
            exit;
        }
    }
    $file_path = $data_dir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $key) . '.json';
    if (file_put_contents($file_path, $data_raw) === false) {
        echo json_encode(['success' => false, 'error' => 'Failed to write file']);
        exit;
    }
    echo json_encode(['success' => true, 'key' => $key]);

// Load data for a key
} elseif ($action === 'load') {
    $key = $_GET['key'] ?? '';
    if (!$key) {
        echo json_encode(['success' => false, 'error' => 'No key provided']);
        exit;
    }
    $file_path = $data_dir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $key) . '.json';
    if (!file_exists($file_path)) {
        echo json_encode(['success' => false, 'error' => 'No data']);
        exit;
    }
    $content = file_get_contents($file_path);
    if ($content === false) {
        echo json_encode(['success' => false, 'error' => 'Failed to read file']);
        exit;
    }
    echo json_encode(['success' => true, 'key' => $key, 'data' => $content]);

// Bulk save multiple keys
} elseif ($action === 'saveAll') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        echo json_encode(['success' => false, 'error' => 'Invalid JSON body']);
        exit;
    }
    $data = null;
    if (!empty($input['b64'])) {
        $decoded = base64_decode($input['b64'], true);
        if ($decoded === false) {
            echo json_encode(['success' => false, 'error' => 'Invalid base64']);
            exit;
        }
        $data = json_decode($decoded, true);
    } elseif (!empty($input['data'])) {
        $data = $input['data'];
    }
    if (!$data || !is_array($data)) {
        echo json_encode(['success' => false, 'error' => 'No valid data provided']);
        exit;
    }
    $saved = 0;
    foreach ($data as $key => $value) {
        $safe_key = preg_replace('/[^a-zA-Z0-9_-]/', '_', $key);
        $file_path = $data_dir . '/' . $safe_key . '.json';
        $json_str = is_string($value) ? $value : json_encode($value);
        if (file_put_contents($file_path, $json_str) !== false) {
            $saved++;
        }
    }
    echo json_encode(['success' => true, 'saved' => $saved]);

// List all stored keys
} elseif ($action === 'list') {
    $files = glob($data_dir . '/*.json');
    $keys = [];
    if ($files) {
        foreach ($files as $f) {
            $keys[] = basename($f, '.json');
        }
    }
    echo json_encode(['success' => true, 'keys' => $keys]);

// Delete/unpublish a web product
} elseif ($action === 'deleteWebProduct') {
    $id = $_GET['id'] ?? '';
    if (!$id) {
        echo json_encode(['success' => false, 'error' => 'No id provided']);
        exit;
    }
    $file_path = $data_dir . '/taiva_web_products.json';
    if (!file_exists($file_path)) {
        echo json_encode(['success' => false, 'error' => 'No products file']);
        exit;
    }
    $content = file_get_contents($file_path);
    $products = json_decode($content, true);
    if (!is_array($products)) $products = [];
    $found = false;
    foreach ($products as $i => $p) {
        if (($p['id'] ?? '') === $id || ($p['adminProductId'] ?? '') === $id) {
            // Delete associated uploaded images
            if (!empty($p['images'])) {
                foreach ($p['images'] as $img_url) {
                    if (strpos($img_url, 'data/uploads/') !== false) {
                        $img_file = $data_dir . '/' . str_replace('data/uploads/', 'uploads/', $img_url);
                        if (file_exists($img_file)) @unlink($img_file);
                    }
                }
            }
            unset($products[$i]);
            $found = true;
            break;
        }
    }
    if (!$found) {
        echo json_encode(['success' => false, 'error' => 'Product not found']);
        exit;
    }
    $products = array_values($products);
    file_put_contents($file_path, json_encode($products, JSON_PRETTY_PRINT));
    echo json_encode(['success' => true, 'message' => 'Product deleted']);

// Upload image file
} elseif ($action === 'upload') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'error' => 'POST required']);
        exit;
    }
    if (empty($_FILES['image'])) {
        echo json_encode(['success' => false, 'error' => 'No file uploaded']);
        exit;
    }
    $file = $_FILES['image'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        echo json_encode(['success' => false, 'error' => 'Upload error: ' . $file['error']]);
        exit;
    }
    // Validate file size (max 5MB)
    if ($file['size'] > 5 * 1024 * 1024) {
        echo json_encode(['success' => false, 'error' => 'File too large (max 5MB)']);
        exit;
    }
    // Validate file type
    $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (!in_array($mime, $allowed)) {
        echo json_encode(['success' => false, 'error' => 'Invalid file type. Allowed: jpg, png, webp, gif']);
        exit;
    }
    // Generate safe filename
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    if (!$ext) {
        $ext_map = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
        $ext = $ext_map[$mime] ?? 'jpg';
    }
    $new_name = 'prod_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $dest = $upload_dir . '/' . $new_name;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        echo json_encode(['success' => false, 'error' => 'Failed to save file']);
        exit;
    }
    // Return URL relative to api.php
    $url = 'data/uploads/' . $new_name;
    echo json_encode(['success' => true, 'url' => $url, 'filename' => $new_name]);

} else {
    echo json_encode(['success' => false, 'error' => 'Unknown action. Valid: webProducts, webProduct, categories, save, load, saveAll, list, deleteWebProduct, upload']);
}
