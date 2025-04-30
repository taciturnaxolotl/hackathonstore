/**
 * Notifications Module for Hackathon Hardware Store
 * Handles push notifications setup and interaction
 */
import Config from './config.js';

const Notifications = {
  // Subscription info
  subscription: null,
  vapidPublicKey: null,

  /**
   * Initialize the notifications module
   */
  async init() {
    // Check if service worker and push messaging is supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported in this browser');
      return false;
    }

    try {
      // Get the VAPID public key from server
      const response = await fetch(`${Config.get('API_BASE_URL')}/notifications/vapid-public-key`);
      const data = await response.json();
      this.vapidPublicKey = data.publicKey;
      
      // Register service worker
      await this.registerServiceWorker();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  },

  /**
   * Register the service worker for push notifications
   */
  async registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/client/sw.js');
      console.log('Service worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      throw error;
    }
  },

  /**
   * Request permission to show notifications
   * @returns {string} Permission status: 'granted', 'denied', or 'default'
   */
  async requestPermission() {
    if (!('Notification' in window)) {
      console.log('Notifications not supported in this browser');
      return 'not-supported';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    // Request permission
    const permission = await Notification.requestPermission();
    return permission;
  },

  /**
   * Subscribe to push notifications
   * @returns {PushSubscription|null} The subscription object or null if failed
   */
  async subscribeToPush() {
    try {
      // Make sure service worker is registered
      const registration = await navigator.serviceWorker.ready;
      
      // Get existing subscription or create a new one
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Convert VAPID key to Uint8Array
        const applicationServerKey = this.urlB64ToUint8Array(this.vapidPublicKey);
        
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }
      
      this.subscription = subscription;
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
      return null;
    }
  },

  /**
   * Register order for push notifications
   * @param {string} orderId - The order ID to register
   * @param {string} username - User identifier (name or email)
   * @returns {boolean} Whether registration was successful
   */
  async registerOrder(orderId, username) {
    if (!this.subscription) {
      try {
        await this.subscribeToPush();
      } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        return false;
      }
    }

    if (!this.subscription) {
      console.error('No push subscription available');
      return false;
    }

    try {
      const response = await fetch(`${Config.get('API_BASE_URL')}/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          username,
          subscription: this.subscription
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to register for notifications');
      }
      
      console.log('Successfully registered for order notifications');
      return true;
    } catch (error) {
      console.error('Error registering for notifications:', error);
      return false;
    }
  },

  /**
   * Convert a base64 string to Uint8Array for the applicationServerKey
   * @param {string} base64String - Base64 encoded string
   * @returns {Uint8Array} Decoded array
   */
  urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  }
};

export default Notifications;