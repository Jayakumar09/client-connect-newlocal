import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Person } from "@/pages/Dashboard";
import { Upload, X, Image as ImageIcon, Database } from "lucide-react";
import { z } from "zod";
import imageCompression from "browser-image-compression";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStorageSummary, formatBytesUtil, getStatusLabel, getStatusColor } from "@/hooks/useStorageSummary";
import { dedupeImages, getStableKey, dedupeUrls } from "@/lib/image-utils";

interface PersonDialogProps {
  open: boolean;
  onClose: () => void;
}

const personSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(100, { message: "Name must be less than 100 characters" }),
  address: z.string().trim().min(1, { message: "Address is required" }).max(500, { message: "Address must be less than 500 characters" }),
  phoneno: z.string()
    .trim()
    .min(1, { message: "Phone number is required" })
    .regex(/^[+]?[()]?[0-9]{1,4}[)]?[-\s.]?[()]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, { message: "Invalid phone number format. Use digits, +, -, spaces, or parentheses" }),
  comments: z.string().max(1000, { message: "Comments must be less than 1000 characters" }).optional(),
  paymentStatus: z.enum(['paid', 'non_paid', 'free']),
});

const isDev = import.meta.env.DEV;

function log(prefix: string, message: string, data?: unknown) {
  if (isDev) {
    console.log(`[PersonDialog] [${prefix}] ${message}`, data ?? '');
  }
}

