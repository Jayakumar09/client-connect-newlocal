import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'vijayalakshmijayakumar45@gmail.com';

const COOLDOWN_MS = 30000;
const MAX_RATE_LIMIT_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 300000;

interface RateLimitState {
  lastAttempt: number;
  attempts: number;
  blockedUntil: number;
}

const clientRateLimit: RateLimitState = {
  lastAttempt: 0,
  attempts: 0,
  blockedUntil: 0,
};

const adminRateLimit: RateLimitState = {
  lastAttempt: 0,
  attempts: 0,
  blockedUntil: 0,
};

function isRateLimited(rateLimit: RateLimitState): boolean {
  const now = Date.now();
  if (now < rateLimit.blockedUntil) return true;
  
  if (now - rateLimit.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    rateLimit.attempts = 0;
  }
  
  return false;
}

function getRemainingCooldown(rateLimit: RateLimitState): number {
  const now = Date.now();
  if (now < rateLimit.blockedUntil) {
    return Math.ceil((rateLimit.blockedUntil - now) / 1000);
  }
  return 0;
}

function recordAttempt(rateLimit: RateLimitState): void {
  const now = Date.now();
  rateLimit.lastAttempt = now;
  rateLimit.attempts += 1;
  
  if (rateLimit.attempts >= MAX_RATE_LIMIT_ATTEMPTS) {
    rateLimit.blockedUntil = now + COOLDOWN_MS;
    rateLimit.attempts = 0;
  }
}

function clearRateLimit(rateLimit: RateLimitState): void {
  rateLimit.lastAttempt = 0;
  rateLimit.attempts = 0;
  rateLimit.blockedUntil = 0;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: User;
}

export interface ClientAuthResult extends AuthResult {
  needsProfileCreation?: boolean;
  isNewUser?: boolean;
}

export function isAdminUser(user: User | null): boolean {
  return user?.email === ADMIN_EMAIL;
}

export function getCooldownStatus(): {
  client: number;
  admin: number;
} {
  return {
    client: getRemainingCooldown(clientRateLimit),
    admin: getRemainingCooldown(adminRateLimit),
  };
}

