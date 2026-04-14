const API_BASE = "http://localhost:8080/api/v1";
const REFRESH_MS = 5000;

const leaderboardBody = document.getElementById("leaderboardBody");
const myRankCard = document.getElementById("myRankCard");
const lastUpdated = document.getElementById("lastUpdated");
const refreshBtn = document.getElementById("refreshBtn");

let currentUsername = null;

async function fetchJSON(url) {
  const res = await fetch(url, {
    method: "GET",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const contentType = res.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = { message: await res.text() };
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }

  return data;
}

function formatTime(date) {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderLeaderboard(items) {
  if (!items || items.length === 0) {
    leaderboardBody.innerHTML = `
      <tr>
        <td colspan="3" class="empty">No hay datos en el leaderboard</td>
      </tr>
    `;
    return;
  }

  leaderboardBody.innerHTML = items
    .map((item, index) => {
      const username = item.username || item.member || "-";
      const points = item.total_points ?? item.score ?? 0;
      const rank = item.rank ?? index + 1;
      const isMe = currentUsername && username === currentUsername;

      return `
        <tr class="${isMe ? "highlight" : ""}" data-username="${username}">
          <td>${rank}</td>
          <td>${username}</td>
          <td>${Number(points).toFixed(0)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMyRank(data) {
  if (!data) {
    myRankCard.innerHTML = `<p>No se pudo cargar tu posición.</p>`;
    return;
  }

  currentUsername = data.username;

  myRankCard.innerHTML = `
    <div class="rank-grid">
      <div>
        <span class="label">Usuario</span>
        <strong>${data.username || "-"}</strong>
      </div>
      <div>
        <span class="label">Squad</span>
        <strong>${data.squad_name || "-"}</strong>
      </div>
      <div>
        <span class="label">Rank</span>
        <strong>${data.rank ?? "N/A"}</strong>
      </div>
      <div>
        <span class="label">Puntos</span>
        <strong>${Number(data.score || 0).toFixed(0)}</strong>
      </div>
    </div>
    ${data.message ? `<p class="muted">${data.message}</p>` : ""}
  `;
}

async function loadLeaderboard() {
  try {
    const data = await fetchJSON(`${API_BASE}/leaderboard?limit=10`);
    const items = Array.isArray(data) ? data : (data.items || []);
    renderLeaderboard(items);
    lastUpdated.textContent = `Última actualización: ${formatTime(new Date())}`;
  } catch (error) {
    leaderboardBody.innerHTML = `
      <tr>
        <td colspan="3" class="error">Error cargando leaderboard: ${error.message}</td>
      </tr>
    `;
  }
}

async function loadMyRank() { //esto esta harcodeado
  try {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NzYxMzQxNjMsInVzZXJfaWQiOjV9.5Y4DopB9FfJL-mdGTvMkNfKPojMO2wm8GkQ0N-DLtyM";
    
    const res = await fetch(`${API_BASE}/leaderboard/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json();
    renderMyRank(data);
  } catch (error) {
    myRankCard.innerHTML = `<p class="muted">Error cargando tu posición.</p>`;
  }
}

async function refreshAll() {
  await Promise.all([loadMyRank(), loadLeaderboard()]);
}

refreshBtn.addEventListener("click", refreshAll);

refreshAll();
setInterval(refreshAll, REFRESH_MS);