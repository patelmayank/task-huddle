-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.reorder_task(
  p_task_id uuid,
  p_new_status text,
  p_target_index integer
) RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;