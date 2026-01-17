# Raspberry Pi CDN Server

> A lightweight, self-hosted image CDN server designed to run on Raspberry Pi 5. Perfect for serving images to your e-commerce website with features like on-demand resizing, JWT authentication, and TOTP 2FA.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red)](https://www.raspberrypi.org/)

## 🌟 Why Raspberry Pi CDN?

- **Self-hosted** - Complete control over your images and data
- **Lightweight** - Optimized for Raspberry Pi 5 with minimal resource usage
- **Secure** - JWT authentication with optional TOTP 2FA support
- **Modern UI** - Beautiful web interface for image management
- **On-demand resizing** - Automatic image optimization and caching
- **Low traffic optimized** - Perfect for small to medium e-commerce sites

## Features

- 📤 **Image Upload** - Upload images via API with automatic optimization
- 🖼️ **On-Demand Resizing** - Resize images on the fly (e.g., `/images/{id}/200/200`)
- 📦 **Multiple Formats** - Supports JPEG, PNG, WebP, GIF
- 🚀 **Fast Serving** - Caches resized images for better performance
- 🔐 **JWT Authentication** - Secure token-based authentication
- 🔒 **TOTP 2FA** - Google Authenticator compatible two-factor authentication
- 📊 **Image Management** - List, view, and delete images via API

## 🚀 Quick Start

### Prerequisites

- Raspberry Pi 5 (or any ARM-based Linux system)
- Node.js v18 or higher
- npm or yarn

### Installation

### Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v18 or higher)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Setup

1. **Clone this repository**

```bash
git clone https://github.com/yourusername/raspberry-pi-cdn.git
cd raspberry-pi-cdn
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure (optional)**

Edit `config.js` or set environment variables:
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret key for JWT tokens (change from default!)
- `API_KEY` - Legacy API key (still supported for backward compatibility)
- `ADMIN_PASSWORD` - Default admin password (if creating first user)

```bash
export JWT_SECRET="your-super-secret-jwt-key-here"
export PORT=3000
export ADMIN_PASSWORD="secure-password-here"
```

**⚠️ Important:** On first run, a default admin user is created:
- Username: `admin`
- Password: `admin123` (or `ADMIN_PASSWORD` env variable)
- Change this password and enable TOTP immediately!

4. **Start the server**

```bash
# Production
npm start

# Development (with auto-restart)
npm run dev
```

The server will create the `storage/` directory automatically and a default admin user if no users exist.

## Authentication

The server uses JWT tokens for authentication. You can also use the legacy API key method for backward compatibility.

### Login Flow

**Step 1: Login with username/password**

```bash
curl -X POST http://your-pi-ip:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Response (if TOTP is enabled):**
```json
{
  "requiresTotp": true,
  "tempSessionId": "abc123...",
  "message": "TOTP verification required"
}
```

**Response (if TOTP is NOT enabled):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "totpEnabled": false
  }
}
```

**Step 2: If TOTP is enabled, verify TOTP code**

```bash
curl -X POST http://your-pi-ip:3000/api/auth/totp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "tempSessionId": "abc123...",
    "token": "123456"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "totpEnabled": true
  }
}
```

### Enable TOTP (Two-Factor Authentication)

**Step 1: Setup TOTP (requires valid JWT token)**

```bash
curl -X POST http://your-pi-ip:3000/api/auth/totp/setup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "manualEntryKey": "JBSWY3DPEHPK3PXP",
  "message": "Scan QR code or enter manual key. Then verify with a TOTP code to enable."
}
```

Scan the QR code with Google Authenticator or any TOTP app.

**Step 2: Verify and Enable TOTP**

```bash
curl -X POST http://your-pi-ip:3000/api/auth/totp/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456",
    "enable": true
  }'
```

### Using JWT Token

After login, include the JWT token in requests:

```bash
curl -X POST http://your-pi-ip:3000/api/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg"
```

Or use legacy API key method:

```bash
curl -X POST http://your-pi-ip:3000/api/upload \
  -H "X-API-Key: your-api-key" \
  -F "image=@/path/to/image.jpg"
