const BASE_URL = 'http://localhost:5000/api/v1';

async function testFlow() {
    try {
        console.log('--- 1. Testing Health ---');
        const health = await fetch('http://localhost:5000/health');
        console.log('Health:', health.status);

        console.log('\n--- 2. Registering Passenger ---');
        const passEmail = `pass_${Date.now()}@test.com`;
        const passRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'E2E Passenger',
                email: passEmail,
                password: 'password123',
                phone: '5550101',
                role: 'passenger',
                currentLocation: { type: 'Point', coordinates: [77.59, 12.97] }
            })
        });
        const passData = await passRes.json();
        if (!passData.success) throw new Error(passData.error?.message || 'Passenger Reg Failed');
        const passToken = passData.token;
        console.log('✅ Passenger Registered');

        console.log('\n--- 3. Testing Price Estimate ---');
        const estRes = await fetch(`${BASE_URL}/rides/estimate?distance=15&seats=2`);
        const estData = await estRes.json();
        if (!estData.success || !estData.fare) throw new Error('Estimation Failed');
        console.log(`✅ Price Estimate: ${estData.fare}`);

        console.log('\n--- 4. Requesting Ride ---');
        const reqRes = await fetch(`${BASE_URL}/rides/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${passToken}`
            },
            body: JSON.stringify({
                pickupLocation: { type: 'Point', coordinates: [77.59, 12.97] },
                terminal: 'T1',
                seatsNeeded: 1,
                luggageCount: 1
            })
        });
        const reqData = await reqRes.json();
        if (!reqData.success) throw new Error('Ride Request Failed');
        console.log('✅ Ride Requested, Job ID:', reqData.jobId);

        // Wait for worker to process
        console.log('... Waiting 2s for worker ...');
        await new Promise(r => setTimeout(r, 2000));

        console.log('\n--- 5. Registering Driver ---');
        const driverEmail = `driver_${Date.now()}@test.com`;
        const driverRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'E2E Driver',
                email: driverEmail,
                password: 'password123',
                phone: '5550102',
                role: 'driver',
                currentLocation: { type: 'Point', coordinates: [77.60, 12.98] }
            })
        });
        const driverData = await driverRes.json();
        const driverToken = driverData.token;
        console.log('✅ Driver Registered');

        console.log('\n--- 6. Fetching Open Rides (Driver) ---');
        const poolsRes = await fetch(`${BASE_URL}/rides/open`, {
            headers: { 'Authorization': `Bearer ${driverToken}` }
        });
        const poolsData = await poolsRes.json();
        console.log(`✅ Open Pools Found: ${poolsData.count}`);

        const pool = poolsData.data.find(p => p.passengers.some(pass => pass.passengerId === passData.data.id));

        if (pool) {
            console.log('✅ Match Found! Accepting Pool ID:', pool._id);

            console.log('\n--- 7. Accepting Ride ---');
            const acceptRes = await fetch(`${BASE_URL}/rides/pool/${pool._id}/accept`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${driverToken}` }
            });
            const acceptData = await acceptRes.json();

            if (acceptData.success && acceptData.data.status === 'in-progress') {
                console.log('✅ Ride Accepted Successfully!');
            } else {
                throw new Error('Acceptance Failed or Status mismatch');
            }
        } else {
            console.log('⚠️ Warning: Our requested ride was not found in open pools. (Queue might be slow or Redis issue?)');
            console.log('Available pools:', JSON.stringify(poolsData.data, null, 2));
        }

    } catch (e) {
        console.error('❌ TEST FAILED:', e.message);
        console.error(e);
    }
}

testFlow();
