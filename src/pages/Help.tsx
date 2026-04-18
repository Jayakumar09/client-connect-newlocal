import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, HelpCircle, Phone, Mail, MapPin, Clock } from "lucide-react";
import { BRAND_LOGO } from "@/lib/branding";

const Help = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!roleData);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={BRAND_LOGO} alt="Sri Lakshmi Mangalya Mahal" className="h-12 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">HELP & SUPPORT</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate(isAdmin ? "/dashboard" : "/browse")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isAdmin ? "Back to Dashboard" : "Back to Browse"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <HelpCircle className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Need Help?</CardTitle>
              <CardDescription>
                We're here to assist you with any questions or concerns
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Phone className="h-5 w-5 text-primary" />
                  Contact Us
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a 
                  href="tel:+917639150271" 
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  +91 7639150271
                </a>
                <a 
                  href="mailto:vijayalakshmijayakumar45@gmail.com" 
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="break-all">vijayalakshmijayakumar45@gmail.com</span>
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-primary" />
                  Business Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-muted-foreground">
                <p>Monday - Saturday: 9:00 AM - 7:00 PM</p>
                <p>Sunday: 10:00 AM - 5:00 PM</p>
                <p className="text-sm text-primary">Available on all days for urgent queries</p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                  Visit Us
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sri Lakshmi Mangalya Mahal<br />
                  Tamil Nadu, India
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium">How do I create a profile?</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Sign up using your email and fill in your profile details. You can also add photos to make your profile more attractive.
                </p>
              </div>
              <div>
                <h4 className="font-medium">What are the subscription plans?</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  We offer Free, Standard, Premium, and Elite plans. Visit the Plans page to see detailed features and pricing.
                </p>
              </div>
              <div>
                <h4 className="font-medium">How do I verify my payment?</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  After making a payment, submit your transaction details through the Payments page. Our admin team will verify and activate your subscription within 24 hours.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Help;
