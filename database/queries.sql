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

-- name: UpdateSquadProfile :one
UPDATE squad
SET squad_name = $2,
    formation = $3
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

-- =========================================================
-- BEGIN FEATURE 4: Scoring, Leaderboard & Ranking support
-- =========================================================

-- Datos base para scoring
-- name: ListSquadsForScoring :many
SELECT squad_id, user_id, squad_name, total_points
FROM squad
ORDER BY squad_id ASC;

-- name: GetMatchByID :one
SELECT *
FROM matches
WHERE match_id = $1
LIMIT 1;

-- name: ListMatches :many
SELECT *
FROM matches
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- Escritura de resultados / scoring
-- name: CreateMatch :one
INSERT INTO matches (team_a, team_b, score_a, score_b)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CreateMatchUserPoints :one
INSERT INTO match_user_points (
    match_id,
    user_id,
    points_earned,
    total_points_after_match
)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CreateMatchUserPlayerPoints :one
INSERT INTO match_user_player_points (
    match_id,
    user_id,
    player_id,
    points_earned
)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: IncrementSquadTotalPoints :one
UPDATE squad
SET total_points = total_points + $2
WHERE squad_id = $1
RETURNING *;

-- Historial de puntos por usuario
-- name: GetUserScoringHistory :many
SELECT
    mup.match_user_points_id,
    mup.match_id,
    mup.user_id,
    mup.points_earned,
    mup.total_points_after_match,
    mup.created_at AS scored_at,
    m.team_a,
    m.team_b,
    m.score_a,
    m.score_b
FROM match_user_points mup
JOIN matches m ON m.match_id = mup.match_id
WHERE mup.user_id = $1
ORDER BY mup.created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetUserScoringHistoryByMatch :many
SELECT
    mpp.match_user_player_points_id,
    mpp.match_id,
    mpp.user_id,
    mpp.player_id,
    mpp.points_earned,
    mpp.created_at AS scored_at,
    p.short_name,
    p.long_name,
    p.nationality_name,
    p.player_face_url
FROM match_user_player_points mpp
JOIN players p ON p.player_id = mpp.player_id
WHERE mpp.user_id = $1 AND mpp.match_id = $2
ORDER BY mpp.points_earned DESC, p.short_name ASC;

-- Leaderboard / rank individual
-- name: GetUserTotalPoints :one
SELECT COALESCE(total_points, 0) AS total_points
FROM squad
WHERE user_id = $1
LIMIT 1;

-- name: GetUserLeaderboardPosition :one
SELECT
    1 + COUNT(s2.squad_id) AS rank,
    target.user_id,
    target.username,
    target.total_points
FROM (
    SELECT
        u.user_id,
        u.username,
        s.total_points,
        s.squad_id
    FROM squad s
    JOIN users u ON u.user_id = s.user_id
    WHERE u.user_id = $1
    LIMIT 1
) AS target
LEFT JOIN squad s2
    ON s2.total_points > target.total_points
    OR (
        s2.total_points = target.total_points
        AND s2.squad_id < target.squad_id
    )
GROUP BY target.user_id, target.username, target.total_points;

-- name: GetLeaderboardPage :many
SELECT
    ROW_NUMBER() OVER (ORDER BY s.total_points DESC, s.squad_id ASC) AS rank,
    u.user_id,
    u.username,
    s.total_points
FROM squad s
JOIN users u ON u.user_id = s.user_id
ORDER BY s.total_points DESC, s.squad_id ASC
LIMIT $1 OFFSET $2;

-- =========================================================
-- END FEATURE 4: Scoring, Leaderboard & Ranking support
-- =========================================================