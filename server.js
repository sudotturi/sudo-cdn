const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const config = require('./config');
const { validateApiKey, validateToken, verifyToken, generateImageId } = require('./utils');
const { loadMetadata, saveMetadata, loadUsers, saveUsers } = require('./storage');
const {
  generateToken,
  verifyPassword,
  hashPassword,
  generateTotpSecret,
  verifyTotpToken,
  generateQrCodeUrl,
  createDefaultAdmin
} = require('./auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Ensure storage directories exist
async function initStorage() {
  try {
    await fs.mkdir(config.originalsPath, { recursive: true });
    await fs.mkdir(config.cachePath, { recursive: true });
    
    // Initialize metadata file if it doesn't exist
    try {
      await fs.access(config.metadataPath);
    } catch {
      await fs.writeFile(config.metadataPath, JSON.stringify({ images: {} }, null, 2));
    }
    
    // Initialize users file and create default admin if needed
    await createDefaultAdmin();
  } catch (error) {
    console.error('Error initializing storage:', error);
    process.exit(1);
  }
}

// Configure multer for file uploads
const upload = multer({
  dest: config.originalsPath,
  limits: {
    fileSize: config.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (config.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${config.allowedMimeTypes.join(', ')}`));
    }
  }
});

// API Routes

// Serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication Routes

// Login - Step 1: Username/Password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const users = await loadUsers();
    const user = users[username];

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // If TOTP is enabled, require TOTP verification
    if (user.totpEnabled && user.totpSecret) {
      // Return temporary session ID for TOTP verification step
      const tempSessionId = uuidv4();
      // Store temp session in memory (for production, use Redis or similar)
      if (!req.app.locals.tempSessions) {
        req.app.locals.tempSessions = {};
      }
      req.app.locals.tempSessions[tempSessionId] = {
        username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
      };

      return res.json({
        requiresTotp: true,
        tempSessionId: tempSessionId,
        message: 'TOTP verification required'
      });
    }

    // TOTP not enabled, generate token directly
    const token = generateToken(user.username, username);
    res.json({
      success: true,
      token: token,
      user: {
        username: user.username,
        totpEnabled: false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// TOTP Setup - Enable TOTP for a user
app.post('/api/auth/totp/setup', validateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const users = await loadUsers();
    const user = users[username];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new TOTP secret
    const secret = generateTotpSecret(username);
    
    // Store temporary secret (don't enable yet - user needs to verify first)
    if (!req.app.locals.pendingTotp) {
      req.app.locals.pendingTotp = {};
    }
    req.app.locals.pendingTotp[username] = secret.base32;

    // Generate QR code
    const qrCodeUrl = await generateQrCodeUrl(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
      message: 'Scan QR code or enter manual key. Then verify with a TOTP code to enable.'
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    res.status(500).json({ error: 'TOTP setup failed', message: error.message });
  }
});

// TOTP Verify - Verify TOTP code and enable TOTP
app.post('/api/auth/totp/verify', async (req, res) => {
  try {
    const { token, enable, tempSessionId } = req.body;
    const users = await loadUsers();
    let username;
    let user;

    // Check if we're enabling TOTP (requires JWT token) or verifying after login (uses tempSessionId)
    if (enable === true) {
      // Enable TOTP - requires authentication token
      const authHeader = req.headers['authorization'];
      const jwtToken = authHeader && authHeader.split(' ')[1];
      
      if (!jwtToken) {
        return res.status(401).json({ error: 'Authentication token required to enable TOTP' });
      }

      const decoded = verifyToken(jwtToken);
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }

      username = decoded.username;
      user = users[username];

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Enable TOTP - verify against pending secret
      if (!req.app.locals.pendingTotp || !req.app.locals.pendingTotp[username]) {
        return res.status(400).json({ error: 'No pending TOTP setup. Call /api/auth/totp/setup first' });
      }

      const pendingSecret = req.app.locals.pendingTotp[username];
      const isValid = verifyTotpToken(pendingSecret, token);

      if (!isValid) {
        return res.status(400).json({ error: 'Invalid TOTP code' });
      }

      // Enable TOTP
      user.totpSecret = pendingSecret;
      user.totpEnabled = true;
      users[username] = user;
      await saveUsers(users);

      // Clear pending secret
      delete req.app.locals.pendingTotp[username];

      res.json({
        success: true,
        message: 'TOTP enabled successfully'
      });
    } else {
      // Verify TOTP after login (for 2FA step) - uses tempSessionId, no JWT token needed
      if (!tempSessionId) {
        return res.status(400).json({ error: 'tempSessionId is required for TOTP verification' });
      }

      // Check temp session
      if (!req.app.locals.tempSessions || !req.app.locals.tempSessions[tempSessionId]) {
        return res.status(400).json({ error: 'Invalid or expired session' });
      }

      const tempSession = req.app.locals.tempSessions[tempSessionId];
      
      // Check expiration
      if (Date.now() > tempSession.expiresAt) {
        delete req.app.locals.tempSessions[tempSessionId];
        return res.status(400).json({ error: 'Session expired. Please login again.' });
      }

      username = tempSession.username;
      user = users[username];

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify TOTP
      if (!user.totpSecret) {
        return res.status(400).json({ error: 'TOTP not enabled for this user' });
      }

      const isValid = verifyTotpToken(user.totpSecret, token);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid TOTP code' });
      }

      // Generate final token
      const finalToken = generateToken(username, username);

      // Clean up temp session
      delete req.app.locals.tempSessions[tempSessionId];

      res.json({
        success: true,
        token: finalToken,
        user: {
          username: user.username,
          totpEnabled: true
        }
      });
    }
  } catch (error) {
    console.error('TOTP verify error:', error);
    res.status(500).json({ error: 'TOTP verification failed', message: error.message });
  }
});

// Disable TOTP
app.post('/api/auth/totp/disable', validateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const users = await loadUsers();
    const user = users[username];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.totpSecret = null;
    user.totpEnabled = false;
    users[username] = user;
    await saveUsers(users);

    res.json({
      success: true,
      message: 'TOTP disabled successfully'
    });
  } catch (error) {
    console.error('TOTP disable error:', error);
    res.status(500).json({ error: 'Failed to disable TOTP', message: error.message });
  }
});

// Get current user info
app.get('/api/auth/me', validateToken, async (req, res) => {
  try {
    const username = req.user.username;
    const users = await loadUsers();
    const user = users[username];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      username: user.username,
      totpEnabled: user.totpEnabled || false,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info', message: error.message });
  }
});

// Upload image
app.post('/api/upload', validateApiKey, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    // Handle Multer errors
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: `File too large. Maximum size is ${(config.maxFileSize / 1024 / 1024).toFixed(0)}MB` 
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected file field. Use "image" field name.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageId = generateImageId();
    const originalPath = req.file.path;
    const originalExt = path.extname(req.file.originalname);
    const newPath = path.join(config.originalsPath, `${imageId}${originalExt}`);

    // Rename file to use imageId
    await fs.rename(originalPath, newPath);

    // Get image metadata
    const image = sharp(newPath);
    const metadata = await image.metadata();

    // Save to metadata
    const metadataStore = await loadMetadata();
    metadataStore.images[imageId] = {
      id: imageId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      uploadedAt: new Date().toISOString(),
      extension: originalExt
    };
    await saveMetadata(metadataStore);

    res.json({
      success: true,
      image: {
        id: imageId,
        url: `/images/${imageId}`,
        thumbnail: `/images/${imageId}/200/200`,
        ...metadataStore.images[imageId]
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Handle Multer errors in catch block as well
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: `File too large. Maximum size is ${(config.maxFileSize / 1024 / 1024).toFixed(0)}MB` 
      });
    }
    
    res.status(500).json({ error: 'Failed to upload image', message: error.message });
  }
});

// Serve image (with optional resizing)
app.get('/images/:id', async (req, res) => {
  return serveImage(req, res, null, null);
});

app.get('/images/:id/:width/:height', async (req, res) => {
  const width = parseInt(req.params.width);
  const height = parseInt(req.params.height);

  if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0 || width > 5000 || height > 5000) {
    return res.status(400).json({ error: 'Invalid dimensions. Max: 5000x5000' });
  }

  return serveImage(req, res, width, height);
});

async function serveImage(req, res, width, height) {
  try {
    const imageId = req.params.id;
    const metadataStore = await loadMetadata();

    if (!metadataStore.images[imageId]) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageMeta = metadataStore.images[imageId];
    const originalPath = path.join(config.originalsPath, `${imageId}${imageMeta.extension}`);

    // Check if original file exists
    try {
      await fs.access(originalPath);
    } catch {
      return res.status(404).json({ error: 'Image file not found' });
    }

    // If no resizing needed, serve original
    if (!width || !height) {
      res.setHeader('Cache-Control', `public, max-age=${config.cacheMaxAge}`);
      res.setHeader('Content-Type', imageMeta.mimeType);
      return res.sendFile(path.resolve(originalPath));
    }

    // Check cache for resized version
    const cacheKey = `${imageId}_${width}x${height}`;
    const cachePath = path.join(config.cachePath, `${cacheKey}.webp`);

    try {
      // Try to serve from cache
      await fs.access(cachePath);
      res.setHeader('Cache-Control', `public, max-age=${config.cacheMaxAge}`);
      res.setHeader('Content-Type', 'image/webp');
      return res.sendFile(path.resolve(cachePath));
    } catch {
      // Generate resized version
      const resizedBuffer = await sharp(originalPath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: config.formats.webp.quality })
        .toBuffer();

      // Save to cache
      await fs.writeFile(cachePath, resizedBuffer);

      res.setHeader('Cache-Control', `public, max-age=${config.cacheMaxAge}`);
      res.setHeader('Content-Type', 'image/webp');
      return res.send(resizedBuffer);
    }
  } catch (error) {
    console.error('Serve image error:', error);
    res.status(500).json({ error: 'Failed to serve image', message: error.message });
  }
}

// List all images
app.get('/api/images', validateApiKey, async (req, res) => {
  try {
    const metadataStore = await loadMetadata();
    const images = Object.values(metadataStore.images).map(img => ({
      ...img,
      url: `/images/${img.id}`,
      thumbnail: `/images/${img.id}/200/200`
    }));

    res.json({
      count: images.length,
      images: images
    });
  } catch (error) {
    console.error('List images error:', error);
    res.status(500).json({ error: 'Failed to list images', message: error.message });
  }
});

// Get single image info
app.get('/api/images/:id', validateApiKey, async (req, res) => {
  try {
    const imageId = req.params.id;
    const metadataStore = await loadMetadata();

    if (!metadataStore.images[imageId]) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageMeta = metadataStore.images[imageId];
    res.json({
      ...imageMeta,
      url: `/images/${imageMeta.id}`,
      thumbnail: `/images/${imageMeta.id}/200/200`
    });
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Failed to get image', message: error.message });
  }
});

// Delete image
app.delete('/api/images/:id', validateApiKey, async (req, res) => {
  try {
    const imageId = req.params.id;
    const metadataStore = await loadMetadata();

    if (!metadataStore.images[imageId]) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const imageMeta = metadataStore.images[imageId];
    const originalPath = path.join(config.originalsPath, `${imageId}${imageMeta.extension}`);

    // Delete original file
    try {
      await fs.unlink(originalPath);
    } catch (error) {
      console.warn('Could not delete original file:', error);
    }

    // Delete cached versions (find all cache files for this image)
    try {
      const cacheFiles = await fs.readdir(config.cachePath);
      const imageCacheFiles = cacheFiles.filter(file => file.startsWith(imageId));
      await Promise.all(
        imageCacheFiles.map(file => 
          fs.unlink(path.join(config.cachePath, file)).catch(err => console.warn('Cache delete warning:', err))
        )
      );
    } catch (error) {
      console.warn('Could not delete cache files:', error);
    }

    // Remove from metadata
    delete metadataStore.images[imageId];
    await saveMetadata(metadataStore);

    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image', message: error.message });
  }
});

// Start server
async function start() {
  await initStorage();
  
  app.listen(config.port, () => {
    console.log(`🚀 CDN Server running on http://localhost:${config.port}`);
    console.log(`📁 Storage: ${config.storagePath}`);
    console.log(`🔑 API Key: ${config.apiKey}`);
  });
}

start().catch(console.error);

