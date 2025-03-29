/**
 * Store Module for Hackathon Hardware Store
 * Manages products display, cart functionality, and checkout process
 */

const Store = {
  // Store state
  items: [],
  cart: [],
  isLoading: false,
  stockCache: {}, // Add a cache to keep track of current stock levels

  /**
   * Initialize the store module
   */
  init() {
    // Add global image error handler
    this.setupImageErrorHandling();

    // Always load cart and update cart count on every page
    this.loadCart();
    this.updateCartCount();
    
    // Initialize event listeners based on current page
    if (document.getElementById('product-list')) {
      this.initStorePage();
    } else if (document.getElementById('cart-items')) {
      this.initCartPage();
    } else if (document.getElementById('checkout-form')) {
      this.initCheckoutPage();
    } else if (document.getElementById('order-status')) {
      this.initOrderPage();
    }
  },

  /**
   * Setup global image error handling to use placeholder for failed images
   */
  setupImageErrorHandling() {
    // Add a global handler for image loading errors
    document.addEventListener('error', (e) => {
      const target = e.target;
      if (target.tagName === 'IMG') {
        console.warn(`Image failed to load: ${target.src}`);
        target.src = 'img/placeholder.svg';
        // Prevent infinite loop if the placeholder itself fails
        target.onerror = null;
      }
    }, true); // Use capture phase to catch all image errors
  },

  /**
   * Initialize the main store page
   */
  async initStorePage() {
    this.showLoading(true);
    try {
      await this.loadProducts();
      this.renderProducts();
    } catch (error) {
      this.showError('Failed to load products. Please try again later.');
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * Initialize the cart page
   */
  initCartPage() {
    this.renderCart();
    document.getElementById('proceed-to-checkout')?.addEventListener('click', () => {
      window.location.href = 'checkout.html';
    });
  },

  /**
   * Initialize the checkout page
   */
  initCheckoutPage() {
    this.renderCheckoutSummary();
    
    document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.processCheckout();
    });
  },

  /**
   * Initialize the order status page
   */
  initOrderPage() {
    const orderId = this.getOrderIdFromURL();
    if (orderId) {
      this.loadOrderStatus(orderId);
    } else {
      // When page loads initially, just focus the input field without showing an error
      // Only show errors when user tries to look up an empty order ID
      const orderIdInput = document.getElementById('order-id-lookup');
      if (orderIdInput) {
        orderIdInput.focus();
      }
    }
    
    // Add event listener for the lookup button if not already set in HTML
    const lookupButton = document.getElementById('lookup-order');
    if (lookupButton) {
      lookupButton.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent form submission
        const orderIdInput = document.getElementById('order-id-lookup');
        const orderIdValue = orderIdInput ? orderIdInput.value.trim() : '';
        
        if (orderIdValue) {
          window.location.href = `order.html?id=${orderIdValue}`;
        } else {
          // Only show error when user tries to submit without an ID
          this.showError('Please enter an order ID to track.');
        }
      });
    }
  },

  /**
   * Load all products from API
   */
  async loadProducts() {
    try {
      this.items = await API.getItems();
    } catch (error) {
      console.error('Failed to load products:', error);
      this.items = [];
      throw error;
    }
  },

  /**
   * Render products to the store page
   */
  renderProducts() {
    const productList = document.getElementById('product-list');
    if (!productList) return;
    
    // Clear existing content
    productList.innerHTML = '';
    
    if (this.items.length === 0) {
      productList.innerHTML = '<div class="no-products">No products available</div>';
      return;
    }

    // Create product cards
    this.items.forEach(item => {
      const productCard = document.createElement('div');
      productCard.className = 'product-card';
      productCard.innerHTML = `
        <div class="product-image">
          <img src="${item.imageUrl || 'img/placeholder.svg'}" alt="${item.name}" onerror="this.src='img/placeholder.svg'">
        </div>
        <div class="product-info">
          <h3>${item.name}</h3>
          <p class="product-description">${item.description}</p>
          <p class="product-manufacturer">Manufacturer: ${item.manufacturer}</p>
          <div class="product-meta">
            <span class="product-price">$${parseFloat(item.price).toFixed(2)}</span>
            <span class="product-stock">${item.stock} in stock</span>
          </div>
          <div class="product-actions">
            ${item.datasheet ? `<a href="${item.datasheet}" target="_blank" class="datasheet-link">Datasheet</a>` : ''}
            <button class="add-to-cart" data-id="${item.id}">Add to Cart</button>
          </div>
        </div>
      `;
      productList.appendChild(productCard);
      
      // Add click event to the "Add to Cart" button
      productCard.querySelector('.add-to-cart').addEventListener('click', () => {
        this.addToCart(item);
      });
    });
  },

  /**
   * Add an item to the cart
   * @param {Object} item - Product to add
   */
  addToCart(item) {
    // Check if item is already in cart
    const existingItem = this.cart.find(cartItem => cartItem.id === item.id);
    
    // Keep track of current stock in cache
    if (!this.stockCache[item.id]) {
      this.stockCache[item.id] = item.stock;
    }
    
    const currentStock = this.stockCache[item.id];
    
    if (existingItem) {
      // Check if adding one more would exceed stock
      if (existingItem.quantity >= currentStock) {
        this.showError(`Sorry, only ${currentStock} units of "${item.name}" are available.`);
        return;
      }
      existingItem.quantity += 1;
    } else {
      // Check if item is in stock
      if (currentStock < 1) {
        this.showError(`Sorry, "${item.name}" is out of stock.`);
        return;
      }
      this.cart.push({
        id: item.id,
        name: item.name,
        price: parseFloat(item.price),
        imageUrl: item.imageUrl,
        stock: currentStock, // Store stock info with cart item
        quantity: 1
      });
    }
    
    // Update stock cache
    this.stockCache[item.id] = currentStock - 1;
    
    // Save cart to local storage
    this.saveCart();
    
    // Update UI
    this.updateCartCount();
    this.showAddedToCart(item.name);
  },

  /**
   * Remove an item from the cart
   * @param {string} itemId - ID of the item to remove
   */
  removeFromCart(itemId) {
    this.cart = this.cart.filter(item => item.id !== itemId);
    this.saveCart();
    this.updateCartCount();
    
    // If on cart page, re-render the cart
    if (document.getElementById('cart-items')) {
      this.renderCart();
    }
  },

  /**
   * Update item quantity in the cart
   * @param {string} itemId - ID of the item
   * @param {number} quantity - New quantity
   */
  updateCartItemQuantity(itemId, quantity) {
    const item = this.cart.find(item => item.id === itemId);
    if (!item) return;
    
    // Find matching item in our items list to get current stock
    const productItem = this.items.find(product => product.id === itemId);
    let maxStock = item.stock; // Use cached stock from cart if available
    
    // If we have fresh stock data from the items array, use that
    if (productItem) {
      maxStock = productItem.stock;
      // Update the stock cache
      this.stockCache[itemId] = maxStock;
    }
    
    // Make sure the requested quantity doesn't exceed available stock
    quantity = Math.min(quantity, maxStock);
    
    // Ensure quantity is at least 1
    quantity = Math.max(1, quantity);
    
    // If trying to increase beyond available stock
    if (quantity > maxStock) {
      this.showError(`Sorry, only ${maxStock} units of "${item.name}" are available.`);
      quantity = maxStock;
    }
    
    item.quantity = quantity;
    this.saveCart();
    
    // If on cart page, re-render the cart
    if (document.getElementById('cart-items')) {
      this.renderCart();
    }
  },

  /**
   * Calculate total price of items in cart
   * @returns {number} Total price
   */
  calculateCartTotal() {
    return this.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  },

  /**
   * Render the shopping cart page
   */
  renderCart() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartSummary = document.getElementById('cart-summary');
    
    if (!cartItemsContainer || !cartSummary) return;
    
    if (this.cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="empty-cart">
          <p>Your cart is empty</p>
          <a href="index.html" class="continue-shopping">Continue Shopping</a>
        </div>
      `;
      cartSummary.style.display = 'none';
      return;
    }
    
    // Display items in cart
    cartItemsContainer.innerHTML = '';
    this.cart.forEach(item => {
      // Fetch current stock data if available
      const productItem = this.items.find(product => product.id === item.id);
      let currentStock = item.stock || 0; // Default to cached stock
      
      // If we have fresh stock data, use it
      if (productItem) {
        currentStock = productItem.stock;
        // Update the stock cache
        this.stockCache[item.id] = currentStock;
      }
      
      // Check if current quantity exceeds available stock
      const isOverStocked = item.quantity > currentStock;
      if (isOverStocked) {
        // Auto-adjust quantity to match available stock
        item.quantity = currentStock;
        this.saveCart();
        this.showError(`Quantity for "${item.name}" has been adjusted due to stock limitations.`);
      }
      
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      cartItem.innerHTML = `
        <div class="cart-item-image">
          <img src="${item.imageUrl || 'img/placeholder.svg'}" alt="${item.name}" onerror="this.src='img/placeholder.svg'">
        </div>
        <div class="cart-item-details">
          <h3>${item.name}</h3>
          <p class="cart-item-price">$${item.price.toFixed(2)}</p>
          ${currentStock <= 5 ? `<p class="stock-warning">${currentStock === 0 ? 'Out of stock!' : 'Low stock: ' + currentStock + ' left'}</p>` : ''}
        </div>
        <div class="cart-item-quantity">
          <button class="decrease-quantity" data-id="${item.id}">-</button>
          <input type="number" min="1" max="${currentStock}" value="${item.quantity}" data-id="${item.id}" class="quantity-input">
          <button class="increase-quantity" data-id="${item.id}" ${item.quantity >= currentStock ? 'disabled' : ''}>+</button>
        </div>
        <div class="cart-item-total">
          $${(item.price * item.quantity).toFixed(2)}
        </div>
        <button class="remove-item" data-id="${item.id}">×</button>
      `;
      cartItemsContainer.appendChild(cartItem);
      
      // Add event listeners for cart item controls
      cartItem.querySelector('.decrease-quantity').addEventListener('click', () => {
        this.updateCartItemQuantity(item.id, item.quantity - 1);
      });
      
      cartItem.querySelector('.increase-quantity').addEventListener('click', () => {
        this.updateCartItemQuantity(item.id, item.quantity + 1);
      });
      
      cartItem.querySelector('.quantity-input').addEventListener('change', (e) => {
        this.updateCartItemQuantity(item.id, parseInt(e.target.value) || 1);
      });
      
      cartItem.querySelector('.remove-item').addEventListener('click', () => {
        this.removeFromCart(item.id);
      });
    });
    
    // Show cart summary
    cartSummary.style.display = 'block';
    
    // Update cart total
    const totalElement = document.getElementById('cart-total');
    if (totalElement) {
      totalElement.textContent = `$${this.calculateCartTotal().toFixed(2)}`;
    }
    
    // Update checkout button state
    const checkoutButton = document.getElementById('proceed-to-checkout');
    if (checkoutButton) {
      checkoutButton.disabled = this.cart.length === 0;
    }
  },

  /**
   * Render checkout page summary
   */
  renderCheckoutSummary() {
    const checkoutSummary = document.getElementById('checkout-summary');
    if (!checkoutSummary) return;
    
    if (this.cart.length === 0) {
      checkoutSummary.innerHTML = `
        <div class="empty-cart">
          <p>Your cart is empty</p>
          <a href="index.html" class="continue-shopping">Continue Shopping</a>
        </div>
      `;
      document.getElementById('checkout-button')?.setAttribute('disabled', 'true');
      return;
    }
    
    // Show order summary
    let summaryHTML = '<h3>Order Summary</h3><ul>';
    this.cart.forEach(item => {
      summaryHTML += `
        <li>
          <span class="item-name">${item.name} × ${item.quantity}</span>
          <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
        </li>
      `;
    });
    
    summaryHTML += `
      <li class="total">
        <span>Total</span>
        <span>$${this.calculateCartTotal().toFixed(2)}</span>
      </li>
    </ul>`;
    
    checkoutSummary.innerHTML = summaryHTML;
  },

  /**
   * Process the checkout
   */
  async processCheckout() {
    if (this.cart.length === 0) {
      this.showError('Your cart is empty. Add items before checking out.');
      return;
    }
    
    const username = document.getElementById('username').value.trim();
    if (!username) {
      this.showError('Please enter your username.');
      return;
    }
    
    // Disable the checkout button and show loading
    const checkoutButton = document.getElementById('checkout-button');
    if (checkoutButton) {
      checkoutButton.disabled = true;
      checkoutButton.innerHTML = 'Processing...';
    }
    
    try {
      // Check stock availability first
      const stockCheck = await API.checkStock(this.cart);
      
      if (!stockCheck.valid) {
        let errorMessage = 'Some items in your cart are no longer available in the requested quantities:';
        stockCheck.stockIssues.forEach(issue => {
          errorMessage += `\n• ${issue.name}: Requested: ${issue.requested}, Available: ${issue.available}`;
        });
        
        this.showError(errorMessage);
        
        if (checkoutButton) {
          checkoutButton.disabled = false;
          checkoutButton.innerHTML = 'Checkout';
        }
        return;
      }
      
      // If stock check passes, try to place the order
      const result = await API.placeOrder(username, this.cart);
      
      // Clear cart after successful order
      this.cart = [];
      this.saveCart();
      
      // Store order ID in sessionStorage for reference
      sessionStorage.setItem('lastOrderId', result.orderId);
      
      // Redirect to order confirmation page
      window.location.href = `order.html?id=${result.orderId}`;
      
    } catch (error) {
      this.showError('Failed to place order: ' + error.message);
      if (checkoutButton) {
        checkoutButton.disabled = false;
        checkoutButton.innerHTML = 'Checkout';
      }
    }
  },

  /**
   * Load and display order status
   * @param {string} orderId - ID of the order to display
   */
  async loadOrderStatus(orderId) {
    const orderStatusContainer = document.getElementById('order-status');
    if (!orderStatusContainer) return;
    
    this.showLoading(true);
    
    try {
      const order = await API.getOrder(orderId);
      
      orderStatusContainer.innerHTML = `
        <div class="order-details ${order.status}">
          <h2>Order #${order.id}</h2>
          <div class="order-meta">
            <p><strong>Status:</strong> <span class="status-badge ${order.status}">${order.status.toUpperCase()}</span></p>
            <p><strong>Date:</strong> ${new Date(order.timestamp).toLocaleString()}</p>
            <p><strong>Username:</strong> ${order.username}</p>
          </div>
          
          <h3>Items</h3>
          <ul class="order-items">
            ${order.items.map(item => `
              <li>
                <span class="item-name">${item.name} × ${item.quantity}</span>
                <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            `).join('')}
          </ul>
          
          <div class="order-total">
            <strong>Total:</strong> $${order.totalPrice.toFixed(2)}
          </div>
          
          <div class="order-history">
            <h3>Order History</h3>
            <ul>
              ${order.statusHistory.map(history => `
                <li>
                  <span class="status-badge ${history.status}">${history.status.toUpperCase()}</span>
                  <span class="history-time">${new Date(history.timestamp).toLocaleString()}</span>
                  ${history.note ? `<p class="history-note">${history.note}</p>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
      
      // Add save order ID button
      const saveIdButton = document.createElement('button');
      saveIdButton.id = 'save-order-id';
      saveIdButton.className = 'primary-button';
      saveIdButton.textContent = 'Save Order ID';
      saveIdButton.addEventListener('click', () => {
        localStorage.setItem('savedOrderId', orderId);
        saveIdButton.textContent = 'Order ID Saved!';
        setTimeout(() => {
          saveIdButton.textContent = 'Save Order ID';
        }, 2000);
      });
      orderStatusContainer.appendChild(saveIdButton);
      
    } catch (error) {
      // Show toast notification
      this.showError(`Order ${orderId} not found. Please check the ID and try again.`);
      
      // Clear the container but don't add a duplicate form
      orderStatusContainer.innerHTML = '';
      
      // Focus the existing input field and update its value
      const orderIdInput = document.getElementById('order-id-lookup');
      if (orderIdInput) {
        orderIdInput.value = orderId;
        orderIdInput.focus();
        orderIdInput.select(); // Select the text for easy correction
      }
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * Get the order ID from URL parameters
   * @returns {string|null} Order ID or null if not found
   */
  getOrderIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  },

  /**
   * Save cart to localStorage, including stock information
   */
  saveCart() {
    // Save stock cache along with cart
    localStorage.setItem('hackathonCart', JSON.stringify(this.cart));
    localStorage.setItem('hackathonStockCache', JSON.stringify(this.stockCache));
  },

  /**
   * Load cart from localStorage
   */
  loadCart() {
    try {
      const savedCart = localStorage.getItem('hackathonCart');
      this.cart = savedCart ? JSON.parse(savedCart) : [];
      
      // Load stock cache
      const savedStockCache = localStorage.getItem('hackathonStockCache');
      this.stockCache = savedStockCache ? JSON.parse(savedStockCache) : {};
    } catch (error) {
      console.error('Failed to load cart:', error);
      this.cart = [];
      this.stockCache = {};
    }
  },

  /**
   * Update cart count in the navigation bar
   */
  updateCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
      const itemCount = this.cart.reduce((count, item) => count + item.quantity, 0);
      cartCountElement.textContent = itemCount;
      cartCountElement.style.display = itemCount > 0 ? 'inline' : 'none';
    }
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
   * Show "Added to Cart" notification
   * @param {string} itemName - Name of the item added to cart
   */
  showAddedToCart(itemName) {
    const notification = document.createElement('div');
    notification.className = 'added-to-cart';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="checkmark">✓</span>
        <span>${itemName} added to cart</span>
      </div>
      <a href="cart.html" class="view-cart-link">View Cart</a>
    `;
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
};

// Initialize the store when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  Store.init();
});