export async function signUpClient(
  email: string,
  password: string,
  profileData: {
    fullName: string;
    gender: string;
    dateOfBirth: string;
    religion: string;
    profileCreatedFor: string;
  }
): Promise<ClientAuthResult> {
  if (!supabase) {
    console.error('[Auth] Supabase client not initialized');
    return { success: false, error: 'Authentication service not available. Please refresh and try again.' };
  }

  if (isRateLimited(clientRateLimit)) {
    const remaining = getRemainingCooldown(clientRateLimit);
    return { 
      success: false, 
      error: `Too many attempts. Please wait ${remaining} seconds before trying again.` 
    };
  }

  recordAttempt(clientRateLimit);

  try {
    console.log('[Auth] Checking for existing profile...');
    const { data: existingProfile } = await supabase
      .from('client_profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
    }

    console.log('[Auth] Creating auth user for:', email.toLowerCase());
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        emailRedirectTo: undefined,
        data: {
          full_name: profileData.fullName,
        }
      }
    });

    console.log('[Auth] Signup response:', { hasUser: !!authData?.user, hasError: !!authError, error: authError?.message });

    if (authError) {
      if (authError.message.includes('rate limit') || authError.status === 429) {
        return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
      }
      throw authError;
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create account. Please try again.' };
    }

    console.log('[Auth] User created, email confirmed:', authData.user.email_confirmed_at !== null);

    // If email is NOT confirmed yet, we cannot sign in immediately
    // Return success but with needsProfileCreation so user goes to complete profile
    if (!authData.user.email_confirmed_at) {
      console.log('[Auth] Email not confirmed yet, creating profile and returning');
      
      // Still create the profile
      const { error: profileError } = await supabase
        .from('client_profiles')
        .insert({
          user_id: authData.user.id,
          full_name: profileData.fullName,
          email: email.toLowerCase(),
          gender: profileData.gender,
          date_of_birth: profileData.dateOfBirth,
          religion: profileData.religion,
          profile_created_for: profileData.profileCreatedFor,
          country: 'India',
          country_code: '+91',
          is_profile_active: true,
          show_phone_number: false,
          payment_status: 'free',
          created_by: 'client',
        });

      if (profileError) {
        console.error('[Auth] Profile insert error:', profileError.message);
      }
      
      clearRateLimit(clientRateLimit);
      return { 
        success: true, 
        needsProfileCreation: false,
        isNewUser: true,
        user: authData.user 
      };
    }

    console.log('[Auth] User created, attempting immediate sign in...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    console.log('[Auth] Post-signup signin:', { hasSession: !!signInData?.session, error: signInError?.message });

    // If sign in fails (e.g., email not confirmed), still create profile and return success
    if (signInError) {
      console.log('[Auth] Sign-in failed, still creating profile');
      
      const { error: profileError } = await supabase
        .from('client_profiles')
        .insert({
          user_id: authData.user.id,
          full_name: profileData.fullName,
          email: email.toLowerCase(),
          gender: profileData.gender,
          date_of_birth: profileData.dateOfBirth,
          religion: profileData.religion,
          profile_created_for: profileData.profileCreatedFor,
          country: 'India',
          country_code: '+91',
          is_profile_active: true,
          show_phone_number: false,
          payment_status: 'free',
          created_by: 'client',
        });

      console.log('[Auth] Profile insert:', { hasError: !!profileError, error: profileError?.message });
      
      clearRateLimit(clientRateLimit);
      return { 
        success: true, 
        needsProfileCreation: false,
        isNewUser: true,
        user: authData.user 
      };
    }

    console.log('[Auth] Creating client profile...');
    const { error: profileError } = await supabase
      .from('client_profiles')
      .insert({
        user_id: authData.user.id,
        full_name: profileData.fullName,
        email: email.toLowerCase(),
        gender: profileData.gender,
        date_of_birth: profileData.dateOfBirth,
        religion: profileData.religion,
        profile_created_for: profileData.profileCreatedFor,
        country: 'India',
        country_code: '+91',
        is_profile_active: true,
        show_phone_number: false,
        payment_status: 'free',
        created_by: 'client',
      });

    console.log('[Auth] Profile insert:', { hasError: !!profileError, error: profileError?.message });

    if (profileError) {
      return { 
        success: true, 
        needsProfileCreation: true,
        error: `Account created. Please complete your profile: ${profileError.message}` 
      };
    }

    clearRateLimit(clientRateLimit);
    
    return { 
      success: true, 
      needsProfileCreation: false,
      isNewUser: true,
      user: signInData.user ?? authData.user 
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return { success: false, error: message };
  }
}

export async function signInClient(
  email: string,
  password: string
): Promise<ClientAuthResult> {
  if (!supabase) {
    console.error('[Auth] Supabase client not initialized - check env vars');
    return { success: false, error: 'Authentication service not available. Please refresh and try again.' };
  }

  if (isRateLimited(clientRateLimit)) {
    const remaining = getRemainingCooldown(clientRateLimit);
    return { 
      success: false, 
      error: `Too many attempts. Please wait ${remaining} seconds before trying again.` 
    };
  }

  recordAttempt(clientRateLimit);

  try {
    console.log('[Auth] Attempting sign in for:', email.toLowerCase());
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    console.log('[Auth] Sign in response:', { hasData: !!data, hasError: !!error, errorMessage: error?.message });

    if (error) {
      if (error.message.includes('rate limit') || error.status === 429) {
        return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
      }
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Invalid email or password' };
      }
      throw error;
    }

    console.log('[Auth] Sign in successful, user:', data.user?.id);

    const { data: profile } = await supabase
      .from('client_profiles')
      .select('id')
      .eq('user_id', data.user?.id)
      .maybeSingle();

    console.log('[Auth] Profile lookup result:', { hasProfile: !!profile });

    clearRateLimit(clientRateLimit);

    return { 
      success: true, 
      needsProfileCreation: !profile,
      user: data.user 
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    console.error('[Auth] Login error:', message);
    return { success: false, error: message };
  }
}

