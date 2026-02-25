-- Create storage bucket for media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 
  'chat-media', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Create policy for chat media uploads
CREATE POLICY "Anyone can upload chat media" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'chat-media');

-- Create policy for viewing chat media
CREATE POLICY "Anyone can view chat media" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-media');

-- Create policy for updating chat media
CREATE POLICY "Anyone can update chat media" ON storage.objects
FOR UPDATE USING (bucket_id = 'chat-media');

-- Create policy for deleting chat media
CREATE POLICY "Anyone can delete chat media" ON storage.objects
FOR DELETE USING (bucket_id = 'chat-media');