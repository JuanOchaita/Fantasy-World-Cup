const API_URL = 'http://localhost:8080/api/v1';
let TOKEN = localStorage.getItem('token');

function showSection(id) {
    document.getElementById(id).classList.remove('hidden');
}

async function register() {
    const email = document.getElementById('email').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
    });
    const data = await res.json();
    alert(data.message || data.error);
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.access_token) {
        TOKEN = data.access_token;
        localStorage.setItem('token', TOKEN);
        document.getElementById('auth-status').innerText = `Autenticado como ${email}`;
        initApp();
    } else {
        alert(data.error);
    }
}

async function initApp() {
    showSection('search-section');
    showSection('squad-section');
    // Inicializar escuadra si no existe
    await fetch(`${API_URL}/squad`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ name: "Mi Equipo", formation: "4-3-3" })
    });
    updateSquad();
}

async function searchPlayers() {
    const query = document.getElementById('search-input').value;
    if (query.length < 2) return;

    const res = await fetch(`${API_URL}/players?q=${query}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    const resultsDiv = document.getElementById('player-results');
    resultsDiv.innerHTML = '';

    data.results.forEach(p => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <img src="${p.player_face_url.String}" alt="Face">
            <p><strong>${p.short_name.String}</strong></p>
            <p>${p.nationality_name.String}</p>
            <p>Rating: ${p.overall.Int16}</p>
            <p>Precio: $${p.fantasy_price}M</p>
            <button onclick="addPlayer(${p.player_id}, 'ST')">Añadir</button>
        `;
        resultsDiv.appendChild(div);
    });
}

async function addPlayer(playerId, slot) {
    const res = await fetch(`${API_URL}/squad/players`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ player_id: playerId, slot: slot })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else updateSquad();
}

async function updateSquad() {
    const res = await fetch(`${API_URL}/squad`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    document.getElementById('squad-name-display').innerText = data.squad.squad_name;
    document.getElementById('budget-used').innerText = (data.squad.budget_used.Int64 / 100).toFixed(2);
    document.getElementById('squad-points').innerText = data.squad.total_points.Int32;

    const list = document.getElementById('squad-list');
    list.innerHTML = '';
    data.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `<p>${p.short_name.String} (${p.position_slot})</p>`;
        list.appendChild(div);
    });
}

async function getLeaderboard() {
    const res = await fetch(`${API_URL}/leaderboard`);
    const data = await res.json();
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    data.forEach(entry => {
        const li = document.createElement('li');
        li.innerText = `${entry.Member}: ${entry.Score} pts`;
        list.appendChild(li);
    });
}
