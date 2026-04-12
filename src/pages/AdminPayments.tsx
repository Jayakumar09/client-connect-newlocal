import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  ArrowLeft,
  RefreshCw,
  User
} from "lucide-react";
import { toast } from "sonner";
import logoImage from "@/assets/sri-lakshmi-logo.png";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface PaymentWithProfile {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  payment_method: string;
  transaction_reference: string | null;
  status: string;
  plan_type: string;
  notes: string | null;
  created_at: string;
  client_profiles?: {
    full_name: string;
    phone_number: string | null;
    email: string | null;
  };
}

const planNames: Record<string, string> = {
  free: "Free Plan",
  standard: "Standard Plan",
  premium: "Premium Plan",
  elite: "Elite Plan",
};

const AdminPayments = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentWithProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      toast.error("Access denied. Admin only.");
      navigate("/auth");
      return;
    }

    await fetchPayments();
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // Fetch payments
      const { data: paymentsData, error: payError } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (payError) throw payError;
      
      // Fetch client profiles separately
      const userIds = [...new Set(paymentsData?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from("client_profiles")
        .select("user_id, full_name, phone_number, email")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const enrichedPayments: PaymentWithProfile[] = paymentsData?.map(p => ({
        ...p,
        client_profiles: profileMap.get(p.user_id) || undefined
      })) || [];

      setPayments(enrichedPayments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (paymentId: string, subscriptionId: string | null, userId: string, planType: string) => {
    setProcessingId(paymentId);
    try {
      // Update payment status to completed
      const { error: payError } = await supabase
        .from("payments")
        .update({ status: "completed" })
        .eq("id", paymentId);

      if (payError) throw payError;

      // Update subscription status to active
      if (subscriptionId) {
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({ status: "active" })
          .eq("id", subscriptionId);

        if (subError) throw subError;
      }

      // Send notification to the client
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Payment Verified ✅",
        message: `Your payment for ${planNames[planType]} has been verified. Your subscription is now active!`,
        type: "success"
      });

      toast.success("Payment verified and subscription activated!");
      await fetchPayments();
    } catch (error) {
      console.error("Error verifying payment:", error);
      toast.error("Failed to verify payment");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPayment = async (paymentId: string, subscriptionId: string | null, userId: string, planType: string) => {
    setProcessingId(paymentId);
    try {
      // Update payment status to failed
      const { error: payError } = await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", paymentId);

      if (payError) throw payError;

      // Update subscription status to cancelled
      if (subscriptionId) {
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("id", subscriptionId);

        if (subError) throw subError;
      }

      // Send notification to the client
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Payment Rejected ❌",
        message: `Your payment for ${planNames[planType]} was not verified. Please contact support or try again.`,
        type: "error"
      });

      toast.success("Payment rejected");
      await fetchPayments();
    } catch (error) {
      console.error("Error rejecting payment:", error);
      toast.error("Failed to reject payment");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { className: string; icon: React.ReactNode }> = {
      pending: { 
        className: "bg-yellow-100 text-yellow-800 border-yellow-200", 
        icon: <Clock className="h-3 w-3" /> 
      },
      completed: { 
        className: "bg-green-100 text-green-800 border-green-200", 
        icon: <CheckCircle className="h-3 w-3" /> 
      },
      failed: { 
        className: "bg-red-100 text-red-800 border-red-200", 
        icon: <XCircle className="h-3 w-3" /> 
      },
      refunded: { 
        className: "bg-gray-100 text-gray-800 border-gray-200", 
        icon: <RefreshCw className="h-3 w-3" /> 
      },
    };
    return styles[status] || styles.pending;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy HH:mm");
    } catch {
      return dateString;
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = searchTerm === "" || 
      payment.client_profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.client_profiles?.phone_number?.includes(searchTerm) ||
      payment.transaction_reference?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeTab === "all" || payment.status === activeTab;
    
    return matchesSearch && matchesTab;
  });

  const counts = {
    all: payments.length,
    pending: payments.filter(p => p.status === "pending").length,
    completed: payments.filter(p => p.status === "completed").length,
    failed: payments.filter(p => p.status === "failed").length,
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
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={logoImage} alt="Sri Lakshmi Mangalya Mahal" className="h-12 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">PAYMENT VERIFICATION</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Search and Stats */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchPayments}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-100">
                Pending ({counts.pending})
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-green-100">
                Completed ({counts.completed})
              </TabsTrigger>
              <TabsTrigger value="failed" className="data-[state=active]:bg-red-100">
                Failed ({counts.failed})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {filteredPayments.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No {activeTab === "all" ? "" : activeTab} payments found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredPayments.map((payment) => {
                    const statusBadge = getStatusBadge(payment.status);
                    return (
                      <Card key={payment.id} className="overflow-hidden">
                        <CardContent className="p-6">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* User Info */}
                            <div className="flex items-start gap-4">
                              <div className="p-3 rounded-full bg-primary/10">
                                <User className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">
                                  {payment.client_profiles?.full_name || "Unknown User"}
                                </h3>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  {payment.client_profiles?.phone_number && (
                                    <p>📞 {payment.client_profiles.phone_number}</p>
                                  )}
                                  {payment.client_profiles?.email && (
                                    <p>✉️ {payment.client_profiles.email}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Payment Details */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8">
                              <div>
                                <p className="text-xs text-muted-foreground">Plan</p>
                                <p className="font-medium">{planNames[payment.plan_type]}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Amount</p>
                                <p className="font-semibold text-lg">₹{Number(payment.amount).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Method</p>
                                <p className="font-medium capitalize">{payment.payment_method.replace("_", " ")}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Date</p>
                                <p className="font-medium text-sm">{formatDate(payment.created_at)}</p>
                              </div>
                            </div>

                            {/* Status & Actions */}
                            <div className="flex flex-col items-end gap-3">
                              <Badge className={`${statusBadge.className} gap-1`}>
                                {statusBadge.icon}
                                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                              </Badge>
                              
                              {payment.transaction_reference && (
                                <p className="text-xs text-muted-foreground">
                                  Ref: {payment.transaction_reference}
                                </p>
                              )}

                              {payment.status === "pending" && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleVerifyPayment(payment.id, payment.subscription_id, payment.user_id, payment.plan_type)}
                                    disabled={processingId === payment.id}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Verify
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRejectPayment(payment.id, payment.subscription_id, payment.user_id, payment.plan_type)}
                                    disabled={processingId === payment.id}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default AdminPayments;
