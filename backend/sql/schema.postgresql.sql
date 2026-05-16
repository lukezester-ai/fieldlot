-- FIELDLOT PostgreSQL schema (production)
-- Run on Supabase / Railway / self-hosted Postgres

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	name TEXT NOT NULL,
	email TEXT UNIQUE NOT NULL,
	password_hash TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'farmer',
	country TEXT DEFAULT 'BG',
	phone TEXT,
	profile_image TEXT,
	verified BOOLEAN DEFAULT FALSE,
	trust_score DOUBLE PRECISION DEFAULT 4.5,
	successful_deals INTEGER DEFAULT 0,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	description TEXT,
	category TEXT NOT NULL,
	price NUMERIC,
	quantity NUMERIC,
	unit TEXT DEFAULT 'kg',
	region TEXT,
	images JSONB DEFAULT '[]',
	videos JSONB DEFAULT '[]',
	certifications JSONB DEFAULT '[]',
	blockchain_trace JSONB,
	ai_rank_score DOUBLE PRECISION DEFAULT 0,
	status TEXT DEFAULT 'active',
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	buyer_id UUID NOT NULL REFERENCES users(id),
	product_id UUID NOT NULL REFERENCES products(id),
	quantity NUMERIC NOT NULL,
	total_price NUMERIC,
	status TEXT DEFAULT 'pending',
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logistics (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	driver_name TEXT,
	vehicle_type TEXT,
	tracking_code TEXT UNIQUE,
	delivery_status TEXT DEFAULT 'requested',
	location TEXT,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	sender_id UUID NOT NULL REFERENCES users(id),
	receiver_id UUID NOT NULL REFERENCES users(id),
	message TEXT NOT NULL,
	attachment TEXT,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_analytics (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id),
	field_name TEXT,
	humidity NUMERIC,
	temperature NUMERIC,
	risk_level TEXT,
	ai_prediction TEXT,
	satellite_data JSONB,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_forecasts (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	commodity TEXT NOT NULL,
	current_price NUMERIC NOT NULL,
	forecast_price NUMERIC NOT NULL,
	horizon_months INTEGER DEFAULT 2,
	change_probability NUMERIC,
	trend TEXT,
	notes TEXT,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_requests (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID REFERENCES users(id),
	country TEXT NOT NULL,
	product_name TEXT NOT NULL,
	requested_quantity NUMERIC NOT NULL,
	price_offer NUMERIC,
	certification TEXT,
	status TEXT DEFAULT 'open',
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id),
	name TEXT NOT NULL,
	location TEXT,
	temperature_c NUMERIC,
	capacity_tons NUMERIC,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_inventory (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
	product_name TEXT NOT NULL,
	quantity NUMERIC NOT NULL,
	unit TEXT DEFAULT 't',
	expires_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id UUID NOT NULL REFERENCES users(id),
	doc_type TEXT NOT NULL,
	title TEXT NOT NULL,
	payload JSONB DEFAULT '{}',
	file_url TEXT,
	created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_prices (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	commodity TEXT UNIQUE NOT NULL,
	price NUMERIC NOT NULL,
	unit TEXT DEFAULT 'лв/тон',
	change_pct NUMERIC DEFAULT 0,
	updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chats_users ON chats(sender_id, receiver_id);
