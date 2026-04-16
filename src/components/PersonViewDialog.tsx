import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Phone, MapPin, Calendar, HardDrive, Image as ImageIcon, HardDrive as HarddiskIcon, Heart, CheckCircle2 } from "lucide-react";
import { Person } from "@/pages/Dashboard";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BRAND_LOGO } from "@/lib/branding";
import { useStorageSummary, formatBytesUtil, getStatusLabel, getStatusColor } from "@/hooks/useStorageSummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dedupeUrls, getStableKey } from "@/lib/image-utils";

interface PersonViewDialogProps {
  person: Person | null;
  open: boolean;
  onClose: () => void;
  onMarkMatched?: (person: Person) => void;
}

const isDev = import.meta.env.DEV;

function log(prefix: string, message: string, data?: unknown) {
  if (isDev) {
    console.log(`[PersonViewDialog] [${prefix}] ${message}`, data ?? '');
  }
}

const PersonViewDialog = ({ person, open, onClose, onMarkMatched }: PersonViewDialogProps) => {
  const { storage, loading: storageLoading } = useStorageSummary();
  const isMatched = person?.match_status === 'matched';

  if (!person) return null;

  const imageUrls = dedupeUrls(person.image_urls || [], 'PersonViewDialog imageUrls');
  log('render', `Displaying ${imageUrls.length} images for person ${person.id}`);

  const sanitizeFileName = (name: string): string => {
    return name
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 30);
  };

  const handleDownloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      const sanitizedName = sanitizeFileName(person.name);
      const fileExt = blob.type.split('/')[1] || 'jpg';
      link.download = `${sanitizedName}_img${index + 1}.${fileExt}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error downloading image:', error);
      toast.error('Failed to download image');
    }
  };

  const handleDownloadAll = async () => {
    if (imageUrls.length > 0) {
      for (let i = 0; i < imageUrls.length; i++) {
        await handleDownloadImage(imageUrls[i], i);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4 pb-4 border-b">
          <div className="flex items-center gap-4">
            <img 
              src={BRAND_LOGO}
              alt="Sri Lakshmi Mangalya Malai" 
              className="w-16 h-16 object-contain"
            />
            <div className="flex-1">
              <h2 className="text-[32px] font-cursive font-semibold uppercase bg-gradient-to-r from-[#7b2ff7] to-[#f107a3] bg-clip-text text-transparent">
                Sri Lakshmi Mangalya Malai
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <DialogTitle className="text-2xl">{person.name}</DialogTitle>
                {isMatched && (
                  <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Matched
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">SL No: {person.slno}</Badge>
            {person.profile_id && (
              <Badge variant="outline" className="font-mono">Profile ID: {person.profile_id}</Badge>
            )}
            {isMatched && !onMarkMatched && (
              <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Matched
              </Badge>
            )}
            {!isMatched && onMarkMatched && (
              <Button
                variant="outline"
                size="sm"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => onMarkMatched(person)}
              >
                <Heart className="h-4 w-4 mr-1" />
                Mark as Matched
              </Button>
            )}
          </div>

          {/* Match Information Section */}
          {isMatched && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Match Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Matched On</p>
                    <p className="font-medium">
                      {person.matched_at ? new Date(person.matched_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Matched By</p>
                    <p className="font-medium">{person.matched_by || 'N/A'}</p>
                  </div>
                </div>
                {person.match_remarks && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground text-xs">Remarks</p>
                    <p className="font-medium text-sm">{person.match_remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Address</p>
                <p className="text-foreground">{person.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p className="text-foreground">{person.phoneno}</p>
              </div>
            </div>

            {person.comments && (
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 mt-0.5 text-muted-foreground">💬</div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Comments</p>
                  <p className="text-foreground whitespace-pre-wrap">{person.comments}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-foreground">
                  {new Date(person.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {imageUrls.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Images ({imageUrls.length})
                </h3>
                {imageUrls.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAll}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download All
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imageUrls.map((url, idx) => (
                  <div
                    key={getStableKey(url, idx)}
                    className="relative rounded-lg overflow-hidden bg-muted"
                  >
                    <img
                      src={url}
                      alt={`${person.name} - ${idx + 1}`}
                      className="w-full h-64 object-cover"
                    />
                    <div className="absolute bottom-2 left-2 flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => window.open(url, '_blank')}
                        className="shadow-lg"
                      >
                        View Only
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDownloadImage(url, idx)}
                        className="shadow-lg"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Storage Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Profile Images:</span>
                  <span className="font-medium">{person.profile_image ? 1 : 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Gallery Images:</span>
                  <span className="font-medium">{imageUrls.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HarddiskIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Total Attachments:</span>
                  <span className="font-medium">{(person.profile_image ? 1 : 0) + imageUrls.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">System Storage:</span>
                  {storageLoading ? (
                    <span className="text-xs text-muted-foreground">Loading...</span>
                  ) : storage ? (
                    <span className={`font-medium ${getStatusColor(storage.status)}`}>
                      {getStatusLabel(storage.status)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )}
                </div>
              </div>
              {storage && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Used: {formatBytesUtil(storage.usedBytes)}</span>
                    <span>{storage.usagePercent.toFixed(1)}%</span>
                    <span>Total: {formatBytesUtil(storage.totalBytes)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PersonViewDialog;
