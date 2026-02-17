const API_URL = 'http://localhost:5000/api/v1';
let socket;
let currentUser = null;
let token = localStorage.getItem('token');

// DOM Elements
const authSection = document.getElementById('auth-section');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const rideRequestForm = document.getElementById('rideRequestForm');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');

// Page Context
const path = window.location.pathname;
const isAuthPage = path === '/' || path.endsWith('index.html');
const isPassengerPage = path.endsWith('passenger.html');
const isDriverPage = path.endsWith('driver.html');

// Initialization
function init() {
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            currentUser = payload;

            // Redirects
            if (isAuthPage) {
                window.location.href = currentUser.role === 'driver' ? 'driver.html' : 'passenger.html';
                return;
            }

            // Role Protection
            if (isPassengerPage && currentUser.role !== 'passenger') {
                window.location.href = 'driver.html';
                return;
            }
            if (isDriverPage && currentUser.role !== 'driver') {
                window.location.href = 'passenger.html';
                return;
            }

            setupCommonUI();
            if (isPassengerPage) setupPassengerUI();
            if (isDriverPage) setupDriverUI();

            connectSocket();

        } catch (e) {
            console.error('Token invalid', e);
            logout();
        }
    } else {
        if (!isAuthPage) window.location.href = '/';
    }
}

function setupCommonUI() {
    const welcome = document.getElementById('welcome-msg');
    // Ensure currentUser is not null before accessing properties
    if (welcome && currentUser && currentUser.name) {
        welcome.textContent = `Hello, ${currentUser.name}`;
    }

    const badge = document.getElementById('role-badge');
    if (badge && currentUser && currentUser.role) {
        badge.textContent = currentUser.role === 'driver' ? 'Driver' : 'Passenger';
    }
}

function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(() => toast.className = 'toast', 3000);
}

async function apiCall(endpoint, method, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Request failed');
        return data;
    } catch (err) {
        showToast(err.message);
        throw err;
    }
}

// --- Auth ---
if (isAuthPage) {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
            document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
        });
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Logging in...';
            btn.disabled = true;

            try {
                const data = await apiCall('/auth/login', 'POST', {
                    email: document.getElementById('login-email').value,
                    password: document.getElementById('login-password').value
                });
                token = data.token;
                localStorage.setItem('token', token);
                showToast('Login successful!');
                init();
            } catch (err) {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = registerForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Registering...';
            btn.disabled = true;

            try {
                // Parse Location
                let loc = null;
                const locStr = document.getElementById('reg-location').value;
                if (locStr.includes(',')) {
                    const [lat, lng] = locStr.split(',').map(n => parseFloat(n.trim()));
                    loc = { type: 'Point', coordinates: [lng, lat] };
                }

                await apiCall('/auth/register', 'POST', {
                    name: document.getElementById('reg-name').value,
                    email: document.getElementById('reg-email').value,
                    password: document.getElementById('reg-password').value,
                    phone: document.getElementById('reg-phone').value,
                    role: document.getElementById('reg-role').value,
                    currentLocation: loc
                });
                showToast('Registered! Please login.');
                document.querySelector('[data-tab="login"]').click();
            } catch (err) {
                // error handled in apiCall
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // Geolocation
    const locBtn = document.getElementById('get-location-btn');
    if (locBtn) {
        locBtn.addEventListener('click', () => {
            if (!navigator.geolocation) return showToast('Geolocation not supported');
            locBtn.textContent = '📍 Locating...';
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    document.getElementById('reg-location').value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                    locBtn.textContent = '📍 Updated';
                },
                (err) => {
                    console.error(err);
                    showToast('Location failed');
                    locBtn.textContent = '📍 Get Location';
                }
            );
        });
    }
}

// --- Passenger ---
function setupPassengerUI() {
    // Event delegation for Cancel Ride button (works with dynamically created elements)
    const rideStatusBox = document.getElementById('ride-status');
    if (rideStatusBox) {
        rideStatusBox.addEventListener('click', (e) => {
            const btn = e.target.closest('.cancel-ride-btn');
            if (btn && btn.dataset.rideId) {
                cancelRide(btn.dataset.rideId);
            }
        });
    }

    const useLoc = document.getElementById('use-my-loc');
    if (useLoc) {
        useLoc.addEventListener('click', () => {
            // Mock Location
            document.getElementById('destination').value =
                `12.${Math.floor(Math.random() * 900) + 100}, 77.${Math.floor(Math.random() * 900) + 100}`;
        });
    }

    const estBtn = document.getElementById('get-estimate-btn');
    if (estBtn) {
        estBtn.addEventListener('click', async () => {
            const dest = document.getElementById('destination').value;
            if (!dest.includes(',')) return showToast('Enter destination first');

            estBtn.textContent = 'Calculating...';
            try {
                // Mock dist
                const dist = (Math.random() * 20 + 5).toFixed(1);
                const res = await apiCall(`/rides/estimate?distance=${dist}&seats=1`, 'GET');
                document.getElementById('estimation-result').style.display = 'block';
                document.getElementById('est-price').textContent = `₹${res.fare.toFixed(2)}`;
            } catch (e) {
                console.error(e);
            } finally {
                estBtn.textContent = 'Get Estimate';
            }
        });
    }

    if (rideRequestForm) {
        rideRequestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dest = document.getElementById('destination').value;
            if (!dest.includes(',')) return showToast('Enter destination');
            const [lat, lng] = dest.split(',').map(n => parseFloat(n.trim()));

            const btn = rideRequestForm.querySelector('button[type="submit"]');
            btn.textContent = 'Requesting...';
            btn.disabled = true;

            try {
                const res = await apiCall('/rides/request', 'POST', {
                    pickupLocation: { type: 'Point', coordinates: [0, 0] },
                    destination: { type: 'Point', coordinates: [lat, lng] },
                    terminal: "1",
                    seatsNeeded: 1,
                    luggageCount: 1
                });
                showToast('Ride Requested!');
                updateRideStatus(res.data);
            } catch (e) {
                btn.textContent = 'Find Pool';
                btn.disabled = false;
            }
        });
    }
}

