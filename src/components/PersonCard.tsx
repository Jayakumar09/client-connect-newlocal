import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Trash2, Phone, MapPin, Images, Heart, CheckCircle2 } from "lucide-react";
import { Person } from "@/pages/Dashboard";
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

interface PersonCardProps {
  person: Person;
  globalIndex?: number;
  onView: (person: Person) => void;
  onEdit: (person: Person) => void;
  onDelete: (id: string, imageUrls: string[]) => void;
  onMarkMatched?: (person: Person) => void;
}

const PersonCard = ({ person, globalIndex = 0, onView, onEdit, onDelete, onMarkMatched }: PersonCardProps) => {
  const isMatched = person.match_status === 'matched';

  const getPaymentStatusSymbol = (status: 'paid' | 'non_paid' | 'free') => {
    switch (status) {
      case 'paid': return '{P}';
      case 'non_paid': return '{NP}';
      case 'free': return '{F}';
      default: return '';
    }
  };

  const displayName = `${person.name}${getPaymentStatusSymbol(person.payment_status)}`;

  return (
    <Card className={`shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group ${isMatched ? 'opacity-90' : ''}`}>
      <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{displayName}</CardTitle>
              {isMatched && (
                <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Matched
                </Badge>
              )}
            </div>
            <Badge variant="secondary" className="mt-2">
              SL No: {globalIndex + 1}
            </Badge>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              {person.profile_image && (
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-border">
                  <img src={person.profile_image} alt={person.name} className="w-full h-full object-cover" />
                </div>
              )}
              {!person.profile_image && (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-muted-foreground font-semibold text-lg border-2 border-border">
                  {person.name.charAt(0).toUpperCase()}
                </div>
              )}
              {isMatched && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
              )}
            </div>
            {person.profile_id && (
              <Badge variant="outline" className="text-xs font-mono mt-1">
                {person.profile_id}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-foreground line-clamp-2">{person.address}</p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <p className="text-foreground">{person.phoneno}</p>
        </div>

        {person.comments && (
          <div className="text-sm">
            <p className="text-muted-foreground line-clamp-2 italic">{person.comments}</p>
          </div>
        )}

        {person.image_urls && person.image_urls.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Images className="w-4 h-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {person.image_urls.length} {person.image_urls.length === 1 ? "image" : "images"}
            </p>
          </div>
        )}

        {person.image_urls && person.image_urls.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            {person.image_urls.slice(0, 4).map((url, idx) => (
              <div
                key={idx}
                className="aspect-square rounded-md overflow-hidden bg-muted"
              >
                <img
                  src={url}
                  alt={`${person.name} - ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {person.image_urls.length > 4 && (
              <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-xs font-medium">
                +{person.image_urls.length - 4}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-4 border-t">
        {isMatched ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onView(person)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 opacity-50 cursor-not-allowed"
              disabled
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 opacity-50 cursor-not-allowed"
              disabled
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onView(person)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
            
            {onMarkMatched && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => onMarkMatched(person)}
              >
                <Heart className="w-4 h-4 mr-2" />
                Match
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(person)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="flex-1">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Person Record?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {person.name}'s record and all associated images.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(person.id, person.image_urls)}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default PersonCard;
