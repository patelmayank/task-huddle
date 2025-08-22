-- Fix Bug #13: Task Access Broken
-- Allow project members to view and manage tasks in their projects
DROP POLICY IF EXISTS "Users can view project tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in own projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in own projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks in own projects" ON public.tasks;

-- Create helper function to check if user is member of project
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id AND owner_id = _user_id
  );
$$;

-- New task policies allowing members to access tasks
CREATE POLICY "Members can view project tasks" 
ON public.tasks FOR SELECT 
USING (public.is_project_member(project_id));

CREATE POLICY "Members can create tasks in projects" 
ON public.tasks FOR INSERT 
WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "Members can update tasks in projects" 
ON public.tasks FOR UPDATE 
USING (public.is_project_member(project_id));

CREATE POLICY "Members can delete tasks in projects" 
ON public.tasks FOR DELETE 
USING (public.is_project_member(project_id));

-- Fix Bug #14: Team Member Access Issue
-- Allow project members to view other members in the same project
DROP POLICY IF EXISTS "Project owners can view members" ON public.project_members;
CREATE POLICY "Project members can view other members" 
ON public.project_members FOR SELECT 
USING (public.is_project_member(project_id));

-- Fix Bug #15: Email Harvesting Vulnerability
-- Secure team invitations table with proper RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invitations they sent" ON public.team_invitations;
DROP POLICY IF EXISTS "Users can create invitations for own projects" ON public.team_invitations;

CREATE POLICY "Project owners can manage invitations" 
ON public.team_invitations FOR ALL 
USING (public.is_project_member(project_id));

CREATE POLICY "Project members can view invitations" 
ON public.team_invitations FOR SELECT 
USING (public.is_project_member(project_id));