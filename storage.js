const fs = require('fs').promises;
const config = require('./config');

// Load users from JSON file
async function loadUsers() {
  try {
    const data = await fs.readFile(config.usersPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty structure
    return {};
  }
}

// Save users to JSON file
async function saveUsers(users) {
  await fs.writeFile(config.usersPath, JSON.stringify(users, null, 2), 'utf8');
}

// Load metadata from JSON file
async function loadMetadata() {
  try {
    const data = await fs.readFile(config.metadataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty structure
    return { images: {} };
  }
}

// Save metadata to JSON file
async function saveMetadata(metadata) {
  await fs.writeFile(config.metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
}

module.exports = {
  loadUsers,
  saveUsers,
  loadMetadata,
  saveMetadata
};

