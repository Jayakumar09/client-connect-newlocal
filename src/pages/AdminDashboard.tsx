import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, LogOut, Users, UserCheck, AlertCircle } from "lucide-react";
import PersonCard from "@/components/PersonCard";
import PersonDialog from "@/components/PersonDialog";
import PersonViewDialog from "@/components/PersonViewDialog";
import ClientProfileViewDialog from "@/components/ClientProfileViewDialog";
import ClientProfileDialog from "@/components/ClientProfileDialog";
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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, loading: authLoading, signOut } = useAuth();
  
  const [persons, setPersons] = useState<Person[]>([]);
  const [clientProfiles, setClientProfiles] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null);
  const [viewingClientProfile, setViewingClientProfile] = useState<ClientProfile | null>(null);
  const [editingClientProfile, setEditingClientProfile] = useState<ClientProfile | null>(null);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { storage, loading: storageLoading } = useStorageSummary();
  const { health } = useSystemHealth();

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    
    if (!isAdmin) {
      navigate("/client-dashboard");
      return;
    }
    
    fetchData();
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const fetchData = async () => {
    try {
      setError(null);
      await Promise.all([fetchPersons(), fetchClientProfiles()]);
    } catch (err) {
      console.error('[AdminDashboard] Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPersons = async () => {
    try {
      const { data, error } = await supabase
        .from("persons")
        .select("*")
        .order("slno", { ascending: true });

      if (error) {
        console.error('[AdminDashboard] Error fetching persons:', error);
        throw error;
      }
      
      const personsWithSignedUrls = await Promise.all(
        (data || []).map(async (person) => {
          if (person.image_urls?.length > 0) {
            const signedUrls = await Promise.all(
              person.image_urls.map(async (url: string) => {
                const urlParts = url.split('/');
                const filePath = urlParts.slice(-2).join('/');
                const { data: signedData } = await supabase.storage
                  .from("person-images")
                  .createSignedUrl(filePath, 3600);
                return signedData?.signedUrl || url;
              })
            );
            return { ...person, image_urls: signedUrls };
          }
          return person;
        })
      );
      
      setPersons(personsWithSignedUrls);
    } catch (err) {
      console.error('[AdminDashboard] fetchPersons error:', err);
      toast.error("Failed to load person records");
    }
  };

  const fetchClientProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error('[AdminDashboard] Error fetching client profiles:', error);
        toast.error(`Failed to load client profiles: ${error.message}`);
        return;
      }
      
      setClientProfiles(data || []);
    } catch (err) {
      console.error('[AdminDashboard] fetchClientProfiles error:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleDelete = async (id: string, imageUrls: string[]) => {
    try {
      if (imageUrls?.length > 0) {
        const filePaths = imageUrls.map(url => {
          const urlParts = url.split('/');
          return urlParts.slice(-2).join('/');
        });
        await supabase.storage.from("person-images").remove(filePaths);
      }

      const { error } = await supabase.from("persons").delete().eq("id", id);
      if (error) throw error;

      toast.success("Person record deleted successfully");
      fetchPersons();
    } catch (err) {
      console.error('[AdminDashboard] Delete error:', err);
      toast.error("Failed to delete person record");
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

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingPerson(null);
    fetchPersons();
  };

  const handleClientDialogClose = () => {
    setIsClientDialogOpen(false);
    setEditingClientProfile(null);
    fetchClientProfiles();
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/browse')}>
              Go to Browse
            </Button>
          </CardContent>
        </Card>
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
                <p className="text-sm text-muted-foreground">Admin Dashboard • {user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate('/browse')}>
                View Site
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Admin Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{persons.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Client Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{clientProfiles.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {clientProfiles.filter(p => p.is_profile_active).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Storage</CardTitle>
            </CardHeader>
            <CardContent>
              {storage ? (
                <p className="text-3xl font-bold">{storage.usagePercent.toFixed(1)}%</p>
              ) : (
                <p className="text-xl">-</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Manage Records</h2>
              <p className="text-muted-foreground">
                {filteredPersons.length + filteredClientProfiles.length} total records
                {searchQuery ? ` found (${persons.length + clientProfiles.length} total)` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <BackupButton />
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Admin Record
              </Button>
            </div>
          </div>
          
          <input
            type="text"
            placeholder="Search by name, phone, email, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Admin Records Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Admin Records ({filteredPersons.length})
          </h3>
          {filteredPersons.length === 0 ? (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>{searchQuery ? "No Results Found" : "No Admin Records Yet"}</CardTitle>
                <CardDescription>
                  {searchQuery ? "Try a different search term" : "Get started by adding your first person record"}
                </CardDescription>
              </CardHeader>
              {!searchQuery && (
                <CardContent>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Record
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
        </div>

        {/* Client Profiles Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client Profiles ({filteredClientProfiles.length})
          </h3>
          {filteredClientProfiles.length === 0 ? (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>{searchQuery ? "No Results Found" : "No Client Profiles Yet"}</CardTitle>
                <CardDescription>
                  {searchQuery ? "Try a different search term" : "Client profiles will appear here when clients register"}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredClientProfiles.map((profile) => (
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
                          {profile.full_name}
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            profile.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 
                            profile.payment_status === 'non_paid' ? 'bg-red-100 text-red-700' : 
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {profile.payment_status === 'paid' ? '{P}' : 
                             profile.payment_status === 'non_paid' ? '{NP}' : '{F}'}
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
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewClientProfile(profile)}>
                        View
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleEditClientProfile(profile)}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Payment
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Admin can only modify payment status
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
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

export default AdminDashboard;
