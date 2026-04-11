---
---

This guide explains how to initialize and run the PostgreSQL database using Docker, load the schema, import data, and run a test query.

---
### Prerequisites  
  
- Docker installed  
- Docker Compose installed  
- Project files:  
	- `schema.sql`  
	- `ImportData.sql`  
	- `Players.csv`

---
### Instructions  

 1. Remove the Database: Stop and remove existing containers and volumes:  
  
```bash  
docker compose down -v
```

2. Start the database container in detached mode:

```bash
docker compose up -d
```

 3. Load Database Schema: Execute the schema file inside the PostgreSQL container:

```bash
docker exec -i db-lab-postgres psql -U admin -d labdb < schema.sql
```

4. Copy Data Files into Container

```bash
docker cp import-data.sql db-lab-postgres:/import-data.sql
```

```bash
docker cp players.csv db-lab-postgres:/players.csv
```

 5. Import Data: Run the import script inside the container:

```bash
docker exec -i db-lab-postgres psql -U admin -d labdb < import-data.sql
```

6. Access the Database: Open an interactive PostgreSQL session:

```bash
docker exec -it db-lab-postgres psql -U admin -d labdb
```

 7. Test Query

```sql
SELECT key, value  
FROM players,  
LATERAL jsonb_each_text(to_jsonb(players))  
WHERE player_id = 158023;
```
