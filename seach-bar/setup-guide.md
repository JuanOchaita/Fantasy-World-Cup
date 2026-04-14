# Setup Guide - World Cup Search Bar Project

This guide provides the necessary commands to set up the infrastructure, populate the data, and run the three service endpoints.

---

## 1. Prerequisites
- Docker & Docker Compose installed.
- Go installed (for running the applications).

---

## 2. Infrastructure Setup (Docker)

Start all the required services (PostgreSQL, Elasticsearch, and Redis).

### Start PostgreSQL
```bash
cd database
docker compose up -d
```

### Start Elasticsearch
```bash
cd elasticsearch-search-bar
docker compose up -d
```

### Start Redis
```bash
cd redis-search-autocomplete
docker compose up -d
```

---

## 3. Database Population

### PostgreSQL (Initial Data)
Wait for the PostgreSQL container to be healthy, then run:
```bash
cd database
# Load schema
docker exec -i db-lab-postgres psql -U admin -d labdb < schema.sql
# Copy data files
docker cp import-data.sql db-lab-postgres:/import-data.sql
docker cp players.csv db-lab-postgres:/players.csv
# Import data
docker exec -i db-lab-postgres psql -U admin -d labdb < import-data.sql
```

### Elasticsearch Indexing
Run the indexer to move data from PostgreSQL to Elasticsearch:
```bash
cd elasticsearch-search-bar/index-players
# If go.mod.indexer exists, rename to go.mod or run directly
go run elasticsearch-indexer.go
```

### Redis Player Information Migration
Migrate full player details from PostgreSQL to Redis:
```bash
cd redis-players-information
go run migrate-players.go
```

### Redis Autocomplete Loading
Load the search prefixes into Redis for the autocomplete feature:
```bash
cd redis-search-autocomplete
go run redis-main.go
```

---

## 4. Running the Endpoints

Open three different terminals to run each service.

### Endpoint 1: Elasticsearch Search Service
- **Port:** 8083
- **Usage:** `GET http://localhost:8083/search/players?q=messi`
```bash
cd elasticsearch-search-bar/serach-bar
go run elasticsearch-search.go
```

### Endpoint 2: Redis Player Information Service
- **Port:** 8082
- **Usage:** `GET http://localhost:8082/player?name=158023` (uses Player ID)
```bash
cd redis-players-information
go run players-info.go
```

### Endpoint 3: Redis Autocomplete Service
- **Port:** 8081
- **Usage:** `GET http://localhost:8081/redis?key=mes`
```bash
cd redis-search-autocomplete
go run redis-search.go
```

---

## Summary of Ports
| Service | Port | Endpoint |
|---------|------|----------|
| Redis Autocomplete | 8081 | `/redis?key=...` |
| Redis Player Info | 8082 | `/player?name=...` |
| Elasticsearch Search | 8083 | `/search/players?q=...` |
| PostgreSQL | 5433 | DB |
| Elasticsearch | 9200 | Search Engine |
| Redis | 6379 | KV Store |
