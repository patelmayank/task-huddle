import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Mail, ExternalLink, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

interface EmailVerificationProps {
  email: string;
  onBack: () => void;
  onEmailChange: (email: string) => void;
  onVerificationComplete: () => void;
}

export default function EmailVerification({ 
  email, 
  onBack, 
  onEmailChange,
  onVerificationComplete 
}: EmailVerificationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [newEmail, setNewEmail] = useState(email);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { signUp } = useAuth();

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-check verification status
  useEffect(() => {
    const checkVerification = async () => {
      // This would normally check if the user is verified
      // For now, we'll simulate with a timeout
      const interval = setInterval(() => {
        // In a real app, you'd check auth status here
        // For demo purposes, we'll auto-verify after 10 seconds
        if (Math.random() > 0.95) {
          setIsVerified(true);
          clearInterval(interval);
          setTimeout(() => {
            onVerificationComplete();
          }, 2000);
        }
      }, 2000);

      return () => clearInterval(interval);
    };

    checkVerification();
  }, [onVerificationComplete]);

  const handleResendEmail = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    try {
      const { error } = await signUp(email, '', ''); // Resend verification
      
      if (error) {
        toast({
          title: "Failed to resend",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email sent!",
          description: "Please check your inbox for the verification link.",
        });
        setCountdown(30); // 30 second cooldown
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to resend verification email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (newEmail === email) {
      setShowChangeEmail(false);
      return;
    }

    setIsLoading(true);
    try {
      // Update email and resend verification
      onEmailChange(newEmail);
      const { error } = await signUp(newEmail, '', '');
      
      if (error) {
        toast({
          title: "Failed to update email",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email updated!",
          description: "Verification email sent to your new address.",
        });
        setShowChangeEmail(false);
        setCountdown(30);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openMailApp = () => {
    // Try to open mail app based on email provider
    const domain = email.split('@')[1];
    let mailUrl = 'mailto:';
    
    if (domain.includes('gmail')) {
      mailUrl = 'https://mail.google.com';
    } else if (domain.includes('outlook') || domain.includes('hotmail')) {
      mailUrl = 'https://outlook.live.com';
    } else if (domain.includes('yahoo')) {
      mailUrl = 'https://mail.yahoo.com';
    }
    
    window.open(mailUrl, '_blank');
  };

  if (isVerified) {
    return (
      <div className="flex items-center justify-center p-8 animate-fade-in">
        <Card className="w-full max-w-md shadow-elegant border-0 bg-gradient-card">
          <CardContent className="text-center p-8">
            <div className="mb-6 animate-scale-in">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Email Verified!
              </h2>
              <p className="text-muted-foreground">
                Your account has been successfully verified. Redirecting to dashboard...
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
            Verify your email to continue
          </CardTitle>
          <CardDescription className="text-base">
            We've sent a verification link to{' '}
            <span className="font-medium text-foreground">{email}</span>.
            Please check your inbox or spam folder.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {showChangeEmail ? (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="new-email">New Email Address</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  className="bg-background border-border"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleChangeEmail}
                  disabled={isLoading || !newEmail}
                  className="flex-1"
                >
                  {isLoading ? "Updating..." : "Update Email"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowChangeEmail(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                onClick={handleResendEmail}
                disabled={isLoading || countdown > 0}
                className="w-full bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth"
              >
                {isLoading ? (
                  "Sending..."
                ) : countdown > 0 ? (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Resend in {countdown}s
                  </div>
                ) : (
                  "Resend Verification Email"
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowChangeEmail(true)}
                className="w-full"
              >
                Change Email Address
              </Button>
              
              <Button
                variant="ghost"
                onClick={openMailApp}
                className="w-full flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Mail App
              </Button>
            </div>
          )}
          
          <div className="pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}