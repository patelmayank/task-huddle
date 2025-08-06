import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuditLogEntry {
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
  success?: boolean;
}

export const useSecurityAudit = () => {
  const logSecurityEvent = useCallback(async (entry: AuditLogEntry) => {
    try {
      // Get user IP and user agent from browser (limited info for privacy)
      const userAgent = navigator.userAgent;
      
      await supabase
        .from('security_audit_logs')
        .insert({
          action: entry.action,
          resource_type: entry.resource_type,
          resource_id: entry.resource_id,
          user_agent: userAgent,
          success: entry.success ?? true,
          details: entry.details || {}
        });
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't throw error to avoid disrupting user flow
    }
  }, []);

  return { logSecurityEvent };
};