const PersonDialog = ({ open, onClose, person }: PersonDialogProps) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phoneno, setPhoneno] = useState("");
  const [comments, setComments] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'non_paid' | 'free'>('free');
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [existingProfileImage, setExistingProfileImage] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { storage, loading: storageLoading, refetch: refetchStorage } = useStorageSummary();

  const personIdRef = useRef<string | undefined>(person?.id);
  const openRef = useRef(open);
  openRef.current = open;
  personIdRef.current = person?.id;

  const resetAllState = useCallback(() => {
    log('reset', 'Resetting all state');
    setName("");
    setAddress("");
    setPhoneno("");
    setComments("");
    setPaymentStatus('free');
    setProfileImageFile(null);
    setExistingProfileImage(null);
    setImageFiles([]);
    setExistingImageUrls([]);
  }, []);

  const loadPersonData = useCallback((p: NonNullable<Person>) => {
    log('load', `Loading person data for ID: ${p.id}`);
    const existingUrls = dedupeUrls(p.image_urls || [], 'existingImageUrls from person');
    log('load', `existingImageUrls: ${existingUrls.length} (deduped)`);
    
    setName(p.name);
    setAddress(p.address);
    setPhoneno(p.phoneno);
    setComments(p.comments || "");
    setPaymentStatus(p.payment_status || 'free');
    setExistingProfileImage(p.profile_image || null);
    setExistingImageUrls(existingUrls);
    setImageFiles([]);
  }, []);

  useEffect(() => {
    if (open) {
      if (person) {
        loadPersonData(person);
      } else {
        resetAllState();
      }
    }
  }, [open, person, loadPersonData, resetAllState]);

  useEffect(() => {
    return () => {
      if (!openRef.current) {
        log('cleanup', 'Modal closed, cleaning up blob URLs');
      }
    };
  }, []);

  const isStorageCritical = storage?.status === 'limit_reached' || storage?.status === 'critical';
  const canUpload = !isStorageCritical || (storage?.remainingBytes ?? 0) > 0;

  const handleProfileImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress profile image
    try {
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      setProfileImageFile(new File([compressedFile], file.name, { type: file.type }));
    } catch (error) {
      console.error("Error compressing profile image:", error);
      toast.error("Failed to compress profile image");
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const totalImages = existingImageUrls.length + imageFiles.length + files.length;
    if (totalImages > 8) {
      toast.error("Maximum 8 images allowed per person");
      return;
    }

    log('select', `Adding ${files.length} new images`);
    log('select', `Current state: ${existingImageUrls.length} existing + ${imageFiles.length} new files`);

    const compressedFiles: File[] = [];
    for (const file of files) {
      try {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);
        compressedFiles.push(new File([compressedFile], file.name, { type: file.type }));
      } catch (error) {
        console.error("Error compressing image:", error);
        toast.error(`Failed to compress ${file.name}`);
      }
    }

    setImageFiles(prevFiles => {
      const combined = [...prevFiles, ...compressedFiles];
      const deduplicated = dedupeImages(combined, 'handleImageSelect');
      log('select', `After dedupe: ${deduplicated.length} images`);
      return deduplicated;
    });
  };

  const removeNewImage = (index: number) => {
    setImageFiles(prevFiles => {
      const newFiles = prevFiles.filter((_, i) => i !== index);
      log('remove', `Removed image at index ${index}, remaining: ${newFiles.length}`);
      return newFiles;
    });
  };

  const removeExistingImage = async (url: string) => {
    setExistingImageUrls(prevUrls => {
      const newUrls = prevUrls.filter((u) => u !== url);
      log('remove', `Removed existing image, remaining: ${newUrls.length}`);
      return newUrls;
    });
  };

  const sanitizeFileName = (name: string): string => {
    return name
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 30);
  };

  const uploadProfileImage = async (userId: string, personName: string): Promise<string | null> => {
    if (!profileImageFile) return existingProfileImage;

    const sanitizedName = sanitizeFileName(personName);
    const fileExt = profileImageFile.name.split(".").pop();
    const fileName = `${userId}/${sanitizedName}_profile.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("person-images")
      .upload(fileName, profileImageFile, { upsert: true });

    if (uploadError) throw uploadError;

    // Generate signed URL (valid for 1 year)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("person-images")
      .createSignedUrl(fileName, 31536000);

    if (signedError) throw signedError;

    return signedData.signedUrl;
  };

  const uploadImages = async (userId: string, personName: string, existingCount: number): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    const sanitizedName = sanitizeFileName(personName);

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const fileExt = file.name.split(".").pop();
      const sequenceNumber = existingCount + i + 1;
      const fileName = `${userId}/${sanitizedName}_img${sequenceNumber}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("person-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.warn(`Upload warning for ${fileName}:`, uploadError.message);
        // Try to get existing URL if upload fails
        const { data: existingUrl } = await supabase.storage
          .from("person-images")
          .createSignedUrl(fileName, 31536000);
        if (existingUrl) {
          uploadedUrls.push(existingUrl.signedUrl);
          continue;
        }
        throw uploadError;
      }

      // Generate signed URL (valid for 1 year)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("person-images")
        .createSignedUrl(fileName, 31536000);

      if (signedError) throw signedError;

      uploadedUrls.push(signedData.signedUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isStorageCritical && (imageFiles.length > 0 || profileImageFile)) {
      toast.error("Cannot upload: Storage capacity is critically low. Please delete some images or contact admin.");
      return;
    }
    
    setLoading(true);

    try {
      const validated = personSchema.parse({ name, address, phoneno, comments, paymentStatus });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const profileImageUrl = await uploadProfileImage(user.id, validated.name);

      const newImageUrls = await uploadImages(user.id, validated.name, existingImageUrls.length);
      
      const combinedUrls = [...existingImageUrls, ...newImageUrls];
      const finalImageUrls = dedupeUrls(combinedUrls, 'handleSubmit finalImageUrls');
      
      log('submit', `Payload: ${existingImageUrls.length} existing + ${newImageUrls.length} new = ${finalImageUrls.length} total`);
      log('submit', 'existingImageUrls:', existingImageUrls);
      log('submit', 'newImageUrls:', newImageUrls);
      log('submit', 'finalImageUrls:', finalImageUrls);

      if (person) {
        const { error } = await supabase
          .from("persons")
          .update({
            name: validated.name,
            address: validated.address,
            phoneno: validated.phoneno,
            comments: validated.comments || null,
            image_urls: finalImageUrls,
            profile_image: profileImageUrl,
            payment_status: validated.paymentStatus,
          })
          .eq("id", person.id);

        if (error) throw error;
        log('submit', 'Update successful');
        toast.success("Person record updated successfully");
      } else {
        const { error } = await supabase.from("persons").insert({
          name: validated.name,
          address: validated.address,
          phoneno: validated.phoneno,
          comments: validated.comments || null,
          image_urls: finalImageUrls,
          profile_image: profileImageUrl,
          payment_status: validated.paymentStatus,
          user_id: user.id,
        });

        if (error) throw error;
        log('submit', 'Insert successful');
        toast.success("Person record created successfully");
      }

      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{person ? "Edit Person" : "Add New Person"}</DialogTitle>
              <DialogDescription>
                Fill in the details below. You can upload up to 8 high-resolution images.
              </DialogDescription>
            </div>
            {person?.profile_id && (
              <Badge variant="outline" className="font-mono ml-4">
                {person.profile_id}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {storage && (
          <Alert variant={isStorageCritical ? "destructive" : "default"}>
            <Database className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <span className={`font-medium ${getStatusColor(storage.status)}`}>
                  {getStatusLabel(storage.status)}
                </span>
                <span className="ml-2">
                  {storage.usagePercent.toFixed(1)}% used · {formatBytesUtil(storage.remainingBytes)} remaining
                </span>
              </div>
              {isStorageCritical && <span className="text-xs font-medium">Upload blocked</span>}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter full address"
              required
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneno">Phone Number *</Label>
            <Input
              id="phoneno"
              value={phoneno}
              onChange={(e) => setPhoneno(e.target.value)}
              placeholder="+91 7639150271"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use digits, +, -, spaces, or parentheses
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-status">Payment Status *</Label>
            <Select value={paymentStatus} onValueChange={(value: 'paid' | 'non_paid' | 'free') => setPaymentStatus(value)}>
              <SelectTrigger id="payment-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid {"{P}"}</SelectItem>
                <SelectItem value="non_paid">Non Paid {"{NP}"}</SelectItem>
                <SelectItem value="free">Free {"{F}"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-image">Profile Image</Label>
            {(existingProfileImage || profileImageFile) && (
              <div className="relative w-32 h-32 mx-auto rounded-lg overflow-hidden bg-muted">
                <img 
                  src={profileImageFile ? URL.createObjectURL(profileImageFile) : existingProfileImage!} 
                  alt="Profile" 
                  className="w-full h-full object-cover" 
                />
                <button
                  type="button"
                  onClick={() => {
                    setProfileImageFile(null);
                    setExistingProfileImage(null);
                  }}
                  className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-border hover:border-primary rounded-lg p-4 text-center transition-colors">
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {profileImageFile || existingProfileImage ? 'Change profile image' : 'Upload profile image'}
                </p>
              </div>
              <input
                id="profile-image"
                type="file"
                accept="image/*"
                onChange={handleProfileImageSelect}
                className="hidden"
              />
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Comments / Remarks / Status</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Additional information about this person..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Images ({existingImageUrls.length + imageFiles.length}/8)
            </Label>
            
            <div className="grid grid-cols-4 gap-3">
              {existingImageUrls.map((url, idx) => (
                <div key={getStableKey(url, idx)} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                  <img src={url} alt={`Existing ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(url)}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {imageFiles.map((file, idx) => (
                <div key={getStableKey(file, idx)} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`New ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {existingImageUrls.length + imageFiles.length < 8 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors bg-muted/30">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Upload up to 8 images. Each image will be compressed to under 500KB. Supported formats: JPG, PNG, WEBP
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : person ? "Update Person" : "Add Person"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PersonDialog;
