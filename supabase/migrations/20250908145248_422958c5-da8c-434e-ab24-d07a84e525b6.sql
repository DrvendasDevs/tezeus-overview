-- First, update any existing incompatible types to valid ones
UPDATE public.dashboard_cards 
SET type = CASE 
  WHEN type NOT IN ('announcement', 'update', 'event', 'promotion', 'feature') THEN 'announcement'
  ELSE type 
END;

-- Now safely add the constraint with all needed types
ALTER TABLE public.dashboard_cards DROP CONSTRAINT IF EXISTS dashboard_cards_type_check;
ALTER TABLE public.dashboard_cards ADD CONSTRAINT dashboard_cards_type_check CHECK (type IN ('announcement', 'update', 'event', 'promotion', 'feature'));