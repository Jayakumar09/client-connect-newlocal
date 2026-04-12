import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, ArrowLeft, Loader2, MoreVertical, Ban, AlertTriangle, Smile } from 'lucide-react';
import { useMessages, Message } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useReactions } from '@/hooks/useReactions';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import TypingIndicator from './TypingIndicator';
import MessageReactions from './MessageReactions';
import EmojiPicker from './EmojiPicker';
import BlockReportDialog from './BlockReportDialog';

interface ChatWindowProps {
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  onBack: () => void;
}

const ChatWindow = ({ partnerId, partnerName, partnerPhoto, onBack }: ChatWindowProps) => {
  const { messages, loading, currentUserId, fetchMessages, sendMessage, subscribeToMessages } = useMessages();
  const { isPartnerTyping, handleTyping } = useTypingIndicator(currentUserId, partnerId);
  const { reactions, toggleReaction } = useReactions(messages.map(m => m.id));
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [blockReportMode, setBlockReportMode] = useState<'block' | 'report' | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages(partnerId);
    const unsubscribe = subscribeToMessages(partnerId);
    return unsubscribe;
  }, [partnerId, fetchMessages, subscribeToMessages]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isPartnerTyping]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    const result = await sendMessage(partnerId, newMessage.trim());
    if (result) {
      setNewMessage('');
      inputRef.current?.focus();
    }
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [date: string]: Message[] } = {};
    messages.forEach(msg => {
      const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarImage src={partnerPhoto || undefined} alt={partnerName} />
          <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
            {partnerName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{partnerName}</h3>
          <p className="text-xs text-muted-foreground">
            {isPartnerTyping ? 'Typing...' : 'Online'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setBlockReportMode('block')} className="text-destructive">
              <Ban className="h-4 w-4 mr-2" />
              Block User
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBlockReportMode('report')}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Report User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Send a message to start the conversation!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(messageGroups).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex justify-center my-4">
                  <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                    {format(new Date(date), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="space-y-2">
                  {msgs.map((msg) => {
                    const isMine = msg.sender_id === currentUserId;
                    const messageReactions = reactions.get(msg.id) || [];
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex flex-col',
                          isMine ? 'items-end' : 'items-start'
                        )}
                        onMouseEnter={() => setHoveredMessageId(msg.id)}
                        onMouseLeave={() => setHoveredMessageId(null)}
                      >
                        <div className="flex items-center gap-1">
                          {isMine && hoveredMessageId === msg.id && (
                            <EmojiPicker onEmojiSelect={(emoji) => toggleReaction(msg.id, emoji)}>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Smile className="h-4 w-4" />
                              </Button>
                            </EmojiPicker>
                          )}
                          <div
                            className={cn(
                              'max-w-[75%] px-4 py-2 rounded-2xl',
                              isMine
                                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-br-md'
                                : 'bg-muted text-foreground rounded-bl-md'
                            )}
                          >
                            <p className="break-words">{msg.message}</p>
                            <p
                              className={cn(
                                'text-xs mt-1',
                                isMine ? 'text-white/70' : 'text-muted-foreground'
                              )}
                            >
                              {format(new Date(msg.created_at), 'h:mm a')}
                              {isMine && (
                                <span className="ml-2">
                                  {msg.is_read ? '✓✓' : '✓'}
                                </span>
                              )}
                            </p>
                          </div>
                          {!isMine && hoveredMessageId === msg.id && (
                            <EmojiPicker onEmojiSelect={(emoji) => toggleReaction(msg.id, emoji)}>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Smile className="h-4 w-4" />
                              </Button>
                            </EmojiPicker>
                          )}
                        </div>
                        <MessageReactions
                          reactions={messageReactions}
                          currentUserId={currentUserId}
                          onReactionClick={(emoji) => toggleReaction(msg.id, emoji)}
                          isMine={isMine}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isPartnerTyping && (
              <div className="flex justify-start">
                <TypingIndicator partnerName={partnerName} />
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex gap-2">
          <EmojiPicker onEmojiSelect={handleEmojiSelect} />
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 border-pink-200 focus-visible:ring-pink-500"
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Block/Report Dialog */}
      {blockReportMode && (
        <BlockReportDialog
          open={!!blockReportMode}
          onClose={() => setBlockReportMode(null)}
          userId={partnerId}
          userName={partnerName}
          mode={blockReportMode}
        />
      )}
    </div>
  );
};

export default ChatWindow;
