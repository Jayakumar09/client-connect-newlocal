import { useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare } from 'lucide-react';
import { useMessages, Conversation } from '@/hooks/useMessages';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
}

const ConversationList = ({ onSelectConversation }: ConversationListProps) => {
  const { conversations, loading, fetchConversations } = useMessages();

  const loadConversations = useCallback(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  if (loading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No conversations yet</h3>
        <p className="text-muted-foreground text-sm">
          Start a conversation by messaging someone from the Browse page
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="space-y-1 p-2">
        {conversations.map((conversation) => (
          <button
            key={`${conversation.partnerId}-${conversation.lastMessageTime}`}
            onClick={() => onSelectConversation(conversation)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left ${
              conversation.unreadCount > 0 ? 'bg-muted/30' : ''
            }`}
          >
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage 
                  src={conversation.partnerPhoto || undefined} 
                  alt={conversation.partnerName || 'User'} 
                />
                <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                  {(conversation.partnerName || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {conversation.unreadCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-pink-500 text-white text-xs"
                >
                  {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium truncate">
                  {conversation.partnerName || 'Unknown User'}
                </h4>
                {conversation.lastMessageTime && (
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {formatDistanceToNow(new Date(conversation.lastMessageTime), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className={`text-sm truncate ${
                conversation.unreadCount > 0 
                  ? 'text-foreground font-medium' 
                  : 'text-muted-foreground'
              }`}>
                {conversation.lastMessage || 'No messages yet'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};

export default ConversationList;
