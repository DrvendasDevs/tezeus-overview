-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true);

-- Create policies for WhatsApp media bucket
CREATE POLICY "WhatsApp media is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "System can upload WhatsApp media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'whatsapp-media');