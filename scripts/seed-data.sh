#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "--- POBLANDO BASE DE DATOS (ADMIN + 10 USUARIOS) ---"

# 1. Cargar variables de entorno
if [ -f .env ]; then
    set -a
    source <(sed -e 's/\s*#.*$//' -e '/^$/d' .env)
    set +a
fi

# 2. Limpiar base de datos
echo "Limpiando base de datos..."
docker exec -i db-lab-postgres psql -U admin -d labdb <<EOF
TRUNCATE TABLE squad_player, squad, users RESTART IDENTITY CASCADE;
EOF

# 3. Registrar Administrador a través de la API
echo "Registrando administrador via API: $ADMIN_USERNAME..."
curl -s -X POST http://localhost:8080/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d "{\"username\": \"$ADMIN_USERNAME\", \"email\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}"
echo ""

# 4. Insertar usuarios y escuadras de prueba (Directo en DB para velocidad)
echo "Insertando usuarios y escuadras de prueba..."
docker exec -i db-lab-postgres psql -U admin -d labdb <<EOF
-- Usuarios de prueba
INSERT INTO users (username, email, password_hash)
SELECT 'user_' || i, 'user' || i || '@example.com', 'x'
FROM generate_series(1, 10) s(i);

-- Escuadras
INSERT INTO squad (user_id, squad_name, formation, total_points)
SELECT user_id, 'Squad de ' || username, '4-3-3', (random() * 100)::int
FROM users WHERE username != '$ADMIN_USERNAME';

-- Jugadores en escuadras
DO \$\$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT squad_id FROM squad LOOP
        INSERT INTO squad_player (squad_id, player_id, position_slot)
        SELECT r.squad_id, player_id, 'ANY' FROM players ORDER BY random() LIMIT 3;
    END LOOP;
END \$\$;
EOF

echo "Sincronizando Redis..."
docker restart fantasy-world-cup-api

echo "✅ Seeding completado."