export async function sendPhoneOtp(
  phone: string,
  countryCode: string = '+91'
): Promise<AuthResult> {
  if (isRateLimited(clientRateLimit)) {
    const remaining = getRemainingCooldown(clientRateLimit);
    return { 
      success: false, 
      error: `Too many attempts. Please wait ${remaining} seconds before trying again.` 
    };
  }

  recordAttempt(clientRateLimit);

  try {
    const fullPhone = `${countryCode}${phone}`;
    
    const { error } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
    });

    if (error) {
      if (error.message.includes('rate limit') || error.status === 429) {
        return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
      }
      if (error.message.includes('invalid phone')) {
        return { success: false, error: 'Invalid phone number format' };
      }
      throw error;
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send OTP';
    return { success: false, error: message };
  }
}

export async function verifyPhoneOtp(
  phone: string,
  countryCode: string,
  otp: string,
  profileData?: {
    fullName: string;
    gender: string;
    dateOfBirth: string;
    religion: string;
    profileCreatedFor: string;
  }
): Promise<ClientAuthResult> {
  try {
    const fullPhone = `${countryCode}${phone}`;
    
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp,
      type: 'sms',
    });

    if (otpError) {
      if (otpError.message.includes('invalid')) {
        return { success: false, error: 'Invalid OTP code' };
      }
      throw otpError;
    }

    if (!otpData.user) {
      return { success: false, error: 'Verification failed' };
    }

    if (profileData) {
      const { data: existingProfile } = await supabase
        .from('client_profiles')
        .select('id')
        .eq('user_id', otpData.user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase
          .from('client_profiles')
          .insert({
            user_id: otpData.user.id,
            full_name: profileData.fullName,
            phone_number: fullPhone,
            country_code: countryCode,
            gender: profileData.gender as 'male' | 'female' | 'other',
            date_of_birth: profileData.dateOfBirth,
            religion: profileData.religion as 'hindu' | 'muslim' | 'christian' | 'sikh' | 'buddhist' | 'jain' | 'other',
            profile_created_for: profileData.profileCreatedFor as 'self' | 'parents' | 'siblings' | 'relatives' | 'friends',
            country: 'India',
            is_profile_active: true,
            show_phone_number: false,
            payment_status: 'free',
            created_by: 'client',
          });
      }
    }

    clearRateLimit(clientRateLimit);

    return { success: true, needsProfileCreation: false, user: otpData.user };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return { success: false, error: message };
  }
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<AuthResult> {
  if (isRateLimited(adminRateLimit)) {
    const remaining = getRemainingCooldown(adminRateLimit);
    return { 
      success: false, 
      error: `Too many attempts. Please wait ${remaining} seconds before trying again.` 
    };
  }

  recordAttempt(adminRateLimit);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Invalid credentials' };
      }
      if (error.message.includes('rate limit') || error.status === 429) {
        return { success: false, error: 'Too many requests. Please wait and try again.' };
      }
      throw error;
    }

    if (!isAdminUser(data.user)) {
      await supabase.auth.signOut();
      return { success: false, error: 'Access denied. Admin credentials required.' };
    }

    clearRateLimit(adminRateLimit);

    return { success: true, user: data.user };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin login failed';
    return { success: false, error: message };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function resetPassword(email: string): Promise<AuthResult> {
  if (isRateLimited(clientRateLimit)) {
    const remaining = getRemainingCooldown(clientRateLimit);
    return { 
      success: false, 
      error: `Too many attempts. Please wait ${remaining} seconds` 
    };
  }

  recordAttempt(clientRateLimit);

  try {
    const redirectUrl = `${window.location.origin}/client-auth`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send reset email';
    return { success: false, error: message };
  }
}
