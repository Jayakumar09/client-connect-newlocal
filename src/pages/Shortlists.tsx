import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Heart, Trash2, Loader2, Ban, Send } from "lucide-react";
import { useShortlist } from "@/hooks/useShortlist";
import { useBlockReport } from "@/hooks/useBlockReport";
import ClientProfileViewDialog from "@/components/ClientProfileViewDialog";
import InterestsPanel from "@/components/InterestsPanel";
import { ClientHeader } from "@/components/ClientHeader";

const Shortlists = () => {
  const navigate = useNavigate();
  const { shortlistedProfiles, loading: shortlistLoading, removeFromShortlist, fetchShortlist } = useShortlist();
  const { blockedIds, unblockUser, fetchBlockedUsers } = useBlockReport();
  const [blockedProfiles, setBlockedProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/client-auth");
        return;
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const fetchBlockedProfiles = async () => {
      if (blockedIds.size === 0) {
        setBlockedProfiles([]);
        return;
      }

      const { data } = await supabase
        .from('client_profiles')
        .select('*')
        .in('user_id', Array.from(blockedIds));
      
      setBlockedProfiles(data || []);
    };

    fetchBlockedProfiles();
  }, [blockedIds]);

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleRemoveFromShortlist = async (userId: string) => {
    await removeFromShortlist(userId);
  };

  const handleUnblock = async (userId: string) => {
    await unblockUser(userId);
    await fetchBlockedUsers();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
      <ClientHeader showBackButton />

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="interests" className="w-full">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-6">
            <TabsTrigger value="interests" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Interests
            </TabsTrigger>
            <TabsTrigger value="shortlist" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Shortlist ({shortlistedProfiles.length})
            </TabsTrigger>
            <TabsTrigger value="blocked" className="flex items-center gap-2">
              <Ban className="h-4 w-4" />
              Blocked ({blockedProfiles.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="interests">
            <InterestsPanel 
              onViewProfile={(userId) => {
                const profile = [...shortlistedProfiles, ...blockedProfiles].find(p => p.user_id === userId);
                if (profile) {
                  setSelectedProfile(profile);
                  setViewDialogOpen(true);
                }
              }}
              onMessageUser={() => navigate('/messages')}
            />
          </TabsContent>

          <TabsContent value="shortlist">
            {shortlistLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : shortlistedProfiles.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No shortlisted profiles yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Tap the heart icon on profiles you like to save them here
                </p>
                <Button onClick={() => navigate('/browse')} className="mt-4">
                  Browse Profiles
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {shortlistedProfiles.map((profile) => (
                  <Card key={profile.id} className="overflow-hidden bg-white/90">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <Avatar 
                          className="h-16 w-16 cursor-pointer"
                          onClick={() => {
                            setSelectedProfile(profile);
                            setViewDialogOpen(true);
                          }}
                        >
                          <AvatarImage src={profile.profile_photo || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                            {profile.full_name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-semibold">{profile.full_name}</h3>
                          {profile.profile_id && (
                            <Badge variant="outline" className="text-xs font-mono mt-1">
                              {profile.profile_id}
                            </Badge>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {calculateAge(profile.date_of_birth)} yrs
                            {profile.city && `, ${profile.city}`}
                          </p>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {profile.religion}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFromShortlist(profile.user_id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="blocked">
            {blockedProfiles.length === 0 ? (
              <div className="text-center py-20">
                <Ban className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No blocked users</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You haven't blocked anyone yet
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {blockedProfiles.map((profile) => (
                  <Card key={profile.id} className="overflow-hidden bg-white/90">
                    <CardContent className="p-4">
                      <div className="flex gap-4 items-center">
                        <Avatar className="h-12 w-12 grayscale">
                          <AvatarImage src={profile.profile_photo || undefined} />
                          <AvatarFallback className="bg-muted">
                            {profile.full_name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-semibold text-muted-foreground">{profile.full_name}</h3>
                          {profile.profile_id && (
                            <Badge variant="outline" className="text-xs font-mono mt-1">
                              {profile.profile_id}
                            </Badge>
                          )}
                          <p className="text-sm text-muted-foreground">Blocked</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnblock(profile.user_id)}
                        >
                          Unblock
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* View Dialog */}
      <ClientProfileViewDialog
        profile={selectedProfile}
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
      />
    </div>
  );
};

export default Shortlists;
