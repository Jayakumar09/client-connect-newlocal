import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Zap, Shield } from "lucide-react";
import { toast } from "sonner";
import { BRAND_LOGO } from "@/lib/branding";
import { Link } from "react-router-dom";

interface Plan {
  id: string;
  name: string;
  price: string;
  duration: string;
  features: string[];
  icon: React.ReactNode;
  popular?: boolean;
  current?: boolean;
}

const Plans = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/client-auth");
        return;
      }
      setUser(session.user);
      
      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!roleData);
      
      // Fetch user's current active subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_type")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .maybeSingle();
      
      setCurrentPlan(subscription?.plan_type || "free");
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const plans: Plan[] = [
    {
      id: "free",
      name: "Free Plan",
      price: "₹0",
      duration: "Forever",
      icon: <Shield className="h-8 w-8" />,
      current: currentPlan === "free",
      features: [
        "Create profile with basic details",
        "Basic search filters",
        "Receive match suggestions",
        "Send Interest requests only",
        "Cannot view direct contact details",
        "Basic (Email/Phone) verification",
      ],
    },
    {
      id: "standard",
      name: "Standard Plan",
      price: "₹2,500",
      duration: "6 months",
      icon: <Star className="h-8 w-8" />,
      popular: true,
      current: currentPlan === "standard",
      features: [
        "Priority Visibility (Top search ranking)",
        "View Contact Details (Phone/Email) of accepted profiles",
        "Unlimited chat/messaging",
        "Enhanced Verification (ID Proof, Education)",
        "Verified Badge on profile",
        "Email & SMS notifications",
      ],
    },
    {
      id: "premium",
      name: "Premium Plan",
      price: "₹5,000",
      duration: "12 months",
      icon: <Crown className="h-8 w-8" />,
      current: currentPlan === "premium",
      features: [
        "All Standard Plan features",
        "Dedicated relationship manager",
        "Profile highlighting in search",
        "Priority customer support",
        "Advanced matching algorithm",
        "Profile boost every month",
      ],
    },
    {
      id: "elite",
      name: "Elite Plan",
      price: "₹10,000",
      duration: "24 months",
      icon: <Zap className="h-8 w-8" />,
      current: currentPlan === "elite",
      features: [
        "All Premium Plan features",
        "Personal matchmaking assistance",
        "Background verification included",
        "Exclusive elite member events",
        "VIP badge on profile",
        "Unlimited profile boosts",
      ],
    },
  ];

  const handleSelectPlan = (planId: string) => {
    if (planId === "free") {
      toast.info("You are already on the Free plan");
      return;
    }
    navigate(`/payments?plan=${planId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={isAdmin ? "/dashboard" : "/browse"} className="flex items-center gap-3">
            <img src={BRAND_LOGO} alt="Sri Lakshmi Mangalya Mahal" className="h-12 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">SUBSCRIPTION PLANS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate(isAdmin ? "/dashboard" : "/browse")}>
              {isAdmin ? "Back to Dashboard" : "Back to Browse"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">Choose Your Plan</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upgrade your membership to unlock premium features and find your perfect match faster
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative transition-all hover:shadow-xl ${
                plan.popular ? "border-primary shadow-lg scale-105" : ""
              } ${plan.current ? "ring-2 ring-primary" : ""}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  Most Popular
                </Badge>
              )}
              {plan.current && (
                <Badge className="absolute -top-3 right-4 bg-green-600">
                  Current Plan
                </Badge>
              )}
              <CardHeader className="text-center pb-4">
                <div className={`mx-auto mb-3 p-3 rounded-full ${
                  plan.popular ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
                }`}>
                  {plan.icon}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground"> / {plan.duration}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full" 
                  variant={plan.current ? "outline" : plan.popular ? "default" : "secondary"}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={plan.current}
                >
                  {plan.current ? "Current Plan" : plan.id === "free" ? "Free Forever" : "Select Plan"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Have questions about our plans?{" "}
            <Link to="/help" className="text-primary hover:underline">
              Contact our support team
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Plans;
