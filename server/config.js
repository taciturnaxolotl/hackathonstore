/**
 * Configuration module for the Hackathon Hardware Store Server
 * Loads environment variables from .env file
 */

require('dotenv').config();

const config = {
  // Server Configuration
  PORT: process.env.PORT || 3000,
  API_PREFIX: process.env.API_PREFIX || '/hackathon',
  
  // DigiKey API Configuration
  digikey: {
    CLIENT_ID: process.env.DIGIKEY_CLIENT_ID,
    CLIENT_SECRET: process.env.DIGIKEY_CLIENT_SECRET,
    API_URL: process.env.DIGIKEY_API_URL || 'https://api.digikey.com',
    TOKEN_URL: process.env.DIGIKEY_TOKEN_URL || 'https://api.digikey.com/v1/oauth2/token',
  },
  
  // Admin Authentication - No default for security
  ADMIN_CODE: process.env.ADMIN_CODE,
};

// Validate that required config values are present
function validateConfig() {
  const requiredFields = ['digikey.CLIENT_ID', 'digikey.CLIENT_SECRET', 'ADMIN_CODE'];
  
  for (const field of requiredFields) {
    const parts = field.split('.');
    let value = config;
    
    for (const part of parts) {
      value = value[part];
    }
    
    if (!value) {
      console.error(`Missing required configuration: ${field}`);
      return false;
    }
  }
  
  return true;
}

// Check if config is valid
config.isValid = validateConfig();

module.exports = config;