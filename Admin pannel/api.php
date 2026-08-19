<?php
// Security: Only allow requests from our own domains
$allowed_origins = ['https://taiva.in', 'https://www.taiva.in', 'http://localhost', 'http://127.0.0.1'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://taiva.in');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

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

// ===================== FCM PUSH HELPERS =====================
function base64url_encode($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

function fcm_get_oauth_token($sa_file) {
    $sa = json_decode(file_get_contents($sa_file), true);
    if (!$sa || empty($sa['client_email']) || empty($sa['private_key'])) return '';
    $now = time();
    $header = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = base64url_encode(json_encode([
        'iss' => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600
    ]));
    $signing_input = $header . '.' . $claims;
    $pkey = openssl_pkey_get_private($sa['private_key']);
    if (!$pkey) return '';
    openssl_sign($signing_input, $signature, $pkey, 'SHA256');
    $jwt = $signing_input . '.' . base64url_encode($signature);
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    $resp = curl_exec($ch);
    curl_close($ch);
    $json = json_decode((string)$resp, true);
    return isset($json['access_token']) ? $json['access_token'] : '';
}

function fcm_send($title, $body, $data = array()) {
    global $data_dir;
    $tokens_file = $data_dir . '/fcm_tokens.json';
    $tokens = array();
    if (file_exists($tokens_file)) {
        $t = json_decode(file_get_contents($tokens_file), true);
        if (is_array($t)) {
            foreach ($t as $row) {
                if (is_array($row) && !empty($row['token'])) $tokens[] = $row['token'];
            }
        }
    }
    $tokens = array_values(array_unique($tokens));
    if (!$tokens) return 0;

    $sa_file = $data_dir . '/fcm_service_account.json';
    $legacy_file = $data_dir . '/fcm_server_key.txt';
    $endpoint = '';
    $auth = '';
    $v1 = false;
    if (file_exists($sa_file)) {
        $sa = json_decode(file_get_contents($sa_file), true);
        if ($sa && !empty($sa['project_id'])) {
            $access = fcm_get_oauth_token($sa_file);
            if ($access) {
                $endpoint = 'https://fcm.googleapis.com/v1/projects/' . rawurlencode($sa['project_id']) . '/messages:send';
                $auth = 'Bearer ' . $access;
                $v1 = true;
            }
        }
    } elseif (file_exists($legacy_file)) {
        $key = trim(file_get_contents($legacy_file));
        if ($key) {
            $endpoint = 'https://fcm.googleapis.com/fcm/send';
            $auth = 'key=' . $key;
        }
    }
    if (!$endpoint || !$auth) return 0;

    $sent = 0;
    foreach ($tokens as $tok) {
        if ($v1) {
            $payload = array(
                'message' => array(
                    'token' => $tok,
                    'notification' => array('title' => $title, 'body' => $body),
                    'data' => $data,
                    'android' => array('priority' => 'high')
                )
            );
        } else {
            $payload = array(
                'to' => $tok,
                'notification' => array('title' => $title, 'body' => $body),
                'data' => $data,
                'priority' => 'high'
            );
        }
        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json', 'Authorization: ' . $auth));
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $resp = curl_exec($ch);
        curl_close($ch);
        $sent++;
    }
    return $sent;
}

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

// Rate limiting (simple file-based)
$rate_file = sys_get_temp_dir() . '/api_rate_' . md5($_SERVER['REMOTE_ADDR'] ?? '0');
$rate_count = 0;
$rate_time = time();
if (file_exists($rate_file)) {
    $rate_data = @unserialize(file_get_contents($rate_file));
    if ($rate_data && (time() - $rate_data['time']) < 60) {
        $rate_count = $rate_data['count'];
    } else {
        $rate_data = ['time' => time(), 'count' => 0];
    }
}
$rate_count++;
if ($rate_count > 120) { // 120 requests per minute
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Rate limit exceeded. Try again later.']);
    exit;
}
file_put_contents($rate_file, serialize(['time' => $rate_data['time'] ?? time(), 'count' => $rate_count]));

// Token must come from POST body or Authorization header (not GET query)
$valid_token = 'MilesToken@2026';
$token = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input_body = json_decode(file_get_contents('php://input'), true);
    $token = $input_body['token'] ?? $_POST['token'] ?? '';
}
$auth_header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!$token && $auth_header) {
    $token = str_replace('Bearer ', '', $auth_header);
}
// Fallback: allow GET token for public read-only actions (webProducts, webProduct, categories)
$public_actions = ['webProducts', 'webProduct', 'categories'];
if (!$token && !in_array($action, $public_actions)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid token']);
    exit;
}
if (!in_array($action, $public_actions) && $token !== $valid_token) {
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
    $old_orders = null;
    if ($key === 'taiva_orders' && file_exists($file_path)) {
        $old_orders = json_decode(file_get_contents($file_path), true);
    }
    if (file_put_contents($file_path, $data_raw) === false) {
        echo json_encode(['success' => false, 'error' => 'Failed to write file']);
        exit;
    }
    // Send FCM push for newly created orders (super_admin / manager devices)
    if ($key === 'taiva_orders' && is_array($old_orders)) {
        $decoded = json_decode($data_raw, true);
        if (is_array($decoded)) {
            $existing_ids = array();
            foreach ($old_orders as $o) {
                if (is_array($o) && isset($o['id'])) $existing_ids[$o['id']] = true;
            }
            $new_orders = array();
            foreach ($decoded as $o) {
                if (is_array($o) && isset($o['id']) && !isset($existing_ids[$o['id']])) {
                    $new_orders[] = $o;
                }
            }
            if (count($new_orders) > 0 && count($new_orders) <= 10) {
                foreach ($new_orders as $no) {
                    $customer = 'Customer';
                    if (is_array($no['customer'] ?? null) && !empty($no['customer']['name'])) $customer = $no['customer']['name'];
                    elseif (!empty($no['customerName'])) $customer = $no['customerName'];
                    $total = isset($no['total']) ? $no['total'] : 0;
                    $order_no = !empty($no['orderNo']) ? $no['orderNo'] : (isset($no['id']) ? $no['id'] : 'Order');
                    fcm_send('New Order ' . $order_no, 'From ' . $customer . ' — Total ' . $total, array(
                        'type' => 'new_order',
                        'orderId' => isset($no['id']) ? $no['id'] : ''
                    ));
                }
            }
        }
    }
    echo json_encode(['success' => true, 'key' => $key]);

// Register a device FCM token for push notifications
} elseif ($action === 'registerToken') {
    $fcm_token = trim($_GET['fcmToken'] ?? '');
    $device = trim($_GET['device'] ?? '');
    if (!$fcm_token) {
        echo json_encode(['success' => false, 'error' => 'No fcmToken provided']);
        exit;
    }
    $tokens_file = $data_dir . '/fcm_tokens.json';
    $tokens = array();
    if (file_exists($tokens_file)) {
        $t = json_decode(file_get_contents($tokens_file), true);
        if (is_array($t)) $tokens = $t;
    }
    $found = false;
    foreach ($tokens as $i => $row) {
        if (is_array($row) && ($row['token'] ?? '') === $fcm_token) {
            $tokens[$i]['device'] = $device;
            $tokens[$i]['updatedAt'] = date('c');
            $found = true;
            break;
        }
    }
    if (!$found) {
        $tokens[] = array('token' => $fcm_token, 'device' => $device, 'updatedAt' => date('c'));
    }
    if (count($tokens) > 100) {
        $tokens = array_slice($tokens, -100);
    }
    file_put_contents($tokens_file, json_encode($tokens));
    echo json_encode(['success' => true]);
    exit;

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
        echo json_encode(['success' => false, 'error' => 'Upload failed. Please try again.']);
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

// Send order notification email via PHP mail()
} elseif ($action === 'sendOrderEmail') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'error' => 'POST required']);
        exit;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['order'])) {
        echo json_encode(['success' => false, 'error' => 'Order data required']);
        exit;
    }
    $o = $input['order'];
    $email = $o['email'] ?? '';
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'error' => 'No valid customer email']);
        exit;
    }
    $template = $input['template'] ?? 'order_created';
    $from_name = !empty($input['fromName']) ? preg_replace('/[\r\n]/', '', $input['fromName']) : 'OMS';
    // Sanitize fromEmail: only allow valid email, strip header injection chars
    $raw_email = !empty($input['fromEmail']) ? $input['fromEmail'] : 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'taiva.in');
    $from_email = preg_replace('/[\r\n]/', '', $raw_email);
    if (!filter_var($from_email, FILTER_VALIDATE_EMAIL)) {
        $from_email = 'no-reply@taiva.in';
    }
    $site_url = !empty($input['siteUrl']) ? preg_replace('/[\r\n]/', '', $input['siteUrl']) : 'https://taiva.in';

    $subject_map = [
        'order_created' => 'Order Confirmed — ' . ($o['id'] ?? ''),
        'order_paid' => 'Payment Received — ' . ($o['id'] ?? ''),
        'order_fulfilled' => 'Your Order Has Been Shipped — ' . ($o['id'] ?? ''),
        'order_refunded' => 'Refund Issued — ' . ($o['id'] ?? ''),
        'order_cancelled' => 'Order Cancelled — ' . ($o['id'] ?? ''),
        'reminder' => 'Reminder: Complete Your Order — ' . ($o['id'] ?? '')
    ];
    $subject = $subject_map[$template] ?? ('Update on order ' . ($o['id'] ?? ''));

    $name = htmlspecialchars($o['customerName'] ?? 'Customer');
    $order_id = htmlspecialchars($o['id'] ?? '');
    $total = number_format($o['total'] ?? 0);
    $method = htmlspecialchars(strtoupper($o['paymentMethod'] ?? ''));

    $items_html = '';
    if (!empty($o['items'])) {
        foreach ($o['items'] as $it) {
            $items_html .= '<tr>
                <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;color:#202223;">' . htmlspecialchars($it['name'] ?? '') . ' &times; ' . (int)($it['qty'] ?? 1) . '</td>
                <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;color:#202223;text-align:right;">Rs. ' . number_format(($it['price'] ?? 0) * ($it['qty'] ?? 1)) . '</td>
            </tr>';
        }
    }

    $headline = 'Your order is confirmed';
    $message = '<p style="margin:0 0 8px;">Hi ' . $name . ',</p>';
    if ($template === 'order_paid') { $headline = 'Payment received'; $message .= '<p style="margin:0 0 8px;">We received your payment of Rs. ' . $total . '.</p>'; }
    elseif ($template === 'order_fulfilled') { $headline = 'Your order is on the way'; $message .= '<p style="margin:0 0 8px;">Your order has been fulfilled and is on its way to you.</p>'; }
    elseif ($template === 'order_refunded') { $headline = 'Refund issued'; $message .= '<p style="margin:0 0 8px;">A refund has been issued for your order.</p>'; }
    elseif ($template === 'order_cancelled') { $headline = 'Order cancelled'; $message .= '<p style="margin:0 0 8px;">Your order has been cancelled.</p>'; }
    elseif ($template === 'reminder') { $headline = 'You still have items in your cart'; $message .= '<p style="margin:0 0 8px;">Complete your purchase today.</p>'; }
    else { $message .= '<p style="margin:0 0 8px;">Thank you for your order.</p>'; }

    $body = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">' .
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 12px;">' .
        '<tr><td align="center">' .
        '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">' .
        '<tr><td style="background:#008060;padding:24px 28px;text-align:center;"><span style="font-size:22px;font-weight:700;color:#ffffff;">OMS</span></td></tr>' .
        '<tr><td style="padding:28px;">' .
        '<h1 style="margin:0 0 16px;font-size:20px;color:#202223;">' . $headline . '</h1>' .
        $message .
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #eee;border-radius:8px;">' .
        '<tr><td style="padding:12px;border-bottom:1px solid #eee;font-size:13px;color:#6e6e73;">Order</td><td style="padding:12px;border-bottom:1px solid #eee;font-size:13px;color:#202223;text-align:right;font-weight:600;">#' . $order_id . '</td></tr>' .
        '<tr><td style="padding:12px;border-bottom:1px solid #eee;font-size:13px;color:#6e6e73;">Payment method</td><td style="padding:12px;border-bottom:1px solid #eee;font-size:13px;color:#202223;text-align:right;">' . $method . '</td></tr>' .
        $items_html .
        '<tr><td style="padding:12px;font-size:14px;color:#202223;font-weight:700;">Total</td><td style="padding:12px;font-size:16px;color:#008060;text-align:right;font-weight:700;">Rs. ' . $total . '</td></tr>' .
        '</table>' .
        '<p style="margin:24px 0 0;font-size:13px;color:#6e6e73;text-align:center;">Need help? Contact us at <a href="https://wa.me/919582908080" style="color:#008060;">WhatsApp</a></p>' .
        '</td></tr>' .
        '<tr><td style="background:#fafafa;padding:16px 28px;text-align:center;font-size:11px;color:#9a9a9a;">&copy; 2026 OMS &middot; <a href="' . $site_url . '" style="color:#9a9a9a;">' . $site_url . '</a></td></tr>' .
        '</table></td></tr></table></body></html>';

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    if (function_exists('mb_encode_mimeheader')) {
        $headers .= "From: " . mb_encode_mimeheader($from_name) . " <" . $from_email . ">\r\n";
    } else {
        $headers .= "From: " . $from_name . " <" . $from_email . ">\r\n";
    }
    $headers .= "Reply-To: " . $from_email . "\r\n";

    $sent = @mail($email, $subject, $body, $headers);
    if ($sent) {
        echo json_encode(['success' => true, 'email' => $email, 'template' => $template]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to send email']);
    }

} else {
    echo json_encode(['success' => false, 'error' => 'Unknown action. Valid: webProducts, webProduct, categories, save, load, saveAll, list, deleteWebProduct, upload, sendOrderEmail']);
}
