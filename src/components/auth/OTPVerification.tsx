
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Mail, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

interface OTPVerificationProps {
  email: string;
  purpose: 'signup' | 'login';
  onBack: () => void;
  onVerificationComplete: () => void;
}

export default function OTPVerification({ 
  email, 
  purpose,
  onBack, 
  onVerificationComplete 
}: OTPVerificationProps) {
  const [otpValue, setOtpValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const { completeSignup, completeLogin } = useAuth();

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the complete 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Verify OTP with the database
      const { data: isValid, error } = await supabase
        .rpc('verify_otp', {
          p_email: email,
          p_code: otpValue,
          p_purpose: purpose
        });

      if (error) {
        toast({
          title: "Verification failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (!isValid) {
        toast({
          title: "Invalid code",
          description: "The code you entered is incorrect or has expired. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // OTP verified successfully, now complete the auth process
      setIsVerified(true);
      
      let authResult;
      if (purpose === 'signup') {
        authResult = await completeSignup();
      } else {
        authResult = await completeLogin();
      }

      if (authResult.error) {
        toast({
          title: "Authentication failed",
          description: authResult.error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success!",
        description: purpose === 'signup' ? "Account created successfully!" : "Signed in successfully!",
      });

      setTimeout(() => {
        onVerificationComplete();
      }, 1500);

    } catch (error: any) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-otp', {
        body: { email, purpose }
      });
      
      if (error) {
        toast({
          title: "Failed to resend",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Code sent!",
          description: "A new verification code has been sent to your email.",
        });
        setCountdown(30); // 30 second cooldown
        setOtpValue(''); // Clear current input
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerified) {
    return (
      <div className="flex items-center justify-center p-8 animate-fade-in">
        <Card className="w-full max-w-md shadow-elegant border-0 bg-gradient-card">
          <CardContent className="text-center p-8">
            <div className="mb-6 animate-scale-in">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {purpose === 'signup' ? 'Account Created!' : 'Welcome Back!'}
              </h2>
              <p className="text-muted-foreground">
                {purpose === 'signup' 
                  ? 'Your account has been successfully created. Redirecting to dashboard...'
                  : 'You have been successfully signed in. Redirecting to dashboard...'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8 animate-fade-in">
      <Card className="w-full max-w-md shadow-elegant border-0 bg-gradient-card">
        <CardHeader className="text-center">
          <div className="mb-4 animate-scale-in">
            <div className="bg-primary/10 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Mail className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Enter verification code
          </CardTitle>
          <CardDescription className="text-base">
            We've sent a 6-digit code to{' '}
            <span className="font-medium text-foreground">{email}</span>.
            Enter it below to {purpose === 'signup' ? 'create your account' : 'sign in'}.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              value={otpValue}
              onChange={setOtpValue}
              maxLength={6}
              onComplete={handleVerifyOTP}
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

          <Button
            onClick={handleVerifyOTP}
            disabled={isLoading || otpValue.length !== 6}
            className="w-full bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth"
          >
            {isLoading ? "Verifying..." : "Verify Code"}
          </Button>
          
          <Button
            variant="outline"
            onClick={handleResendOTP}
            disabled={isLoading || countdown > 0}
            className="w-full"
          >
            {isLoading ? (
              "Sending..."
            ) : countdown > 0 ? (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Resend in {countdown}s
              </div>
            ) : (
              "Resend Code"
            )}
          </Button>
          
          <div className="pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full flex items-center gap-2"
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
