import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  completeSignup: () => Promise<{ error: any }>;
  completeLogin: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    // For OTP flow, we don't create the user account yet
    // Instead, we just send an OTP for verification
    try {
      const response = await supabase.functions.invoke('send-otp', {
        body: { email, purpose: 'signup' }
      });

      if (response.error) {
        return { error: response.error };
      }

      // Store signup data temporarily for after OTP verification
      sessionStorage.setItem('pendingSignup', JSON.stringify({
        email,
        password,
        displayName
      }));

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    // First attempt normal sign in
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      // If sign in fails, send OTP for additional verification
      try {
        const response = await supabase.functions.invoke('send-otp', {
          body: { email, purpose: 'login' }
        });

        if (response.error) {
          return { error };
        }

        // Store login data temporarily for after OTP verification
        sessionStorage.setItem('pendingLogin', JSON.stringify({
          email,
          password
        }));

        return { error: { message: 'OTP_REQUIRED', needsOTP: true } };
      } catch (otpError) {
        return { error };
      }
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const completeSignup = async () => {
    const pendingData = sessionStorage.getItem('pendingSignup');
    if (!pendingData) {
      return { error: { message: 'No pending signup data found' } };
    }

    const { email, password, displayName } = JSON.parse(pendingData);
    
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: displayName ? { display_name: displayName } : undefined
      }
    });

    if (!error) {
      sessionStorage.removeItem('pendingSignup');
    }

    return { error };
  };

  const completeLogin = async () => {
    const pendingData = sessionStorage.getItem('pendingLogin');
    if (!pendingData) {
      return { error: { message: 'No pending login data found' } };
    }

    const { email, password } = JSON.parse(pendingData);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      sessionStorage.removeItem('pendingLogin');
    }

    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    completeSignup,
    completeLogin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};