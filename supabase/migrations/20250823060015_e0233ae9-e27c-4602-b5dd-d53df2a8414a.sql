-- Create OTP management tables
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create OTP rate limiting table
CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempts INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on OTP tables
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for otp_codes
CREATE POLICY "Users can view their own OTP codes" ON public.otp_codes
  FOR SELECT USING (auth.uid() = user_id OR email = auth.email());

CREATE POLICY "System can manage OTP codes" ON public.otp_codes
  FOR ALL USING (true);

-- RLS policies for otp_rate_limits
CREATE POLICY "Users can view their own rate limits" ON public.otp_rate_limits
  FOR SELECT USING (email = auth.email());

CREATE POLICY "System can manage rate limits" ON public.otp_rate_limits
  FOR ALL USING (true);

-- Function to generate and store OTP
CREATE OR REPLACE FUNCTION public.generate_otp(
  p_email TEXT,
  p_user_id UUID DEFAULT NULL,
  p_purpose TEXT DEFAULT 'signup'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  otp_code TEXT;
  code_hash TEXT;
  rate_limit_record RECORD;
BEGIN
  -- Generate 6-digit OTP
  otp_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Hash the OTP code
  code_hash := encode(digest(otp_code, 'sha256'), 'hex');
  
  -- Check rate limiting (max 3 attempts in 15 minutes)
  SELECT * INTO rate_limit_record
  FROM public.otp_rate_limits
  WHERE email = p_email
    AND window_start > NOW() - INTERVAL '15 minutes';
  
  IF rate_limit_record.attempts >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait 15 minutes before requesting another OTP.';
  END IF;
  
  -- Update or insert rate limit record
  INSERT INTO public.otp_rate_limits (email, attempts, window_start)
  VALUES (p_email, 1, NOW())
  ON CONFLICT (email) DO UPDATE SET
    attempts = CASE 
      WHEN otp_rate_limits.window_start <= NOW() - INTERVAL '15 minutes' 
      THEN 1 
      ELSE otp_rate_limits.attempts + 1 
    END,
    window_start = CASE 
      WHEN otp_rate_limits.window_start <= NOW() - INTERVAL '15 minutes' 
      THEN NOW() 
      ELSE otp_rate_limits.window_start 
    END;
  
  -- Delete old OTP codes for this email/purpose
  DELETE FROM public.otp_codes 
  WHERE email = p_email AND purpose = p_purpose;
  
  -- Insert new OTP code
  INSERT INTO public.otp_codes (user_id, email, code_hash, purpose, expires_at)
  VALUES (p_user_id, p_email, code_hash, p_purpose, NOW() + INTERVAL '5 minutes');
  
  RETURN otp_code;
END;
$$;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_otp(
  p_email TEXT,
  p_code TEXT,
  p_purpose TEXT DEFAULT 'signup'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_hash TEXT;
  otp_record RECORD;
BEGIN
  -- Hash the provided code
  code_hash := encode(digest(p_code, 'sha256'), 'hex');
  
  -- Find matching OTP code
  SELECT * INTO otp_record
  FROM public.otp_codes
  WHERE email = p_email
    AND code_hash = code_hash
    AND purpose = p_purpose
    AND expires_at > NOW()
    AND used_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Mark OTP as used
  UPDATE public.otp_codes
  SET used_at = NOW()
  WHERE id = otp_record.id;
  
  RETURN TRUE;
END;
$$;

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.otp_codes WHERE expires_at < NOW();
  DELETE FROM public.otp_rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;