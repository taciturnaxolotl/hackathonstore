import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import webpush from "web-push";
import csv from "csv-parser";
import { Readable } from "node:stream";
import * as fs from "node:fs";
import { mkdir } from "node:fs/promises";

// Import TypeScript config
import config from "./config";

const PORT = config.PORT || 3000;

// Path constants
const DATA_DIR = join(import.meta.dir, "..", "data");
const ITEMS_PATH = join(DATA_DIR, "items.json");
const ITEMS_CACHE_PATH = join(DATA_DIR, "items_cache.json");
const ORDERS_PATH = join(DATA_DIR, "orders.json");
const SUBSCRIPTIONS_PATH = join(DATA_DIR, "subscriptions.json");
const DIGIKEY_CSV_PATH = join(DATA_DIR, "digikey.csv");
const CUSTOM_CSV_PATH = join(DATA_DIR, "custom.csv");
const PUBLIC_DIR = join(import.meta.dir, "public");

// DigiKey API credentials from config
const DIGIKEY_CLIENT_ID = config.digikey.CLIENT_ID;
const DIGIKEY_CLIENT_SECRET = config.digikey.CLIENT_SECRET;
const DIGIKEY_API_URL = config.digikey.API_URL;
const TOKEN_URL = config.digikey.TOKEN_URL;

// Web Push configuration
const vapidKeys = {
  publicKey: config.webpush.VAPID_PUBLIC_KEY,
  privateKey: config.webpush.VAPID_PRIVATE_KEY,
};

// If VAPID keys not set, generate them as fallback
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.warn(
    "VAPID keys not found in configuration! Generating temporary keys...",
  );
  const keys = webpush.generateVAPIDKeys();
  vapidKeys.publicKey = keys.publicKey;
  vapidKeys.privateKey = keys.privateKey;
}

webpush.setVapidDetails(
  `mailto:${config.webpush.CONTACT_EMAIL}`,
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

// DigiKey token management
let digikeyAccessToken: string | null = null;
let tokenExpiry = 0;

// Store data
interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
  category: string;
  tags: string[];
  datasheet: string;
  supplier: string;
  partNumber: string;
}

interface Order {
  id: string;
  username: string;
  items: OrderItem[];
  status: string;
  notes: OrderNote[];
  created: number;
  updated: number;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface OrderNote {
  text: string;
  timestamp: number;
}

interface PushSubscription {
  username: string;
  subscription: webpush.PushSubscription;
  timestamp: number;
}

let allItems: Item[] = [];
let orders: Record<string, Order> = {};
let pushSubscriptions: Record<string, PushSubscription> = {};

// API Prefix
const API_PREFIX = config.API_PREFIX;

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Function to get DigiKey access token
async function getDigiKeyAccessToken(): Promise<string> {
  // Return existing token if still valid
  if (digikeyAccessToken && Date.now() < tokenExpiry - 60000) {
    return digikeyAccessToken;
  }

  try {
    console.log("Requesting new DigiKey API token...");

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: DIGIKEY_CLIENT_ID,
        client_secret: DIGIKEY_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Token request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    digikeyAccessToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;

    console.log(`Token acquired, expires in ${data.expires_in} seconds`);
    return digikeyAccessToken as string;
  } catch (error) {
    console.error("Error getting DigiKey token:", error);
    throw new Error("Failed to authenticate with DigiKey API");
  }
}

// Function to fetch product details from DigiKey API
async function fetchDigiKeyProductDetails(
  partNumber: string,
): Promise<Record<string, unknown> | null> {
  try {
    const token = await getDigiKeyAccessToken();

    const response = await fetch(
      `${DIGIKEY_API_URL}/Search/v3/Products/${partNumber}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-DIGIKEY-Client-Id": DIGIKEY_CLIENT_ID,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching data for ${partNumber}:`, error);
    return null;
  }
}

// Function to load CSV data into memory using Bun
async function parseCsvFile(
  filePath: string,
): Promise<Record<string, string>[]> {
  const results: Record<string, string>[] = [];

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    console.warn(`CSV file not found: ${filePath}`);
    return [];
  }

  const fileContent = await file.text();

