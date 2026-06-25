-- PATH-WISE 城市知识库静态数据
CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  city_name VARCHAR(100) NOT NULL,
  province VARCHAR(100),
  level VARCHAR(20),
  tags TEXT[],
  intercity_transport JSONB,
  local_transport JSONB,
  accommodation JSONB,
  poilist JSONB,
  weather_pattern JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(city_name);
CREATE INDEX IF NOT EXISTS idx_cities_tags ON cities USING GIN(tags);
