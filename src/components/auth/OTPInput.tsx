import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Clock, Shield } from 'lucide-react';

interface OTPInputProps {
  email: string;
  purpose: 'signup' | 'login';
  onBack: () => void;
  onVerificationComplete: () => void;
}

export default function OTPInput({ 
  email, 
  purpose,
  onBack, 
  onVerificationComplete 
}: OTPInputProps) {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-verify when OTP is complete
  useEffect(() => {
    if (otp.length === 6) {
      handleVerifyOTP();
    }
  }, [otp]);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('verify_otp', {
          p_email: email,
          p_code: otp,
          p_purpose: purpose
        });

      if (error || !data) {
        toast({
          title: "Invalid or expired OTP",
          description: "Please check your code and try again.",
          variant: "destructive",
        });
        setOtp(''); // Clear the OTP input
      } else {
        toast({
          title: "Verification successful!",
          description: "Your account has been verified.",
        });
        onVerificationComplete();
      }
    } catch (error) {
      toast({
        title: "Verification failed",
        description: "Please try again or request a new OTP.",
        variant: "destructive",
      });
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0 || resendCount >= 3) return;
    
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('send-otp', {
        body: { email, purpose }
      });

      if (response.error) {
        toast({
          title: "Failed to resend OTP",
          description: response.error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "OTP sent!",
          description: "Please check your email for the new verification code.",
        });
        setCountdown(30);
        setResendCount(prev => prev + 1);
        setOtp('');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-8 animate-fade-in">
      <Card className="w-full max-w-md shadow-elegant border-0 bg-gradient-card">
        <CardHeader className="text-center">
          <div className="mb-4 animate-scale-in">
            <div className="bg-primary/10 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Shield className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Enter verification code
          </CardTitle>
          <CardDescription className="text-base">
            We've sent a 6-digit code to{' '}
            <span className="font-medium text-foreground">{email}</span>.
            Enter it below to continue.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              value={otp}
              onChange={setOtp}
              maxLength={6}
              disabled={isLoading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {otp.length === 6 && isLoading && (
            <div className="text-center text-sm text-muted-foreground">
              Verifying code...
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={handleResendOTP}
              disabled={isLoading || countdown > 0 || resendCount >= 3}
              variant="outline"
              className="w-full"
            >
              {countdown > 0 ? (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Resend in {countdown}s
                </div>
              ) : resendCount >= 3 ? (
                "Max resend attempts reached"
              ) : (
                "Resend OTP"
              )}
            </Button>

            {resendCount > 0 && resendCount < 3 && (
              <div className="text-center text-sm text-muted-foreground">
                {3 - resendCount} resend attempts remaining
              </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full flex items-center gap-2"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {purpose === 'signup' ? 'Sign Up' : 'Sign In'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}