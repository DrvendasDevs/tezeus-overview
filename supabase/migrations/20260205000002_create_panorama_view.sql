-- View para acelerar o panorama (cards com joins básicos)
CREATE OR REPLACE VIEW public.v_panorama_cards AS
SELECT
  pc.id,
  pc.status,
  pc.created_at,
  pc.updated_at,
  pc.value,
  pc.qualification,
  pc.pipeline_id,
  pc.column_id,
  pc.responsible_user_id,
  pc.contact_id,
  p.workspace_id,
  CASE
    WHEN c.id IS NULL THEN NULL
    ELSE jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone)
  END AS contact,
  jsonb_build_object('id', p.id, 'name', p.name) AS pipelines,
  CASE
    WHEN col.id IS NULL THEN NULL
    ELSE jsonb_build_object('id', col.id, 'name', col.name)
  END AS pipeline_columns,
  CASE
    WHEN u.id IS NULL THEN NULL
    ELSE jsonb_build_object('id', u.id, 'name', u.name)
  END AS responsible_user
FROM public.pipeline_cards pc
JOIN public.pipelines p ON p.id = pc.pipeline_id
LEFT JOIN public.pipeline_columns col ON col.id = pc.column_id
LEFT JOIN public.contacts c ON c.id = pc.contact_id
LEFT JOIN public.system_users u ON u.id = pc.responsible_user_id;
