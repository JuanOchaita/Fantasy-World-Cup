# Fantasy-World-Cup


docker compose down -v
docker compose up -d
docker exec -i db-lab-postgres psql -U admin -d labdb < schema.sql
docker cp ImportData.sql db-lab-postgres:/ImportData.sql
docker cp Players.csv db-lab-postgres:/Players.csv
docker exec -i db-lab-postgres \psql -U admin -d labdb < ImportData.sql

docker exec -it db-lab-postgres psql -U admin -d labdb
SELECT key AS atributo, value AS valor FROM players, LATERAL jsonb_each_text(to_jsonb(players)) WHERE player_id = 252371;

