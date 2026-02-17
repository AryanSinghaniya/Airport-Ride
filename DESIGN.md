# Design Document - Smart Airport Ride Pooling Backend

## 1. Problem Statement & Functional Requirements
Build a backend system to group airport passengers into shared cabs, optimizing routes, pricing, and handling high concurrency.

**Requirements:**
- Group passengers (pooling).
- Respect capacity constraints (seats, luggage).
- Minimize detours.
- Handle cancellations.
- Support 10k users, 100 RPS, <300ms latency.

---

## 2. High Level Architecture (HLA)

The system is built using a microservices-ready architecture (currently a modular monolith) with the following components:

![Architecture Diagram](https://mermaid.ink/img/pako:eNpVkMtqwzAQRX9FzKpFkH0sAiml20Kh20JDKLoxWhybypFHQhJDyL9XTmzSTZf3zJkz9wY501oJ5EdaPyuDglfWIG-Fsdag8c4iIcxW1kCh1eOzdWj1eKz1E-Q8ZSwJOUvCjLGCV7-sQc6S8EwYSwLOUsoK3kGDSsEKXv2wBnktCWfCWBLwWhLeQYdKwQpe_bIGeSsJZ8JYUoLXkvABOtQKVvDqlzXIeUl4JowlBXgtCR-gQ61gBa9-WYO8l4SzhLEk4L0kHODT2UqDCt78sgYFSwlnCWNJwEdJeACd6gYVvPllDQqWEs4SxpKAj5LwADrVDSp488sapLCScJYwlgR8lIQH0KluUMGbX9agYCnhLGMsCfhYSXgAna4NKnjzyxoULCWcJYwlAR8rCQ-g07VBBW9-WYOCpYSzhLEk4GMl4QF0ujas4N0va1CwlHCWMJYEfKwkPIBO14YVvPtlDQqWEs4SxpKAj5WEB9Dp2rCCd7-sQcFSnlnCWBLwsZLwADpdG1bw7pc1KFhKOEsYSwI+VhIeQKdrwwre_bIGBUsJZwljScDHSuID6HRtWMG7X9agYCnP7AnGkoCPlYQH0OnasIJ3v6xBwVLCCcZYEvCxkvAAOl0bVvDulzUoWEo4wRhLAj5WEh5Ap2vDCt79sgYFS3lmTzCWBHysJDyATteGFbz7ZQ0KlhJOMMaSgI-VhAfQ6dqwgne_rEGxUmoF7yXhA3SoFazg1S9r0P8bS8Jb6FArWMGrX9ag4CXhLXSoFazg1S9r0P8bSwreQYdKwQpe_bIGBS8J76BDPbKCt7-sQf9vLCl4h0fQoVbw6pc1KHgpeIdH0KFW8OqXNSg4S3iHR9ChVvDqlzUoeEl4h0fQoVbw6pc1KDhLeIdH0KFW8OqXNSg4S3iHHtChVvDqlzUoOEt4hx7QoVbw6pc1KDhLeIce0KFW8OqXNSg4S3iHHtChVvDqlzUoOEt4hx7QoVbw6pc1KDhLeIce0KFW8OqXNSg4S3iHHtChVvDqlzUoOEt4hx7QoVbw6pc1KDhLeIcX0KFW8OqXNSg4S3iHF9ChVvDqlzUoOEt4hxfQoVbw6pc1KDhLeIcX0KFW8OqXNSg4S3iHF9ChVvDqlzUoOEt4hxfQoVbw6pc16P-NJeEtdKgVrODVL2tQ8JLwFjrUCl79sgb9v7Gk4B10qOdW8PaXNej_jSUF76BDpWAFr35Zg4KXhHfQoVKwgle_rEH/bywpeAcdKgUrePXLGrT_p0nCW8JYEvBaEt5Bh0rBCl79sgbZSwlnCWNJwEdJeACd6gYVvPllDQqWEs4SxpKAj5WEB9Dp2rCCd7-sQcFS3plnjCUJHysJD6DTtWEF735Zg2Kl1AreS8IH6FArWMGrX9ag_zeWhLfQoVawe?type=png)

### Core Components
1.  **API Gateway / Load Balancer (Nginx/Cloud)**: Handles incoming HTTP requests.
2.  **Node.js Server (Cluster Mode)**:
    -   **API Layer**: Express.js handling HTTP routes.
    -   **Service Layer**: Business logic for Pooling, Pricing.
    -   **Repositories**: Database access abstraction.
3.  **Redis**:
    -   **Rate Limiting**: Preventing abuse.
    -   **Distributed Locks**: Preventing race conditions on seat allocation.
    -   **Bull Queue**: Backing for async job processing.
    -   **Caching**: Storing frequent queries (like open pools).
4.  **MongoDB (with GeoJSON)**:
    -   Persistent storage for Users, Rides, and Pools.
    -   Geospatial Indexing (`2dsphere`) allows efficient "Find nearby" queries.
5.  **Workers (Bull/Redis)**:
    -   Offloads heavy computations (like complex route matching) from the main event loop.

---

## 3. Low Level Design (LLD)

### Data Models & Schema

#### 1. Passenger
-   `_id`: UUID
-   `name`, `email`, `phone`: String
-   `currentLocation`: GeoJSON Point (Indexed `2dsphere`)

#### 2. RidePool
-   `_id`: UUID
-   `startLocation`: GeoJSON Point (Indexed `2dsphere`) - Used to query nearby pools.
-   `terminal`: String (Target destination)
-   `passengers`: Array of Objects
    -   `passengerId`: Ref
    -   `pickupLocation`: GeoJSON Point
    -   `luggageCount`: Number
    -   `seatsNeeded`: Number
-   `seatsRemaining`: Number (Tracked for quick filtering)
-   `status`: Enum (`open`, `locked`, `in-progress`, `completed`, `cancelled`)

### Class Diagram / Modules

-   **PoolingService**:
    -   `matchPassengerToPool(passenger, requestData)`: Main logic.
    -   `acquireLock(poolId)`: Redis distributed lock.
-   **PricingService**:
    -   `calculateFare(distance, surge, poolSize)`: Dynamic pricing logic.
-   **RidePoolRepository**:
    -   `findNearbyOpenPools(coords, radius)`: Database query abstraction.

---

## 4. DSA Approach & Complexity Analysis

### Problem: Efficient Matching
We need to find the best available Ride Pool for a new user request in real-time.

### Brute Force Approach
Compare the new user's location with every single active pool in the database.
-   **Complexity**: O(N) where N is the total number of active pools.
-   **Drawback**: Extremely slow as N grows.

### Optimized Geospatial Approach (Implemented)
We use MongoDB's `2dsphere` index to filter pools spatially.
1.  **Query**: `db.ridepools.find({ startLocation: { $near: ..., $maxDistance: 5000 }, status: 'open' })`
2.  **Complexity**: O(log N) due to Geohash/Quadtree indexing in MongoDB.
3.  **Refinement**: After fetching `K` nearby pools (where K << N), we iterate through them to check constraints (Luggage, Seats).
4.  **Total Complexity**: O(log N + K), where K is small (number of nearby candidates).

### Pricing Algorithm
-   **Formula**: `Fare = (Base + (Distance * Rate)) * SurgeMultiplier * PoolingDiscount`
-   **Surge**: `Multiplier = f(ActiveRequests / AvailableDrivers)`
-   **Pooling Discount**: `0.8` if `passengers > 1`.
-   **Complexity**: O(1) - constant time math operations.

---

## 5. Concurrency Handling Strategy

In a high-concurrency environment (100 req/sec), multiple users might try to book the last seat in a pool simultaneously.

### Race Condition Scenario
1.  User A sees Pool X has 1 seat.
2.  User B sees Pool X has 1 seat.
3.  Both verify `seatsRemaining > 0`.
4.  Both write to DB decrementing seat. Result: Seat count -1.

### Solution: Distributed Locking (Redis)
We use Redis to implement a "Resource Lock" (Mutex) on the Pool ID.

1.  **Acquire Lock**: `SET resource_id locked NX PX 2000` (Set if Not Exists, Expire in 2000ms).
2.  **Critical Section**:
    -   Re-read Pool from DB (Optimistic Verification).
    -   Check `seatsRemaining`.
    -   Add Passenger & Save.
3.  **Release Lock**: `DEL resource_id`.

If a lock cannot be acquired, the worker retries or moves to the next available pool.

---

## 6. Setup & Execution

1.  **Prerequisites**: Docker, Node.js v14+
2.  **Run Infrastructure**: `docker-compose up -d` (Starts Mongo & Redis)
3.  **Install Deps**: `npm install`
4.  **Start Server**: `npm start`
5.  **API Docs**: Visit `http://localhost:5000/api-docs`

---
,filePath: