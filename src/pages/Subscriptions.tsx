import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CalendarCheck, 
  Clock, 
  Crown, 
  Shield,
  Search,
  ArrowLeft,
  User,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { BRAND_LOGO } from "@/lib/branding";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  price_paid: number;
  auto_renew: boolean;
  client_profiles?: {
    full_name: string;
    phone_number: string | null;
  };
}

const planNames: Record<string, string> = {
  free: "Free Plan",
  standard: "Standard Plan",
  premium: "Premium Plan",
  elite: "Elite Plan",
};

const Subscriptions = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(subs?.map(s => s.user_id) || [])];
      const { data: profiles } = await supabase
        .from("client_profiles")
        .select("user_id, full_name, phone_number")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      const enrichedSubs: Subscription[] = subs?.map(s => ({
        ...s,
        client_profiles: profileMap.get(s.user_id) || undefined
      })) || [];

      setSubscriptions(enrichedSubs);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAuthAndFetch = useCallback(async () => {
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

    await fetchSubscriptions();
  }, [fetchSubscriptions, navigate]);

  useEffect(() => {
    void checkAuthAndFetch();
  }, [checkAuthAndFetch]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-800 border-green-200",
      expired: "bg-red-100 text-red-800 border-red-200",
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      cancelled: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  const getPlanBadge = (plan: string) => {
    const styles: Record<string, string> = {
      free: "bg-gray-100 text-gray-700",
      standard: "bg-blue-100 text-blue-700",
      premium: "bg-purple-100 text-purple-700",
      elite: "bg-amber-100 text-amber-700",
    };
    return styles[plan] || "bg-gray-100 text-gray-700";
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = searchTerm === "" || 
      sub.client_profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.client_profiles?.phone_number?.includes(searchTerm);
    
    const matchesTab = activeTab === "all" || sub.status === activeTab;
    
    return matchesSearch && matchesTab;
  });

  const counts = {
    all: subscriptions.length,
    active: subscriptions.filter(s => s.status === "active").length,
    pending: subscriptions.filter(s => s.status === "pending").length,
    expired: subscriptions.filter(s => s.status === "expired").length,
    cancelled: subscriptions.filter(s => s.status === "cancelled").length,
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
            <img src={BRAND_LOGO} alt="Sri Lakshmi Mangalya Mahal" className="h-12 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">ALL SUBSCRIPTIONS</span>
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
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchSubscriptions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-4">
                <p className="text-sm text-blue-600">Total</p>
                <p className="text-2xl font-bold text-blue-700">{counts.all}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="pt-4">
                <p className="text-sm text-green-600">Active</p>
                <p className="text-2xl font-bold text-green-700">{counts.active}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="pt-4">
                <p className="text-sm text-yellow-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-700">{counts.pending}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardContent className="pt-4">
                <p className="text-sm text-red-600">Expired</p>
                <p className="text-2xl font-bold text-red-700">{counts.expired}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-gray-700">{counts.cancelled}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-green-100">Active</TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-100">Pending</TabsTrigger>
              <TabsTrigger value="expired" className="data-[state=active]:bg-red-100">Expired</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {filteredSubscriptions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No {activeTab === "all" ? "" : activeTab} subscriptions found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredSubscriptions.map((subscription) => (
                    <Card key={subscription.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* User Info */}
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-full bg-primary/10">
                              <User className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">
                                {subscription.client_profiles?.full_name || "Unknown User"}
                              </h3>
                              {subscription.client_profiles?.profile_id && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {subscription.client_profiles.profile_id}
                                </p>
                              )}
                              {subscription.client_profiles?.phone_number && (
                                <p className="text-sm text-muted-foreground">
                                  📞 {subscription.client_profiles.phone_number}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Subscription Details */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8">
                            <div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Shield className="h-3 w-3" /> Plan
                              </p>
                              <Badge className={getPlanBadge(subscription.plan_type)}>
                                {planNames[subscription.plan_type]}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <CalendarCheck className="h-3 w-3" /> Start
                              </p>
                              <p className="font-medium text-sm">{formatDate(subscription.start_date)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> End
                              </p>
                              <p className="font-medium text-sm">{formatDate(subscription.end_date)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Amount Paid</p>
                              <p className="font-semibold">₹{Number(subscription.price_paid).toLocaleString()}</p>
                            </div>
                          </div>

                          {/* Status */}
                          <Badge className={getStatusBadge(subscription.status)}>
                            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Subscriptions;
