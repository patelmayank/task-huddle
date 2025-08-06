-- Completely remove the problematic project_members policies and recreate them more simply
DROP POLICY IF EXISTS "Users can view members of their projects" ON public.project_members;
DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;

-- Create much simpler policies that don't cause recursion
CREATE POLICY "All authenticated users can view project members" 
ON public.project_members 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Only project owners can manage members" 
ON public.project_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_members.project_id 
    AND projects.owner_id = auth.uid()
  )
);