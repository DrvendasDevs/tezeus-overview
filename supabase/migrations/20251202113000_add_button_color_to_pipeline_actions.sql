-- Add support for storing custom colors in pipeline action buttons
ALTER TABLE pipeline_actions
ADD COLUMN IF NOT EXISTS button_color TEXT;

COMMENT ON COLUMN pipeline_actions.button_color IS 'Hex color (e.g. #F97316) applied to the action button in the pipeline UI';





























