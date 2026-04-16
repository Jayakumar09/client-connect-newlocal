import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Upload, X, Save, Heart, Plus, CheckCircle2, Circle } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { format } from "date-fns";
import imageCompression from 'browser-image-compression';
import { ClientHeader } from "@/components/ClientHeader";
import { z } from "zod";
import { Tables } from "@/integrations/supabase/types";
import { calculateProfileCompletion, getProfileCompletionBreakdown, getFieldLabel } from "@/lib/profileCompletion";

type ClientProfile = Tables<"client_profiles"> & {
  match_status?: 'not_matched' | 'matched' | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
};

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const profileFormSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone_number: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  religion: z.enum(['hindu', 'muslim', 'christian', 'sikh', 'buddhist', 'jain', 'other']),
  profile_created_for: z.enum(['self', 'parents', 'siblings', 'relatives', 'friends']),
  caste: z.string().optional(),
  sub_caste: z.string().optional(),
  mother_tongue: z.string().optional(),
  height_cm: z.string().optional(),
  weight_kg: z.string().optional(),
  complexion: z.string().optional(),
  marital_status: z.enum(['never_married', 'divorced', 'widowed', 'awaiting_divorce', 'married']),
  birth_time: z.string().optional(),
  birth_place: z.string().optional(),
  star: z.string().optional(),
  rasi: z.string().optional(),
  education: z.string().optional(),
  occupation: z.string().optional(),
  annual_income: z.string().optional(),
  working_location: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("India"),
  father_name: z.string().optional(),
  father_occupation: z.string().optional(),
  mother_name: z.string().optional(),
  mother_occupation: z.string().optional(),
  number_of_brothers: z.string().optional(),
  number_of_sisters: z.string().optional(),
  about_me: z.string().optional(),
  partner_expectations: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const ClientProfile = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [existingGalleryImages, setExistingGalleryImages] = useState<string[]>([]);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    return calculateProfileCompletion(profile);
  }, [profile]);

  const completionBreakdown = useMemo(() => {
    if (!profile) return null;
    return getProfileCompletionBreakdown(profile);
  }, [profile]);

  const [formData, setFormData] = useState<Partial<ProfileFormData>>({
    country: "India",
    gender: 'male',
    religion: 'hindu',
    profile_created_for: 'self',
    marital_status: 'never_married',
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      navigate('/client-auth');
      return;
    }
    
    if (isAdmin) {
      navigate('/dashboard');
      return;
    }
    
    fetchProfile();
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  const fetchProfile = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        console.error('[ClientProfile] No authenticated user');
        navigate("/client-auth");
        return;
      }

      console.log('[ClientProfile] Fetching profile for user:', authUser.id);

      if (authUser.last_sign_in_at) {
        setLastSignIn(authUser.last_sign_in_at);
      }

      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (error) {
        console.error('[ClientProfile] Fetch error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        toast.error(`Failed to load profile: ${error.message}`);
        setLoading(false);
        return;
      }
      
      if (!data) {
        console.log('[ClientProfile] No profile found - showing create form');
        setIsNewUser(true);
        setLoading(false);
        return;
      }
      
      console.log('[ClientProfile] Profile found:', data.id, {
        userId: data.user_id,
        fullName: data.full_name,
        paymentStatus: data.payment_status,
        isProfileActive: data.is_profile_active,
      });
      setProfile(data);
      setIsNewUser(false);
      
      if (data.profile_photo) {
        setProfilePhotoPreview(data.profile_photo);
      }
      if (data.gallery_images && data.gallery_images.length > 0) {
        setExistingGalleryImages(data.gallery_images);
      }
      
      setFormData({
        full_name: data.full_name,
        phone_number: data.phone_number || '',
        gender: data.gender,
        date_of_birth: data.date_of_birth,
        religion: data.religion,
        profile_created_for: data.profile_created_for,
        caste: data.caste || '',
        sub_caste: data.sub_caste || '',
        mother_tongue: data.mother_tongue || '',
        height_cm: data.height_cm?.toString() || '',
        weight_kg: data.weight_kg?.toString() || '',
        complexion: data.complexion || '',
        marital_status: data.marital_status,
        birth_time: data.birth_time || '',
        birth_place: data.birth_place || '',
        star: data.star || '',
        rasi: data.rasi || '',
        education: data.education || '',
        occupation: data.occupation || '',
        annual_income: data.annual_income || '',
        working_location: data.working_location || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country,
        father_name: data.father_name || '',
        father_occupation: data.father_occupation || '',
        mother_name: data.mother_name || '',
        mother_occupation: data.mother_occupation || '',
        number_of_brothers: data.number_of_brothers?.toString() || '',
        number_of_sisters: data.number_of_sisters?.toString() || '',
        about_me: data.about_me || '',
        partner_expectations: data.partner_expectations || '',
      });
    } catch (err) {
      console.error('[ClientProfile] Exception:', err);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true });
      setProfilePhotoFile(compressed);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePhotoPreview(reader.result as string);
      reader.readAsDataURL(compressed);
    } catch {
      toast.error('Error processing image');
    }
  };

  const handleGalleryImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const total = galleryFiles.length + existingGalleryImages.length + files.length;
    if (total > 8) {
      toast.error('Maximum 8 gallery images allowed');
      return;
    }

    try {
      const newFiles: File[] = [];
      const newPreviews: string[] = [];

      for (const file of Array.from(files)) {
        const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true });
        newFiles.push(compressed);
        const reader = new FileReader();
        const preview = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(compressed);
        });
        newPreviews.push(preview);
      }

      setGalleryFiles([...galleryFiles, ...newFiles]);
      setGalleryPreviews([...galleryPreviews, ...newPreviews]);
    } catch {
      toast.error('Error processing images');
    }
  };

  const removeNewGalleryImage = (index: number) => {
    setGalleryFiles(galleryFiles.filter((_, i) => i !== index));
    setGalleryPreviews(galleryPreviews.filter((_, i) => i !== index));
  };

  const removeExistingGalleryImage = (url: string) => {
    setExistingGalleryImages(existingGalleryImages.filter(u => u !== url));
  };

  const uploadProfilePhoto = async (userId: string): Promise<string | null> => {
    if (!profilePhotoFile) return profile?.profile_photo || null;

    try {
      const fileExt = profilePhotoFile.name.split('.').pop();
      const fileName = `${userId}/profile/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('person-images')
        .upload(fileName, profilePhotoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: signedUrlData } = await supabase.storage
        .from('person-images')
        .createSignedUrl(fileName, 31536000);

      return signedUrlData?.signedUrl || null;
    } catch (err) {
      console.error('[ClientProfile] Upload error:', err);
      return null;
    }
  };

  const uploadGalleryImages = async (userId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < galleryFiles.length; i++) {
      try {
        const file = galleryFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/gallery/${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('person-images')
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: signedUrlData } = await supabase.storage
          .from('person-images')
          .createSignedUrl(fileName, 31536000);

        if (signedUrlData?.signedUrl) uploadedUrls.push(signedUrlData.signedUrl);
      } catch (err) {
        console.error('[ClientProfile] Gallery upload error:', err);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast.error("Not authenticated");
        navigate("/client-auth");
        return;
      }

      const validated = profileFormSchema.parse(formData);

      const profilePhotoUrl = await uploadProfilePhoto(authUser.id);
      const newGalleryUrls = await uploadGalleryImages(authUser.id);
      const allGalleryUrls = isNewUser ? [...newGalleryUrls] : [...existingGalleryImages, ...newGalleryUrls];

      const profileData = {
        user_id: authUser.id,
        full_name: validated.full_name,
        phone_number: validated.phone_number || null,
        email: authUser.email || validated.caste || null,
        gender: validated.gender,
        date_of_birth: validated.date_of_birth,
        religion: validated.religion,
        profile_created_for: validated.profile_created_for,
        caste: validated.caste || null,
        sub_caste: validated.sub_caste || null,
        mother_tongue: validated.mother_tongue || null,
        height_cm: validated.height_cm ? parseInt(validated.height_cm) : null,
        weight_kg: validated.weight_kg ? parseInt(validated.weight_kg) : null,
        complexion: validated.complexion || null,
        marital_status: validated.marital_status,
        birth_time: validated.birth_time || null,
        birth_place: validated.birth_place || null,
        star: validated.star || null,
        rasi: validated.rasi || null,
        education: validated.education || null,
        occupation: validated.occupation || null,
        annual_income: validated.annual_income || null,
        working_location: validated.working_location || null,
        city: validated.city || null,
        state: validated.state || null,
        country: validated.country,
        father_name: validated.father_name || null,
        father_occupation: validated.father_occupation || null,
        mother_name: validated.mother_name || null,
        mother_occupation: validated.mother_occupation || null,
        number_of_brothers: validated.number_of_brothers ? parseInt(validated.number_of_brothers) : null,
        number_of_sisters: validated.number_of_sisters ? parseInt(validated.number_of_sisters) : null,
        about_me: validated.about_me || null,
        partner_expectations: validated.partner_expectations || null,
        profile_photo: profilePhotoUrl,
        gallery_images: allGalleryUrls.length > 0 ? allGalleryUrls : null,
        is_profile_active: true,
        show_phone_number: false,
        payment_status: 'free' as const,
        country_code: '+91',
        created_by: 'client' as const,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (isNewUser) {
        console.log('[ClientProfile] Creating new profile for user:', authUser.id);
        result = await supabase
          .from("client_profiles")
          .insert(profileData);
      } else {
        console.log('[ClientProfile] Updating profile for user:', authUser.id);
        result = await supabase
          .from("client_profiles")
          .update(profileData)
          .eq("user_id", authUser.id);
      }

      const { error: saveError } = result;

      if (saveError) {
        console.error('[ClientProfile] Save error:', {
          message: saveError.message,
          details: saveError.details,
          hint: saveError.hint,
          code: saveError.code,
        });
        
        if (saveError.code === '23505') {
          toast.error("A profile already exists for this account.");
        } else {
          toast.error(`Failed to ${isNewUser ? 'create' : 'update'} profile: ${saveError.message}`);
        }
        setSaving(false);
        return;
      }

      toast.success(isNewUser ? "Profile created successfully!" : "Profile updated successfully!");
      
      setGalleryFiles([]);
      setGalleryPreviews([]);
      
      if (profilePhotoUrl) {
        setExistingGalleryImages([profilePhotoUrl, ...allGalleryUrls]);
      }
      
      setIsNewUser(false);
      await fetchProfile();
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      } else {
        console.error('[ClientProfile] Submit error:', err);
        toast.error("Failed to save profile");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
      <ClientHeader
        showBackToDashboard
        showNotificationBell
        showLogoutButton={!isNewUser}
        onSignOut={() => navigate('/client-auth')}
      />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {isNewUser && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 rounded-full p-2">
                  <Plus className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-800">Welcome! Complete your profile to get started</p>
                  <p className="text-sm text-green-600">Fill in the details below to create your profile</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!isNewUser && (
          <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 mb-6">
            <CardContent className="py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-lg font-medium text-pink-700">Welcome back! 👋</p>
                  {lastSignIn && (
                    <p className="text-sm text-muted-foreground">
                      Last login: {format(new Date(lastSignIn), "PPP 'at' p")}
                    </p>
                  )}
                </div>
                <div className="flex-1 max-w-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-pink-700">Profile Completion</span>
                    <span className="text-sm font-semibold text-purple-600">{profileCompletion}%</span>
                  </div>
                  <Progress value={profileCompletion} className="h-2" />
                  {profileCompletion < 100 && completionBreakdown && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <p className="font-medium mb-1">Complete these sections:</p>
                      <div className="space-y-1">
                        {completionBreakdown.sections.filter(s => !s.complete).map(section => (
                          <div key={section.name} className="flex items-center gap-1">
                            <Circle className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-600">{section.name}</span>
                            {section.missingFields.length > 0 && (
                              <span className="text-gray-400">({section.missingFields.slice(0, 2).map(getFieldLabel).join(', ')}{section.missingFields.length > 2 ? '...' : ''})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {profileCompletion === 100 && (
                    <p className="text-xs text-green-600 mt-1 flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Profile complete!
                    </p>
                  )}
                </div>
                {profile?.payment_status && (
                  <div className="mt-4 md:mt-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-pink-700">Membership:</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        profile.payment_status === 'paid' 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : profile.payment_status === 'non_paid'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-orange-100 text-orange-800 border border-orange-200'
                      }`}>
                        {profile.payment_status === 'paid' && (
                          <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
                        )}
                        {profile.payment_status === 'non_paid' && (
                          <span className="w-2 h-2 rounded-full bg-red-500 mr-1.5"></span>
                        )}
                        {profile.payment_status === 'free' && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 mr-1.5"></span>
                        )}
                        {profile.payment_status === 'paid' ? 'Premium Member' : 
                         profile.payment_status === 'non_paid' ? 'Payment Pending' : 'Free Plan'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {profile.payment_status === 'paid' 
                        ? 'You have full access to all features' 
                        : profile.payment_status === 'non_paid'
                        ? 'Please complete your payment'
                        : 'Upgrade to premium for more features'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {!isNewUser && profile && (
          <Card className="bg-white border-pink-200 mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {profilePhotoPreview || profile.profile_photo ? (
                    <img 
                      src={profilePhotoPreview || profile.profile_photo!} 
                      alt={profile.full_name} 
                      className="w-20 h-20 object-cover rounded-full border-2 border-pink-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold border-2 border-pink-200">
                      {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  {profile.payment_status === 'paid' && (
                    <span className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Premium
                    </span>
                  )}
                  <label className="absolute inset-0 cursor-pointer rounded-full opacity-0 hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-gray-900 truncate">
                    {profile.full_name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Profile ID: {profile.id?.slice(0, 8).toUpperCase() || 'N/A'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {profile.date_of_birth && (
                      <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                        {calculateAge(profile.date_of_birth)} years
                      </span>
                    )}
                    {profile.religion && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        {profile.religion}
                      </span>
                    )}
                    {profile.caste && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {profile.caste}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-pink-700">Completion</p>
                  <p className="text-2xl font-bold text-purple-600">{profileCompletion}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700 flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Basic Information
                </CardTitle>
                <CardDescription>Tell us about yourself</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name || ''}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile_created_for">Creating Profile For *</Label>
                    <select
                      id="profile_created_for"
                      value={formData.profile_created_for || 'self'}
                      onChange={(e) => handleInputChange('profile_created_for', e.target.value)}
                      className="w-full h-10 px-3 border rounded-md"
                      required
                    >
                      <option value="self">Self</option>
                      <option value="parents">Parents</option>
                      <option value="siblings">Sibling</option>
                      <option value="relatives">Relative</option>
                      <option value="friends">Friend</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <select
                      id="gender"
                      value={formData.gender || 'male'}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      className="w-full h-10 px-3 border rounded-md"
                      required
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth *</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth || ''}
                      onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="religion">Religion *</Label>
                    <select
                      id="religion"
                      value={formData.religion || 'hindu'}
                      onChange={(e) => handleInputChange('religion', e.target.value)}
                      className="w-full h-10 px-3 border rounded-md"
                      required
                    >
                      <option value="hindu">Hindu</option>
                      <option value="muslim">Muslim</option>
                      <option value="christian">Christian</option>
                      <option value="sikh">Sikh</option>
                      <option value="buddhist">Buddhist</option>
                      <option value="jain">Jain</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      type="tel"
                      value={formData.phone_number || ''}
                      onChange={(e) => handleInputChange('phone_number', e.target.value)}
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marital_status">Marital Status *</Label>
                    <select
                      id="marital_status"
                      value={formData.marital_status || 'never_married'}
                      onChange={(e) => handleInputChange('marital_status', e.target.value)}
                      className="w-full h-10 px-3 border rounded-md"
                      required
                    >
                      <option value="never_married">Never Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                      <option value="awaiting_divorce">Awaiting Divorce</option>
                      <option value="married">Married</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Personal Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="height_cm">Height (cm)</Label>
                    <Input
                      id="height_cm"
                      type="number"
                      value={formData.height_cm || ''}
                      onChange={(e) => handleInputChange('height_cm', e.target.value)}
                      placeholder="170"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight_kg">Weight (kg)</Label>
                    <Input
                      id="weight_kg"
                      type="number"
                      value={formData.weight_kg || ''}
                      onChange={(e) => handleInputChange('weight_kg', e.target.value)}
                      placeholder="70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="complexion">Complexion</Label>
                    <select
                      id="complexion"
                      value={formData.complexion || ''}
                      onChange={(e) => handleInputChange('complexion', e.target.value)}
                      className="w-full h-10 px-3 border rounded-md"
                    >
                      <option value="">Select</option>
                      <option value="very_fair">Very Fair</option>
                      <option value="fair">Fair</option>
                      <option value="wheatish">Wheatish</option>
                      <option value="brown">Brown</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caste">Caste</Label>
                    <Input
                      id="caste"
                      value={formData.caste || ''}
                      onChange={(e) => handleInputChange('caste', e.target.value)}
                      placeholder="Brahmins"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub_caste">Sub Caste</Label>
                    <Input
                      id="sub_caste"
                      value={formData.sub_caste || ''}
                      onChange={(e) => handleInputChange('sub_caste', e.target.value)}
                      placeholder="Smartha"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mother_tongue">Mother Tongue</Label>
                    <Input
                      id="mother_tongue"
                      value={formData.mother_tongue || ''}
                      onChange={(e) => handleInputChange('mother_tongue', e.target.value)}
                      placeholder="Tamil"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birth_time">Birth Time</Label>
                    <Input
                      id="birth_time"
                      type="time"
                      value={formData.birth_time || ''}
                      onChange={(e) => handleInputChange('birth_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birth_place">Birth Place</Label>
                    <Input
                      id="birth_place"
                      value={formData.birth_place || ''}
                      onChange={(e) => handleInputChange('birth_place', e.target.value)}
                      placeholder="Chennai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="star">Star</Label>
                    <Input
                      id="star"
                      value={formData.star || ''}
                      onChange={(e) => handleInputChange('star', e.target.value)}
                      placeholder="Krittika"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Career & Education</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="education">Education</Label>
                    <Input
                      id="education"
                      value={formData.education || ''}
                      onChange={(e) => handleInputChange('education', e.target.value)}
                      placeholder="B.E Computer Science"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={formData.occupation || ''}
                      onChange={(e) => handleInputChange('occupation', e.target.value)}
                      placeholder="Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="annual_income">Annual Income</Label>
                    <Input
                      id="annual_income"
                      value={formData.annual_income || ''}
                      onChange={(e) => handleInputChange('annual_income', e.target.value)}
                      placeholder="10 LPA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="working_location">Working Location</Label>
                    <Input
                      id="working_location"
                      value={formData.working_location || ''}
                      onChange={(e) => handleInputChange('working_location', e.target.value)}
                      placeholder="Bangalore"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city || ''}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Chennai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state || ''}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="Tamil Nadu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country || 'India'}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      placeholder="India"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Family Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="father_name">Father's Name</Label>
                    <Input
                      id="father_name"
                      value={formData.father_name || ''}
                      onChange={(e) => handleInputChange('father_name', e.target.value)}
                      placeholder="Ramaswamy"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="father_occupation">Father's Occupation</Label>
                    <Input
                      id="father_occupation"
                      value={formData.father_occupation || ''}
                      onChange={(e) => handleInputChange('father_occupation', e.target.value)}
                      placeholder="Business"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mother_name">Mother's Name</Label>
                    <Input
                      id="mother_name"
                      value={formData.mother_name || ''}
                      onChange={(e) => handleInputChange('mother_name', e.target.value)}
                      placeholder="Lakshmi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mother_occupation">Mother's Occupation</Label>
                    <Input
                      id="mother_occupation"
                      value={formData.mother_occupation || ''}
                      onChange={(e) => handleInputChange('mother_occupation', e.target.value)}
                      placeholder="Homemaker"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="number_of_brothers">Number of Brothers</Label>
                    <Input
                      id="number_of_brothers"
                      type="number"
                      min="0"
                      value={formData.number_of_brothers || ''}
                      onChange={(e) => handleInputChange('number_of_brothers', e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="number_of_sisters">Number of Sisters</Label>
                    <Input
                      id="number_of_sisters"
                      type="number"
                      min="0"
                      value={formData.number_of_sisters || ''}
                      onChange={(e) => handleInputChange('number_of_sisters', e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">About Me & Expectations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="about_me">About Me</Label>
                  <Textarea
                    id="about_me"
                    value={formData.about_me || ''}
                    onChange={(e) => handleInputChange('about_me', e.target.value)}
                    rows={4}
                    placeholder="Tell us about yourself..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner_expectations">Partner Expectations</Label>
                  <Textarea
                    id="partner_expectations"
                    value={formData.partner_expectations || ''}
                    onChange={(e) => handleInputChange('partner_expectations', e.target.value)}
                    rows={4}
                    placeholder="What are you looking for in a partner..."
                  />
                </div>
              </CardContent>
            </Card>

            {!isNewUser && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-pink-700">Gallery ({existingGalleryImages.length + galleryFiles.length}/8)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3">
                    {existingGalleryImages.map((url, idx) => (
                      <div key={`existing-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                        <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeExistingGalleryImage(url)}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {galleryFiles.map((file, idx) => (
                      <div key={`new-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                        <img src={galleryPreviews[idx]} alt={`New ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeNewGalleryImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {existingGalleryImages.length + galleryFiles.length < 8 && (
                      <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors">
                        <Upload className="w-6 h-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Add</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryImageSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/browse')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isNewUser ? 'Create Profile' : 'Save Changes'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientProfile;
