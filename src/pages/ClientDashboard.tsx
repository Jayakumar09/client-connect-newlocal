import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, LogOut, ArrowLeft, Upload, X, Trash2, Save, User, Mail, Phone, MapPin, Briefcase, Heart, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import imageCompression from 'browser-image-compression';
import logoImage from '@/assets/sri-lakshmi-logo.png';

interface ClientProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  country_code: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth: string;
  profile_created_for: string;
  religion: string;
  caste: string | null;
  sub_caste: string | null;
  mother_tongue: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  complexion: string | null;
  marital_status: string;
  birth_time: string | null;
  birth_place: string | null;
  star: string | null;
  rasi: string | null;
  education: string | null;
  occupation: string | null;
  annual_income: string | null;
  working_location: string | null;
  city: string | null;
  state: string | null;
  country: string;
  father_name: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_occupation: string | null;
  number_of_brothers: number | null;
  number_of_sisters: number | null;
  about_me: string | null;
  partner_expectations: string | null;
  profile_photo: string | null;
  gallery_images: string[] | null;
  is_profile_active: boolean;
  show_phone_number: boolean;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
}

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, loading: authLoading, signOut } = useAuth();
  
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [existingGalleryImages, setExistingGalleryImages] = useState<string[]>([]);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  const profileCompletion = (() => {
    if (!profile) return 0;
    const fields = [
      profile.full_name, profile.email, profile.phone_number, profile.date_of_birth,
      profile.gender, profile.religion, profile.caste, profile.mother_tongue,
      profile.height_cm, profile.weight_kg, profile.complexion, profile.marital_status,
      profile.birth_time, profile.birth_place, profile.star, profile.rasi,
      profile.education, profile.occupation, profile.annual_income, profile.city,
      profile.state, profile.father_name, profile.about_me, profile.profile_photo,
    ];
    const filled = fields.filter(f => f !== null && f !== undefined && f !== '').length;
    return Math.round((filled / fields.length) * 100);
  })();

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
      setError(null);
      if (!user) return;

      if (user.last_sign_in_at) {
        setLastSignIn(user.last_sign_in_at);
      }

      const { data, error: fetchError } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[ClientDashboard] Fetch error:', fetchError);
        setError(`Failed to load profile: ${fetchError.message}`);
        toast.error(`Failed to load profile: ${fetchError.message}`);
        return;
      }
      
      if (!data) {
        toast.info('No profile found. Redirecting to create your profile...');
        navigate('/client-profile');
        return;
      }
      
      setProfile(data);
      if (data.profile_photo) setProfilePhotoPreview(data.profile_photo);
      if (data.gallery_images?.length) setExistingGalleryImages(data.gallery_images);
    } catch (err) {
      console.error('[ClientDashboard] Exception:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
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
      console.error('Upload error:', err);
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
        console.error('Gallery upload error:', err);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) return;

    setSaving(true);
    try {
      const profilePhotoUrl = await uploadProfilePhoto(user.id);
      const newGalleryUrls = await uploadGalleryImages(user.id);
      const allGalleryUrls = [...existingGalleryImages, ...newGalleryUrls];

      const { error: updateError } = await supabase
        .from('client_profiles')
        .update({
          ...profile,
          profile_photo: profilePhotoUrl,
          gallery_images: allGalleryUrls,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setGalleryFiles([]);
      setGalleryPreviews([]);
      setExistingGalleryImages(allGalleryUrls);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Update error:', err);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    try {
      if (!user) return;

      const { error: deleteError } = await supabase
        .from('client_profiles')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      await signOut();
      toast.success('Profile deleted successfully');
      navigate('/client-auth');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete profile');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/client-auth');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              {error ? 'Error' : 'Profile Not Found'}
            </CardTitle>
            <CardDescription>
              {error || 'Unable to load your profile'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/browse')} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Browse
            </Button>
            <Button variant="outline" onClick={handleSignOut} className="flex-1">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Sri Lakshmi" className="w-12 h-12 object-contain" />
            <h1 className="text-xl font-semibold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              My Profile
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/browse')} className="border-pink-200">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Browse
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All your data will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteProfile} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={handleSignOut} className="border-pink-200">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      <div className="container mx-auto px-4 pt-6 max-w-4xl">
        <Card className="bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
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
                {profileCompletion < 100 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete your profile to get better matches!
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Profile Photo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Profile Photo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  {profilePhotoPreview ? (
                    <div className="relative">
                      <img 
                        src={profilePhotoPreview} 
                        alt="Profile" 
                        className="w-32 h-32 object-cover rounded-full border-4 border-pink-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProfilePhotoFile(null);
                          setProfilePhotoPreview(null);
                        }}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                      {profile.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <Label htmlFor="profile-photo" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600">
                      <Upload className="h-4 w-4" />
                      {profilePhotoPreview ? 'Change Photo' : 'Upload Photo'}
                    </div>
                    <Input
                      id="profile-photo"
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoChange}
                      className="hidden"
                    />
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Gallery Images */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Gallery Images</CardTitle>
                <CardDescription>Upload up to 8 additional photos (optional)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {existingGalleryImages.map((url, index) => (
                    <div key={`existing-${index}`} className="relative">
                      <img 
                        src={url} 
                        alt={`Gallery ${index + 1}`} 
                        className="w-full h-24 object-cover rounded-lg border-2 border-pink-200"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingGalleryImage(url)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {galleryPreviews.map((preview, index) => (
                    <div key={`new-${index}`} className="relative">
                      <img 
                        src={preview} 
                        alt={`New ${index + 1}`} 
                        className="w-full h-24 object-cover rounded-lg border-2 border-purple-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewGalleryImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {existingGalleryImages.length + galleryFiles.length < 8 && (
                  <Label htmlFor="gallery-images" className="cursor-pointer inline-block">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600">
                      <Upload className="h-4 w-4" />
                      Add Gallery Photos
                    </div>
                    <Input
                      id="gallery-images"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryImageSelect}
                      className="hidden"
                    />
                  </Label>
                )}
                <p className="text-sm text-muted-foreground">
                  {existingGalleryImages.length + galleryFiles.length}/8 images
                </p>
              </CardContent>
            </Card>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email || ''}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="country_code"
                        value={profile.country_code}
                        onChange={(e) => setProfile({ ...profile, country_code: e.target.value })}
                        className="w-24"
                        placeholder="+91"
                      />
                      <Input
                        id="phone_number"
                        value={profile.phone_number || ''}
                        onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="date_of_birth">Date of Birth *</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={profile.date_of_birth}
                      onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>Gender *</Label>
                    <RadioGroup
                      value={profile.gender}
                      onValueChange={(value) => setProfile({ ...profile, gender: value as typeof profile.gender })}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="male" />
                        <Label htmlFor="male">Male</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="female" />
                        <Label htmlFor="female">Female</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="other" />
                        <Label htmlFor="other">Other</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label htmlFor="marital_status">Marital Status *</Label>
                    <select
                      id="marital_status"
                      value={profile.marital_status}
                      onChange={(e) => setProfile({ ...profile, marital_status: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="never_married">Never Married</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                      <option value="awaiting_divorce">Awaiting Divorce</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Physical Attributes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Physical Attributes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="height_cm">Height (cm)</Label>
                    <Input
                      id="height_cm"
                      type="number"
                      value={profile.height_cm || ''}
                      onChange={(e) => setProfile({ ...profile, height_cm: parseInt(e.target.value) || null })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight_kg">Weight (kg)</Label>
                    <Input
                      id="weight_kg"
                      type="number"
                      value={profile.weight_kg || ''}
                      onChange={(e) => setProfile({ ...profile, weight_kg: parseInt(e.target.value) || null })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="complexion">Complexion</Label>
                    <select
                      id="complexion"
                      value={profile.complexion || ''}
                      onChange={(e) => setProfile({ ...profile, complexion: e.target.value || null })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select</option>
                      <option value="fair">Fair</option>
                      <option value="wheatish">Wheatish</option>
                      <option value="brown">Brown</option>
                      <option value="dark">Dark</option>
                      <option value="very_fair">Very Fair</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Religious Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Religious Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="religion">Religion *</Label>
                    <select
                      id="religion"
                      value={profile.religion}
                      onChange={(e) => setProfile({ ...profile, religion: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="hindu">Hindu</option>
                      <option value="muslim">Muslim</option>
                      <option value="christian">Christian</option>
                      <option value="sikh">Sikh</option>
                      <option value="jain">Jain</option>
                      <option value="buddhist">Buddhist</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="caste">Caste</Label>
                    <Input
                      id="caste"
                      value={profile.caste || ''}
                      onChange={(e) => setProfile({ ...profile, caste: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sub_caste">Sub Caste</Label>
                    <Input
                      id="sub_caste"
                      value={profile.sub_caste || ''}
                      onChange={(e) => setProfile({ ...profile, sub_caste: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mother_tongue">Mother Tongue</Label>
                    <Input
                      id="mother_tongue"
                      value={profile.mother_tongue || ''}
                      onChange={(e) => setProfile({ ...profile, mother_tongue: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Professional Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Professional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="education">Education</Label>
                    <Input
                      id="education"
                      value={profile.education || ''}
                      onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={profile.occupation || ''}
                      onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="annual_income">Annual Income</Label>
                    <Input
                      id="annual_income"
                      value={profile.annual_income || ''}
                      onChange={(e) => setProfile({ ...profile, annual_income: e.target.value })}
                      placeholder="e.g., 5-10 lakhs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="working_location">Working Location</Label>
                    <Input
                      id="working_location"
                      value={profile.working_location || ''}
                      onChange={(e) => setProfile({ ...profile, working_location: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={profile.city || ''}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={profile.state || ''}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={profile.country}
                      onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* About Me */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">About Me</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="about_me"
                  value={profile.about_me || ''}
                  onChange={(e) => setProfile({ ...profile, about_me: e.target.value })}
                  rows={5}
                  placeholder="Tell us about yourself..."
                />
              </CardContent>
            </Card>

            {/* Profile Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Profile Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_profile_active"
                    checked={profile.is_profile_active}
                    onChange={(e) => setProfile({ ...profile, is_profile_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_profile_active">Make profile visible to others</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="show_phone_number"
                    checked={profile.show_phone_number}
                    onChange={(e) => setProfile({ ...profile, show_phone_number: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="show_phone_number">Show phone number to others</Label>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
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
                    Save Profile
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

export default ClientDashboard;
