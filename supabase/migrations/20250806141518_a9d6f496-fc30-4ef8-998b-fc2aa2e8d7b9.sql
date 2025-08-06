-- Add INSERT policy for team invitations
CREATE POLICY "Project owners can create invitations" 
ON public.team_invitations 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_id AND owner_id = auth.uid()
  )
);