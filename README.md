# hackathonstore

**Version 2.1.0**

A lightweight inventory and request management system for hardware-focused hackathons, built with Bun.

## Overview

hackathonstore helps hackathon organizers manage hardware components while allowing participants to browse and request items for their projects with real-time inventory tracking.

## Key Features

- Component browsing with images, descriptions and datasheets
- Order placement through simple cart interface
- Order status tracking and notifications
- Admin approval workflow
- DigiKey API integration (optional)
- Optimized with Bun's native server

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime installed

### Installation

```bash
# Clone the repository
git clone https://github.com/dropalltables/hackathonstore.git
cd hackathonstore

# Install dependencies
bun install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your settings
```

### Starting the Server

```bash
bun start
```

The server will be available at http://localhost:3000 (or your configured port).

## Configuration

Create a `.env` file with these variables:

```
# Server settings
PORT=3000
API_PREFIX=/api

# DigiKey API (optional for component data enrichment)
DIGIKEY_CLIENT_ID=your_key
DIGIKEY_CLIENT_SECRET=your_secret

# Admin access
ADMIN_CODE=your_secure_code

# Web Push (for notifications)
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
CONTACT_EMAIL=your@email.com
```

## Inventory Management

### Custom Items (data/custom.csv)

```csv
sku,name,description,datasheet,supplier,imageUrl,price,stock,category,tags
custom-001,Arduino Uno,Microcontroller board,https://example.com/datasheet.pdf,Arduino,https://example.com/image.jpg,10.99,50,Development Boards,arduino,microcontroller
```

### DigiKey Items (data/digikey.csv)

```csv
sku,price,stock
296-6501-1-ND,1.23,50
```

## Security Notes

- Set a strong ADMIN_CODE
- Keep your DigiKey credentials secure
- Don't commit sensitive files (.env)

## License

GNU Affero General Public License v3.0 (AGPL-3.0)