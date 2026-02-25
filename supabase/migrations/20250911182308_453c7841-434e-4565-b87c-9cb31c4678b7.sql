-- Ensure whatsapp-media bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('whatsapp-media', 'whatsapp-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/webm', 'application/pdf', 'application/octet-stream'])
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/webm', 'application/pdf', 'application/octet-stream'];

-- Ensure proper RLS policies for whatsapp-media bucket
CREATE POLICY IF NOT EXISTS "Public read access for whatsapp-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload to whatsapp-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Users can update their own files in whatsapp-media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Users can delete their own files in whatsapp-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');