-- Bug #3: Add order_index for proper drag & drop ordering
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_order ON public.tasks(project_id, status, order_index);

-- Bug #4: Fix role escalation - prevent direct role updates
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;

-- Only allow project owners to manage members
CREATE POLICY "Project owners can manage project members"
ON public.project_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = project_members.project_id 
    AND owner_id = auth.uid()
  )
);

-- Bug #8: Admin delete policies - allow admins to delete tasks
DROP POLICY IF EXISTS "Members can delete tasks in projects" ON public.tasks;
CREATE POLICY "Members and admins can delete tasks in projects" 
ON public.tasks FOR DELETE 
USING (
  public.is_project_member(project_id) OR
  EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = tasks.project_id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Bug #12: Add updated_at trigger for tasks
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to tasks table
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger to projects table  
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Bug #6: Add table for idempotency tracking
CREATE TABLE IF NOT EXISTS public.request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on request_logs
ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own request logs"
ON public.request_logs FOR ALL
USING (auth.uid() = user_id);

-- Create function for reordering tasks with gap-based indexing
CREATE OR REPLACE FUNCTION public.reorder_task(
  p_task_id uuid,
  p_new_status text,
  p_target_index integer
) RETURNS void AS $$
DECLARE
  gap_size constant integer := 100;
  new_order_index integer;
BEGIN
  -- Calculate new order index with gaps
  IF p_target_index = 0 THEN
    -- Moving to first position
    SELECT COALESCE(MIN(order_index) - gap_size, gap_size) 
    INTO new_order_index
    FROM public.tasks 
    WHERE project_id = (SELECT project_id FROM public.tasks WHERE id = p_task_id)
    AND status = p_new_status;
  ELSE
    -- Moving to specific position
    SELECT COALESCE(MAX(order_index) + gap_size, gap_size * p_target_index)
    INTO new_order_index
    FROM public.tasks 
    WHERE project_id = (SELECT project_id FROM public.tasks WHERE id = p_task_id)
    AND status = p_new_status
    AND order_index <= p_target_index * gap_size;
  END IF;
  
  -- Update the task
  UPDATE public.tasks 
  SET status = p_new_status, order_index = new_order_index
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;