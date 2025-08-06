-- Continue with the team management setup

-- 5. Insert default system roles
INSERT INTO public.roles (name, description, permissions, is_system_role) VALUES
('Owner', 'Full access to all project features and settings', '{
  "projects": ["read", "write", "delete"],
  "tasks": ["read", "write", "delete"],
  "team": ["read", "write", "delete", "invite"],
  "settings": ["read", "write"],
  "audit_logs": ["read"]
}', true),
('Admin', 'Administrative access with team management capabilities', '{
  "projects": ["read", "write"],
  "tasks": ["read", "write", "delete"],
  "team": ["read", "write", "invite"],
  "settings": ["read"],
  "audit_logs": ["read"]
}', true),
('Manager', 'Project management with limited team access', '{
  "projects": ["read", "write"],
  "tasks": ["read", "write", "delete"],
  "team": ["read"],
  "settings": ["read"],
  "audit_logs": []
}', true),
('Member', 'Basic project access for task management', '{
  "projects": ["read"],
  "tasks": ["read", "write"],
  "team": ["read"],
  "settings": [],
  "audit_logs": []
}', true),
('Viewer', 'Read-only access to project and tasks', '{
  "projects": ["read"],
  "tasks": ["read"],
  "team": ["read"],
  "settings": [],
  "audit_logs": []
}', true);

-- 6. Enable RLS on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for roles
CREATE POLICY "Everyone can view system roles" 
ON public.roles 
FOR SELECT 
USING (is_system_role = true);

-- 8. Create RLS policies for team invitations
CREATE POLICY "Project members can view invitations" 
ON public.team_invitations 
FOR SELECT 
USING (public.is_project_member(project_id, auth.uid()));

-- 9. Create RLS policies for audit logs
CREATE POLICY "Project members can view audit logs with permission" 
ON public.audit_logs 
FOR SELECT 
USING (public.is_project_member(project_id, auth.uid()));