  return new Promise((resolve, reject) => {
    Readable.from(fileContent)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

// Function to load all data
async function loadData() {
  console.log("Loading data...");

  try {
    // Ensure data directory exists
    await mkdir(DATA_DIR, { recursive: true });

    // Try to load from cache first
    const cacheFile = Bun.file(ITEMS_CACHE_PATH);
    if (await cacheFile.exists()) {
      const cacheContent = await cacheFile.json();

      // Check if cache is fresh (less than 24 hours old)
      if (
        cacheContent.timestamp &&
        Date.now() - cacheContent.timestamp < 24 * 60 * 60 * 1000
      ) {
        console.log("Using cached items data");
        allItems = cacheContent.items;
        return;
      }
    }

    // Try to load existing items
    const itemsFile = Bun.file(ITEMS_PATH);
    if (await itemsFile.exists()) {
      allItems = await itemsFile.json();
      console.log(`Loaded ${allItems.length} items from items.json`);
    } else {
      // Load from CSV files if items.json doesn't exist
      const [digikeyItems, customItems] = await Promise.all([
        parseCsvFile(DIGIKEY_CSV_PATH),
        parseCsvFile(CUSTOM_CSV_PATH),
      ]);

      console.log(
        `Loaded ${digikeyItems.length} DigiKey items and ${customItems.length} custom items`,
      );

      // Process DigiKey items
      for (const item of digikeyItems) {
        if (!item.sku) continue;

        try {
          const details = await fetchDigiKeyProductDetails(item.sku);
          if (details) {
            allItems.push({
              id: item.sku,
              name:
                (details.ProductDescription as string) || item.name || item.sku,
              description:
                (details.DetailedDescription as string) ||
                item.description ||
                "",
              price:
                Number.parseFloat(item.price) ||
                (details.UnitPrice as number) ||
                0,
              stock: Number.parseInt(item.stock) || 10,
              imageUrl: (details.PrimaryPhoto as string) || item.imageUrl || "",
              category:
                item.category ||
                (details.CategoryName as string) ||
                "Components",
              tags: (item.tags || "")
                .split(",")
                .map((tag: string) => tag.trim()),
              datasheet:
                (details.PrimaryDatasheet as string) || item.datasheet || "",
              supplier: "DigiKey",
              partNumber: item.sku,
            });
          }
        } catch (error) {
          console.error(`Error processing DigiKey item ${item.sku}:`, error);
        }
      }

      // Process custom items
      for (const item of customItems) {
        if (!item.sku) continue;

        allItems.push({
          id: item.sku,
          name: item.name || item.sku,
          description: item.description || "",
          price: Number.parseFloat(item.price) || 0,
          stock: Number.parseInt(item.stock) || 10,
          imageUrl: item.imageUrl || "",
          category: item.category || "Components",
          tags: (item.tags || "").split(",").map((tag: string) => tag.trim()),
          datasheet: item.datasheet || "",
          supplier: item.supplier || "Custom",
          partNumber: item.sku,
        });
      }

      // Save the processed items
      await Bun.write(ITEMS_PATH, JSON.stringify(allItems, null, 2));
      console.log(`Saved ${allItems.length} items to items.json`);
    }

    // Save to cache
    await Bun.write(
      ITEMS_CACHE_PATH,
      JSON.stringify(
        {
          timestamp: Date.now(),
          items: allItems,
        },
        null,
        2,
      ),
    );

    // Load orders if exist
    const ordersFile = Bun.file(ORDERS_PATH);
    if (await ordersFile.exists()) {
      orders = await ordersFile.json();
      console.log(`Loaded ${Object.keys(orders).length} orders`);
    }

    // Load subscriptions if exist
    await loadSubscriptions();
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}

// Inventory management functions
function checkOrderStock(cart: { id: string; quantity: number }[]): {
  available: boolean;
  unavailableItems: {
    id: string;
    name: string;
    requestedQuantity: number;
    availableStock: number;
  }[];
} {
  const unavailableItems = [];

  for (const cartItem of cart) {
    const item = allItems.find((i) => i.id === cartItem.id);

    if (!item || item.stock < cartItem.quantity) {
      unavailableItems.push({
        id: cartItem.id,
        name: item?.name || cartItem.id,
        requestedQuantity: cartItem.quantity,
        availableStock: item?.stock || 0,
      });
    }
  }

  return {
    available: unavailableItems.length === 0,
    unavailableItems,
  };
}

function reserveStock(cart: { id: string; quantity: number }[]): void {
  for (const cartItem of cart) {
    const item = allItems.find((i) => i.id === cartItem.id);
    if (item) {
      item.stock -= cartItem.quantity;
    }
  }

  // Save updated inventory
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(allItems, null, 2));

  // Update cache too
  fs.writeFileSync(
    ITEMS_CACHE_PATH,
    JSON.stringify(
      {
        timestamp: Date.now(),
        items: allItems,
      },
      null,
      2,
    ),
  );
}

function returnStock(cart: { id: string; quantity: number }[]): void {
  for (const cartItem of cart) {
    const item = allItems.find((i) => i.id === cartItem.id);
    if (item) {
      item.stock += cartItem.quantity;
    }
  }

  // Save updated inventory
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(allItems, null, 2));

  // Update cache too
  fs.writeFileSync(
    ITEMS_CACHE_PATH,
    JSON.stringify(
      {
        timestamp: Date.now(),
        items: allItems,
      },
      null,
      2,
    ),
  );
}

// Push notification functions
async function sendOrderNotification(
  orderId: string,
  status: string,
  note = "",
): Promise<void> {
  const subscription = pushSubscriptions[orderId];
  if (!subscription || !subscription.subscription) {
    console.log(`No push subscription found for order ${orderId}`);
    return;
  }

  try {
    const username = subscription.username || "Anonymous";
    const payload = JSON.stringify({
      title: `Order ${status}`,
      body: `Your order #${orderId.substring(0, 8)} ${
        status === "completed"
          ? "is ready for pickup"
          : status === "cancelled"
            ? "has been cancelled"
            : `status: ${status}`
      }${note ? `\nNote: ${note}` : ""}`,
      icon: "/img/favicon.png",
      orderId,
      status,
    });

    console.log(`Sending notification to ${username} for order ${orderId}`);

    await webpush.sendNotification(subscription.subscription, payload);

    console.log("Push notification sent successfully");
  } catch (error) {
    console.error("Error sending push notification:", error);

    // Remove invalid subscription
    if ((error as { statusCode?: number }).statusCode === 410) {
      console.log(`Removing invalid subscription for order ${orderId}`);
      delete pushSubscriptions[orderId];
      saveSubscriptions();
    }
  }
}

async function saveSubscriptions(): Promise<void> {
  try {
    await Bun.write(
      SUBSCRIPTIONS_PATH,
      JSON.stringify(pushSubscriptions, null, 2),
    );
  } catch (error) {
    console.error("Error saving subscriptions:", error);
  }
}

async function loadSubscriptions(): Promise<void> {
  try {
    const file = Bun.file(SUBSCRIPTIONS_PATH);
    if (await file.exists()) {
      pushSubscriptions = await file.json();
      console.log(
        `Loaded ${Object.keys(pushSubscriptions).length} push subscriptions`,
      );
    }
  } catch (error) {
    console.error("Error loading subscriptions:", error);
    pushSubscriptions = {};
  }
}

function saveOrders(): void {
  try {
    fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2));
  } catch (error) {
    console.error("Error saving orders:", error);
  }
}

