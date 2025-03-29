/**
 * Admin Module for Hackathon Hardware Store
 * Handles order management, authentication, and admin operations
 */

const Admin = {
  // Admin state
  isAuthenticated: false,
  adminCode: null,
  orders: {},
  currentOrderId: null,
  isLoading: false,

  /**
   * Initialize the admin module
   */
  init() {
    // Check for existing admin session
    this.checkAdminSession();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // If already authenticated, load orders directly
    if (this.isAuthenticated) {
      this.loadAllOrders();
    }
    
    // Check if an order ID was provided in URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');
    if (orderId) {
      this.currentOrderId = orderId;
      const orderIdInput = document.getElementById('order-id-input');
      if (orderIdInput) {
        orderIdInput.value = orderId;
      }
    }
  },

  /**
   * Set up all event listeners for admin page
   */
  setupEventListeners() {
    // Admin login form
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.authenticate();
      });
    }

    // Add autocomplete attribute to password field
    const adminCodeInput = document.getElementById('admin-code');
    if (adminCodeInput) {
      adminCodeInput.setAttribute('autocomplete', 'new-password');
    }

    // Order lookup form
    const lookupForm = document.getElementById('order-lookup-form');
    if (lookupForm) {
      lookupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const orderIdInput = document.getElementById('order-id-input');
        const orderId = orderIdInput ? orderIdInput.value.trim() : '';
        if (orderId) {
          this.loadOrderDetails(orderId);
        } else {
          this.showError('Please enter an order ID');
        }
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    // Order list toggle
    const toggleBtn = document.getElementById('toggle-order-list');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const orderListContainer = document.getElementById('order-list-container');
        if (orderListContainer) {
          orderListContainer.classList.toggle('expanded');
          toggleBtn.textContent = orderListContainer.classList.contains('expanded') 
            ? 'Hide Orders' 
            : 'Show All Orders';
        }
      });
    }
  },

  /**
   * Check if admin is already logged in from previous session
   */
  checkAdminSession() {
    const savedAdminCode = sessionStorage.getItem('adminCode');
    if (savedAdminCode) {
      this.adminCode = savedAdminCode;
      this.isAuthenticated = true;
      this.updateAdminUI(true);
    }
  },

  /**
   * Authenticate admin with passcode
   */
  async authenticate() {
    const adminCodeInput = document.getElementById('admin-code');
    if (!adminCodeInput) return;
    
    const adminCodeValue = adminCodeInput.value.trim();
    if (!adminCodeValue) {
      this.showError('Please enter admin code');
      return;
    }

    this.showLoading(true);
    
    try {
      // Test authentication by attempting to fetch all orders
      await API.getAllOrders(adminCodeValue);
      
      // If successful, save admin code and update UI
      this.adminCode = adminCodeValue;
      this.isAuthenticated = true;
      
      // Save to session storage
      sessionStorage.setItem('adminCode', this.adminCode);
      
      // Update UI to show authenticated state
      this.updateAdminUI(true);
      
      // Load all orders
      this.loadAllOrders();
    } catch (error) {
      this.showError('Invalid admin code. Please try again.');
      if (adminCodeInput) {
        adminCodeInput.value = '';
      }
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * Load all orders for admin view
   */
  async loadAllOrders() {
    if (!this.isAuthenticated) {
      this.showError('Authentication required');
      return;
    }

    this.showLoading(true);
    
    try {
      this.orders = await API.getAllOrders(this.adminCode);
      this.renderOrderList();
      
      // If we have a current order ID, load its details
      if (this.currentOrderId) {
        this.loadOrderDetails(this.currentOrderId);
      }
    } catch (error) {
      this.showError('Failed to load orders: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * Load specific order details
   * @param {string} orderId - ID of the order to display
   */
  async loadOrderDetails(orderId) {
    if (!orderId) return;
    
    this.showLoading(true);
    
    try {
      let orderData;
      
      // If already authenticated, check if we have the order in our list
      if (this.isAuthenticated && this.orders[orderId]) {
        orderData = this.orders[orderId];
      } else {
        // Otherwise fetch the specific order
        orderData = await API.getOrder(orderId);
      }
      
      // Update current order ID
      this.currentOrderId = orderId;
      
      // Render order details
      this.renderOrderDetails(orderData);
    } catch (error) {
      this.showError(`Order ${orderId} not found or access denied`);
      this.renderEmptyOrderDetails();
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * Update order status (approve/deny)
   * @param {string} status - New status ('approved' or 'denied')
   */
  async updateOrderStatus(status) {
    if (!this.isAuthenticated || !this.currentOrderId) {
      this.showError('Authentication required or no order selected');
      return;
    }

    const note = prompt(`Enter a note for ${status} this order (optional):`);

    this.showLoading(true);
    
    try {
      const result = await API.updateOrderStatus(
        this.currentOrderId,
        status,
        note || `Order ${status}`,
        this.adminCode
      );
      
      // Update local data
      this.orders[this.currentOrderId] = result.order;
      
      // Re-render details and list
      this.renderOrderDetails(result.order);
      this.renderOrderList();
      
      // Show success message
      this.showSuccess(`Order ${this.currentOrderId} was ${status}`);
    } catch (error) {
      this.showError(`Failed to ${status} order: ${error.message}`);
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * Render the list of all orders
   */
  renderOrderList() {
    const orderListContainer = document.getElementById('order-list-container');
    const orderListElement = document.getElementById('order-list');
    
    if (!orderListContainer || !orderListElement) return;
    
    // Clear existing content
    orderListElement.innerHTML = '';
    
    // Check if we have orders
    const orderIds = Object.keys(this.orders);
    if (orderIds.length === 0) {
      orderListElement.innerHTML = '<li class="no-orders">No orders found</li>';
      return;
    }
    
    // Sort orders by timestamp (newest first)
    const sortedOrderIds = orderIds.sort((a, b) => {
      return new Date(this.orders[b].timestamp) - new Date(this.orders[a].timestamp);
    });
    
    // Create list items for each order
    sortedOrderIds.forEach(orderId => {
      const order = this.orders[orderId];
      const orderItem = document.createElement('li');
      orderItem.className = `order-item ${order.status}`;
      orderItem.dataset.orderId = orderId;
      
      orderItem.innerHTML = `
        <div class="order-item-header">
          <span class="order-id">#${orderId.substring(0, 8)}</span>
          <span class="order-date">${new Date(order.timestamp).toLocaleDateString()}</span>
          <span class="status-badge ${order.status}">${order.status.toUpperCase()}</span>
        </div>
        <div class="order-item-details">
          <span class="order-user">${order.username}</span>
          <span class="order-items-count">${order.items.length} items</span>
          <span class="order-total">$${order.totalPrice.toFixed(2)}</span>
        </div>
      `;
      
      // Add click event to view order details
      orderItem.addEventListener('click', () => {
        this.loadOrderDetails(orderId);
        
        // Highlight selected order
        document.querySelectorAll('.order-item.selected').forEach(item => {
          item.classList.remove('selected');
        });
        orderItem.classList.add('selected');
      });
      
      // Mark as selected if it's the current order
      if (orderId === this.currentOrderId) {
        orderItem.classList.add('selected');
      }
      
      orderListElement.appendChild(orderItem);
    });
    
    // Update counts in the header
    this.updateOrderCounts();
  },
  
  /**
   * Update order counts in the UI
   */
  updateOrderCounts() {
    const orderIds = Object.keys(this.orders);
    
    let pendingCount = 0;
    let approvedCount = 0;
    let deniedCount = 0;
    
    // Count orders by status
    orderIds.forEach(id => {
      const status = this.orders[id].status;
      if (status === 'pending') {
        pendingCount += 1;
      } else if (status === 'approved') {
        approvedCount += 1;
      } else if (status === 'denied') {
        deniedCount += 1;
      }
    });
    
    // Update counts in the UI
    const totalElement = document.getElementById('total-orders');
    if (totalElement) totalElement.textContent = orderIds.length;
    
    const pendingElement = document.getElementById('pending-orders');
    if (pendingElement) pendingElement.textContent = pendingCount;
    
    const approvedElement = document.getElementById('approved-orders');
    if (approvedElement) approvedElement.textContent = approvedCount;
    
    const deniedElement = document.getElementById('denied-orders');
    if (deniedElement) deniedElement.textContent = deniedCount;
  },

  /**
   * Render order details in the main view
   * @param {Object} orderData - Order data to display
   */
  renderOrderDetails(orderData) {
    const orderDetailsContainer = document.getElementById('order-details');
    if (!orderDetailsContainer) return;
    
    // Fetch latest item data including current stock levels
    const fetchCurrentItemData = async () => {
      try {
        // Get all items to check current stock levels
        const allItems = await API.getItems();
        return allItems;
      } catch (error) {
        console.error('Failed to fetch updated stock data:', error);
        return [];
      }
    };
    
    // First render the basic order details
    orderDetailsContainer.innerHTML = `
      <div class="order-details ${orderData.status}">
        <div class="order-header">
          <h2>Order #${orderData.id}</h2>
          <span class="status-badge large ${orderData.status}">${orderData.status.toUpperCase()}</span>
        </div>
        
        <div class="order-meta">
          <div class="meta-item">
            <span class="meta-label">Date:</span>
            <span class="meta-value">${new Date(orderData.timestamp).toLocaleString()}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Username:</span>
            <span class="meta-value">${orderData.username}</span>
          </div>
        </div>
        
        <div class="order-items-container">
          <h3>Items</h3>
          <table class="order-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Total</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody id="order-items-body">
              <tr><td colspan="5">Loading stock information...</td></tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total</td>
                <td>$${orderData.totalPrice.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div class="order-history">
          <h3>Order History</h3>
          <ul class="status-history">
            ${orderData.statusHistory.map(history => `
              <li class="status-entry">
                <div class="status-entry-header">
                  <span class="status-badge ${history.status}">${history.status.toUpperCase()}</span>
                  <span class="status-time">${new Date(history.timestamp).toLocaleString()}</span>
                </div>
                ${history.note ? `<div class="status-note">${history.note}</div>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;
    
    // Add action buttons if order is pending and user is authenticated
    if (this.isAuthenticated && orderData.status === 'pending') {
      const actionButtons = document.createElement('div');
      actionButtons.className = 'order-actions';
      
      const approveButton = document.createElement('button');
      approveButton.className = 'approve-button';
      approveButton.textContent = 'Approve Order';
      approveButton.addEventListener('click', () => this.updateOrderStatus('approved'));
      
      const denyButton = document.createElement('button');
      denyButton.className = 'deny-button';
      denyButton.textContent = 'Deny Order';
      denyButton.addEventListener('click', () => this.updateOrderStatus('denied'));
      
      actionButtons.appendChild(approveButton);
      actionButtons.appendChild(denyButton);
      
      orderDetailsContainer.appendChild(actionButtons);
    }
    
    // Now fetch current stock data and update the table
    fetchCurrentItemData().then(items => {
      const tbody = document.getElementById('order-items-body');
      if (!tbody) return;
      
      tbody.innerHTML = orderData.items.map(item => {
        // Find current stock level
        const currentItemData = items.find(i => i.id === item.id);
        const currentStock = currentItemData ? currentItemData.stock : 0;
        const outOfStock = currentStock < item.quantity;
        
        // Determine stock status display
        let stockDisplay;
        if (currentStock === 0) {
          stockDisplay = `<span class="stock-status oos">OOS</span>`;
        } else {
          stockDisplay = `<span class="stock-status ${outOfStock ? 'low' : ''}">${currentStock}</span>`;
        }
        
        return `
          <tr class="${outOfStock ? 'stock-warning' : ''}">
            <td>${item.name}</td>
            <td>$${item.price.toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>$${(item.price * item.quantity).toFixed(2)}</td>
            <td>${stockDisplay}</td>
          </tr>
        `;
      }).join('');
    });
  },

  /**
   * Render empty order details when no order is selected
   */
  renderEmptyOrderDetails() {
    const orderDetailsContainer = document.getElementById('order-details');
    if (!orderDetailsContainer) return;
    
    orderDetailsContainer.innerHTML = `
      <div class="no-order-selected">
        <h2>No Order Selected</h2>
        <p>Enter an order ID above or select an order from the list to view details.</p>
      </div>
    `;
  },

  /**
   * Update admin UI based on authentication state
   * @param {boolean} isAuthenticated - Whether admin is authenticated
   */
  updateAdminUI(isAuthenticated) {
    const loginContainer = document.getElementById('admin-login-container');
    const authContainer = document.getElementById('admin-authenticated-container');
    
    if (loginContainer) {
      loginContainer.classList.toggle('hidden', isAuthenticated);
    }
    
    if (authContainer) {
      authContainer.classList.toggle('hidden', !isAuthenticated);
    }
  },

  /**
   * Log out from admin panel
   */
  logout() {
    this.isAuthenticated = false;
    this.adminCode = null;
    sessionStorage.removeItem('adminCode');
    this.updateAdminUI(false);
    this.renderEmptyOrderDetails();
    this.orders = {};
    
    // Clear order ID input
    const orderIdInput = document.getElementById('order-id-input');
    if (orderIdInput) orderIdInput.value = '';
  },

  /**
   * Show loading indicator
   * @param {boolean} isLoading - Whether to show or hide the loading indicator
   */
  showLoading(isLoading) {
    this.isLoading = isLoading;
    
    let loadingElement = document.getElementById('loading-indicator');
    
    if (isLoading) {
      if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'loading-indicator';
        loadingElement.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loadingElement);
      }
      loadingElement.style.display = 'flex';
    } else if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  },

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-toast';
    errorElement.innerHTML = `
      <div class="toast-icon error">✖</div>
      <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(errorElement);
    
    // Fade in
    setTimeout(() => {
      errorElement.classList.add('show');
    }, 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
      errorElement.classList.remove('show');
      setTimeout(() => {
        errorElement.remove();
      }, 300);
    }, 5000);
  },
  
  /**
   * Show success message
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'success-toast';
    successElement.innerHTML = `
      <div class="toast-icon success">✓</div>
      <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(successElement);
    
    // Fade in
    setTimeout(() => {
      successElement.classList.add('show');
    }, 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
      successElement.classList.remove('show');
      setTimeout(() => {
        successElement.remove();
      }, 300);
    }, 5000);
  }
};

// Initialize the admin module when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
});