function updateRideStatus(status) {
    const box = document.getElementById('ride-status');
    if (box && status) {
        const rideId = (status._id || status.poolId || '').toString();
        box.innerHTML = `<p><strong>Order ID:</strong> ${rideId}</p>
                         <p><strong>Status:</strong> ${status.status}</p>
                         <button type="button" id="cancel-ride-btn" class="secondary-btn cancel-ride-btn" data-ride-id="${rideId}" style="margin-top: 10px; background-color: #ffcccc; color: #cc0000;">Cancel Ride</button>`;
        // Reset request button when ride is matched
        const reqBtn = document.querySelector('#rideRequestForm button[type="submit"]');
        if (reqBtn) {
            reqBtn.textContent = 'Find Pool';
            reqBtn.disabled = false;
        }
    }
}

async function cancelRide(rideId) {
    if (!confirm('Are you sure you want to cancel this ride?')) return;

    const btn = document.getElementById('cancel-ride-btn');
    if (btn) {
        btn.textContent = 'Cancelling...';
        btn.disabled = true;
    }

    try {
        await apiCall(`/rides/pool/${rideId}/cancel`, 'POST');
        showToast('Ride Cancelled');
        document.getElementById('ride-status').innerHTML = '<p>Ride cancelled.</p>';
        document.querySelectorAll('.driver-info').forEach(el => el.remove());

        // Reset Request Button
        const reqBtn = document.querySelector('#rideRequestForm button[type="submit"]');
        if (reqBtn) {
            reqBtn.textContent = 'Find Pool';
            reqBtn.disabled = false;
        }
    } catch (e) {
        console.error(e);
        if (btn) {
            btn.textContent = 'Cancel Ride';
            btn.disabled = false;
        }
    }
}

// --- Driver ---
function setupDriverUI() {
    loadOpenRides();
    const refBtn = document.getElementById('refresh-rides');
    if (refBtn) refBtn.addEventListener('click', loadOpenRides);

    // Event Delegation for Accept Button
    const list = document.getElementById('rides-list');
    if (list) {
        list.addEventListener('click', async (e) => {
            if (e.target.classList.contains('accept-btn')) {
                const btn = e.target;
                const rideId = btn.dataset.id;
                await acceptRide(rideId, btn);
            }
        });
    }
}

async function loadOpenRides() {
    const list = document.getElementById('rides-list');
    if (!list) return;
    list.innerHTML = '<p>Loading...</p>';

    try {
        const res = await apiCall('/rides/open', 'GET');
        if (!res.data || res.data.length === 0) {
            list.innerHTML = '<p>No open rides.</p>';
            return;
        }
        list.innerHTML = res.data.map(ride => `
            <div class="ride-card">
                 <div class="ride-info">
                    <strong>📍 Terminal ${ride.terminal}</strong>
                    <span>to ${ride.route?.coordinates ? 'Mapped Route' : 'Destination'}</span>
                </div>
                <div class="ride-meta">
                    <span>${ride.seatsRemaining} seats</span>
                </div>
                <button class="primary-btn accept-btn" data-id="${ride._id}">Accept</button>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '<p style="color:red">Failed to load rides.</p>';
    }
}

async function acceptRide(id, btn) {
    if (btn) {
        btn.textContent = 'Accepting...';
        btn.disabled = true;
    }

    try {
        console.log('Accepting ride:', id);
        await apiCall(`/rides/pool/${id}/accept`, 'PUT');
        showToast('Ride Accepted! Navigation started.');
        loadOpenRides(); // Refresh list to remove it
    } catch (err) {
        console.error('Accept error:', err);
        showToast(err.message || 'Failed to accept ride');
        if (btn) {
            btn.textContent = 'Accept';
            btn.disabled = false;
        }
    }
}

// --- Global ---
if (logoutBtn) logoutBtn.addEventListener('click', logout);

function logout() {
    token = null;
    localStorage.removeItem('token');
    if (socket) socket.disconnect();
    window.location.href = '/';
}

function connectSocket() {
    try {
        socket = io('http://localhost:5000');
        if (currentUser) {
            socket.emit('join', currentUser.id);
            socket.on('rideMatched', (data) => {
                showToast('Ride Matched!');
                if (isPassengerPage) updateRideStatus(data);
                if (isDriverPage) loadOpenRides(); // Refresh list if needed
            });

            socket.on('rideAccepted', (data) => {
                showToast('Driver Accepted!');
                if (isPassengerPage && data && data.driver) {
                    const box = document.getElementById('ride-status');
                    if (box) {
                        box.innerHTML += `
                            <div class="driver-info" style="margin-top:10px; padding-top:10px; border-top:1px solid #ccc;">
                                <p><strong>🚖 Driver Found!</strong></p>
                                <p>Name: ${data.driver.name || 'Driver'}</p>
                                <p>Phone: ${data.driver.phone || 'N/A'}</p>
                                <p style="color: green; font-weight: bold;">En Route</p>
                            </div>
                        `;
                        // Update status to in-progress and remove cancel button
                        const statusP = box.querySelector('p:nth-child(2)');
                        if (statusP) statusP.innerHTML = '<strong>Status:</strong> in-progress';
                        const cancelBtn = document.getElementById('cancel-ride-btn');
                        if (cancelBtn) cancelBtn.remove();
                    }
                }
            });
        }
    } catch (e) {
        console.error('Socket error', e);
    }
}

init();