// Helper for JSON responses
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

// Parse URL and route to appropriate handler
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Handle CORS preflight requests
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Handle static files
  if (!path.startsWith(API_PREFIX)) {
    // Default to index.html for root or client-side routes
    const filePath = path === "/" ? "/index.html" : path;
    const fullPath = join(PUBLIC_DIR, filePath);

    try {
      const file = Bun.file(fullPath);
      if (await file.exists()) {
        return new Response(file);
      }

      // If file doesn't exist but doesn't start with API_PREFIX,
      // it might be a client-side route - serve index.html
      return new Response(Bun.file(join(PUBLIC_DIR, "/index.html")));
    } catch (error) {
      return new Response("Not found", { status: 404 });
    }
  }

  // API routes
  // Get VAPID public key
  if (
    path === `${API_PREFIX}/notifications/vapid-public-key` &&
    method === "GET"
  ) {
    return jsonResponse({ publicKey: vapidKeys.publicKey });
  }

  // Register push notification
  if (path === `${API_PREFIX}/notifications/register` && method === "POST") {
    try {
      const body = await req.json();
      const { orderId, username, subscription } = body;

      if (!orderId || !subscription) {
        return jsonResponse({ error: "Missing required fields" }, 400);
      }

      // Store the subscription for this order
      pushSubscriptions[orderId] = {
        username: username || "Anonymous",
        subscription,
        timestamp: Date.now(),
      };

      saveSubscriptions();

      return jsonResponse({ success: true });
    } catch (error) {
      console.error("Error registering push subscription:", error);
      return jsonResponse({ error: "Failed to register subscription" }, 500);
    }
  }

  // Get all items
  if (path === `${API_PREFIX}/items` && method === "GET") {
    return jsonResponse(allItems);
  }

  // Get single item by ID
  if (path.startsWith(`${API_PREFIX}/items/`) && method === "GET") {
    const itemId = path.split("/").pop();
    const item = allItems.find((item) => item.id === itemId);

    if (item) {
      return jsonResponse(item);
    }
    return jsonResponse({ error: "Item not found" }, 404);
  }

  // Create new order
  if (path === `${API_PREFIX}/orders` && method === "POST") {
    try {
      const body = await req.json();
      const { username, cart } = body;

      if (!username || !cart || !Array.isArray(cart) || cart.length === 0) {
        return jsonResponse({ error: "Invalid order data" }, 400);
      }

      // Generate order ID
      const orderId = uuidv4();

      // Create order
      const stockCheck = checkOrderStock(cart);

      if (!stockCheck.available) {
        return jsonResponse(
          {
            error:
              "Some items are out of stock or not available in requested quantity",
            unavailableItems: stockCheck.unavailableItems,
          },
          400,
        );
      }

      // Process the order
      const newOrder = {
        id: orderId,
        username,
        items: cart.map((cartItem) => {
          const item = allItems.find((i) => i.id === cartItem.id);
          return {
            id: cartItem.id,
            name: item?.name || cartItem.id,
            price: item?.price || 0,
            quantity: cartItem.quantity,
          };
        }),
        status: "pending",
        notes: [],
        created: Date.now(),
        updated: Date.now(),
      };

      // Reserve stock
      reserveStock(cart);

      // Store the order
      orders[orderId] = newOrder;
      saveOrders();

      return jsonResponse(newOrder);
    } catch (error) {
      console.error("Error creating order:", error);
      return jsonResponse({ error: "Failed to create order" }, 500);
    }
  }

  // Get order by ID
  if (path.startsWith(`${API_PREFIX}/orders/`) && method === "GET") {
    const orderId = path.split("/").pop();
    const order = orders[orderId as string];

    if (order) {
      return jsonResponse(order);
    }
    return jsonResponse({ error: "Order not found" }, 404);
  }

  // Update order status
  if (path.startsWith(`${API_PREFIX}/orders/`) && method === "PUT") {
    try {
      const orderId = path.split("/").pop();
      const body = await req.json();
      const { adminCode, status, note } = body;

      // Check admin code - in a real app, use proper authentication
      if (adminCode !== config.ADMIN_CODE) {
        return jsonResponse({ error: "Invalid admin code" }, 403);
      }

      const order = orders[orderId as string];
      if (!order) {
        return jsonResponse({ error: "Order not found" }, 404);
      }

      // Handle status change
      if (status && status !== order.status) {
        // Handle cancellation - return stock
        if (status === "cancelled" && order.status !== "cancelled") {
          returnStock(
            order.items.map((item: OrderItem) => ({
              id: item.id,
              quantity: item.quantity,
            })),
          );
        }

        order.status = status;
        order.updated = Date.now();

        // Send push notification about status change
        if (pushSubscriptions[orderId as string]) {
          sendOrderNotification(orderId as string, status, note);
        }
      }

      // Add note if provided
      if (note) {
        order.notes.push({
          text: note,
          timestamp: Date.now(),
        });
      }

      // Save changes
      saveOrders();

      return jsonResponse(order);
    } catch (error) {
      console.error("Error updating order:", error);
      return jsonResponse({ error: "Failed to update order" }, 500);
    }
  }

  // Get all orders (admin only)
  if (path === `${API_PREFIX}/orders` && method === "GET") {
    const url = new URL(req.url);
    const adminCode = url.searchParams.get("adminCode");

    // Check admin code - in a real app, use proper authentication
    if (adminCode !== config.ADMIN_CODE) {
      return jsonResponse({ error: "Invalid admin code" }, 403);
    }

    return jsonResponse(orders);
  }

  // Route not found
  return jsonResponse({ error: "Not found" }, 404);
}

async function startServer() {
  try {
    await loadData();
    await loadSubscriptions();

    // Use Bun's native server
    const server = Bun.serve({
      port: PORT,
      async fetch(req) {
        try {
          return await handleRequest(req);
        } catch (error) {
          console.error("Error handling request:", error);
          return new Response(`Server error: ${(error as Error).message}`, {
            status: 500,
            headers: corsHeaders,
          });
        }
      },
      error(error) {
        console.error("Server error:", error);
        return new Response(`<pre>${error}\n${error.stack}</pre>`, {
          status: 500,
          headers: {
            "Content-Type": "text/html",
            ...corsHeaders,
          },
        });
      },
    });

    console.log(`Server running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}${API_PREFIX}`);
    console.log(`Static files served from ${PUBLIC_DIR}`);

    return server;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
