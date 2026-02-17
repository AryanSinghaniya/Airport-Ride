# Smart Airport Ride Pooling Backend 🚖✈️

A production-grade backend system for grouping airport passengers into shared cabs, optimizing routes and pricing. Built to handle high concurrency (10,000+ users) with the MERN stack, Redis, and Socket.IO.

> **Note:** This project implements all functional requirements including **Geospatial Pooling**, **Concurrency Control (Redis Locks)**, **Async Processing (Bull Queues)**, and **Dynamic Pricing**.

---

## 📚 Documentation
-   **[View Detailed Design Document (DSA, Architecture, DB Schema)](DESIGN.md)**
-   **[API Documentation (Swagger UI)](http://localhost:5000/api-docs)**

(Ensure server is running to view API docs)

---

## 🚀 Features

-   **Smart Pooling Algorithm**: Groups passengers based on proximity (`2dsphere` index) and destination, respecting seat/luggage constraints.
-   **Concurrency Safety**: Uses Redis Distributed Locks to prevent race conditions when multiple users book the last seat simultaneously.
-   **High Performance**: 
    -   **Clustering**: Utilizes all CPU cores (Node.js Cluster Mode) to handle 10k concurrent connections.
    -   **Async Processing**: Offloads heavy matching logic to background workers via **Bull Queues**.
    -   **Rate Limiting**: Handles 100+ requests/second with stability.
-   **Real-time Updates**: Socket.IO integration for live ride matching and driver acceptance notifications.
-   **Dynamic Pricing**: Calculates fares based on distance, surge demand, and pooling discounts.

---

## 🛠️ Tech Stack

-   **Runtime**: Node.js (v18+)
-   **Framework**: Express.js
-   **Database**: MongoDB (Mongoose ODM) with GeoJSON support.
-   **Caching & Queues**: Redis (ioredis, Bull).
-   **Real-time**: Socket.IO.
-   **Containerization**: Docker & Docker Compose.

---

## ⚙️ Setup & Installation

### 1. Prerequisites
-   Node.js (v18 or higher)
-   Docker & Docker Compose (for MongoDB and Redis)

### 2. Clone & Install
```bash
git clone <repository-url>
cd smart-airport-backend
npm install
```

### 3. Start Infrastructure
Start the database and cache services using Docker:
```bash
docker-compose up -d
```

### 4. Run the Application
Start the backend server in production (cluster) mode:
```bash
npm start
```
*Server runs at: `http://localhost:5000`*

---

## 🧪 Testing & Simulation

### 1. Verification Simulation
Run the included simulation script to create a user, request a ride, and verify the flow:
```bash
node simulate_ride.js
```

### 2. Populate Sample Data
Seed the database with initial drivers and passengers:
```bash
node seed_data.js
```

### 3. Frontend Demo
Open **[http://localhost:5000](http://localhost:5000)** in your browser to access the Passenger/Driver dashboards.
-   **Passenger**: Login `bob@passenger.com` / `password123`
-   **Driver**: Login `alice@driver.com` / `password123`

---

## 📂 Project Structure

```
├── src/
│   ├── config/         # DB, Redis, Logger configs
│   ├── controllers/    # Request handlers
│   ├── models/         # Mongoose Schemas (Passenger, RidePool)
│   ├── services/       # Business Logic (Pooling, Pricing)
│   ├── workers/        # Background Job Processors (Bull)
│   ├── routes/         # API Routes
│   └── server.js       # Entry point (Cluster setup)
├── public/             # Frontend Demo (HTML/JS)
├── docker-compose.yml  # Infrastructure setup
├── simulate_ride.js    # Testing script
└── DESIGN.md           # Architecture & DSA Documentation
```

## 📝 Assumptions

1.  **Terminals**: Rides are currently restricted to airport pickups/drop-offs.
2.  **Distance**: Calculated using Haversine formula (Euclidean approximation). Real-world implementation would use Google Maps API.
3.  **Routing**: Validates that pickup is within 5km of the pool's route start.
