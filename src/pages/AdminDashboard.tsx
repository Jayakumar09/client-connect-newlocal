import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, LogOut, Users, UserCheck, AlertCircle, MessageSquare, Heart, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import PersonCard from "@/components/PersonCard";
import PersonDialog from "@/components/PersonDialog";
import PersonViewDialog from "@/components/PersonViewDialog";
import ClientProfileViewDialog from "@/components/ClientProfileViewDialog";
import ClientProfileDialog from "@/components/ClientProfileDialog";
import MatchDialog from "@/components/MatchDialog";
import { BackupButton } from "@/components/BackupButton";
import { StorageSummaryCard } from "@/components/StorageSummary";
import { Tables } from "@/integrations/supabase/types";
import { useStorageSummary, useSystemHealth } from "@/hooks/useStorageSummary";
import { Pencil } from "lucide-react";
import { PaginatedRecordGrid } from "@/components/PaginatedRecordGrid";
import { dedupeUrls } from "@/lib/image-utils";

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
  profile_id?: string;
  match_status?: 'active' | 'matched';
  matched_at?: string | null;
  matched_by?: string | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
}

type ClientProfile = Tables<"client_profiles"> & {
  match_status?: 'not_matched' | 'matched' | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
};

const isDev = import.meta.env.DEV;

function log(prefix: string, message: string, data?: unknown) {
  if (isDev) {
    console.log(`[AdminDashboard] [${prefix}] ${message}`, data ?? '');
  }
}

