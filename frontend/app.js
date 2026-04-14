const API_URL = 'http://localhost:8080/api/v1';
let TOKEN = localStorage.getItem('token');

function showSection(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
}

function hideSection(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

async function register() {
    const email = document.getElementById('email').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password })
        });
        const data = await res.json();
        alert(data.message || data.error);
    } catch (e) {
        alert("Error de conexión al registrar");
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
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
            hideSection('auth-section');
            initApp();
        } else {
            alert(data.error || "Credenciales inválidas");
        }
    } catch (e) {
        alert("Error de conexión al iniciar sesión");
    }
}

async function initApp() {
    console.log("Iniciando aplicación...");
    
    // Forzar visibilidad de secciones principales
    showSection('dashboard-section');
    showSection('search-section');
    showSection('squad-section');
    
    if (!TOKEN) return;

    try {
        // Intentar inicializar escuadra (silencioso)
        console.log("Verificando escuadra...");
        await fetch(`${API_URL}/squad`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ name: "Mi Equipo", formation: "4-3-3" })
        });

        // Cargar datos en paralelo
        console.log("Cargando datos del dashboard...");
        updateSquad();
        getLeaderboard();
        getMyRank();
    } catch (e) {
        console.error("Fallo parcial en initApp:", e);
    }
}

async function getMyRank() {
    if (!TOKEN) return;
    try {
        const res = await fetch(`${API_URL}/leaderboard/me`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        const infoDiv = document.getElementById('my-rank-info');
        
        if (data.rank && data.rank !== "N/A") {
            infoDiv.innerHTML = `
                <div style="background: var(--dark); color: var(--accent); padding: 20px; border-radius: 8px; display: flex; justify-content: space-around; align-items: center; border: 2px solid var(--primary);">
                    <div style="text-align: center;">
                        <div style="font-size: 0.8em; text-transform: uppercase;">Puesto Mundial</div>
                        <div style="font-size: 2.5em; font-weight: bold;">#${data.rank}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.8em; text-transform: uppercase;">Puntos Totales</div>
                        <div style="font-size: 2.5em; font-weight: bold;">${data.score}</div>
                    </div>
                </div>
            `;
        } else {
            infoDiv.innerHTML = `<p>${data.message || "¡Añade jugadores para empezar a puntuar!"}</p>`;
        }
    } catch (e) {
        console.error("Error al obtener rank:", e);
    }
}

async function getLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';

        if (Array.isArray(data)) {
            data.forEach((entry, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${entry.Member}</td>
                    <td>${entry.Score}</td>
                `;
                list.appendChild(row);
            });
        }
    } catch (e) {
        console.error("Error al cargar leaderboard:", e);
    }
}

async function searchPlayers() {
    const query = document.getElementById('search-input').value;
    if (query.length < 2) return;

    try {
        const res = await fetch(`${API_URL}/players?q=${query}`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        const resultsDiv = document.getElementById('player-results');
        resultsDiv.innerHTML = '';

        if (data.results) {
            data.results.forEach(p => {
                const div = document.createElement('div');
                div.className = 'card';
                div.innerHTML = `
                    <img src="${p.player_face_url.String}" alt="Face">
                    <p><strong>${p.short_name.String}</strong></p>
                    <p>${p.nationality_name.String}</p>
                    <p>Precio: $${p.fantasy_price}M</p>
                    <button onclick="addPlayer(${p.player_id})">Añadir</button>
                `;
                resultsDiv.appendChild(div);
            });
        }
    } catch (e) {
        console.error("Error en búsqueda:", e);
    }
}

async function addPlayer(playerId) {
    try {
        const res = await fetch(`${API_URL}/squad/players`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ player_id: playerId, slot: "ANY" })
        });
        const data = await res.json();
        if (data.error) alert(data.error);
        else {
            updateSquad();
            getMyRank();
        }
    } catch (e) {
        alert("Error al añadir jugador");
    }
}

async function updateSquad() {
    try {
        const res = await fetch(`${API_URL}/squad`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        if (data.squad) {
            document.getElementById('squad-name-display').innerText = data.squad.squad_name;
            document.getElementById('budget-used').innerText = (data.squad.budget_used.Int64 / 100).toFixed(2);
            document.getElementById('squad-points').innerText = data.squad.total_points.Int32;

            const list = document.getElementById('squad-list');
            list.innerHTML = '';
            if (data.players) {
                data.players.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'card';
                    div.innerHTML = `<p>${p.short_name.String} (${p.position_slot})</p>`;
                    list.appendChild(div);
                });
            }
        }
    } catch (e) {
        console.error("Error al actualizar escuadra:", e);
    }
}

async function postMatchResult() {
    const nationAID = parseInt(document.getElementById('nation-a-id').value);
    const nationBID = parseInt(document.getElementById('nation-b-id').value);
    const scoreA = parseInt(document.getElementById('score-a').value);
    const scoreB = parseInt(document.getElementById('score-b').value);

    try {
        const res = await fetch(`${API_URL}/admin/results`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ nation_a_id: nationAID, nation_b_id: nationBID, score_a: scoreA, score_b: scoreB })
        });
        const data = await res.json();
        alert(data.message || data.error);
        getLeaderboard();
        getMyRank();
    } catch (e) {
        alert("Error al postear resultado");
    }
}

// Auto-login / Reconexión
if (TOKEN) {
    console.log("Sesión encontrada, recuperando...");
    document.getElementById('auth-status').innerText = "Sesión recuperada";
    hideSection('auth-section');
    initApp();
}
