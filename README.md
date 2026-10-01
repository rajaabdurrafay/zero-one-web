# Gaming Zone Booking System

Complete booking management system for gaming zone with multiple activities.

## Project Structure

```
├── backend/          # Node.js + Express + TypeScript + Prisma
├── website/          # Next.js customer-facing website (Phase 2)
└── admin/            # Next.js admin panel (Phase 2)
```

## Activities Supported

1. **Snooker** - ₨500/hour
2. **PS5 Gaming (Open)** - ₨300/hour
3. **PS5 Private Room** - ₨800/hour
4. **Private Cinema** - ₨1000/hour
5. **Table Tennis** - ₨400/hour
6. **Car Simulator** - ₨20/minute

## Phase 0 + Phase 1 Complete ✅

### Features Implemented:
- ✅ Monorepo structure with workspaces
- ✅ PostgreSQL database with Prisma ORM
- ✅ Complete database schema (Resources, Activities, Customers, Bookings)
- ✅ Time conflict detection (no double-booking)
- ✅ Automatic price calculation based on activity pricing
- ✅ REST API with validation (Zod)
- ✅ Database seeding with sample data

### API Endpoints:

#### 1. Get Availability
```http
GET /api/availability?date=2026-09-15&resourceType=SNOOKER
```
Returns all resources with their busy time slots for the specified date.

#### 2. Create Booking
```http
POST /api/bookings
Content-Type: application/json

{
  "resourceId": "clxxx...",
  "customer": {
    "name": "Raja Abdurrafay",
    "phone": "03001234567",
    "email": "raja@example.com"
  },
  "startTime": "2026-09-15T14:00:00Z",
  "endTime": "2026-09-15T16:00:00Z",
  "isWalkIn": false
}
```
Creates a booking with automatic conflict check and price calculation.

#### 3. List Bookings
```http
GET /api/bookings?date=2026-09-15&status=CONFIRMED
```
Filter bookings by date and/or status.

#### 4. Update Booking
```http
PATCH /api/bookings/:id
Content-Type: application/json

{
  "status": "CANCELLED"
}
```
Update booking status or reschedule (with conflict check).

#### 5. Get Pricing
```http
GET /api/pricing
```
Returns all activities with current pricing information.

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database running
- npm or yarn

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Database
1. Copy the example env file:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Update `.env` with your PostgreSQL credentials:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/gaming_zone_db?schema=public"
   PORT=3001
   NODE_ENV=development
   ```

### Step 3: Run Database Migrations
```bash
cd backend
npm run db:migrate
```

### Step 4: Seed Database
```bash
npm run db:seed
```
This will create:
- 6 activities with pricing
- 11 resources (3 snooker tables, 4 PS5 stations, etc.)
- 1 sample customer

### Step 5: Start Backend Server
```bash
npm run dev
```

Server will start on `http://localhost:3001`

### Optional: Open Prisma Studio (Database GUI)
```bash
npm run db:studio
```

## Testing the API

### Using curl:

**Check health:**
```bash
curl http://localhost:3001/health
```

**Get pricing:**
```bash
curl http://localhost:3001/api/pricing
```

**Check availability:**
```bash
curl "http://localhost:3001/api/availability?date=2026-09-15&resourceType=SNOOKER"
```

**Create booking:**
```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "YOUR_RESOURCE_ID",
    "customer": {
      "name": "Test User",
      "phone": "03001234567"
    },
    "startTime": "2026-09-15T14:00:00Z",
    "endTime": "2026-09-15T16:00:00Z"
  }'
```

### Using Postman:
Import the endpoints above and test each one.

## Key Features

### 1. Conflict Detection
The system prevents double-booking by checking for overlapping time slots on the same resource:
- New booking starts during existing booking ❌
- New booking ends during existing booking ❌
- New booking contains existing booking ❌

### 2. Automatic Pricing
Price is calculated based on:
- Activity's pricing unit (per hour or per minute)
- Duration of booking
- Base price from Activity table

### 3. Customer Management
- Customers are identified by phone number
- Automatically reuses existing customer or creates new one

### 4. Type Safety
- Full TypeScript support
- Prisma ORM for type-safe database queries
- Zod validation for API requests

## Next Steps (Phase 2)

- [ ] Build admin panel (Next.js)
- [ ] Build customer-facing website (Next.js)
- [ ] Add authentication
- [ ] Add payment integration
- [ ] Real-time availability updates

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Development**: tsx (hot reload)

## Common Commands

```bash
# Start backend dev server
npm run dev:backend

# Run database migrations
cd backend && npm run db:migrate

# Seed database
cd backend && npm run db:seed

# Open Prisma Studio
cd backend && npm run db:studio

# Build backend for production
cd backend && npm run build

# Start production server
cd backend && npm start
```

## Troubleshooting

**Issue: Database connection error**
- Verify PostgreSQL is running
- Check DATABASE_URL in `.env`
- Ensure database exists

**Issue: Port 3001 already in use**
- Change PORT in `.env`
- Or kill the process using port 3001

**Issue: Prisma migration fails**
- Drop database and recreate: `dropdb gaming_zone_db && createdb gaming_zone_db`
- Run migrations again
