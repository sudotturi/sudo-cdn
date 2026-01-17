// API Configuration
const API_BASE = window.location.origin;

// State management
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('totpForm').addEventListener('submit', handleTotpVerify);
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
}

// Check authentication status
function checkAuth() {
    if (authToken) {
        verifyTokenAndLoadDashboard();
    } else {
        showScreen('loginScreen');
    }
}

// Verify token and load dashboard
async function verifyTokenAndLoadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            currentUser = await response.json();
            showDashboard();
        } else {
            localStorage.removeItem('authToken');
            authToken = null;
            showScreen('loginScreen');
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('authToken');
        authToken = null;
        showScreen('loginScreen');
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            if (data.requiresTotp) {
                // Store temp session ID and show TOTP screen
                document.getElementById('tempSessionId').value = data.tempSessionId;
                showScreen('totpScreen');
            } else {
                // No TOTP required, save token and show dashboard
                authToken = data.token;
                localStorage.setItem('authToken', authToken);
                currentUser = data.user;
                showDashboard();
            }
        } else {
            errorDiv.textContent = data.error || 'Login failed';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
    }
}

// Handle TOTP verification
async function handleTotpVerify(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('totpError');
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';

    const totpCode = document.getElementById('totpCode').value;
    const tempSessionId = document.getElementById('tempSessionId').value;

    if (!totpCode || totpCode.length !== 6) {
        errorDiv.textContent = 'Please enter a valid 6-digit code';
        errorDiv.classList.add('show');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/totp/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tempSessionId, token: totpCode })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            currentUser = data.user;
            showDashboard();
        } else {
            errorDiv.textContent = data.error || 'Invalid TOTP code';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
    }
}

// Handle image upload
async function handleUpload(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('uploadError');
    const successDiv = document.getElementById('uploadSuccess');
    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');

    const fileInput = document.getElementById('imageFile');
    const file = fileInput.files[0];

    if (!file) {
        errorDiv.textContent = 'Please select an image file';
        errorDiv.classList.add('show');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            successDiv.textContent = `Image uploaded successfully! URL: ${data.image.url}`;
            successDiv.classList.add('show');
            fileInput.value = '';
            loadImages();
        } else {
            errorDiv.textContent = data.error || 'Upload failed';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
    }
}

// Load images list
async function loadImages() {
    const imagesList = document.getElementById('imagesList');
    imagesList.innerHTML = '<p>Loading images...</p>';

    try {
        const response = await fetch(`${API_BASE}/api/images`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            if (data.images && data.images.length > 0) {
                imagesList.innerHTML = data.images.map(img => `
                    <div class="image-item">
                        <img src="${API_BASE}${img.thumbnail}" alt="${img.originalName}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3C/svg%3E'">
                        <div class="image-item-info">
                            <h3>${img.originalName}</h3>
                            <div class="image-url">ID: ${img.id}</div>
                            <div class="image-url">${img.width}x${img.height} - ${(img.size / 1024).toFixed(2)} KB</div>
                            <div class="image-item-actions">
                                <a href="${API_BASE}${img.url}" target="_blank" class="btn btn-primary">View</a>
                                <button onclick="deleteImage('${img.id}')" class="btn btn-danger">Delete</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                imagesList.innerHTML = '<div class="empty-state">No images uploaded yet.</div>';
            }
        } else {
            imagesList.innerHTML = '<div class="empty-state">Failed to load images.</div>';
        }
    } catch (error) {
        imagesList.innerHTML = '<div class="empty-state">Error loading images.</div>';
    }
}

// Delete image
async function deleteImage(imageId) {
    if (!confirm('Are you sure you want to delete this image?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/images/${imageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            loadImages();
        } else {
            const data = await response.json();
            alert(data.error || 'Failed to delete image');
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

// TOTP Setup functions
async function showTotpSetup() {
    const modal = document.getElementById('totpSetupModal');
    const errorDiv = document.getElementById('totpSetupError');
    const qrDisplay = document.getElementById('qrCodeDisplay');
    const disableSection = document.getElementById('totpDisableSection');

    errorDiv.classList.remove('show');
    qrDisplay.style.display = 'none';
    
    // Check if TOTP is enabled
    if (currentUser && currentUser.totpEnabled) {
        disableSection.style.display = 'block';
    } else {
        disableSection.style.display = 'none';
    }

    modal.classList.add('active');
}

function closeTotpSetup() {
    document.getElementById('totpSetupModal').classList.remove('active');
    document.getElementById('qrCodeDisplay').style.display = 'none';
    document.getElementById('setupTotpCode').value = '';
}

async function generateTotpQr() {
    const errorDiv = document.getElementById('totpSetupError');
    const qrDisplay = document.getElementById('qrCodeDisplay');
    errorDiv.classList.remove('show');

    try {
        const response = await fetch(`${API_BASE}/api/auth/totp/setup`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('qrCodeImage').src = data.qrCode;
            document.getElementById('manualKey').textContent = data.manualEntryKey;
            qrDisplay.style.display = 'block';
        } else {
            errorDiv.textContent = data.error || 'Failed to generate QR code';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
    }
}

async function enableTotp() {
    const totpCode = document.getElementById('setupTotpCode').value;
    const errorDiv = document.getElementById('totpSetupError');

    if (!totpCode || totpCode.length !== 6) {
        errorDiv.textContent = 'Please enter a valid 6-digit code';
        errorDiv.classList.add('show');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/totp/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: totpCode, enable: true })
        });

        const data = await response.json();

        if (response.ok) {
            currentUser.totpEnabled = true;
            document.getElementById('userInfo').textContent = `User: ${currentUser.username} | TOTP: Enabled`;
            closeTotpSetup();
            alert('TOTP enabled successfully!');
        } else {
            errorDiv.textContent = data.error || 'Invalid TOTP code';
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.add('show');
    }
}

async function disableTotp() {
    if (!confirm('Are you sure you want to disable TOTP? This will reduce your account security.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/totp/disable`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            currentUser.totpEnabled = false;
            document.getElementById('userInfo').textContent = `User: ${currentUser.username} | TOTP: Disabled`;
            closeTotpSetup();
            alert('TOTP disabled successfully!');
        } else {
            alert(data.error || 'Failed to disable TOTP');
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

// Show dashboard
function showDashboard() {
    showScreen('dashboardScreen');
    document.getElementById('userInfo').textContent = 
        `User: ${currentUser.username} | TOTP: ${currentUser.totpEnabled ? 'Enabled' : 'Disabled'}`;
    loadImages();
}

// Go to login
function goToLogin() {
    showScreen('loginScreen');
    document.getElementById('loginForm').reset();
}

// Logout
function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    goToLogin();
}

// Show screen helper
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

