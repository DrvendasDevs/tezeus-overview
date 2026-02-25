-- Ensure whatsapp-media bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('whatsapp-media', 'whatsapp-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/webm', 'application/pdf', 'application/octet-stream'])
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/webm', 'application/pdf', 'application/octet-stream'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for whatsapp-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to whatsapp-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files in whatsapp-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files in whatsapp-media" ON storage.objects;

-- Create RLS policies for whatsapp-media bucket
CREATE POLICY "Public read access for whatsapp-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated users can upload to whatsapp-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own files in whatsapp-media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own files in whatsapp-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');