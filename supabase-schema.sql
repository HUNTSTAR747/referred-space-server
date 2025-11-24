-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stores table (e.g., gymshark.com, fashionnova.com)
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT UNIQUE NOT NULL,
  name TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creators table (Instagram influencers)
CREATE TABLE creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_id TEXT UNIQUE,
  instagram_handle TEXT UNIQUE,
  access_token TEXT,
  follower_count INTEGER,
  bio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discount codes table
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT, -- 'percentage', 'fixed', 'unknown'
  discount_value NUMERIC,
  is_verified BOOLEAN DEFAULT FALSE,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  last_tested TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, code)
);

-- Link table: which creators own which codes
CREATE TABLE creator_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  code_id UUID REFERENCES discount_codes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(creator_id, code_id)
);

-- User favorites (optional - for regular users to save codes)
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code_id UUID REFERENCES discount_codes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, code_id)
);

-- Code usage analytics
CREATE TABLE code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_id UUID REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL,
  savings_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_stores_domain ON stores(domain);
CREATE INDEX idx_creators_instagram_id ON creators(instagram_id);
CREATE INDEX idx_creators_user_id ON creators(user_id);
CREATE INDEX idx_codes_store_id ON discount_codes(store_id);
CREATE INDEX idx_codes_code ON discount_codes(code);
CREATE INDEX idx_creator_codes_creator ON creator_codes(creator_id);
CREATE INDEX idx_creator_codes_code ON creator_codes(code_id);
CREATE INDEX idx_usage_code_id ON code_usage(code_id);

-- Enable Row Level Security
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Stores: publicly readable
CREATE POLICY "Stores are publicly readable"
  ON stores FOR SELECT
  USING (true);

-- Creators: publicly readable
CREATE POLICY "Creators are publicly readable"
  ON creators FOR SELECT
  USING (true);

-- Creators: users can update their own profile
CREATE POLICY "Users can update own creator profile"
  ON creators FOR UPDATE
  USING (auth.uid() = user_id);

-- Discount codes: publicly readable
CREATE POLICY "Codes are publicly readable"
  ON discount_codes FOR SELECT
  USING (true);

-- Creator codes: publicly readable
CREATE POLICY "Creator codes are publicly readable"
  ON creator_codes FOR SELECT
  USING (true);

-- User favorites: users can manage their own
CREATE POLICY "Users can manage own favorites"
  ON user_favorites FOR ALL
  USING (auth.uid() = user_id);

-- Code usage: anyone can insert (for analytics)
CREATE POLICY "Anyone can report usage"
  ON code_usage FOR INSERT
  WITH CHECK (true);

-- Code usage: publicly readable
CREATE POLICY "Usage stats are publicly readable"
  ON code_usage FOR SELECT
  USING (true);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON creators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();