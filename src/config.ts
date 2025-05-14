/**
 * Configuration module for the Hackathon Hardware Store Server
 * Loads environment variables from .env file
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

// Configuration interface
interface Config {
  PORT: number;
  API_PREFIX: string;
  digikey: {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    API_URL: string;
    TOKEN_URL: string;
  };
  ADMIN_CODE: string;
  webpush: {
    VAPID_PUBLIC_KEY: string;
    VAPID_PRIVATE_KEY: string;
    CONTACT_EMAIL: string;
  };
  isValid: boolean;
}

const config: Config = {
  // Server Configuration
  PORT: parseInt(process.env.PORT || '3000'),
  API_PREFIX: process.env.API_PREFIX || '/hackathon',
  
  // DigiKey API Configuration
  digikey: {
    CLIENT_ID: process.env.DIGIKEY_CLIENT_ID || '',
    CLIENT_SECRET: process.env.DIGIKEY_CLIENT_SECRET || '',
    API_URL: process.env.DIGIKEY_API_URL || 'https://api.digikey.com',
    TOKEN_URL: process.env.DIGIKEY_TOKEN_URL || 'https://api.digikey.com/v1/oauth2/token',
  },
  
  // Admin Authentication - No default for security
  ADMIN_CODE: process.env.ADMIN_CODE || '',

  // Web Push Notification Configuration
  webpush: {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
    CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'example@yourdomain.org',
  },
  
  // This will be set by validateConfig()
  isValid: false
};

// Validate that required config values are present
function validateConfig(): boolean {
  const requiredFields = ['digikey.CLIENT_ID', 'digikey.CLIENT_SECRET', 'ADMIN_CODE'];
  
  for (const field of requiredFields) {
    const parts = field.split('.');
    let value: any = config;
    
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

export default config;