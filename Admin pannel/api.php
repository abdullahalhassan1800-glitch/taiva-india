<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$valid_token = 'MilesToken@2026';
$token = $_REQUEST['token'] ?? '';
if ($token !== $valid_token) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid token']);
    exit;
}

$data_dir = __DIR__ . '/data';
if (!is_dir($data_dir)) {
    if (!mkdir($data_dir, 0755, true)) {
        echo json_encode(['success' => false, 'error' => 'Cannot create data directory']);
        exit;
    }
}

$action = $_GET['action'] ?? '';

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
    $file_path = $data_dir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $key) . '.json';
    if (file_put_contents($file_path, $data_raw) === false) {
        echo json_encode(['success' => false, 'error' => 'Failed to write file']);
        exit;
    }
    echo json_encode(['success' => true, 'key' => $key]);
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
} elseif ($action === 'list') {
    $files = glob($data_dir . '/*.json');
    $keys = [];
    if ($files) {
        foreach ($files as $f) {
            $keys[] = basename($f, '.json');
        }
    }
    echo json_encode(['success' => true, 'keys' => $keys]);
} else {
    echo json_encode(['success' => false, 'error' => 'Unknown action. Valid: save, load, saveAll, list']);
}
