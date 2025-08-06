-- COMPREHENSIVE TEAM MANAGEMENT SCHEMA

-- 1. Create roles table with granular permissions
CREATE TABLE public.roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create team invitations table
CREATE TABLE public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, email)
);

-- 3. Create audit log table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Update project_members table to include roles
ALTER TABLE public.project_members 
ADD COLUMN role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN permissions_override JSONB DEFAULT '{}',
ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE;

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

CREATE POLICY "Project owners can manage custom roles" 
ON public.roles 
FOR ALL 
USING (is_system_role = false AND auth.uid() IN (
  SELECT owner_id FROM public.projects WHERE id = ANY(
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
  )
));

-- 8. Create RLS policies for team invitations
CREATE POLICY "Project members can view invitations" 
ON public.team_invitations 
FOR SELECT 
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project admins can manage invitations" 
ON public.team_invitations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.project_members pm ON p.id = pm.project_id
    JOIN public.roles r ON pm.role_id = r.id
    WHERE p.id = project_id 
    AND pm.user_id = auth.uid()
    AND (p.owner_id = auth.uid() OR r.permissions->>'team' ? 'invite')
  )
);

-- 9. Create RLS policies for audit logs
CREATE POLICY "Project members can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (
  public.is_project_member(project_id, auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.project_members pm
    JOIN public.roles r ON pm.role_id = r.id
    WHERE pm.project_id = audit_logs.project_id 
    AND pm.user_id = auth.uid()
    AND r.permissions->>'audit_logs' ? 'read'
  )
);

-- 10. Create helper functions for permission checking
CREATE OR REPLACE FUNCTION public.has_permission(
  project_uuid UUID, 
  user_uuid UUID, 
  resource TEXT, 
  action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
  project_owner UUID;
BEGIN
  -- Check if user is project owner (always has all permissions)
  SELECT owner_id INTO project_owner 
  FROM public.projects 
  WHERE id = project_uuid;
  
  IF project_owner = user_uuid THEN
    RETURN TRUE;
  END IF;
  
  -- Get user's role permissions for this project
  SELECT COALESCE(pm.permissions_override, r.permissions, '{}') INTO user_permissions
  FROM public.project_members pm
  JOIN public.roles r ON pm.role_id = r.id
  WHERE pm.project_id = project_uuid 
  AND pm.user_id = user_uuid 
  AND pm.status = 'active';
  
  -- Check if user has the specific permission
  RETURN (user_permissions->resource ? action);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- 11. Create audit logging trigger function
CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip audit logging for audit_logs table itself
  IF TG_TABLE_NAME = 'audit_logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Log the change
  INSERT INTO public.audit_logs (
    project_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values
  ) VALUES (
    CASE 
      WHEN TG_TABLE_NAME = 'projects' THEN COALESCE(NEW.id, OLD.id)
      WHEN TG_TABLE_NAME = 'tasks' THEN COALESCE(NEW.project_id, OLD.project_id)
      WHEN TG_TABLE_NAME = 'project_members' THEN COALESCE(NEW.project_id, OLD.project_id)
      ELSE NULL
    END,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 12. Create audit triggers
CREATE TRIGGER audit_projects_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_tasks_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

CREATE TRIGGER audit_project_members_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_trail();

-- 13. Update existing project owners with Owner role
DO $$
DECLARE
  owner_role_id UUID;
  project_record RECORD;
BEGIN
  -- Get the Owner role ID
  SELECT id INTO owner_role_id FROM public.roles WHERE name = 'Owner';
  
  -- Create project_members entry for each project owner
  FOR project_record IN SELECT id, owner_id FROM public.projects
  LOOP
    INSERT INTO public.project_members (project_id, user_id, role_id, status, joined_at)
    VALUES (project_record.id, project_record.owner_id, owner_role_id, 'active', now())
    ON CONFLICT (project_id, user_id) DO UPDATE SET
      role_id = owner_role_id,
      status = 'active';
  END LOOP;
END $$;