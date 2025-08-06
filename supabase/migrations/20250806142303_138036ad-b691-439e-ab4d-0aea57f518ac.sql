-- CRITICAL SECURITY FIX: Remove overly permissive profile access policy
-- This policy currently allows any authenticated user to view ALL user profiles including emails
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create secure, context-aware policies for profile access
-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Project members can view profiles of other members in their projects
CREATE POLICY "Project members can view member profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = auth.uid() 
    AND pm2.user_id = profiles.user_id
    AND pm1.status = 'active'
    AND pm2.status = 'active'
  )
);

-- Policy 3: Allow viewing profiles for pending team invitations (for invitation context)
CREATE POLICY "Inviter can view invitee profile context" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.team_invitations ti
    JOIN public.projects p ON ti.project_id = p.id
    WHERE p.owner_id = auth.uid()
    AND profiles.email = ti.email
    AND ti.status = 'pending'
  )
);

-- Add input validation and security enhancements for team invitations
-- Add email format validation constraint
ALTER TABLE public.team_invitations 
ADD CONSTRAINT valid_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add rate limiting table for invitation sending
CREATE TABLE IF NOT EXISTS public.invitation_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  invitation_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on rate limiting table
ALTER TABLE public.invitation_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy for rate limiting table
CREATE POLICY "Users can manage their own rate limits" 
ON public.invitation_rate_limits 
FOR ALL 
USING (auth.uid() = user_id);

-- Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy for audit logs (only project owners can view logs for their projects)
CREATE POLICY "Project owners can view security audit logs" 
ON public.security_audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.owner_id = auth.uid()
    AND (
      security_audit_logs.resource_id = p.id 
      OR security_audit_logs.user_id = auth.uid()
    )
  )
);