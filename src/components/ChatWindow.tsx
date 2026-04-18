import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, ArrowLeft, Loader2, MoreVertical, Ban, AlertTriangle, Smile, Mic, Play, Pause, Trash2 } from 'lucide-react';
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
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  
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

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('[ChatWindow] Microphone error:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingDuration(0);
      setAudioBlob(null);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob || !currentUserId) return;
    
    setSending(true);
    try {
      const fileExt = 'webm';
      const filePath = `${currentUserId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await (await import('@/integrations/supabase/client')).supabase.storage
        .from('chat-attachments')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = (await import('@/integrations/supabase/client')).supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);
      
      const { error } = await (await import('@/integrations/supabase/client')).supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: partnerId,
          message: '🎤 Voice message',
          message_type: 'audio',
          attachment_url: urlData.publicUrl,
          attachment_name: `Voice message (${formatDuration(recordingDuration)})`,
          attachment_size: audioBlob.size,
          attachment_mime_type: 'audio/webm'
        });
      
      if (error) throw error;
      
      setAudioBlob(null);
      setRecordingDuration(0);
    } catch (error) {
      console.error('[ChatWindow] Error sending voice message:', error);
    } finally {
      setSending(false);
    }
  };

  const togglePlayAudio = (messageId: string, audioUrl: string) => {
    if (playingAudioId === messageId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingAudioId(null);
        audioRef.current = null;
      };
      
      audio.play();
      setPlayingAudioId(messageId);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                    const isVoiceMessage = msg.message_type === 'audio' || msg.message.startsWith('🎤');
                    
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
                            {isVoiceMessage && msg.attachment_url ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => togglePlayAudio(msg.id, msg.attachment_url)}
                                  className={cn("h-10 w-10 rounded-full", isMine ? "text-white" : "text-pink-500")}
                                >
                                  {playingAudioId === msg.id ? (
                                    <Pause className="h-5 w-5" />
                                  ) : (
                                    <Play className="h-5 w-5" />
                                  )}
                                </Button>
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-medium truncate", isMine ? "text-white" : "text-foreground")}>
                                    Voice message
                                  </p>
                                  <p className={cn("text-xs", isMine ? "text-white/70" : "text-muted-foreground")}>
                                    {msg.attachment_name || 'Audio'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
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
                              </>
                            )}
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

      {/* Recording UI */}
      {isRecording || audioBlob ? (
        <div className="p-4 border-t bg-red-50 dark:bg-red-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 font-medium">
                  {isRecording ? `Recording ${formatDuration(recordingDuration)}` : 'Recording ready'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelRecording}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
              <Button
                onClick={sendVoiceMessage}
                disabled={sending || !audioBlob}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex gap-2">
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            <Button
              variant="ghost"
              size="icon"
              onClick={startRecording}
              className="text-red-500 hover:text-red-600"
              title="Record voice note"
            >
              <Mic className="h-5 w-5" />
            </Button>
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
      )}

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
