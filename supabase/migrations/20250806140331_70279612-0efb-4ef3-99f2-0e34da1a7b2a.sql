-- Create clean, non-recursive RLS policies

-- PROJECTS TABLE POLICIES
CREATE POLICY "owners_can_view_projects" 
ON public.projects 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "authenticated_can_create_projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owners_can_update_projects" 
ON public.projects 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "owners_can_delete_projects" 
ON public.projects 
FOR DELETE 
USING (auth.uid() = owner_id);

-- PROJECT_MEMBERS TABLE POLICIES  
CREATE POLICY "owners_can_manage_members" 
ON public.project_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND owner_id = auth.uid()
  )
);

-- TASKS TABLE POLICIES (using security definer function - NO RECURSION)
CREATE POLICY "members_can_view_tasks" 
ON public.tasks 
FOR SELECT 
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "members_can_create_tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND 
  public.is_project_member(project_id, auth.uid())
);

CREATE POLICY "members_can_update_tasks" 
ON public.tasks 
FOR UPDATE 
USING (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "members_can_delete_tasks" 
ON public.tasks 
FOR DELETE 
USING (public.is_project_member(project_id, auth.uid()));