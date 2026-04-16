import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, Settings } from "lucide-react";
import { BRAND_LOGO } from "@/lib/branding";
import ConversationList from "@/components/ConversationList";
import ChatWindow from "@/components/ChatWindow";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import { Conversation } from "@/hooks/useMessages";

const Messages = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showSettings, setShowSettings] = useState(false);

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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={BRAND_LOGO} alt="Sri Lakshmi Mangalya Malai" className="h-12 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">MESSAGES</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(isAdmin ? "/dashboard" : "/browse")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isAdmin ? "Dashboard" : "Browse"}
            </Button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="container mx-auto px-4 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notification Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <PushNotificationToggle />
            </CardContent>
          </Card>
        </div>
      )}

      <main className="flex-1 container mx-auto px-4 py-4">
        <Card className="h-[calc(100vh-200px)]">
          {selectedConversation ? (
            <ChatWindow
              partnerId={selectedConversation.partnerId}
              partnerName={selectedConversation.partnerName}
              partnerPhoto={selectedConversation.partnerPhoto}
              onBack={() => setSelectedConversation(null)}
            />
          ) : (
            <>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ConversationList onSelectConversation={setSelectedConversation} />
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Messages;
