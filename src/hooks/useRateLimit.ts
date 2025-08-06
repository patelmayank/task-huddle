import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RateLimitConfig {
  maxAttempts: number;
  windowMinutes: number;
  action: string;
}

export const useRateLimit = (config: RateLimitConfig) => {
  const [isBlocked, setIsBlocked] = useState(false);

  const checkRateLimit = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - config.windowMinutes);

      // Check current rate limit
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return true; // Allow if not authenticated
      
      const { data: rateLimits, error } = await supabase
        .from('invitation_rate_limits')
        .select('invitation_count')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .gte('window_start', windowStart.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Rate limit check error:', error);
        return true; // Allow on error to avoid blocking legitimate users
      }

      const currentCount = rateLimits?.invitation_count || 0;
      
      if (currentCount >= config.maxAttempts) {
        setIsBlocked(true);
        toast.error(`Rate limit exceeded. Please wait ${config.windowMinutes} minutes before sending more ${config.action}s.`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow on error
    }
  }, [config]);

  const recordAttempt = useCallback(async (projectId: string): Promise<void> => {
    try {
      const windowStart = new Date();
      windowStart.setMinutes(windowStart.getMinutes() - config.windowMinutes);

      // Check if there's an existing record in the current window
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: existing } = await supabase
        .from('invitation_rate_limits')
        .select('id, invitation_count')
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .gte('window_start', windowStart.toISOString())
        .single();

      if (existing) {
        // Update existing record
        await supabase
          .from('invitation_rate_limits')
          .update({ invitation_count: existing.invitation_count + 1 })
          .eq('id', existing.id);
      } else {
        // Create new record
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('invitation_rate_limits')
            .insert({
              user_id: user.id,
              project_id: projectId,
              invitation_count: 1,
              window_start: new Date().toISOString()
            });
        }
      }
    } catch (error) {
      console.error('Failed to record rate limit attempt:', error);
    }
  }, [config]);

  const resetBlock = useCallback(() => {
    setIsBlocked(false);
  }, []);

  return {
    isBlocked,
    checkRateLimit,
    recordAttempt,
    resetBlock
  };
};