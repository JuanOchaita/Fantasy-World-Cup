---

---
# Database Basic Documentation

### Players Table

Información general

- `player_id`: identificador único del jugador en la base de datos
- `player_url`: enlace externo con información adicional del jugador
- `fifa_version`: versión del videojuego FIFA / EA Sports FC correspondiente al registro
- `fifa_update`: número de actualización de datos del juego
- `fifa_update_date`: fecha de la actualización de datos
- `short_name`: nombre corto del jugador para mostrar en la UI
- `long_name`: nombre completo del jugador
- `player_positions`: posiciones principales y secundarias que puede desempeñar
- `age`: edad actual del jugador
- `dob`: fecha de nacimiento del jugador
- `height_cm`: altura del jugador en centímetros
- `weight_kg`: peso del jugador en kilogramos
- `nationality_id`: identificador del país del jugador
- `nationality_name`: país del jugador
- `preferred_foot`: pie dominante del jugador
- `weak_foot`: nivel de uso del pie débil (1 a 5 estrellas)
- `work_rate`: ritmo de trabajo ofensivo y defensivo del jugador
- `body_type`: tipo de cuerpo del jugador
- `real_face`: indica si el jugador tiene rostro escaneado real en el juego
- `player_tags`: etiquetas destacadas del jugador
- `player_traits`: rasgos especiales del jugador

Valoración del jugador

- `overall`: rating general del jugador
- `potential`: potencial máximo estimado del jugador
- `value_eur`: valor de mercado en euros
- `wage_eur`: salario semanal estimado del jugador
- `release_clause_eur`: cláusula de rescisión del jugador
- `skill_moves`: nivel de habilidades técnicas del jugador
- `international_reputation`: nivel de reputación internacional (estrellas)

Estadísticas generales

- `pace`: ritmo o velocidad del jugador
- `shooting`: capacidad de tiro y definición
- `passing`: calidad y precisión en los pases
- `dribbling`: habilidad de regate y control del balón
- `defending`: capacidad defensiva del jugador
- `physic`: fuerza física y resistencia

Estadísticas ofensivas

- `attacking_crossing`: precisión de centros
- `attacking_finishing`: capacidad de definición
- `attacking_heading_accuracy`: precisión de remate de cabeza
- `attacking_short_passing`: precisión de pase corto
- `attacking_volleys`: capacidad de remates de volea

Estadísticas técnicas

- `skill_dribbling`: nivel de regate técnico
- `skill_curve`: efecto en disparos y pases
- `skill_fk_accuracy`: precisión en tiros libres
- `skill_long_passing`: precisión de pase largo
- `skill_ball_control`: control de balón

Estadísticas de movimiento

- `movement_acceleration`: aceleración inicial
- `movement_sprint_speed`: velocidad máxima de sprint
- `movement_agility`: agilidad y cambios de dirección
- `movement_reactions`: capacidad de reacción
- `movement_balance`: equilibrio corporal

Estadísticas físicas

- `power_shot_power`: potencia de disparo
- `power_jumping`: capacidad de salto
- `power_stamina`: resistencia física
- `power_strength`: fuerza corporal
- `power_long_shots`: precisión de disparos lejanos

Estadísticas mentales

- `mentality_aggression`: agresividad competitiva
- `mentality_interceptions`: capacidad de interceptar balones
- `mentality_positioning`: posicionamiento ofensivo
- `mentality_vision`: visión de juego
- `mentality_penalties`: precisión en penales
- `mentality_composure`: compostura bajo presión

Estadísticas defensivas

- `defending_marking_awareness`: capacidad de marcaje
- `defending_standing_tackle`: entradas de pie
- `defending_sliding_tackle`: barridas defensivas

Estadísticas de portero

- `goalkeeping_diving`: reflejos en estiradas
- `goalkeeping_handling`: manejo de balón
- `goalkeeping_kicking`: precisión de despejes
- `goalkeeping_positioning`: colocación bajo palos
- `goalkeeping_reflexes`: reflejos rápidos
- `goalkeeping_speed`: velocidad del portero

Club Información

- `league_id`: identificador de la liga actual
- `league_name`: nombre de la liga actual
- `league_level`: nivel competitivo de la liga
- `club_team_id`: identificador del club actual
- `club_name`: nombre del club actual del jugador
- `club_position`: posición que ocupa el jugador en su club
- `club_jersey_number`: número de camiseta del jugador en el club
- `club_loaned_from`: club de origen si está cedido
- `club_joined_date`: fecha de incorporación al club
- `club_contract_valid_until_year`: año de finalización del contrato

Selección nacional

- `nation_team_id`: identificador de la selección nacional
- `nation_position`: posición del jugador en su selección
- `nation_jersey_number`: dorsal en selección nacional

Ratings por posición

- `ls`: rating del jugador como delantero izquierdo
- `st`: rating del jugador como delantero centro
- `rs`: rating del jugador como delantero derecho
- `lw`: rating del jugador como extremo izquierdo
- `lf`: rating del jugador como delantero interior izquierdo
- `cf`: rating del jugador como delantero centro retrasado
- `rf`: rating del jugador como delantero interior derecho
- `rw`: rating del jugador como extremo derecho
- `lam`: rating del jugador como mediapunta ofensivo izquierdo
- `cam`: rating del jugador como mediapunta central
- `ram`: rating del jugador como mediapunta ofensivo derecho
- `lm`: rating del jugador como volante izquierdo
- `lcm`: rating del jugador como mediocampista central izquierdo
- `cm`: rating del jugador como mediocampista central
- `rcm`: rating del jugador como mediocampista central derecho
- `rm`: rating del jugador como volante derecho
- `lwb`: rating del jugador como carrilero izquierdo
- `ldm`: rating del jugador como mediocentro defensivo izquierdo
- `cdm`: rating del jugador como mediocentro defensivo central
- `rdm`: rating del jugador como mediocentro defensivo derecho
- `rwb`: rating del jugador como carrilero derecho
- `lb`: rating del jugador como lateral izquierdo
- `lcb`: rating del jugador como defensa central izquierdo
- `cb`: rating del jugador como defensa central
- `rcb`: rating del jugador como defensa central derecho
- `rb`: rating del jugador como lateral derecho
- `gk`: rating del jugador como portero

Imágenes y links

- `player_face_url`: URL de la imagen del jugador

### Table user

- `id`: unique id for each user
- `username`: name of the user validacion backend y sql
- `email`: correo electronico validacion backend y sql
- `password_hash`: contraseña hash desde backend

### Table squad_player

- `squad_id`:
- `player_id`: 
- `position_slot`:

### Table squad 

- `squad_id`: 
- `user_id`:
- `squad_name`: 
- `formation`:
- `budget_used`:
- `total_points`:
