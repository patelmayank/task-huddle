-- Fix the reorder_task function to handle enum types properly
CREATE OR REPLACE FUNCTION public.reorder_task(
  p_task_id uuid,
  p_new_status task_status,  -- Use proper enum type
  p_target_index integer
) RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gap_size constant integer := 100;
  new_order_index integer;
  current_project_id uuid;
BEGIN
  -- Get the project_id for this task
  SELECT project_id INTO current_project_id 
  FROM public.tasks 
  WHERE id = p_task_id;
  
  IF current_project_id IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
  
  -- Calculate new order index with gaps
  IF p_target_index = 0 THEN
    -- Moving to first position
    SELECT COALESCE(MIN(order_index) - gap_size, gap_size) 
    INTO new_order_index
    FROM public.tasks 
    WHERE project_id = current_project_id
    AND status = p_new_status;
  ELSE
    -- Moving to specific position
    SELECT COALESCE(MAX(order_index) + gap_size, gap_size * (p_target_index + 1))
    INTO new_order_index
    FROM public.tasks 
    WHERE project_id = current_project_id
    AND status = p_new_status
    AND order_index <= p_target_index * gap_size;
  END IF;
  
  -- Ensure we have a valid order index
  IF new_order_index IS NULL OR new_order_index <= 0 THEN
    new_order_index := gap_size * (p_target_index + 1);
  END IF;
  
  -- Update the task
  UPDATE public.tasks 
  SET 
    status = p_new_status, 
    order_index = new_order_index,
    updated_at = now()
  WHERE id = p_task_id;
END;
$$;