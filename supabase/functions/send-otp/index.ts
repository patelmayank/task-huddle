
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendOTPRequest {
  email: string;
  purpose?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, purpose = 'signup' }: SendOTPRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Generate OTP using the database function
    const { data: otpData, error: otpError } = await supabase
      .rpc('generate_otp', { 
        p_email: email, 
        p_purpose: purpose 
      });

    if (otpError) {
      console.error('Error generating OTP:', otpError);
      return new Response(
        JSON.stringify({ error: otpError.message }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log('Generated OTP for email:', email, 'OTP:', otpData);

    // Create custom email HTML with OTP
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verification Code - TaskHuddle</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">TaskHuddle</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Collaborative Project Management</p>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h2 style="color: #1e293b; margin-top: 0;">Your Verification Code</h2>
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${purpose === 'signup' ? 'Welcome! Please use this code to verify your email and complete your account setup.' : 'Please use this code to verify your identity and sign in.'}
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: white; 
                          border: 2px solid #6366f1; 
                          border-radius: 8px; 
                          padding: 20px; 
                          display: inline-block;
                          font-size: 32px;
                          font-weight: bold;
                          letter-spacing: 8px;
                          color: #1e293b;
                          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.1);">
                ${otpData}
              </div>
            </div>
            
            <div style="background: #e2e8f0; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                <strong>Important:</strong><br>
                • This code will expire in 5 minutes<br>
                • Enter this code in the verification screen to continue<br>
                • Keep this code confidential and don't share it with anyone
              </p>
            </div>
          </div>
          
          <div style="text-align: center; color: #64748b; font-size: 14px;">
            <p>If you didn't request this code, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p>Powered by <strong>TaskHuddle</strong> - Collaborative Project Management</p>
          </div>
        </body>
      </html>
    `;

    // For now, we'll simulate sending the email by logging it
    // In production, you'd integrate with a service like Resend, SendGrid, etc.
    console.log('Email HTML that would be sent:', emailHtml);
    console.log('OTP Code that would be sent to', email, ':', otpData);

    // Since we can't actually send emails without an email service,
    // we'll return the OTP in the response for development purposes
    // In production, remove this and only return success/failure
    return new Response(
      JSON.stringify({ 
        message: 'OTP sent successfully',
        email: email,
        // Remove this in production - only for development testing
        otp: otpData,
        note: 'In development: OTP is returned in response. In production, this would be sent via email only.'
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error('Error in send-otp function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
};

serve(handler);
