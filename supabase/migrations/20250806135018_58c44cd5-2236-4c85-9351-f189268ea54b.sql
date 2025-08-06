-- Fix infinite recursion in project_members policies
-- Drop the problematic policy and recreate it properly
DROP POLICY IF EXISTS "Project admins can manage members" ON public.project_members;

-- Create a simpler policy that doesn't cause recursion
CREATE POLICY "Users can view members of their projects" 
ON public.project_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  )
);

CREATE POLICY "Project owners can manage members" 
ON public.project_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id AND p.owner_id = auth.uid()
  )
);

-- Also fix projects policy to be simpler
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;

CREATE POLICY "Users can view their own projects" 
ON public.projects 
FOR SELECT 
USING (auth.uid() = owner_id);