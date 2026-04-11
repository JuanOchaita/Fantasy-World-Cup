
-- PostgreSQL schema for Fantasy Football Application

DROP TABLE IF EXISTS players;

CREATE TABLE players (
    player_id INT PRIMARY KEY,
    player_url VARCHAR(255),
    fifa_version SMALLINT,
    fifa_update SMALLINT,
    fifa_update_date DATE,
    short_name VARCHAR(100),
    long_name VARCHAR(150),
    player_positions VARCHAR(50),
    overall SMALLINT,
    potential SMALLINT,
    value_eur BIGINT,
    wage_eur INT,
    age SMALLINT,
    dob DATE,
    height_cm SMALLINT,
    weight_kg SMALLINT,
    league_id INT,
    league_name VARCHAR(100),
    league_level SMALLINT,
    club_team_id INT,
    club_name VARCHAR(100),
    club_position VARCHAR(10),
    club_jersey_number SMALLINT,
    club_loaned_from VARCHAR(100),
    club_joined_date DATE,
    club_contract_valid_until_year SMALLINT,
    nationality_id INT,
    nationality_name VARCHAR(100),
    nation_team_id INT,
    nation_position VARCHAR(10),
    nation_jersey_number SMALLINT,
    preferred_foot VARCHAR(10),
    weak_foot SMALLINT,
    skill_moves SMALLINT,
    international_reputation SMALLINT,
    work_rate VARCHAR(50),
    body_type VARCHAR(50),
    real_face BOOLEAN,
    release_clause_eur BIGINT,
    player_tags TEXT,
    player_traits TEXT,
    pace SMALLINT,
    shooting SMALLINT,
    passing SMALLINT,
    dribbling SMALLINT,
    defending SMALLINT,
    physic SMALLINT,
    attacking_crossing SMALLINT,
    attacking_finishing SMALLINT,
    attacking_heading_accuracy SMALLINT,
    attacking_short_passing SMALLINT,
    attacking_volleys SMALLINT,
    skill_dribbling SMALLINT,
    skill_curve SMALLINT,
    skill_fk_accuracy SMALLINT,
    skill_long_passing SMALLINT,
    skill_ball_control SMALLINT,
    movement_acceleration SMALLINT,
    movement_sprint_speed SMALLINT,
    movement_agility SMALLINT,
    movement_reactions SMALLINT,
    movement_balance SMALLINT,
    power_shot_power SMALLINT,
    power_jumping SMALLINT,
    power_stamina SMALLINT,
    power_strength SMALLINT,
    power_long_shots SMALLINT,
    mentality_aggression SMALLINT,
    mentality_interceptions SMALLINT,
    mentality_positioning SMALLINT,
    mentality_vision SMALLINT,
    mentality_penalties SMALLINT,
    mentality_composure SMALLINT,
    defending_marking_awareness SMALLINT,
    defending_standing_tackle SMALLINT,
    defending_sliding_tackle SMALLINT,
    goalkeeping_diving SMALLINT,
    goalkeeping_handling SMALLINT,
    goalkeeping_kicking SMALLINT,
    goalkeeping_positioning SMALLINT,
    goalkeeping_reflexes SMALLINT,
    goalkeeping_speed SMALLINT,
    ls VARCHAR(10),
    st VARCHAR(10),
    rs VARCHAR(10),
    lw VARCHAR(10),
    lf VARCHAR(10),
    cf VARCHAR(10),
    rf VARCHAR(10),
    rw VARCHAR(10),
    lam VARCHAR(10),
    cam VARCHAR(10),
    ram VARCHAR(10),
    lm VARCHAR(10),
    lcm VARCHAR(10),
    cm VARCHAR(10),
    rcm VARCHAR(10),
    rm VARCHAR(10),
    lwb VARCHAR(10),
    ldm VARCHAR(10),
    cdm VARCHAR(10),
    rdm VARCHAR(10),
    rwb VARCHAR(10),
    lb VARCHAR(10),
    lcb VARCHAR(10),
    cb VARCHAR(10),
    rcb VARCHAR(10),
    rb VARCHAR(10),
    gk VARCHAR(10),
    player_face_url VARCHAR(255)
);

CREATE TABLE users (

    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL

);

CREATE TABLE squad (

    squad_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id),
    squad_name VARCHAR(50) NOT NULL,
    formation VARCHAR(10),
    budget_used BIGINT DEFAULT 0 CHECK (budget_used >= 0),
    total_points INT DEFAULT 0 CHECK (total_points >= 0)

);

CREATE TABLE squad_player (

    squad_id INT NOT NULL REFERENCES squad(squad_id),
    player_id INT NOT NULL REFERENCES players(player_id),
    position_slot VARCHAR(5),
    PRIMARY KEY (squad_id, player_id)

);

ALTER TABLE squad
ADD CONSTRAINT fk_squad_user FOREIGN KEY (user_id) REFERENCES users(user_id);

ALTER TABLE squad_player
ADD CONSTRAINT fk_squadplayer_squad FOREIGN KEY (squad_id) REFERENCES squad(squad_id);

ALTER TABLE squad_player
ADD CONSTRAINT fk_squadplayer_player FOREIGN KEY (player_id) REFERENCES players(player_id);

ALTER TABLE squad_player
ADD CONSTRAINT unique_squad_player UNIQUE (squad_id, player_id);
