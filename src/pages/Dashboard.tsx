import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";
import { Plus, LogOut } from "lucide-react";
import PersonCard from "@/components/PersonCard";
import PersonDialog from "@/components/PersonDialog";
import PersonViewDialog from "@/components/PersonViewDialog";
import ClientProfileViewDialog from "@/components/ClientProfileViewDialog";
import ClientProfileDialog from "@/components/ClientProfileDialog";
import DashboardNav from "@/components/DashboardNav";
import { BackupButton } from "@/components/BackupButton";
import { StorageSummaryCard } from "@/components/StorageSummary";
import { Tables } from "@/integrations/supabase/types";
import { useStorageSummary, useSystemHealth } from "@/hooks/useStorageSummary";
import { Pencil } from "lucide-react";
import logoImage from "@/assets/sri-lakshmi-logo.png";

export interface Person {
  id: string;
  slno: number;
  name: string;
  address: string;
  phoneno: string;
  image_urls: string[];
  comments: string | null;
  created_at: string;
  updated_at: string;
  profile_image: string | null;
  payment_status: 'paid' | 'non_paid' | 'free';
}

type ClientProfile = Tables<"client_profiles">;

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [clientProfiles, setClientProfiles] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null);
  const [viewingClientProfile, setViewingClientProfile] = useState<ClientProfile | null>(null);
  const [editingClientProfile, setEditingClientProfile] = useState<ClientProfile | null>(null);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("admin");

  const { storage, loading: storageLoading, refetch: refetchStorage } = useStorageSummary();
  const { health, refetch: refetchHealth } = useSystemHealth();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchPersons();
      fetchClientProfiles();
    }
  }, [user]);

  const fetchPersons = async () => {
    try {
      const { data, error } = await supabase
        .from("persons")
        .select("*")
        .order("slno", { ascending: true });

      if (error) throw error;
      
      // Regenerate signed URLs for all images (since bucket is now private)
      const personsWithSignedUrls = await Promise.all(
        (data || []).map(async (person) => {
          if (person.image_urls && person.image_urls.length > 0) {
            const signedUrls = await Promise.all(
              person.image_urls.map(async (url: string) => {
                // Extract file path from existing URL
                const urlParts = url.split('/');
                const filePath = urlParts.slice(-2).join('/');
                
                // Generate new signed URL
                const { data: signedData } = await supabase.storage
                  .from("person-images")
                  .createSignedUrl(filePath, 3600); // 1 hour expiry
                
                return signedData?.signedUrl || url;
              })
            );
            return { ...person, image_urls: signedUrls };
          }
          return person;
        })
      );
      
      setPersons(personsWithSignedUrls);
    } catch (error) {
      toast.error("Failed to load person records");
    } finally {
      setLoading(false);
    }
  };

  const fetchClientProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .order("slno", { ascending: true });

      if (error) throw error;
      
      setClientProfiles(data || []);
    } catch (error) {
      console.error("Failed to load client profiles:", error);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to sign out");
    } else {
      toast.success("Signed out successfully");
      navigate("/auth");
    }
  };

  const handleDelete = async (id: string, imageUrls: string[]) => {
    try {
      // Delete images from storage
      if (imageUrls && imageUrls.length > 0) {
        const filePaths = imageUrls.map(url => {
          const urlParts = url.split('/');
          return urlParts.slice(-2).join('/'); // Get user_id/filename
        });

        await supabase.storage.from("person-images").remove(filePaths);
      }

      // Delete person record
      const { error } = await supabase.from("persons").delete().eq("id", id);

      if (error) throw error;

      toast.success("Person record deleted successfully");
      fetchPersons();
    } catch (error) {
      toast.error("Failed to delete person record");
    }
  };

  const handleDeleteClientProfile = async (id: string) => {
    try {
      const { error } = await supabase.from("client_profiles").delete().eq("id", id);

      if (error) throw error;

      toast.success("Client profile deleted successfully");
      fetchClientProfiles();
    } catch (error) {
      toast.error("Failed to delete client profile");
    }
  };

  const handleEdit = (person: Person) => {
    setEditingPerson(person);
    setIsDialogOpen(true);
  };

  const handleView = (person: Person) => {
    setViewingPerson(person);
  };

  const handleViewClientProfile = (profile: ClientProfile) => {
    setViewingClientProfile(profile);
  };

  const handleEditClientProfile = (profile: ClientProfile) => {
    setEditingClientProfile(profile);
    setIsClientDialogOpen(true);
  };

  const handleClientDialogClose = () => {
    setIsClientDialogOpen(false);
    setEditingClientProfile(null);
    fetchClientProfiles();
  };

  const getPaymentStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return { text: '{P}', className: 'text-green-600 font-bold' };
      case 'non_paid':
        return { text: '{NP}', className: 'text-red-600 font-bold' };
      case 'free':
      default:
        return { text: '{F}', className: 'text-orange-500 font-bold' };
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingPerson(null);
    fetchPersons();
  };

  const filteredPersons = persons.filter((person) => {
    const query = searchQuery.toLowerCase();
    return (
      person.name.toLowerCase().includes(query) ||
      person.phoneno.toLowerCase().includes(query) ||
      person.address.toLowerCase().includes(query)
    );
  });

  const filteredClientProfiles = clientProfiles.filter((profile) => {
    const query = searchQuery.toLowerCase();
    return (
      profile.full_name.toLowerCase().includes(query) ||
      (profile.phone_number && profile.phone_number.toLowerCase().includes(query)) ||
      (profile.email && profile.email.toLowerCase().includes(query)) ||
      (profile.city && profile.city.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface-2 to-surface-3">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={logoImage}
                alt="Sri Lakshmi" 
                className="w-12 h-12 object-contain"
              />
              <div className="flex-1 text-center">
                <h1 className="text-3xl font-cursive bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  SRI LAKSHMI MANGALYA MALAI
                </h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
          <nav className="mt-4 flex justify-center">
            <DashboardNav activeTab={activeTab} onTabChange={setActiveTab} />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Dashboard</h2>
              <p className="text-muted-foreground">
                {activeTab === "admin" 
                  ? `${filteredPersons.length} admin records${searchQuery ? ` found (${persons.length} total)` : ''}`
                  : `${filteredClientProfiles.length} client profiles${searchQuery ? ` found (${clientProfiles.length} total)` : ''}`
                }
              </p>
            </div>
            <div className="flex gap-2">
              {activeTab === "admin" && <BackupButton />}
              {activeTab === "admin" && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Person
                </Button>
              )}
            </div>
          </div>
          
          <input
            type="text"
            placeholder={activeTab === "admin" ? "Search by name, phone, or address..." : "Search by name, phone, email, or city..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {activeTab === "admin" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <StorageSummaryCard storage={storage} loading={storageLoading} showWarnings={true} />
            {health && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${health.supabaseConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span>Supabase: {health.supabaseConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${health.googleDriveConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span>Google Drive: {health.googleDriveConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                  </div>
                  {health.errors.length > 0 && (
                    <p className="text-xs text-red-500 mt-2">{health.errors.join(', ')}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="admin">Admin Records ({persons.length})</TabsTrigger>
            <TabsTrigger value="client">Client Profiles ({clientProfiles.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="admin">
            {filteredPersons.length === 0 ? (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>{searchQuery ? "No Results Found" : "No Records Yet"}</CardTitle>
                  <CardDescription>
                    {searchQuery 
                      ? "Try a different search term" 
                      : "Get started by adding your first person record"}
                  </CardDescription>
                </CardHeader>
                {!searchQuery && (
                  <CardContent>
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Person
                    </Button>
                  </CardContent>
                )}
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPersons.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="client">
            {filteredClientProfiles.length === 0 ? (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>{searchQuery ? "No Results Found" : "No Client Profiles Yet"}</CardTitle>
                  <CardDescription>
                    {searchQuery 
                      ? "Try a different search term" 
                      : "Client profiles will appear here when clients register"}
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredClientProfiles.map((profile) => {
                  const paymentBadge = getPaymentStatusBadge(profile.payment_status);
                  return (
                    <Card key={profile.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          {profile.profile_photo ? (
                            <img 
                              src={profile.profile_photo} 
                              alt={profile.full_name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-pink-200"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg ${profile.profile_photo ? 'hidden' : ''}`}>
                            {profile.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                              SL.No: {profile.slno} - {profile.full_name}
                              <span className={paymentBadge.className}>{paymentBadge.text}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${profile.created_by === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {profile.created_by === 'admin' ? 'Admin' : 'Client'}
                              </span>
                            </CardTitle>
                            <CardDescription>{profile.gender} • {profile.religion}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1 text-sm text-muted-foreground mb-4">
                          {profile.phone_number && <p>📞 {profile.phone_number}</p>}
                          {profile.email && <p>✉️ {profile.email}</p>}
                          {profile.city && <p>📍 {profile.city}, {profile.state}</p>}
                          {profile.occupation && <p>💼 {profile.occupation}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleViewClientProfile(profile)}
                          >
                            View
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleEditClientProfile(profile)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleDeleteClientProfile(profile.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <PersonDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        person={editingPerson}
      />

      <PersonViewDialog
        person={viewingPerson}
        open={!!viewingPerson}
        onClose={() => setViewingPerson(null)}
      />

      <ClientProfileViewDialog
        profile={viewingClientProfile}
        open={!!viewingClientProfile}
        onClose={() => setViewingClientProfile(null)}
      />

      <ClientProfileDialog
        open={isClientDialogOpen}
        onClose={handleClientDialogClose}
        profile={editingClientProfile}
      />
    </div>
  );
};

export default Dashboard;