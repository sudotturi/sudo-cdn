module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  
  // JWT configuration
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  
  // API authentication (legacy - kept for backward compatibility)
  apiKey: process.env.API_KEY || 'your-secret-api-key-change-this',
  
  // Image settings
  maxFileSize: 50 * 1024 * 1024, // 50MB (increased for e-commerce product images)
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  
  // Storage paths
  storagePath: './storage',
  originalsPath: './storage/originals',
  cachePath: './storage/cache',
  metadataPath: './storage/metadata.json',
  
  // Image processing
  defaultQuality: 85,
  formats: {
    jpeg: { quality: 85 },
    png: { quality: 90 },
    webp: { quality: 85 }
  },
  
  // Cache settings (for low traffic, simple is fine)
  cacheMaxAge: 31536000, // 1 year in seconds (CDN-style)
  
  // User storage
  usersPath: './storage/users.json',
  
  // TOTP settings
  totpIssuer: process.env.TOTP_ISSUER || 'Raspberry Pi CDN',
};

