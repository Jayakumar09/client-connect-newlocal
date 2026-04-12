import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Upload, X, Trash2 } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
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
} from "@/components/ui/alert-dialog";
import imageCompression from 'browser-image-compression';
import logoImage from "@/assets/sri-lakshmi-logo.png";

interface ClientProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  country_code: string;
  gender: "male" | "female" | "other";
  date_of_birth: string;
  profile_created_for: "self" | "parents" | "siblings" | "relatives" | "friends";
  religion: "hindu" | "muslim" | "christian" | "sikh" | "jain" | "buddhist" | "other";
  caste: string | null;
  sub_caste: string | null;
  mother_tongue: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  complexion: "fair" | "wheatish" | "brown" | "dark" | "very_fair" | null;
  marital_status: "never_married" | "divorced" | "widowed" | "awaiting_divorce" | "married";
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
  number_of_brothers: number;
  number_of_sisters: number;
  about_me: string | null;
  partner_expectations: string | null;
  profile_photo: string | null;
  gallery_images: string[] | null;
  is_profile_active: boolean;
  show_phone_number: boolean;
}

const ClientProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [existingGalleryImages, setExistingGalleryImages] = useState<string[]>([]);
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  // Calculate profile completion percentage
  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    
    const fields = [
      profile.full_name,
      profile.email,
      profile.phone_number,
      profile.date_of_birth,
      profile.gender,
      profile.religion,
      profile.caste,
      profile.mother_tongue,
      profile.height_cm,
      profile.weight_kg,
      profile.complexion,
      profile.marital_status,
      profile.birth_time,
      profile.birth_place,
      profile.star,
      profile.rasi,
      profile.education,
      profile.occupation,
      profile.annual_income,
      profile.working_location,
      profile.city,
      profile.state,
      profile.country,
      profile.father_name,
      profile.father_occupation,
      profile.mother_name,
      profile.mother_occupation,
      profile.about_me,
      profile.partner_expectations,
      profile.profile_photo,
    ];
    
    const filledFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  }, [profile]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/client-auth");
        return;
      }

      // Set last sign in date
      if (user.last_sign_in_at) {
        setLastSignIn(user.last_sign_in_at);
      }

      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
        setLoading(false);
        return;
      }
      
      // If no profile exists, redirect to registration
      if (!data) {
        toast.error("No profile found. Please complete your registration.");
        navigate("/client-auth");
        return;
      }
      
      setProfile(data);
      if (data.profile_photo) {
        setProfilePhotoPreview(data.profile_photo);
      }
      if (data.gallery_images && data.gallery_images.length > 0) {
        setExistingGalleryImages(data.gallery_images);
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };
      
      const compressedFile = await imageCompression(file, options);
      setProfilePhotoFile(compressedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      toast.error("Error processing image");
    }
  };

  const handleGalleryImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const totalImages = galleryFiles.length + existingGalleryImages.length + files.length;
    if (totalImages > 8) {
      toast.error("Maximum 8 gallery images allowed");
      return;
    }

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true
      };

      const newFiles: File[] = [];
      const newPreviews: string[] = [];

      for (const file of Array.from(files)) {
        const compressedFile = await imageCompression(file, options);
        newFiles.push(compressedFile);

        const reader = new FileReader();
        const preview = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(compressedFile);
        });
        newPreviews.push(preview);
      }

      setGalleryFiles([...galleryFiles, ...newFiles]);
      setGalleryPreviews([...galleryPreviews, ...newPreviews]);
    } catch (error) {
      toast.error("Error processing images");
    }
  };

  const removeNewGalleryImage = (index: number) => {
    setGalleryFiles(galleryFiles.filter((_, i) => i !== index));
    setGalleryPreviews(galleryPreviews.filter((_, i) => i !== index));
  };

  const removeExistingGalleryImage = (index: number) => {
    setExistingGalleryImages(existingGalleryImages.filter((_, i) => i !== index));
  };

  const uploadProfilePhoto = async (userId: string): Promise<string | null> => {
    if (!profilePhotoFile) return profile?.profile_photo || null;

    try {
      const fileExt = profilePhotoFile.name.split('.').pop();
      const fileName = `${userId}_${Date.now()}.${fileExt}`;
      const filePath = `${userId}/profile/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('person-images')
        .upload(filePath, profilePhotoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: signedUrlData } = await supabase.storage
        .from('person-images')
        .createSignedUrl(filePath, 31536000);

      return signedUrlData?.signedUrl || null;
    } catch (error) {
      console.error("Error uploading photo:", error);
      return null;
    }
  };

  const uploadGalleryImages = async (userId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (let i = 0; i < galleryFiles.length; i++) {
      try {
        const file = galleryFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}_gallery_${Date.now()}_${i}.${fileExt}`;
        const filePath = `${userId}/gallery/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('person-images')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: signedUrlData } = await supabase.storage
          .from('person-images')
          .createSignedUrl(filePath, 31536000);

        if (signedUrlData?.signedUrl) {
          uploadedUrls.push(signedUrlData.signedUrl);
        }
      } catch (error) {
        console.error("Error uploading gallery image:", error);
      }
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const profilePhotoUrl = await uploadProfilePhoto(user.id);
      const newGalleryUrls = await uploadGalleryImages(user.id);
      const allGalleryUrls = [...existingGalleryImages, ...newGalleryUrls];

      const { error } = await supabase
        .from("client_profiles")
        .update({
          ...profile,
          profile_photo: profilePhotoUrl,
          gallery_images: allGalleryUrls,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Reset new files after successful upload
      setGalleryFiles([]);
      setGalleryPreviews([]);
      setExistingGalleryImages(allGalleryUrls);

      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/client-auth");
  };

  const handleDeleteProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete profile from database
      const { error: deleteError } = await supabase
        .from("client_profiles")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      // Sign out and delete user account
      await supabase.auth.signOut();
      toast.success("Profile deleted successfully");
      navigate("/client-auth");
    } catch (error: any) {
      console.error("Error deleting profile:", error);
      toast.error("Failed to delete profile");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
            <CardDescription>Unable to load your profile</CardDescription>
          </CardHeader>
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
            <img 
              src={logoImage} 
              alt="Sri Lakshmi" 
              className="w-12 h-12 object-contain"
            />
            <h1 className="text-xl font-semibold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              {profile?.full_name || "My Profile"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="outline" onClick={() => navigate("/browse")} className="border-pink-200">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Browse
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Your profile and all associated data will be permanently deleted.
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
            <Button variant="outline" onClick={handleLogout} className="border-pink-200">
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Welcome & Profile Completion Section */}
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
                  {profilePhotoPreview && (
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
                  )}
                  <Label htmlFor="profile-photo" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600">
                      <Upload className="h-4 w-4" />
                      {profilePhotoPreview ? "Change Photo" : "Upload Photo"}
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
                  {/* Existing Gallery Images */}
                  {existingGalleryImages.map((url, index) => (
                    <div key={`existing-${index}`} className="relative">
                      <img 
                        src={url} 
                        alt={`Gallery ${index + 1}`} 
                        className="w-full h-24 object-cover rounded-lg border-2 border-pink-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeExistingGalleryImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {/* New Gallery Image Previews */}
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
                      value={profile.email || ""}
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
                        value={profile.phone_number || ""}
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
                      onValueChange={(value: any) => setProfile({ ...profile, gender: value })}
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
                      onChange={(e) => setProfile({ ...profile, marital_status: e.target.value as any })}
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
                      value={profile.height_cm || ""}
                      onChange={(e) => setProfile({ ...profile, height_cm: parseInt(e.target.value) || null })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight_kg">Weight (kg)</Label>
                    <Input
                      id="weight_kg"
                      type="number"
                      value={profile.weight_kg || ""}
                      onChange={(e) => setProfile({ ...profile, weight_kg: parseInt(e.target.value) || null })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="complexion">Complexion</Label>
                    <select
                      id="complexion"
                      value={profile.complexion || ""}
                      onChange={(e) => setProfile({ ...profile, complexion: (e.target.value as any) || null })}
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
                      onChange={(e) => setProfile({ ...profile, religion: e.target.value as any })}
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
                      value={profile.caste || ""}
                      onChange={(e) => setProfile({ ...profile, caste: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sub_caste">Sub Caste</Label>
                    <Input
                      id="sub_caste"
                      value={profile.sub_caste || ""}
                      onChange={(e) => setProfile({ ...profile, sub_caste: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mother_tongue">Mother Tongue</Label>
                    <Input
                      id="mother_tongue"
                      value={profile.mother_tongue || ""}
                      onChange={(e) => setProfile({ ...profile, mother_tongue: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Astrological Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Astrological Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="birth_time">Birth Time</Label>
                    <Input
                      id="birth_time"
                      type="time"
                      value={profile.birth_time || ""}
                      onChange={(e) => setProfile({ ...profile, birth_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="birth_place">Birth Place</Label>
                    <Input
                      id="birth_place"
                      value={profile.birth_place || ""}
                      onChange={(e) => setProfile({ ...profile, birth_place: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="star">Star (Nakshatram)</Label>
                    <Input
                      id="star"
                      value={profile.star || ""}
                      onChange={(e) => setProfile({ ...profile, star: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rasi">Rasi (Zodiac)</Label>
                    <Input
                      id="rasi"
                      value={profile.rasi || ""}
                      onChange={(e) => setProfile({ ...profile, rasi: e.target.value })}
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
                      value={profile.education || ""}
                      onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={profile.occupation || ""}
                      onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="annual_income">Annual Income</Label>
                    <Input
                      id="annual_income"
                      value={profile.annual_income || ""}
                      onChange={(e) => setProfile({ ...profile, annual_income: e.target.value })}
                      placeholder="e.g., 5-10 lakhs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="working_location">Working Location</Label>
                    <Input
                      id="working_location"
                      value={profile.working_location || ""}
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
                      value={profile.city || ""}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={profile.state || ""}
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

            {/* Family Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Family Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="father_name">Father's Name</Label>
                    <Input
                      id="father_name"
                      value={profile.father_name || ""}
                      onChange={(e) => setProfile({ ...profile, father_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="father_occupation">Father's Occupation</Label>
                    <Input
                      id="father_occupation"
                      value={profile.father_occupation || ""}
                      onChange={(e) => setProfile({ ...profile, father_occupation: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mother_name">Mother's Name</Label>
                    <Input
                      id="mother_name"
                      value={profile.mother_name || ""}
                      onChange={(e) => setProfile({ ...profile, mother_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mother_occupation">Mother's Occupation</Label>
                    <Input
                      id="mother_occupation"
                      value={profile.mother_occupation || ""}
                      onChange={(e) => setProfile({ ...profile, mother_occupation: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="number_of_brothers">Number of Brothers</Label>
                    <Input
                      id="number_of_brothers"
                      type="number"
                      value={profile.number_of_brothers}
                      onChange={(e) => setProfile({ ...profile, number_of_brothers: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="number_of_sisters">Number of Sisters</Label>
                    <Input
                      id="number_of_sisters"
                      type="number"
                      value={profile.number_of_sisters}
                      onChange={(e) => setProfile({ ...profile, number_of_sisters: parseInt(e.target.value) || 0 })}
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
                  value={profile.about_me || ""}
                  onChange={(e) => setProfile({ ...profile, about_me: e.target.value })}
                  rows={5}
                  placeholder="Tell us about yourself..."
                />
              </CardContent>
            </Card>

            {/* Partner Expectations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-pink-700">Partner Expectations</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="partner_expectations"
                  value={profile.partner_expectations || ""}
                  onChange={(e) => setProfile({ ...profile, partner_expectations: e.target.value })}
                  rows={5}
                  placeholder="Describe your ideal partner..."
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
                onClick={() => navigate("/browse")}
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
                  "Save Profile"
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
