import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Search, Send, Paperclip, Image, File, Mic, Play, Pause, Trash2, X, MessageSquare } from "lucide-react";
import { format, isToday, isYesterday, isThisWeek, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import logoImage from "@/assets/sri-lakshmi-logo.png";
import EmojiPicker from "@/components/EmojiPicker";

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type?: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_size?: number;
  attachment_mime_type?: string;
  is_read: boolean;
  created_at: string;
}

const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001";

const ClientMessages = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const partnerMap = new Map<string, Conversation>();
      
      messagesData?.forEach((msg: Message) => {
        const partnerId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
        
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, {
            partnerId,
            partnerName: "Admin",
            partnerPhoto: null,
            lastMessage: msg.message,
            lastMessageTime: msg.created_at,
            unreadCount: 0
          });
        }
        
        const conv = partnerMap.get(partnerId)!;
        if (msg.sender_id !== user?.id && !msg.is_read) {
          conv.unreadCount++;
        }
      });

      setConversations(Array.from(partnerMap.values()));
    } catch (error) {
      console.error("[ClientMessages] Error fetching conversations:", error);
    }
  }, [user?.id]);

  const fetchMessages = useCallback(async (partnerId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user?.id})`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("sender_id", partnerId)
        .eq("receiver_id", user?.id)
        .eq("is_read", false);
    } catch (error) {
      console.error("[ClientMessages] Error fetching messages:", error);
    } finally {
      setMessagesLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      navigate("/client-auth");
      return;
    }
    
    setSelectedPartner({
      partnerId: ADMIN_USER_ID,
      partnerName: "Admin",
      partnerPhoto: null,
      lastMessage: "",
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0
    });
    
    Promise.all([fetchConversations()])
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, navigate, fetchConversations]);

  useEffect(() => {
    if (selectedPartner && messagesEndRef.current) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedPartner, messages]);

  const sendMessage = async () => {
    if (!selectedPartner || sending) return;
    if (!newMessage.trim() && !attachmentPreview) return;

    setSending(true);
    try {
      if (attachmentPreview) {
        const fileExt = attachmentPreview.name.split(".").pop();
        const filePath = `${user?.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, attachmentPreview, {
            contentType: attachmentPreview.type,
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("chat-attachments")
          .getPublicUrl(filePath);

        let messageType = "document";
        if (attachmentPreview.type.startsWith("image/")) messageType = "image";
        else if (attachmentPreview.type.startsWith("video/")) messageType = "video";
        else if (attachmentPreview.type.startsWith("audio/")) messageType = "audio";

        const { error } = await supabase
          .from("messages")
          .insert({
            sender_id: user?.id,
            receiver_id: selectedPartner.partnerId,
            message: newMessage.trim() || "",
            message_type: messageType,
            attachment_url: urlData.publicUrl,
            attachment_name: attachmentPreview.name,
            attachment_size: attachmentPreview.size,
            attachment_mime_type: attachmentPreview.type
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("messages")
          .insert({
            sender_id: user?.id,
            receiver_id: selectedPartner.partnerId,
            message: newMessage.trim()
          });

        if (error) throw error;
      }

      setNewMessage("");
      setAttachmentPreview(null);
      setFileInputKey(k => k + 1);
      await fetchMessages(selectedPartner.partnerId);
      await fetchConversations();
    } catch (error) {
      console.error("[ClientMessages] Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

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
      console.error("[ClientMessages] Microphone error:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const cancelRecording = useCallback(() => {
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
  }, [isRecording]);

  const sendVoiceMessage = useCallback(async () => {
    if (!selectedPartner || !audioBlob || sending) return;
    const currentUserId = user?.id || '';
    
    setSending(true);
    try {
      const fileExt = 'webm';
      const filePath = `${currentUserId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);
      
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          receiver_id: selectedPartner.partnerId,
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
      await fetchMessages(selectedPartner.partnerId);
      await fetchConversations();
    } catch (error) {
      console.error("[ClientMessages] Error sending voice message:", error);
    } finally {
      setSending(false);
    }
  }, [selectedPartner, audioBlob, sending, recordingDuration]);

  const togglePlayAudio = useCallback((messageId: string, audioUrl: string) => {
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
  }, [playingAudioId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleNewMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachmentPreview(file);
  };

  const handleRemoveAttachment = () => {
    setAttachmentPreview(null);
    setFileInputKey(k => k + 1);
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: Record<string, Message[]> = {};
    msgs.forEach(msg => {
      const date = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    if (isThisWeek(date)) return format(date, "EEEE");
    return format(date, "MMMM d, yyyy");
  };

  const formatMessageTime = (dateStr: string) => format(new Date(dateStr), "h:mm a");

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c => 
        c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Sri Lakshmi Mangalya Malai" className="h-12 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">MESSAGES</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate("/browse")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Browse
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-4">
        <Card className="h-[calc(100vh-140px)]">
          <div className="flex h-full">
            {/* Left Panel - Conversation List */}
            <div className="w-1/3 border-r flex flex-col">
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5" />
                  Chat with Admin
                  {unreadTotal > 0 && (
                    <Badge className="ml-2 bg-pink-500">{unreadTotal}</Badge>
                  )}
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search messages..."
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <ScrollArea className="flex-1">
                <div className="p-2">
                  <button
                    onClick={() => {
                      setSelectedPartner({
                        partnerId: ADMIN_USER_ID,
                        partnerName: "Admin",
                        partnerPhoto: null,
                        lastMessage: "",
                        lastMessageTime: new Date().toISOString(),
                        unreadCount: 0
                      });
                      fetchMessages(ADMIN_USER_ID);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left",
                      selectedPartner?.partnerId === ADMIN_USER_ID && "bg-muted"
                    )}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                        A
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">Admin</h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {selectedPartner?.lastMessage || "Start a conversation..."}
                      </p>
                    </div>
                  </button>
                </div>
              </ScrollArea>
            </div>

            {/* Right Panel - Chat Window */}
            <div className="flex-1 flex flex-col">
              {selectedPartner ? (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center gap-3 p-4 border-b">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                        A
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold">{selectedPartner.partnerName}</h3>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-center">
                        <div>
                          <p className="text-muted-foreground">Start a conversation with admin</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Send a message below!
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(groupMessagesByDate(messages)).map(([date, msgs]) => (
                          <div key={date}>
                            <div className="flex justify-center my-4">
                              <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground">
                                {formatMessageDate(date)}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {msgs.map((msg) => {
                                const isMine = msg.sender_id === user?.id;
                                const isVoiceMessage = msg.message_type === 'audio' || msg.message.startsWith('🎤');
                                
                                return (
                                  <div
                                    key={msg.id}
                                    className={cn(
                                      "flex",
                                      isMine ? "justify-end" : "justify-start"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "max-w-[75%] px-4 py-2 rounded-2xl",
                                        isMine
                                          ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-br-md"
                                          : "bg-muted text-foreground rounded-bl-md"
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
                                        <p className="break-words">{msg.message}</p>
                                      )}
                                      <p
                                        className={cn(
                                          "text-xs mt-1",
                                          isMine ? "text-white/70" : "text-muted-foreground"
                                        )}
                                      >
                                        {formatMessageTime(msg.created_at)}
                                        {isMine && (
                                          <span className="ml-2">
                                            {msg.is_read ? "✓✓" : "✓"}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Attachment Preview */}
                  {attachmentPreview && (
                    <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
                      {attachmentPreview.type.startsWith("image/") && (
                        <img
                          src={URL.createObjectURL(attachmentPreview)}
                          alt="Preview"
                          className="h-16 w-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{attachmentPreview.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(attachmentPreview.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleRemoveAttachment}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

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
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <input
                          type="file"
                          key={fileInputKey}
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                        >
                          <Paperclip className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={startRecording}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Mic className="h-5 w-5" />
                        </Button>
                        <EmojiPicker onEmojiSelect={(emoji) => setNewMessage(prev => prev + emoji)} />
                        <Input
                          ref={inputRef}
                          value={newMessage}
                          onChange={handleNewMessageChange}
                          onKeyPress={handleKeyPress}
                          placeholder="Type a message..."
                          className="flex-1"
                        />
                        <Button
                          onClick={sendMessage}
                          disabled={(!newMessage.trim() && !attachmentPreview) || sending}
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
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground">Select a conversation to start chatting</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default ClientMessages;