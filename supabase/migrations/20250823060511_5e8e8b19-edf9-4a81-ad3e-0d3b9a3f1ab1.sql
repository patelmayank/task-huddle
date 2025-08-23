-- Add unique constraint to otp_rate_limits email column
ALTER TABLE public.otp_rate_limits ADD CONSTRAINT otp_rate_limits_email_key UNIQUE (email);