const AdminDashboard = () => {
  console.log('[AdminDashboard] === START RENDER ===');
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, loading: authLoading, signOut } = useAuth();
  
  const personsRef = useRef<Person[]>([]);
  const lastFetchedAtRef = useRef<number>(0);
  
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
  
  // Match Dialog State
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [matchProfileType, setMatchProfileType] = useState<'person' | 'client_profile'>('person');
  const [matchProfile, setMatchProfile] = useState<{ id: string; name: string; profile_id?: string } | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [adminPage, setAdminPage] = useState(1);
  const [clientPage, setClientPage] = useState(1);
  const PAGE_SIZE = 6;

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
      await Promise.all([fetchPersons(), fetchClientProfiles(), fetchUnreadCount()]);
    } catch (err) {
      console.error('[AdminDashboard] Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      setUnreadTotal(count || 0);
    } catch (err) {
      console.error('[AdminDashboard] Error fetching unread count:', err);
    }
  };

  const fetchPersons = async () => {
    const fetchId = Date.now();
    log('fetchPersons', `Starting fetch (id: ${fetchId})`);

    try {
      const { data, error } = await supabase
        .from("persons")
        .select("*")
        .order("slno", { ascending: true });

      if (error) {
        console.error('[AdminDashboard] Error fetching persons:', error);
        throw error;
      }
      
      log('fetchPersons', `Fetched ${data?.length || 0} records from DB`);
      
      const personsWithSignedUrls = await Promise.all(
        (data || []).map(async (person) => {
          if (person.image_urls?.length > 0) {
            const signedUrls: string[] = [];
            for (const url of person.image_urls) {
              const urlParts = url.split('/');
              const filePath = urlParts.slice(-2).join('/');
              const { data: signedData } = await supabase.storage
                .from("person-images")
                .createSignedUrl(filePath, 3600);
              signedUrls.push(signedData?.signedUrl || url);
            }
            const dedupedSignedUrls = dedupeUrls(signedUrls, 'fetchPersons signedUrls');
            log('fetchPersons', `Person ${person.id}: ${person.image_urls.length} -> ${dedupedSignedUrls.length} (after dedupe)`);
            return { ...person, image_urls: dedupedSignedUrls };
          }
          return person;
        })
      );
      
      log('fetchPersons', `Setting state with ${personsWithSignedUrls.length} persons`);
      personsRef.current = personsWithSignedUrls;
      lastFetchedAtRef.current = fetchId;
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

  const handleDeleteProfile = async (profile: ClientProfile) => {
    if (!confirm(`Are you sure you want to delete profile for ${profile.full_name}?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('client_profiles')
        .delete()
        .eq('id', profile.id);
      
      if (error) throw error;
      
      toast.success('Profile deleted successfully');
      fetchClientProfiles();
    } catch (err) {
      console.error('[AdminDashboard] Delete profile error:', err);
      toast.error('Failed to delete profile');
    }
  };

  const handleDialogClose = () => {
    log('dialogClose', 'Closing dialog, refreshing data');
    setIsDialogOpen(false);
    setEditingPerson(null);
    fetchPersons();
  };

  const handleClientDialogClose = () => {
    setIsClientDialogOpen(false);
    setEditingClientProfile(null);
    fetchClientProfiles();
  };

  const handleMarkMatched = (type: 'person' | 'client_profile', profile: any) => {
    setMatchProfileType(type);
    setMatchProfile(profile);
    setMatchDialogOpen(true);
  };

  const handleMatchSuccess = () => {
    fetchPersons();
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setAdminPage(1);
    setClientPage(1);
  };

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
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                SL
              </div>
              <div className="flex-1 text-center">
                <h1 className="text-3xl font-cursive bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  SRI LAKSHMI MANGALYA MALAI
                </h1>
                <p className="text-sm text-muted-foreground">Admin Dashboard • {user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate('/admin-messages')}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
                {unreadTotal > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {unreadTotal > 9 ? '9+' : unreadTotal}
                  </span>
                )}
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
              <Button onClick={() => { setEditingPerson(null); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Admin Record
              </Button>
            </div>
          </div>
          
          <input
            type="text"
            placeholder="Search by name, phone, email, or city..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Admin Records Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Admin Records ({filteredPersons.length})
          </h3>
          <PaginatedRecordGrid
            items={filteredPersons}
            page={adminPage}
            pageSize={PAGE_SIZE}
            onPageChange={setAdminPage}
            containerHeight="max-h-[60vh] md:max-h-[500px]"
            renderItem={(person, globalIndex) => (
              <PersonCard
                key={person.id}
                person={person}
                globalIndex={globalIndex}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMarkMatched={(p) => handleMarkMatched('person', p)}
              />
            )}
            emptyMessage={searchQuery ? "No Results Found" : "No Admin Records Yet"}
            emptyDescription={searchQuery ? "Try a different search term" : "Get started by adding your first person record"}
            actionButton={
              !searchQuery && (
                <Button onClick={() => { setEditingPerson(null); setIsDialogOpen(true); }} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Record
                </Button>
              )
            }
          />
        </div>

        {/* Client Profiles Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client Profiles ({filteredClientProfiles.length})
          </h3>
          <PaginatedRecordGrid
            items={filteredClientProfiles}
            page={clientPage}
            pageSize={PAGE_SIZE}
            onPageChange={setClientPage}
            containerHeight="max-h-[60vh] md:max-h-[500px]"
            renderItem={(profile, globalIndex) => {
                const isMatched = profile.match_status === 'matched';
                return (
                  <Card key={profile.id} className={`overflow-hidden hover:shadow-lg transition-shadow ${isMatched ? 'opacity-90' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg">
                              {profile.full_name}
                            </CardTitle>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              profile.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                              profile.payment_status === 'non_paid' ? 'bg-red-100 text-red-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {profile.payment_status === 'paid' ? '{P}' :
                               profile.payment_status === 'non_paid' ? '{NP}' : '{F}'}
                            </span>
                            {isMatched && (
                              <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Matched
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              SL No: {globalIndex + 1}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className="relative">
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
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                {profile.full_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {isMatched && (
                              <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5">
                                <CheckCircle2 className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          {profile.profile_id && (
                            <Badge variant="outline" className="text-xs font-mono mt-1">
                              {profile.profile_id}
                            </Badge>
                          )}
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewClientProfile(profile)}>
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleMarkMatched('client_profile', profile)}
                        >
                          <Heart className="w-4 h-4 mr-1" />
                          Match
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEditClientProfile(profile)}>
                          <Pencil className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleDeleteProfile(profile)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {isMatched ? 'Profile matched successfully' : 'Admin can only modify payment status'}
                      </p>
                    </CardContent>
                  </Card>
                );
              }}
            emptyMessage={searchQuery ? "No Results Found" : "No Client Profiles Yet"}
            emptyDescription={searchQuery ? "Try a different search term" : "Client profiles will appear here when clients register"}
          />
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
        onMarkMatched={(p) => handleMarkMatched('person', p)}
      />

      <ClientProfileViewDialog
        profile={viewingClientProfile}
        open={!!viewingClientProfile}
        onClose={() => setViewingClientProfile(null)}
        onMarkMatched={(p) => handleMarkMatched('client_profile', p)}
      />

      <ClientProfileDialog
        open={isClientDialogOpen}
        onClose={handleClientDialogClose}
        profile={editingClientProfile}
      />

      <MatchDialog
        open={matchDialogOpen}
        onClose={() => { setMatchDialogOpen(false); setMatchProfile(null); }}
        profileType={matchProfileType}
        profileId={matchProfile?.id || ''}
        profileName={matchProfile?.name || ''}
        profileCode={matchProfile?.profile_id || matchProfile?.id?.slice(0, 8) || ''}
        onMatchSuccess={handleMatchSuccess}
      />
    </div>
  );
};

export default AdminDashboard;
