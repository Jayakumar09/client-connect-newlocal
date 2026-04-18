import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Smartphone, CreditCard, Building2, QrCode, Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BRAND_LOGO } from "@/lib/branding";
import { Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

const planDetails: Record<string, { name: string; price: number; duration: string; months: number }> = {
  standard: { name: "Standard Plan", price: 2500, duration: "6 months", months: 6 },
  premium: { name: "Premium Plan", price: 5000, duration: "12 months", months: 12 },
  elite: { name: "Elite Plan", price: 10000, duration: "24 months", months: 24 },
};

const Payments = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan") || "standard";
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "card" | "bank_transfer">("upi");
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");

  const selectedPlan = planDetails[planId] || planDetails.standard;
  const upiId = "7639150271@ybl";
  const phoneNumber = "+91 7639150271";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/client-auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast.success("UPI ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitPayment = async () => {
    if (!user) return;
    
    setProcessing(true);
    
    try {
      // Calculate end date based on plan duration
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + selectedPlan.months);

      // Create subscription record
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          plan_type: planId as "free" | "standard" | "premium" | "elite",
          status: "pending",
          price_paid: selectedPlan.price,
          end_date: endDate.toISOString(),
        })
        .select()
        .single();

      if (subError) throw subError;

      // Create payment record
      const { error: payError } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          subscription_id: subscription.id,
          amount: selectedPlan.price,
          payment_method: paymentMethod,
          transaction_reference: transactionRef || null,
          status: "pending",
          plan_type: planId as "free" | "standard" | "premium" | "elite",
        });

      if (payError) throw payError;

      // Notify all admins about the new payment
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const adminNotifications = admins.map(admin => ({
          user_id: admin.user_id,
          title: "New Payment Submitted",
          message: `A client has submitted a payment of ₹${selectedPlan.price.toLocaleString()} for ${selectedPlan.name}. Please verify.`,
          type: "info",
          related_id: subscription.id,
          related_type: "payment"
        }));

        await supabase.from("notifications").insert(adminNotifications);
      }

      toast.success("Payment submitted! We will verify and activate your plan within 24 hours.");
      navigate("/subscriptions");
    } catch (error: unknown) {
      console.error("Payment error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit payment. Please try again.");
    } finally {
      setProcessing(false);
    }
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
          <Link to="/browse" className="flex items-center gap-3">
            <img src={BRAND_LOGO} alt="Sri Lakshmi Mangalya Mahal" className="h-12 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">PAYMENT</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate("/plans")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Plans
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Summary */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">{selectedPlan.name}</span>
                <Badge variant="secondary">{selectedPlan.duration}</Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">₹{selectedPlan.price.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                * GST included. Plan activates within 24 hours of payment verification.
              </p>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Select Payment Method</CardTitle>
              <CardDescription>Choose your preferred payment option</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                {/* UPI Option */}
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  paymentMethod === "upi" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="upi" id="upi" />
                    <Label htmlFor="upi" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <span className="font-medium">UPI Payment</span>
                    </Label>
                  </div>
                  {paymentMethod === "upi" && (
                    <div className="mt-4 pl-8 space-y-4">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <div className="bg-white p-4 rounded-lg inline-block mb-3">
                          <QrCode className="h-32 w-32 text-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Scan QR code or use UPI ID</p>
                        <div className="flex items-center justify-center gap-2 bg-background rounded-md p-2">
                          <span className="font-mono text-sm">{upiId}</span>
                          <Button variant="ghost" size="sm" onClick={handleCopyUPI}>
                            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Phone: {phoneNumber}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="upi-ref">Transaction Reference / UTR Number</Label>
                        <Input 
                          id="upi-ref" 
                          placeholder="Enter 12-digit UTR number after payment" 
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Option */}
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  paymentMethod === "card" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="font-medium">Credit / Debit Card</span>
                    </Label>
                  </div>
                  {paymentMethod === "card" && (
                    <div className="mt-4 pl-8 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="card-number">Card Number</Label>
                        <Input id="card-number" placeholder="1234 5678 9012 3456" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="expiry">Expiry Date</Label>
                          <Input id="expiry" placeholder="MM/YY" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cvv">CVV</Label>
                          <Input id="cvv" placeholder="123" type="password" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="card-name">Name on Card</Label>
                        <Input id="card-name" placeholder="Enter name as on card" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bank Transfer Option */}
                <div className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  paymentMethod === "bank_transfer" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                    <Label htmlFor="bank_transfer" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Building2 className="h-5 w-5 text-primary" />
                      <span className="font-medium">Bank Transfer / NEFT</span>
                    </Label>
                  </div>
                  {paymentMethod === "bank_transfer" && (
                    <div className="mt-4 pl-8 space-y-3">
                      <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account Name:</span>
                          <span className="font-medium">Sri Lakshmi Mangalya Mahal</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Account Number:</span>
                          <span className="font-medium">1234567890123</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IFSC Code:</span>
                          <span className="font-medium">SBIN0001234</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Bank:</span>
                          <span className="font-medium">State Bank of India</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bank-ref">Transaction Reference Number</Label>
                        <Input 
                          id="bank-ref" 
                          placeholder="Enter transaction reference after transfer" 
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </RadioGroup>

              <Separator />

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleSubmitPayment}
                disabled={processing}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  `Pay ₹${selectedPlan.price.toLocaleString()}`
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By proceeding, you agree to our Terms of Service and Privacy Policy.
                Payment will be verified manually within 24 hours.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Payments;
