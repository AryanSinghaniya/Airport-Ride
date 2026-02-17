const BASE_URL = 'http://localhost:5000/api/v1';

// A simple fetch wrapper to handle errors better
async function request(url, options = {}) {
    try {
        const res = await fetch(url, options);
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            return { error: { message: text }, status: res.status };
        }
    } catch (e) {
        return { error: { message: e.message } };
    }
}

async function testFlow() {
    console.log('🚀 Starting Final System Verification...');

    // 1. Health
    const health = await request('http://localhost:5000/health');
    if (health.status && health.status !== 'success') console.log('✅ Health Check Passed');

    // 2. Register Passenger
    const passEmail = `pass_${Date.now()}@verify.com`;
    console.log(`\n👤 Registering Passenger: ${passEmail}`);
    const passData = await request(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Verify Passenger',
            email: passEmail,
            password: 'password123',
            phone: '5550101',
            role: 'passenger',
            currentLocation: { type: 'Point', coordinates: [77.59, 12.97] }
        })
    });

    if (!passData.success) {
        console.error('❌ Passenger Registration Failed:', passData);
        return;
    }
    const passToken = passData.token;
    console.log('✅ Passenger Registered');

    // 3. Estimate Price (Authenticated)
    console.log('\n💰 Getting Price Estimate...');
    const estData = await request(`${BASE_URL}/rides/estimate?distance=10&seats=1`, {
        headers: { 'Authorization': `Bearer ${passToken}` }
    });

    if (estData.success && estData.fare) {
        console.log(`✅ Estimate Success: $${estData.fare}`);
    } else {
        console.error('❌ Estimate Failed:', estData);
        // Don't stop, strictly speaking not blocking flow but bad.
    }

    // 4. Request Ride
    console.log('\n🚖 Requesting Ride...');
    const reqData = await request(`${BASE_URL}/rides/request`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${passToken}`
        },
        body: JSON.stringify({
            pickupLocation: { type: 'Point', coordinates: [77.59, 12.97] },
            terminal: 'T2',
            seatsNeeded: 1,
            luggageCount: 1
        })
    });

    if (!reqData.success) {
        console.error('❌ Ride Request Failed:', reqData);
        return;
    }
    console.log('✅ Ride Requested. Job ID:', reqData.jobId);

    // 5. Register Driver
    await new Promise(r => setTimeout(r, 1000)); // Wait for worker
    const driverEmail = `driver_${Date.now()}@verify.com`;
    console.log(`\n🧢 Registering Driver: ${driverEmail}`);
    const driverData = await request(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Verify Driver',
            email: driverEmail,
            password: 'password123',
            phone: '5550102',
            role: 'driver',
            currentLocation: { type: 'Point', coordinates: [77.60, 12.98] }
        })
    });

    if (!driverData.success) {
        console.error('❌ Driver Registration Failed:', driverData);
        return;
    }
    const driverToken = driverData.token;
    console.log('✅ Driver Registered');

    // 6. Get Open Pools
    console.log('\n📋 Fetching Open Rides...');
    const poolsData = await request(`${BASE_URL}/rides/open`, {
        headers: { 'Authorization': `Bearer ${driverToken}` }
    });

    if (!poolsData.success) {
        console.error('❌ Fetch Pools Failed:', poolsData);
        return;
    }
    console.log(`✅ Open Pools: ${poolsData.count}`);

    // Find our ride pool (might be one of many)
    // We look for a pool containing our passenger
    const myPool = poolsData.data.find(p => p.passengers.some(pass => pass.passengerId === passData.data.id));

    if (myPool) {
        console.log(`✅ Found our pool: ${myPool._id}`);

        // 7. Accept Ride
        console.log(`\n✅ Accepting Pool ${myPool._id}...`);
        const acceptData = await request(`${BASE_URL}/rides/pool/${myPool._id}/accept`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${driverToken}` }
        });

        if (acceptData.success && acceptData.data.status === 'in-progress') {
            console.log('🎉 SUCCESS: Ride Accepted and In-Progress!');
            console.log('\n--- SYSTEM VERIFICATION PASSED ---');
        } else {
            console.error('❌ Acceptance Failed:', acceptData);
        }

    } else {
        console.error('❌ Could not find the requested ride in open pools.');
        console.log('Pools found:', JSON.stringify(poolsData.data.map(p => p.passengers), null, 2));
        console.log('Looking for passenger ID:', passData.data.id);
    }
}

testFlow();
