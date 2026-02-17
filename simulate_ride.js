// const fetch = require('node-fetch'); // Built-in fetch available in Node 18+

async function run() {
    try {
        console.log('Registering passenger...');
        const regRes = await fetch('http://localhost:5000/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Passenger',
                email: `testpass${Date.now()}@example.com`,
                password: 'password123',
                phone: '1234567890',
                role: 'passenger',
                currentLocation: { type: 'Point', coordinates: [77.5, 12.9] }
            })
        });
        const regData = await regRes.json();
        if (!regData.success) throw new Error(regData.error?.message || 'Registration failed');
        const token = regData.token;
        console.log('Registered. Token:', token.substring(0, 10) + '...');

        console.log('Requesting ride...');
        const reqRes = await fetch('http://localhost:5000/api/v1/rides/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                pickupLocation: { type: 'Point', coordinates: [77.5, 12.9] },
                destination: { type: 'Point', coordinates: [77.6, 13.0] },
                terminal: '1',
                seatsNeeded: 1,
                luggageCount: 1
            })
        });
        const reqData = await reqRes.json();
        console.log('Request Response:', reqData);

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
