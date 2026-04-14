#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "--- POBLANDO BASE DE DATOS (SEEDING) ---"

# Cargar variables de entorno de forma robusta
if [ -f .env ]; then
    set -a
    # Sed elimina comentarios al final de la linea y lineas vacias antes de hacer el source
    source <(sed -e 's/\s*#.*$//' -e '/^$/d' .env)
    set +a
fi

# Verificar variables criticas
if [ -z "$ADMIN_USERNAME" ]; then
    echo "Error: ADMIN_USERNAME no está definido en el .env"
    exit 1
fi

# 1. Crear el usuario Administrador
echo "Creando usuario administrador: $ADMIN_USERNAME..."
docker exec -i db-lab-postgres psql -U admin -d labdb -c "
INSERT INTO users (username, email, password_hash) 
VALUES ('$ADMIN_USERNAME', '$ADMIN_EMAIL', 'admin_hash_placeholder')
ON CONFLICT (username) DO NOTHING;"

# 2. Insertar usuarios y escuadras de prueba
echo "Insertando usuarios y escuadras de prueba..."
docker exec -i db-lab-postgres psql -U admin -d labdb <<EOF
-- Limpiar datos previos
TRUNCATE TABLE squad_player, squad, users RESTART IDENTITY CASCADE;

-- Re-insertar Admin
INSERT INTO users (username, email, password_hash) VALUES ('$ADMIN_USERNAME', '$ADMIN_EMAIL', 'x');

-- Usuarios de prueba
INSERT INTO users (username, email, password_hash) VALUES 
('user1', 'user1@test.com', 'x'),
('user2', 'user2@test.com', 'x'),
('user3', 'user3@test.com', 'x');

-- Escuadras
INSERT INTO squad (user_id, squad_name, formation, total_points) VALUES 
(2, 'Brasil Squad', '4-3-3', 10),
(3, 'Argentina Squad', '4-4-2', 15),
(4, 'Germany Squad', '3-5-2', 5);

-- Asignar algunos jugadores a Brasil (ID nacion 54)
INSERT INTO squad_player (squad_id, player_id, position_slot)
SELECT 1, player_id, 'ST' FROM players WHERE nationality_id = 54 LIMIT 3;
EOF

# 3. Sincronizar Redis
echo "Sincronizando ranking en Redis..."
docker restart fantasy-world-cup-api

echo "Seeding completado."
