const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { loadUsers, saveUsers } = require('./storage');

// Generate JWT token
function generateToken(userId, username) {
  return jwt.sign(
    { userId, username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
}

// Hash password
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Verify password
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Generate TOTP secret for a user
function generateTotpSecret(username) {
  return speakeasy.generateSecret({
    name: `${config.totpIssuer} (${username})`,
    issuer: config.totpIssuer,
    length: 32
  });
}

// Verify TOTP token
function verifyTotpToken(secret, token) {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 2 time steps (60 seconds) before/after current time
  });
}

// Generate QR code for TOTP setup
async function generateQrCodeUrl(otpauthUrl) {
  try {
    return await qrcode.toDataURL(otpauthUrl);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
}

// Create default admin user (if no users exist)
async function createDefaultAdmin() {
  const users = await loadUsers();
  
  if (Object.keys(users).length === 0) {
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await hashPassword(defaultPassword);
    
    users.admin = {
      username: 'admin',
      passwordHash: hashedPassword,
      createdAt: new Date().toISOString(),
      totpSecret: null,
      totpEnabled: false
    };
    
    await saveUsers(users);
    console.log('⚠️  Default admin user created!');
    console.log('   Username: admin');
    console.log('   Password: admin123 (or ADMIN_PASSWORD env variable)');
    console.log('   ⚠️  Change this password and enable TOTP immediately!');
  }
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  generateTotpSecret,
  verifyTotpToken,
  generateQrCodeUrl,
  createDefaultAdmin
};

