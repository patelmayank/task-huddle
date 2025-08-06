import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TeamInvitationRequest {
  email: string;
  projectName: string;
  inviterName: string;
  roleName: string;
  invitationToken: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log(`[TeamInvitation] ${req.method} request received`);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      projectName, 
      inviterName, 
      roleName, 
      invitationToken,
      message 
    }: TeamInvitationRequest = await req.json();

    console.log(`[TeamInvitation] Sending invitation to ${email} for project ${projectName}`);

    const acceptUrl = `${req.headers.get('origin') || 'http://localhost:3000'}/auth?invite=${invitationToken}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Team Invitation - TaskHuddle</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">TaskHuddle</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Collaborative Project Management</p>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h2 style="color: #1e293b; margin-top: 0;">You're invited to join "${projectName}"!</h2>
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${inviterName}</strong> has invited you to collaborate on the project <strong>"${projectName}"</strong> as a <strong>${roleName}</strong>.
            </p>
            
            ${message ? `
              <div style="background: white; padding: 20px; border-left: 4px solid #6366f1; margin: 20px 0; border-radius: 5px;">
                <p style="margin: 0; font-style: italic;">"${message}"</p>
              </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" 
                 style="background: linear-gradient(135deg, #6366f1, #8b5cf6); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: bold; 
                        font-size: 16px;
                        display: inline-block;
                        box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);">
                Accept Invitation
              </a>
            </div>
            
            <div style="background: #e2e8f0; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                <strong>What happens next?</strong><br>
                Click the button above to create your account or sign in. You'll automatically be added to the project with ${roleName} permissions.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; color: #64748b; font-size: 14px;">
            <p>This invitation will expire in 7 days.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p>Powered by <strong>TaskHuddle</strong> - Collaborative Project Management</p>
          </div>
        </body>
      </html>
    `;

    const { data: emailResponse, error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        project_name: projectName,
        inviter_name: inviterName,
        role_name: roleName,
        invitation_token: invitationToken,
        message: message
      },
      redirectTo: acceptUrl
    });

    if (emailError) {
      console.error(`[TeamInvitation] Email error:`, emailError);
      throw emailError;
    }

    console.log(`[TeamInvitation] Email sent successfully:`, emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Invitation sent successfully",
      emailId: emailResponse.user?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error(`[TeamInvitation] Error:`, error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.name === 'Error' ? 'Email service error' : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);