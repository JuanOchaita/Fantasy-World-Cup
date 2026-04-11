-- name: GetPlayer :one
SELECT * FROM players
WHERE player_id = $1 LIMIT 1;

-- name: ListPlayers :many
SELECT * FROM players
ORDER BY overall DESC
LIMIT $1 OFFSET $2;

-- name: SearchPlayers :many
SELECT * FROM players
WHERE short_name ILIKE $1 OR long_name ILIKE $1
ORDER BY overall DESC
LIMIT $2 OFFSET $3;

-- name: CreateUser :one
INSERT INTO users (username, email, password_hash)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: GetUserByUsername :one
SELECT * FROM users
WHERE username = $1 LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users
WHERE user_id = $1 LIMIT 1;

-- name: CreateSquad :one
INSERT INTO squad (user_id, squad_name, formation, budget_used)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetSquadByUserID :one
SELECT * FROM squad
WHERE user_id = $1 LIMIT 1;

-- name: UpdateSquadBudget :one
UPDATE squad
SET budget_used = $2
WHERE squad_id = $1
RETURNING *;

-- name: UpdateSquadFormation :one
UPDATE squad
SET formation = $2
WHERE squad_id = $1
RETURNING *;

-- name: CountPlayersInSquad :one
SELECT COUNT(*) FROM squad_player
WHERE squad_id = $1;

-- name: AddPlayerToSquad :exec
INSERT INTO squad_player (squad_id, player_id, position_slot)
VALUES ($1, $2, $3);

-- name: RemovePlayerFromSquad :exec
DELETE FROM squad_player
WHERE squad_id = $1 AND player_id = $2;

-- name: GetSquadPlayers :many
SELECT p.*, sp.position_slot
FROM players p
JOIN squad_player sp ON p.player_id = sp.player_id
WHERE sp.squad_id = $1;

-- name: CountPlayersFromNationInSquad :one
SELECT COUNT(*)
FROM players p
JOIN squad_player sp ON p.player_id = sp.player_id
WHERE sp.squad_id = $1 AND p.nationality_id = $2;

-- name: UpdatePointsForNation :exec
UPDATE squad s
SET total_points = total_points + ($1 * (
    SELECT COUNT(*) FROM squad_player sp
    JOIN players p ON sp.player_id = p.player_id
    WHERE sp.squad_id = s.squad_id AND p.nationality_id = $2
))
WHERE EXISTS (
    SELECT 1 FROM squad_player sp
    JOIN players p ON sp.player_id = p.player_id
    WHERE sp.squad_id = s.squad_id AND p.nationality_id = $2
);

-- name: GetLeaderboard :many
SELECT u.username, s.squad_name, s.total_points
FROM squad s
JOIN users u ON s.user_id = u.user_id
ORDER BY s.total_points DESC
LIMIT $1 OFFSET $2;
