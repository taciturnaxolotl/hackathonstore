/**
 * Service Worker for Hackathon Hardware Store
 * Handles push notifications and caching
 */

// Cache name for offline support
const CACHE_NAME = 'hackathon-store-v1';

// Installation event
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We'll use relative paths which will work correctly within the registration scope
      return cache.addAll([
        './', // Root relative to where the SW is registered
        './index.html',
        './cart.html',
        './checkout.html',
        './order.html',
        './admin.html',
        './css/style.css',
        './js/config.js',
        './js/api.js',
        './js/store.js',
        './js/admin.js',
        './js/notifications.js',
        './img/placeholder.svg'
      ]);
    }).catch(error => {
      console.error('Cache addAll error:', error);
    })
  );
});

// Activation event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve(); // Explicitly return a resolved promise for non-matching cases
        })
      );
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push notification received', event);

  if (!event.data) {
    console.log('No payload in push notification');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Received notification data:', data);

    const title = data.title || 'Order Update';
    const options = {
      body: data.body || 'Your order status has been updated.',
      icon: './img/notification-icon.png',
      badge: './img/notification-badge.png',
      data: {
        url: data.url || './order.html?id=' + data.orderId
      }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('Error processing push notification:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked', event);
  
  event.notification.close();

  // Use relative URL paths based on the scope
  const url = event.notification.data.url || './order.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window/tab is already open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Fetch event for offline support
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});