-- Delete queues that reference non-existent workspaces
DELETE FROM queues 
WHERE workspace_id NOT IN (SELECT id FROM workspaces);

-- Add foreign key constraint from queues to workspaces
ALTER TABLE queues 
ADD CONSTRAINT queues_workspace_id_fkey 
FOREIGN KEY (workspace_id) 
REFERENCES workspaces(id) 
ON DELETE CASCADE;