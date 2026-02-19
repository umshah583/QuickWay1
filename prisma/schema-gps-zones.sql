-- GPS-Based Zone Pricing System
-- PostgreSQL Schema with PostGIS Support

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;

-- ============================================================================
-- ZONES TABLE (Geo-fencing)
-- ============================================================================

CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL, -- e.g., AUH02, DXB01
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0, -- Higher priority wins in overlaps
    polygon GEOMETRY(POLYGON, 4326) NOT NULL, -- PostGIS polygon
    polygon_json JSONB, -- Fallback: array of {lat, lng} points
    area_sqm NUMERIC(15,2), -- Calculated area in square meters
    center_lat DECIMAL(10,8),
    center_lng DECIMAL(11,8),
    radius_meters INTEGER, -- For circle approximations
    metadata JSONB DEFAULT '{}', -- Additional zone info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID, -- Admin user ID
    updated_by UUID  -- Admin user ID
);

-- Indexes for zones
CREATE INDEX idx_zones_is_active ON zones(is_active);
CREATE INDEX idx_zones_code ON zones(code);
CREATE INDEX idx_zones_priority ON zones(priority DESC);
CREATE INDEX idx_zones_updated_at ON zones(updated_at DESC);

-- Spatial index for fast geo queries (most important!)
CREATE INDEX idx_zones_polygon ON zones USING GIST (polygon);

-- Partial index for active zones only
CREATE INDEX idx_zones_active_polygon ON zones USING GIST (polygon)
WHERE is_active = true;

-- ============================================================================
-- SERVICES TABLE
-- ============================================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., svc_basic, svc_premium
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- e.g., 'wash', 'detail', 'subscription'
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    estimated_duration_minutes INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Indexes for services
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_code ON services(code);
CREATE INDEX idx_services_category ON services(category);

-- ============================================================================
-- ZONE SERVICE PRICES TABLE
-- ============================================================================

CREATE TABLE zone_service_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    price INTEGER NOT NULL, -- Price in cents (e.g., 10000 = 100.00)
    currency_code VARCHAR(3) NOT NULL DEFAULT 'AED',
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    discount_percentage DECIMAL(5,2) DEFAULT 0, -- Optional discount
    min_order_value INTEGER, -- Minimum order value for this price
    max_order_value INTEGER, -- Maximum order value for this price
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    UNIQUE(zone_id, service_id, valid_from) -- Prevent duplicate active prices
);

-- Indexes for zone service prices (critical for performance)
CREATE INDEX idx_zone_service_prices_zone_id ON zone_service_prices(zone_id);
CREATE INDEX idx_zone_service_prices_service_id ON zone_service_prices(service_id);
CREATE INDEX idx_zone_service_prices_active ON zone_service_prices(is_active);
CREATE INDEX idx_zone_service_prices_validity ON zone_service_prices(valid_from, valid_to);
CREATE INDEX idx_zone_service_prices_zone_service_active ON zone_service_prices(zone_id, service_id, is_active);

-- Partial index for active prices with validity
CREATE INDEX idx_zone_service_prices_active_valid ON zone_service_prices(zone_id, service_id, is_active, valid_from, valid_to)
WHERE is_active = true;

-- ============================================================================
-- BASE SERVICE PRICES TABLE (Global Fallback)
-- ============================================================================

CREATE TABLE base_service_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    price INTEGER NOT NULL, -- Price in cents
    currency_code VARCHAR(3) NOT NULL DEFAULT 'AED',
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    UNIQUE(service_id, valid_from) -- Prevent duplicate active prices
);

-- Indexes for base service prices
CREATE INDEX idx_base_service_prices_service_id ON base_service_prices(service_id);
CREATE INDEX idx_base_service_prices_active ON base_service_prices(is_active);
CREATE INDEX idx_base_service_prices_validity ON base_service_prices(valid_from, valid_to);

-- ============================================================================
-- ZONE LOOKUP CACHE TABLE (Performance optimization)
-- ============================================================================

CREATE TABLE zone_lookup_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(50) NOT NULL UNIQUE, -- e.g., "24.4539_54.3773" (lat_lng rounded)
    zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'),
    hit_count INTEGER DEFAULT 1,
    UNIQUE(lat, lng) -- Prevent duplicate cache entries
);

-- Indexes for cache
CREATE INDEX idx_zone_lookup_cache_key ON zone_lookup_cache(cache_key);
CREATE INDEX idx_zone_lookup_cache_expires ON zone_lookup_cache(expires_at);
CREATE INDEX idx_zone_lookup_cache_zone_id ON zone_lookup_cache(zone_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_zone_service_prices_updated_at BEFORE UPDATE ON zone_service_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_base_service_prices_updated_at BEFORE UPDATE ON base_service_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate zone area and center
CREATE OR REPLACE FUNCTION calculate_zone_geometry()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate area in square meters
    NEW.area_sqm := ST_Area(ST_Transform(NEW.polygon, 3857));

    -- Calculate center point
    NEW.center_lat := ST_Y(ST_Centroid(NEW.polygon));
    NEW.center_lng := ST_X(ST_Centroid(NEW.polygon));

    -- Calculate approximate radius (for circle approximations)
    NEW.radius_meters := ROUND(ST_Distance(ST_Centroid(NEW.polygon), ST_PointN(ST_Boundary(NEW.polygon), 1)) * 111000); -- Rough conversion to meters

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-calculate zone geometry
CREATE TRIGGER calculate_zone_geometry_trigger BEFORE INSERT OR UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION calculate_zone_geometry();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_zone_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM zone_lookup_cache WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert sample services
INSERT INTO services (code, name, description, category, is_active, display_order, estimated_duration_minutes) VALUES
('svc_basic', 'Basic Wash', 'Exterior wash and dry', 'wash', true, 1, 30),
('svc_premium', 'Premium Wash', 'Interior and exterior detailing', 'wash', true, 2, 60),
('svc_deluxe', 'Deluxe Package', 'Full detailing with wax protection', 'detail', true, 3, 90);

-- Insert sample zones (you would replace with actual polygon data)
-- Example: Abu Dhabi Zone 1 - simplified polygon
INSERT INTO zones (code, name, description, is_active, priority, polygon, polygon_json) VALUES
('AUH01', 'Abu Dhabi Central', 'Central Abu Dhabi business district', true, 10,
 ST_GeomFromText('POLYGON((54.3667 24.4667, 54.3833 24.4667, 54.3833 24.4833, 54.3667 24.4833, 54.3667 24.4667))', 4326),
 '[{"lat": 24.4667, "lng": 54.3667}, {"lat": 24.4667, "lng": 54.3833}, {"lat": 24.4833, "lng": 54.3833}, {"lat": 24.4833, "lng": 54.3667}]'
);

-- Insert sample base prices
INSERT INTO base_service_prices (service_id, price, is_active) VALUES
((SELECT id FROM services WHERE code = 'svc_basic'), 12000, true), -- 120.00 AED
((SELECT id FROM services WHERE code = 'svc_premium'), 18000, true), -- 180.00 AED
((SELECT id FROM services WHERE code = 'svc_deluxe'), 25000, true); -- 250.00 AED

-- Insert sample zone-specific prices
INSERT INTO zone_service_prices (zone_id, service_id, price, is_active) VALUES
((SELECT id FROM zones WHERE code = 'AUH01'), (SELECT id FROM services WHERE code = 'svc_basic'), 10000, true), -- 100.00 AED
((SELECT id FROM zones WHERE code = 'AUH01'), (SELECT id FROM services WHERE code = 'svc_premium'), 15000, true); -- 150.00 AED
