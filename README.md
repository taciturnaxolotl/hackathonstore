# hackathonstore

An organizer-managed inventory and stock management system for hardware-focused hackathons.

## What is it?

hackathonstore helps hackathon organizers manage hardware components and allows participants to browse and request items for their projects. The system tracks inventory in real-time and provides a simple approval workflow.

## Features

- Browse hardware components with images, descriptions and datasheets
- Request items through a simple cart checkout process
- Track order status (pending, approved, denied)
- Admin panel for organizers to approve/deny requests
- DigiKey API integration for component data
- Simple setup with environment variables

## Quick Setup

### 1. Clone and install

```bash
git clone https://github.com/dropalltables/hackathonstore.git
cd hackathonstore/server
npm install
```

### 2. Configure the server

```bash
cp .env.example .env
# Edit .env with your settings (see Configuration section)
```

### 3. Start the server

```bash
npm start # using npm
```
Or:
```bash
node server.js # simple node command
```

### 4. Access the application

To access the app host it somewhere, the server has CORS.

## Configuration

### Server (.env)

```
# Server settings
PORT=3000
API_PREFIX=/hackathon

# DigiKey API (optional)
DIGIKEY_CLIENT_ID=your_key
DIGIKEY_CLIENT_SECRET=your_secret

# Admin access
ADMIN_CODE=your_secure_code
```

### Client (js/config.js)

Update the API endpoints:

```javascript
// Development
API_BASE_URL: 'http://localhost:3000/hackathon',

// Production
production: {
  API_BASE_URL: 'https://your-domain.com/hackathon',
}
```

## Inventory Management

### Add custom items (custom.csv)

```csv
part number,name,description,datasheet,manufacturer,image url,price,stock
custom-001,Arduino Uno,Microcontroller board,https://example.com/datasheet.pdf,Arduino,https://example.com/image.jpg,10.99,50
```

### Add DigiKey items (digikey.csv)

```csv
digikey_part_number,price,stock
296-6501-1-ND,1.23,50
```

## Security Notes

- Set a strong ADMIN_CODE
- Don't commit the .env file
- Keep your DigiKey credentials secure

## License

GNU Affero General Public License v3.0 (AGPL-3.0)

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

Full license text: https://www.gnu.org/licenses/agpl-3.0.en.html
