-- Enable realtime for channels table
ALTER TABLE public.channels REPLICA IDENTITY FULL;

-- Add channels table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;