```

## API Usage

### Upload Image

```bash
# Using JWT token
curl -X POST http://your-pi-ip:3000/api/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg"

# Or using legacy API key
curl -X POST http://your-pi-ip:3000/api/upload \
  -H "X-API-Key: your-api-key" \
  -F "image=@/path/to/image.jpg"
```

Response:
```json
{
  "success": true,
  "image": {
    "id": "abc123...",
    "url": "/images/abc123...",
    "thumbnail": "/images/abc123.../200/200",
    "width": 1920,
    "height": 1080,
    ...
  }
}
```

### Serve Original Image

```
GET http://your-pi-ip:3000/images/{image-id}
```

### Serve Resized Image

```
GET http://your-pi-ip:3000/images/{image-id}/{width}/{height}
```

Example:
- `http://your-pi-ip:3000/images/abc123/800/600` - Resize to max 800x600
- `http://your-pi-ip:3000/images/abc123/200/200` - Thumbnail 200x200

### List All Images

```bash
# Using JWT token
curl http://your-pi-ip:3000/api/images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Or using legacy API key
curl http://your-pi-ip:3000/api/images \
  -H "X-API-Key: your-api-key"
```

### Delete Image

```bash
# Using JWT token
curl -X DELETE http://your-pi-ip:3000/api/images/{image-id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Or using legacy API key
curl -X DELETE http://your-pi-ip:3000/api/images/{image-id} \
  -H "X-API-Key: your-api-key"
```

### Get Current User Info

```bash
curl http://your-pi-ip:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Disable TOTP

```bash
curl -X POST http://your-pi-ip:3000/api/auth/totp/disable \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Integration with E-commerce Website

### HTML Example

```html
<!-- Original image -->
<img src="http://your-pi-ip:3000/images/abc123" alt="Product">

<!-- Thumbnail -->
<img src="http://your-pi-ip:3000/images/abc123/200/200" alt="Product thumbnail">

<!-- Product listing -->
<img src="http://your-pi-ip:3000/images/abc123/400/400" alt="Product">
```

### JavaScript Upload Example

```javascript
async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch('http://your-pi-ip:3000/api/upload', {
    method: 'POST',
    headers: {
      'X-API-Key': 'your-api-key'
    },
    body: formData
  });
  
  const data = await response.json();
  return data.image.url;
}
```

## Running as a Service (Optional)

Create a systemd service to run the CDN server on boot:

```bash
sudo nano /etc/systemd/system/cdn-server.service
```

Add:
```ini
[Unit]
Description=CDN Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/cdn
ExecStart=/usr/bin/node server.js
Restart=always
Environment="NODE_ENV=production"
Environment="API_KEY=your-api-key"
Environment="PORT=3000"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable cdn-server
sudo systemctl start cdn-server
sudo systemctl status cdn-server
```

## Performance Tips for Raspberry Pi

1. **Use SD card with good I/O** - Class 10 or better
2. **Consider external USB storage** - For better performance with many images
3. **Monitor storage space** - Set up disk space monitoring
4. **Use reverse proxy** - Consider nginx for better performance and SSL

## Security Considerations

1. **Change default API key** in `config.js` or environment variables
2. **Use HTTPS** - Set up nginx reverse proxy with Let's Encrypt
3. **Firewall** - Only expose necessary ports
4. **Rate limiting** - Consider adding rate limiting for production

## File Structure

```
.
├── server.js          # Main server file
├── config.js          # Configuration
├── utils.js           # Helper functions
├── package.json       # Dependencies
├── storage/           # Auto-created
│   ├── originals/     # Original uploaded images
│   ├── cache/         # Cached resized images
│   └── metadata.json  # Image metadata
└── README.md
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

For more details, see [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Code of Conduct

Please be respectful and considerate in all interactions. We welcome contributions from everyone.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Image processing powered by [Sharp](https://sharp.pixelplumbing.com/)
- TOTP implementation using [Speakeasy](https://github.com/speakeasyjs/speakeasy)

## 📮 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/raspberry-pi-cdn/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/raspberry-pi-cdn/discussions)

## ⭐ Star History

If you find this project useful, please consider giving it a star! ⭐

---

Made with ❤️ for the Raspberry Pi community

