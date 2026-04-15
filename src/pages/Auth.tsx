import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { z } from "zod";
import { Users, Lock, KeyRound, Eye, EyeOff, Wand2 } from "lucide-react";
import logoImage from "@/assets/sri-lakshmi-logo.png";
import { isAdminApp } from "@/lib/config";

const ADMIN_EMAIL = "vijayalakshmijayakumar45@gmail.com";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^A-Za-z0-9]/, { message: "Password must contain at least one special character" }),
});

// Generate a strong random password
const generateStrongPassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  let password = '';
  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest with random characters from all sets
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = 0; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatePasswordLoading, setUpdatePasswordLoading] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      } else if (event === "SIGNED_IN" && !isRecoveryMode) {
        // Redirect based on current host
        if (isAdminApp()) {
          navigate("/admin/dashboard");
        } else {
          navigate("/dashboard");
        }
      }
    });

    // Check if user is already logged in (but not in recovery mode)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !isRecoveryMode) {
        // Don't redirect if we're in recovery mode
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        if (type !== 'recovery') {
          // Redirect based on current host
          if (isAdminApp()) {
            navigate("/admin/dashboard");
          } else {
            navigate("/dashboard");
          }
        }
      }
    };
    checkSession();

    return () => subscription.unsubscribe();
  }, [navigate, isRecoveryMode]);

  const handleGeneratePassword = () => {
    const generatedPassword = generateStrongPassword();
    setPassword(generatedPassword);
    setShowPassword(true); // Show password so user can see it
    toast.success("Strong password generated! Make sure to copy it.");
  };

  const handleGenerateNewPassword = () => {
    const generatedPassword = generateStrongPassword();
    setNewPassword(generatedPassword);
    setConfirmPassword(generatedPassword);
    setShowNewPassword(true);
    setShowConfirmPassword(true);
    toast.success("Strong password generated! Make sure to copy it.");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatePasswordLoading(true);

    try {
      if (newPassword !== confirmPassword) {
        toast.error("Passwords do not match");
        setUpdatePasswordLoading(false);
        return;
      }

      const passwordSchema = z.string()
        .min(8, { message: "Password must be at least 8 characters" })
        .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
        .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
        .regex(/[0-9]/, { message: "Password must contain at least one number" })
        .regex(/[^A-Za-z0-9]/, { message: "Password must contain at least one special character" });

      passwordSchema.parse(newPassword);

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      toast.success("Password updated successfully! You can now sign in.");
      setIsRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setUpdatePasswordLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = authSchema.parse({ email, password });
      
      // Restrict signup to admin email only
      if (validated.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        toast.error("Access restricted. Only authorized admin can create an account.");
        setLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      toast.success("Account created successfully! You can now sign in.");
      setEmail("");
      setPassword("");
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = authSchema.parse({ email, password });

      // Restrict signin to admin email only
      if (validated.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        toast.error("Access restricted. Only authorized admin can sign in.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast.success("Signed in successfully!");
      navigate("/dashboard");
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    try {
      // Validate email format
      const emailSchema = z.string().email();
      const validatedEmail = emailSchema.parse(resetEmail.trim());

      // Restrict password reset to admin email only
      if (validatedEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        toast.error("Access restricted. Only authorized admin can reset password.");
        setResetLoading(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/auth`;

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

  if (isRecoveryMode) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
          <CardHeader className="space-y-4 text-center border-b border-slate-100 dark:border-slate-800 pb-8">
            <div className="mx-auto mb-3 bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 w-fit">
              <img 
                src={logoImage}
                alt="Sri Lakshmi Mangalya Malai" 
                className="w-20 h-20 mx-auto object-contain"
              />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                Reset Password
              </CardTitle>
              <p className="text-[26px] font-cursive text-slate-600 dark:text-slate-400">
                Sri Lakshmi Mangalya Malai
              </p>
            </div>
            <CardDescription className="text-slate-600 dark:text-slate-400 font-medium">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be 8+ characters with uppercase, lowercase, number, and special character
                </p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full" 
                onClick={handleGenerateNewPassword}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Strong Password
              </Button>
              <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900" disabled={updatePasswordLoading}>
                <KeyRound className="w-4 h-4 mr-2" />
                {updatePasswordLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
        <CardHeader className="space-y-4 text-center border-b border-slate-100 dark:border-slate-800 pb-8">
          <div className="mx-auto mb-3 bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 w-fit">
            <img 
              src={logoImage}
              alt="Sri Lakshmi Mangalya Malai" 
              className="w-20 h-20 mx-auto object-contain"
            />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              Admin Portal
            </CardTitle>
            <p className="text-[26px] font-cursive text-slate-600 dark:text-slate-400">
              Sri Lakshmi Mangalya Malai
            </p>
          </div>
          <CardDescription className="text-slate-600 dark:text-slate-400 font-medium">
            Securely manage detailed person records with image storage
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="signin" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900" disabled={loading}>
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
                        Enter your admin email to receive a password reset link.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Admin Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="vijayalakshmijayakumar45@gmail.com"
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
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be 8+ characters with uppercase, lowercase, number, and special character
                  </p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleGeneratePassword}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Strong Password
                </Button>
                <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900" disabled={loading}>
                  <Users className="w-4 h-4 mr-2" />
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;