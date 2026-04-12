import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, X, Heart, Send, Inbox, Clock, MessageSquare } from 'lucide-react';
import { useProfileInterests, InterestWithProfile } from '@/hooks/useProfileInterests';
import { formatDistanceToNow } from 'date-fns';

interface InterestsPanelProps {
  onViewProfile?: (userId: string) => void;
  onMessageUser?: (userId: string) => void;
}

export const InterestsPanel = ({ onViewProfile, onMessageUser }: InterestsPanelProps) => {
  const { 
    sentInterests, 
    receivedInterests, 
    loading, 
    updateInterestStatus 
  } = useProfileInterests();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (interestId: string) => {
    setProcessingId(interestId);
    await updateInterestStatus(interestId, 'accepted');
    setProcessingId(null);
  };

  const handleDecline = async (interestId: string) => {
    setProcessingId(interestId);
    await updateInterestStatus(interestId, 'declined');
    setProcessingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-100 text-green-700">Accepted</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-700">Declined</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
    }
  };

  const renderInterestCard = (interest: InterestWithProfile, type: 'sent' | 'received') => {
    const profile = interest.profile;
    const userId = type === 'sent' ? interest.receiver_id : interest.sender_id;

    return (
      <Card key={interest.id} className="mb-3 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar 
              className="h-12 w-12 cursor-pointer" 
              onClick={() => onViewProfile?.(userId)}
            >
              <AvatarImage src={profile?.profile_photo || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                {profile?.full_name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 
                className="font-medium truncate cursor-pointer hover:text-pink-600"
                onClick={() => onViewProfile?.(userId)}
              >
                {profile?.full_name || 'Unknown User'}
              </h4>
              <p className="text-sm text-muted-foreground truncate">
                {profile?.occupation || 'No occupation'} • {profile?.city || 'Unknown location'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(interest.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(interest.status)}
              {type === 'received' && interest.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                    onClick={() => handleAccept(interest.id)}
                    disabled={processingId === interest.id}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => handleDecline(interest.id)}
                    disabled={processingId === interest.id}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {interest.status === 'accepted' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-pink-600"
                  onClick={() => onMessageUser?.(userId)}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Message
                </Button>
              )}
            </div>
          </div>
          {interest.message && (
            <p className="mt-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              "{interest.message}"
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading interests...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-500" />
          My Interests
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received" className="gap-2">
              <Inbox className="h-4 w-4" />
              Received ({receivedInterests.length})
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2">
              <Send className="h-4 w-4" />
              Sent ({sentInterests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4">
            {receivedInterests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No interests received yet</p>
                <p className="text-sm">When someone sends you an interest, it will appear here</p>
              </div>
            ) : (
              receivedInterests.map(interest => renderInterestCard(interest, 'received'))
            )}
          </TabsContent>

          <TabsContent value="sent" className="mt-4">
            {sentInterests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No interests sent yet</p>
                <p className="text-sm">Start browsing profiles and send interests!</p>
              </div>
            ) : (
              sentInterests.map(interest => renderInterestCard(interest, 'sent'))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default InterestsPanel;
