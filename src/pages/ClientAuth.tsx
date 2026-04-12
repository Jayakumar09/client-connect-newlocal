import { useState, useEffect } from "react";
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
import logoImage from "@/assets/sri-lakshmi-logo.png";

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
  phone: z.string().min(10, { message: "Invalid phone number" }),
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if this is an admin user and redirect appropriately
        const isAdmin = session.user.email === "vijayalakshmijayakumar45@gmail.com";
        navigate(isAdmin ? "/" : "/browse");
      }
    };
    checkSession();
  }, [navigate]);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
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
      
      const redirectUrl = `${window.location.origin}/browse`;

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validated.fullName,
            gender: validated.gender,
            date_of_birth: validated.dateOfBirth,
            religion: validated.religion,
            profile_created_for: validated.profileCreatedFor,
          },
        },
      });

      if (error) throw error;

      toast.success("Account created successfully! You can now sign in.");
      // Reset form
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
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Signed in successfully!");
      navigate("/browse");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
        options: {
          data: {
            full_name: validated.fullName,
            gender: validated.gender,
            date_of_birth: validated.dateOfBirth,
            religion: validated.religion,
            profile_created_for: validated.profileCreatedFor,
          },
        },
      });

      if (error) throw error;

      setOtpSent(true);
      toast.success("OTP sent to your phone!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
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

      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      toast.success("Verified successfully!");
      navigate("/browse");
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
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
            <div className="mx-auto mb-3 bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/50 dark:to-purple-900/50 rounded-full p-5 w-fit shadow-lg">
              <img 
                src={logoImage}
                alt="Sri Lakshmi Mangalya Malai" 
                className="w-20 h-20 mx-auto object-contain"
              />
            </div>
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