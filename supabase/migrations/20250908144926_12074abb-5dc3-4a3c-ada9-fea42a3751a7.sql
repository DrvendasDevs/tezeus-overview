-- Allow 'update' and 'event' types in dashboard_cards
ALTER TABLE public.dashboard_cards DROP CONSTRAINT IF EXISTS dashboard_cards_type_check;
ALTER TABLE public.dashboard_cards ADD CONSTRAINT dashboard_cards_type_check CHECK (type IN ('announcement', 'update', 'event', 'promotion', 'feature'));