/**
 * API Client for Hackathon Store
 * Handles all communication with the server
 */

const API = {
  // Base URL updated for the external API endpoint through Caddy
  BASE_URL: 'http://localhost:3000/hackathon',

  /**
   * Fetches all items from the store
   * @returns {Promise<Array>} Array of item objects
   */
  async getItems() {
    try {
      const response = await fetch(`${this.BASE_URL}/items`);
      if (!response.ok) {
        throw new Error('Failed to fetch items');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching items:', error);
      return [];
    }
  },

  /**
   * Fetches a specific item by ID
   * @param {string} id - Item ID
   * @returns {Promise<Object|null>} Item object or null if not found
   */
  async getItemById(id) {
    try {
      const response = await fetch(`${this.BASE_URL}/items/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch item with ID: ${id}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching item ${id}:`, error);
      return null;
    }
  },

  /**
   * Places a new order
   * @param {string} username - Customer username
   * @param {Array} cart - Array of cart items with quantity
   * @returns {Promise<Object>} Order confirmation with orderId
   */
  async placeOrder(username, cart) {
    try {
      const response = await fetch(`${this.BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, cart })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to place order');
      }

      return await response.json();
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  },

  /**
   * Gets order details by order ID
   * @param {string} orderId - The order ID
   * @returns {Promise<Object>} Order details
   */
  async getOrder(orderId) {
    try {
      const response = await fetch(`${this.BASE_URL}/orders/${orderId}`);
      if (!response.ok) {
        throw new Error('Order not found');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  },

  /**
   * Gets all orders (admin only)
   * @param {string} adminCode - Admin authentication code
   * @returns {Promise<Object>} Object with orders
   */
  async getAllOrders(adminCode) {
    try {
      const response = await fetch(`${this.BASE_URL}/orders?adminCode=${adminCode}`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders or invalid admin code');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching all orders:', error);
      throw error;
    }
  },

  /**
   * Updates an order status (admin only)
   * @param {string} orderId - The order ID
   * @param {string} status - New status ('approved' or 'denied')
   * @param {string} note - Optional note about the status change
   * @param {string} adminCode - Admin authentication code
   * @returns {Promise<Object>} Updated order
   */
  async updateOrderStatus(orderId, status, note, adminCode) {
    try {
      const response = await fetch(`${this.BASE_URL}/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, note, adminCode })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update order');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
};
