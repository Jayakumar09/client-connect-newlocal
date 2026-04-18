import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, Phone, Lock, KeyRound, Heart, Eye, EyeOff, Wand2 } from "lucide-react";
import { BRAND_LOGO } from "@/lib/branding";
import { 
  signUpClient, 
  signInClient, 
  sendPhoneOtp as authSendPhoneOtp, 
  verifyPhoneOtp as authVerifyPhoneOtp, 
  resetPassword as authResetPassword,
  getCooldownStatus 
} from "@/integrations/auth";

const emailSignupSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  fullName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  gender: z.enum(['male', 'female', 'other'], { required_error: "Gender is required" }),
  dateOfBirth: z.string().min(1, { message: "Date of birth is required" }),
  religion: z.enum(['hindu', 'muslim', 'christian', 'sikh', 'buddhist', 'jain', 'other'], { required_error: "Religion is required" }),
  profileCreatedFor: z.enum(['self', 'parents', 'siblings', 'relatives', 'friends'], { required_error: "This field is required" }),
});

const phoneSignupSchema = z.object({
  phone: z.string()
    .min(10, { message: "Phone number must be at least 10 digits" })
    .max(10, { message: "Phone number must be exactly 10 digits" })
    .regex(/^[6-9]\d{9}$/, { message: "Invalid Indian phone number. Must be 10 digits starting with 6-9" }),
  countryCode: z.string(),
  fullName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  gender: z.enum(['male', 'female', 'other'], { required_error: "Gender is required" }),
  dateOfBirth: z.string().min(1, { message: "Date of birth is required" }),
  religion: z.enum(['hindu', 'muslim', 'christian', 'sikh', 'buddhist', 'jain', 'other'], { required_error: "Religion is required" }),
  profileCreatedFor: z.enum(['self', 'parents', 'siblings', 'relatives', 'friends'], { required_error: "This field is required" }),
});

