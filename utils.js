const path = require('path');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const config = require('./config');

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
}

// Validate JWT token from request headers
function validateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  // Also check legacy API key for backward compatibility
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }
  
  // Legacy API key support
  if (apiKey && apiKey === config.apiKey) {
    return next();
  }
  
  return res.status(401).json({ error: 'Unauthorized. Invalid or missing authentication token.' });
}

// Alias for backward compatibility
const validateApiKey = validateToken;

// Generate unique image ID
function generateImageId() {
  return uuidv4().replace(/-/g, ''); // Remove dashes for cleaner URLs
}

module.exports = {
  validateApiKey,
  validateToken,
  verifyToken,
  generateImageId
};

