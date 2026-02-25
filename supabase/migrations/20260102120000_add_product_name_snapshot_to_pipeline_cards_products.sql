-- Add snapshot fields to preserve product info on deal-product links
-- This prevents reports/UI from showing only UUIDs when a product is deleted or renamed.

alter table public.pipeline_cards_products
add column if not exists product_name_snapshot text;

-- Backfill snapshot name for existing rows
update public.pipeline_cards_products pcp
set product_name_snapshot = p.name
from public.products p
where pcp.product_id = p.id
  and (pcp.product_name_snapshot is null or pcp.product_name_snapshot = '');