const ClientAuth = () => {
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  
  // Email fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Phone fields
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingPhoneSignup, setPendingPhoneSignup] = useState<{
    fullName: string;
    gender: string;
    dateOfBirth: string;
    religion: string;
    profileCreatedFor: string;
  } | null>(null);
  
  // Profile fields
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [religion, setReligion] = useState("");
  const [profileCreatedFor, setProfileCreatedFor] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [actionBlocked, setActionBlocked] = useState(false);

  const updateCooldown = useCallback(() => {
    const status = getCooldownStatus();
    if (status.client > 0) {
      setCooldownSeconds(status.client);
      setActionBlocked(true);
    } else {
      setCooldownSeconds(0);
      setActionBlocked(false);
    }
  }, []);

  useEffect(() => {
    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [updateCooldown]);

  const generatePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const all = uppercase + lowercase + numbers + special;
    
    let generated = '';
    generated += uppercase[Math.floor(Math.random() * uppercase.length)];
    generated += lowercase[Math.floor(Math.random() * lowercase.length)];
    generated += numbers[Math.floor(Math.random() * numbers.length)];
    generated += special[Math.floor(Math.random() * special.length)];
    
    for (let i = 0; i < 8; i++) {
      generated += all[Math.floor(Math.random() * all.length)];
    }
    
    // Shuffle the password
    generated = generated.split('').sort(() => Math.random() - 0.5).join('');
    setPassword(generated);
    setShowPassword(true);
    toast.success("Password generated! Make sure to save it.");
  };

  useEffect(() => {
    const checkSession = async () => {
      console.log('[ClientAuth] Checking session on mount...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('[ClientAuth] Session check result:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        error: sessionError?.message
      });
      
      // Only redirect if session actually exists and is valid
      if (session && session.user) {
        console.log('[ClientAuth] Session found, checking profile...');
        const isAdmin = session.user.email === "vijayalakshmijayakumar45@gmail.com";
        
        const { data: profile, error: profileError } = await supabase
          .from("client_profiles")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        console.log('[ClientAuth] Profile lookup:', { 
          hasProfile: !!profile, 
          profileId: profile?.id,
          error: profileError?.message
        });
        
        if (isAdmin) {
          console.log('[ClientAuth] Admin user, navigating to /dashboard');
          navigate("/dashboard");
        } else if (profile) {
          console.log('[ClientAuth] Profile exists, navigating to /browse');
          navigate("/browse");
        } else {
          console.log('[ClientAuth] No profile, navigating to /client-profile');
          navigate("/client-profile");
        }
      } else {
        console.log('[ClientAuth] No session - staying on login page');
      }
      // If no session, stay on login page (do nothing)
    };
    checkSession();
  }, [navigate]);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (actionBlocked) {
      toast.error(`Please wait ${cooldownSeconds} seconds before trying again`);
      return;
    }
    
    setLoading(true);

    try {
      const validated = emailSignupSchema.parse({ 
        email, 
        password, 
        fullName, 
        gender, 
        dateOfBirth, 
        religion, 
        profileCreatedFor 
      });

      const result = await signUpClient(
        validated.email,
        validated.password,
        {
          fullName: validated.fullName,
          gender: validated.gender,
          dateOfBirth: validated.dateOfBirth,
          religion: validated.religion,
          profileCreatedFor: validated.profileCreatedFor,
        }
      );

      if (!result.success) {
        toast.error(result.error || 'Registration failed');
        setLoading(false);
        updateCooldown();
        return;
      }

      if (result.needsProfileCreation) {
        toast.success('Account created! Please complete your profile...');
        navigate('/client-profile');
      } else {
        toast.success('Welcome! Redirecting...');
        navigate('/browse');
      }
      
      setEmail("");
      setPassword("");
      setFullName("");
      setGender("");
      setDateOfBirth("");
      setReligion("");
      setProfileCreatedFor("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (actionBlocked) {
      toast.error(`Please wait ${cooldownSeconds} seconds before trying again`);
      return;
    }
    
    setLoading(true);

    try {
      console.log('[ClientAuth] Calling signInClient for:', email);
      const result = await signInClient(email, password);
      console.log('[ClientAuth] signInClient result:', result);

      if (!result.success) {
        toast.error(result.error || 'Login failed');
        setLoading(false);
        updateCooldown();
        return;
      }

      toast.success('Signed in successfully!');
      console.log('[ClientAuth] Login success, navigating...');
      
      if (result.needsProfileCreation) {
        console.log('[ClientAuth] Navigating to /client-profile');
        navigate('/client-profile');
      } else {
        console.log('[ClientAuth] Navigating to /browse');
        navigate('/browse');
      }
    } catch (error) {
      console.error('[ClientAuth] Login exception:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (actionBlocked) {
      toast.error(`Please wait ${cooldownSeconds} seconds before trying again`);
      return;
    }
    
    setLoading(true);

    try {
      const validated = phoneSignupSchema.parse({ 
        phone, 
        countryCode, 
        fullName, 
        gender, 
        dateOfBirth, 
        religion, 
        profileCreatedFor 
      });
      
      const fullPhone = `${validated.countryCode}${validated.phone}`;

      // Check if phone number already exists in client_profiles
      const { data: existingPhoneProfile, error: checkError } = await supabase
        .from("client_profiles")
        .select("id, phone_number")
        .eq("phone_number", fullPhone)
        .maybeSingle();

      if (checkError) {
        console.error("[ClientAuth] Error checking existing phone:", checkError);
      }

      if (existingPhoneProfile) {
        toast.error("An account with this phone number already exists. Please sign in instead.");
        setLoading(false);
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (otpError) {
        console.error("[ClientAuth] OTP send error:", {
          message: otpError.message,
          status: otpError.status,
          code: otpError.code,
        });
        throw otpError;
      }

      // Store pending signup data for profile creation after OTP verification
      setPendingPhoneSignup({
        fullName: validated.fullName,
        gender: validated.gender,
        dateOfBirth: validated.dateOfBirth,
        religion: validated.religion,
        profileCreatedFor: validated.profileCreatedFor,
      });
      setOtpSent(true);
      toast.success("OTP sent to your phone!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        console.error("[ClientAuth] Phone signup error:", error.message);
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullPhone = `${countryCode}${phone}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) throw error;

      setOtpSent(true);
      toast.success("OTP sent to your phone!");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fullPhone = `${countryCode}${phone}`;

      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: 'sms',
      });

      if (otpError) {
        console.error("[ClientAuth] OTP verification error:", {
          message: otpError.message,
          status: otpError.status,
          code: otpError.code,
        });
        throw otpError;
      }

      console.log("[ClientAuth] OTP verified, user:", otpData.user?.id);

      // If this is a signup (has pending data), create the profile
      if (pendingPhoneSignup && otpData.user) {
        // Check if this phone already has a profile
        const { data: existingPhoneProfile, error: checkError } = await supabase
          .from("client_profiles")
          .select("id, phone_number")
          .eq("phone_number", fullPhone)
          .maybeSingle();

        if (checkError) {
          console.error("[ClientAuth] Error checking existing phone:", checkError);
        }

        if (existingPhoneProfile) {
          toast.error("An account with this phone number already exists. Please sign in instead.");
          setLoading(false);
          setOtpSent(false);
          setOtp("");
          setPendingPhoneSignup(null);
          return;
        }

        // Check if user already has a profile (unique constraint)
        const { data: existingUserProfile, error: userCheckError } = await supabase
          .from("client_profiles")
          .select("id")
          .eq("user_id", otpData.user.id)
          .maybeSingle();

        if (userCheckError) {
          console.error("[ClientAuth] Error checking user profile:", userCheckError);
        }

        if (existingUserProfile) {
          toast.success("Verified! You already have a profile. Redirecting...");
          navigate("/client-profile");
          setPendingPhoneSignup(null);
          return;
        }

        // Now insert the profile with valid session
        const { error: profileError } = await supabase
          .from("client_profiles")
          .insert({
            user_id: otpData.user.id,
            full_name: pendingPhoneSignup.fullName,
            phone_number: fullPhone,
            country_code: countryCode,
            gender: pendingPhoneSignup.gender as "male" | "female" | "other",
            date_of_birth: pendingPhoneSignup.dateOfBirth,
            religion: pendingPhoneSignup.religion as "hindu" | "muslim" | "christian" | "sikh" | "buddhist" | "jain" | "other",
            profile_created_for: pendingPhoneSignup.profileCreatedFor as "self" | "parents" | "siblings" | "relatives" | "friends",
            country: "India",
            is_profile_active: true,
            show_phone_number: false,
            payment_status: "free",
            created_by: "client",
          });

        if (profileError) {
          console.error("[ClientAuth] Profile creation error details:", {
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            code: profileError.code,
          });
          
          if (profileError.code === '23505') {
            toast.error("A profile already exists for this account. Redirecting...");
            navigate("/client-profile");
          } else {
            toast.error(`Failed to create profile: ${profileError.message}`);
          }
        } else {
          console.log("[ClientAuth] Phone signup profile created successfully");
          toast.success("Profile created successfully!");
        }
        
        setPendingPhoneSignup(null);
      } else if (otpData.user) {
        // Phone sign-in (no pending signup data)
        toast.success("Verified successfully!");
        navigate("/client-profile");
        return;
      }

      toast.success("Verified successfully!");
      navigate("/client-profile");
    } catch (error) {
      if (error instanceof Error) {
        console.error("[ClientAuth] OTP verification error:", error.message);
        toast.error(error.message);
      } else {
        console.error("[ClientAuth] Unknown OTP error:", error);
        toast.error("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    try {
      const emailSchema = z.string().email();
      const validatedEmail = emailSchema.parse(resetEmail.trim());

      const redirectUrl = `${window.location.origin}/client-auth`;

      const { error } = await supabase.auth.resetPasswordForEmail(validatedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      toast.success("Password reset link sent! Please check your email.");
      setResetDialogOpen(false);
      setResetEmail("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error("Please enter a valid email address");
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-rose-50 dark:from-slate-950 dark:via-purple-950 dark:to-rose-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-pink-100 dark:border-purple-900 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
        <CardHeader className="space-y-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-100/50 via-purple-100/50 to-rose-100/50 dark:from-pink-900/20 dark:via-purple-900/20 dark:to-rose-900/20" />
          <div className="relative">
            <img 
              src={BRAND_LOGO}
              alt="Sri Lakshmi Mangalya Malai" 
              className="h-16 w-auto mx-auto mb-3 object-contain"
            />
            <div className="flex items-center justify-center gap-2 mb-2">
              <Heart className="w-6 h-6 text-pink-500 dark:text-pink-400 fill-pink-500 dark:fill-pink-400" />
              <CardTitle className="text-[32px] font-cursive font-semibold uppercase text-center bg-gradient-to-r from-pink-600 via-purple-600 to-rose-600 dark:from-pink-400 dark:via-purple-400 dark:to-rose-400 bg-clip-text text-transparent">
                Sri Lakshmi Mangalya Malai
              </CardTitle>
              <Heart className="w-6 h-6 text-pink-500 dark:text-pink-400 fill-pink-500 dark:fill-pink-400" />
            </div>
            <CardDescription className="text-purple-700 dark:text-purple-300 font-medium text-base">
              Find your perfect match - Register to get started
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30">
              <TabsTrigger value="signin" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={authMethod === 'email' ? 'default' : 'outline'}
                    className={authMethod === 'email' ? 'flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700' : 'flex-1 border-pink-200 dark:border-purple-800'}
                    onClick={() => setAuthMethod('email')}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                  <Button
                    variant={authMethod === 'phone' ? 'default' : 'outline'}
                    className={authMethod === 'phone' ? 'flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700' : 'flex-1 border-pink-200 dark:border-purple-800'}
                    onClick={() => setAuthMethod('phone')}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Phone
                  </Button>
                </div>

                {authMethod === 'email' ? (
                  <form onSubmit={handleEmailSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white" disabled={loading}>
                      <Lock className="w-4 h-4 mr-2" />
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>

                    <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="link" className="w-full text-sm text-muted-foreground">
                          Forgot password?
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reset Password</DialogTitle>
                          <DialogDescription>
                            Enter your email to receive a password reset link.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handlePasswordReset} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="reset-email">Email</Label>
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="your@email.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full" disabled={resetLoading}>
                            <KeyRound className="w-4 h-4 mr-2" />
                            {resetLoading ? "Sending..." : "Send Reset Link"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </form>
                ) : otpSent ? (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp">Enter OTP</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Verifying..." : "Verify OTP"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setOtpSent(false)}
                    >
                      Back
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handlePhoneSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-phone">Phone Number</Label>
                      <div className="flex gap-2">
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="+91">+91 (IN)</SelectItem>
                            <SelectItem value="+1">+1 (US)</SelectItem>
                            <SelectItem value="+44">+44 (UK)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          id="signin-phone"
                          type="tel"
                          placeholder="1234567890"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white" disabled={loading}>
                      <Phone className="w-4 h-4 mr-2" />
                      {loading ? "Sending OTP..." : "Send OTP"}
                    </Button>
                  </form>
                )}
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={authMethod === 'email' ? 'default' : 'outline'}
                    className={authMethod === 'email' ? 'flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700' : 'flex-1 border-pink-200 dark:border-purple-800'}
                    onClick={() => setAuthMethod('email')}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                  <Button
                    variant={authMethod === 'phone' ? 'default' : 'outline'}
                    className={authMethod === 'phone' ? 'flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700' : 'flex-1 border-pink-200 dark:border-purple-800'}
                    onClick={() => setAuthMethod('phone')}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Phone
                  </Button>
                </div>

                {authMethod === 'email' ? (
                  <form onSubmit={handleEmailSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="profile-for">Creating Profile For</Label>
                        <Select value={profileCreatedFor} onValueChange={setProfileCreatedFor} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">Self</SelectItem>
                            <SelectItem value="parents">Parents</SelectItem>
                            <SelectItem value="siblings">Siblings</SelectItem>
                            <SelectItem value="relatives">Relatives</SelectItem>
                            <SelectItem value="friends">Friends</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="full-name">Full Name</Label>
                        <Input
                          id="full-name"
                          type="text"
                          placeholder="Full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select value={gender} onValueChange={setGender} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input
                          id="dob"
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="religion">Religion</Label>
                        <Select value={religion} onValueChange={setReligion} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select religion" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hindu">Hindu</SelectItem>
                            <SelectItem value="muslim">Muslim</SelectItem>
                            <SelectItem value="christian">Christian</SelectItem>
                            <SelectItem value="sikh">Sikh</SelectItem>
                            <SelectItem value="buddhist">Buddhist</SelectItem>
                            <SelectItem value="jain">Jain</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="pr-20"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={generatePassword}
                              className="text-muted-foreground hover:text-foreground p-1"
                              title="Generate password"
                            >
                              <Wand2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-muted-foreground hover:text-foreground p-1"
                              title={showPassword ? "Hide password" : "Show password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Must be 8+ characters with uppercase, lowercase, and number
                        </p>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white" disabled={loading}>
                      <Heart className="w-4 h-4 mr-2" />
                      {loading ? "Creating account..." : "Register Free"}
                    </Button>
                  </form>
                ) : otpSent ? (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp-signup">Enter OTP</Label>
                      <Input
                        id="otp-signup"
                        type="text"
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white" disabled={loading}>
                      {loading ? "Verifying..." : "Verify OTP"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full border-pink-200 dark:border-purple-800" 
                      onClick={() => setOtpSent(false)}
                    >
                      Back
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handlePhoneSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="profile-for-phone">Creating Profile For</Label>
                        <Select value={profileCreatedFor} onValueChange={setProfileCreatedFor} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="self">Self</SelectItem>
                            <SelectItem value="parents">Parents</SelectItem>
                            <SelectItem value="siblings">Siblings</SelectItem>
                            <SelectItem value="relatives">Relatives</SelectItem>
                            <SelectItem value="friends">Friends</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="full-name-phone">Full Name</Label>
                        <Input
                          id="full-name-phone"
                          type="text"
                          placeholder="Full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gender-phone">Gender</Label>
                        <Select value={gender} onValueChange={setGender} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dob-phone">Date of Birth</Label>
                        <Input
                          id="dob-phone"
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="religion-phone">Religion</Label>
                        <Select value={religion} onValueChange={setReligion} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select religion" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hindu">Hindu</SelectItem>
                            <SelectItem value="muslim">Muslim</SelectItem>
                            <SelectItem value="christian">Christian</SelectItem>
                            <SelectItem value="sikh">Sikh</SelectItem>
                            <SelectItem value="buddhist">Buddhist</SelectItem>
                            <SelectItem value="jain">Jain</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="signup-phone">Phone Number</Label>
                        <div className="flex gap-2">
                          <Select value={countryCode} onValueChange={setCountryCode}>
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="+91">+91 (IN)</SelectItem>
                              <SelectItem value="+1">+1 (US)</SelectItem>
                              <SelectItem value="+44">+44 (UK)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            id="signup-phone"
                            type="tel"
                            placeholder="1234567890"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white" disabled={loading}>
                      <Heart className="w-4 h-4 mr-2" />
                      {loading ? "Sending OTP..." : "Register Free"}
                    </Button>
                  </form>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientAuth;