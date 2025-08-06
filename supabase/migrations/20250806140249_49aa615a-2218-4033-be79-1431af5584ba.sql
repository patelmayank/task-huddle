-- COMPREHENSIVE FIX: Remove all recursive policies and implement clean, non-recursive alternatives

-- 1. Drop all existing problematic policies
DROP POLICY IF EXISTS "All authenticated users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Only project owners can manage members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Project members can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Task creators and project admins can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Task creators and project admins can delete tasks" ON public.tasks;

-- 2. Create a security definer function to check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(project_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is project owner
  IF EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_uuid AND owner_id = user_uuid
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is in project_members (when we implement team features)
  IF EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = project_uuid AND user_id = user_uuid
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- 3. Create simple, non-recursive policies for projects
CREATE POLICY "Users can view their own projects" 
ON public.projects 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Project owners can update their projects" 
ON public.projects 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Project owners can delete their projects" 
ON public.projects 
FOR DELETE 
USING (auth.uid() = owner_id);

-- 4. Create simple policies for project_members (no recursion)
CREATE POLICY "Project owners can manage members" 
ON public.project_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND owner_id = auth.uid()
  )
);

-- 5. Create clean task policies using the security definer function
CREATE POLICY "Project members can view tasks" 
ON public.tasks 
FOR SELECT 
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members can create tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND 
  public.is_project_member(project_id, auth.uid())
);

CREATE POLICY "Task creators and project members can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  auth.uid() = created_by OR 
  public.is_project_member(project_id, auth.uid())
);

CREATE POLICY "Task creators and project members can delete tasks" 
ON public.tasks 
FOR DELETE 
USING (
  auth.uid() = created_by OR 
  public.is_project_member(project_id, auth.uid())
);