-- RIWA POS Printer Configuration SQL Migration
-- Run this in Supabase SQL Editor

-- Drop existing tables if they have wrong schema
DROP TABLE IF EXISTS printer_configs CASCADE;
DROP TABLE IF EXISTS printer_queues CASCADE;

-- Create printer_configs table
CREATE TABLE printer_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45) NOT NULL,
    port INTEGER DEFAULT 9100,
    model VARCHAR(50) DEFAULT 'NT310',
    location VARCHAR(50) DEFAULT 'cashier',
    default_for_channel VARCHAR(20) DEFAULT 'pos',
    enabled BOOLEAN DEFAULT true,
    open_drawer_before BOOLEAN DEFAULT false,
    open_drawer_after BOOLEAN DEFAULT true,
    credentials_encrypted TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create printer_queues table for print jobs
CREATE TABLE printer_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID,
    printer_id UUID REFERENCES printer_configs(id),
    order_id UUID,
    print_type VARCHAR(50) DEFAULT 'receipt',
    open_drawer BOOLEAN DEFAULT false,
    receipt_data JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    printed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_printer_configs_tenant ON printer_configs(tenant_id);
CREATE INDEX idx_printer_configs_enabled ON printer_configs(tenant_id, enabled);
CREATE INDEX idx_printer_queues_status ON printer_queues(status);
CREATE INDEX idx_printer_queues_printer ON printer_queues(printer_id);
CREATE INDEX idx_printer_queues_order ON printer_queues(order_id);

-- Enable Row Level Security
ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE printer_queues ENABLE ROW LEVEL SECURITY;

-- Create policies for printer_configs
CREATE POLICY "Allow all operations for service role" ON printer_configs
    FOR ALL USING (true);

CREATE POLICY "Allow all operations for service role" ON printer_queues
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON printer_configs TO anon, authenticated, service_role;
GRANT ALL ON printer_queues TO anon, authenticated, service_role;

-- Success message
SELECT 'Printer tables created successfully!' as message;
