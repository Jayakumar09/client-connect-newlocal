import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Search, Send, Paperclip, Image, File as FileIcon, Mic, MicOff, X, ChevronDown, Play, Pause, Square, Trash2, Download } from "lucide-react";
import { format, isToday, isYesterday, isThisWeek, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { BRAND_LOGO } from "@/lib/branding";
import EmojiPicker from "@/components/EmojiPicker";
import { formatChatPartnerName } from "@/lib/chat-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  phoneNumber?: string;
  email?: string;
  profileId?: string;
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

interface ClientProfile {
  user_id: string;
  full_name: string | null;
  profile_photo: string | null;
  phone_number: string | null;
  email: string | null;
  profile_id?: string | null;
  match_status?: 'not_matched' | 'matched' | null;
  matched_with_id?: string | null;
  match_remarks?: string | null;
}

interface ClientProfileLookup {
  user_id: string;
  full_name: string | null;
  profile_photo: string | null;
  phone_number: string | null;
  email: string | null;
  profile_id?: string | null;
}

type ExtendedMessageInsert = {
  sender_id: string | undefined;
  receiver_id: string;
  message: string;
  message_type?: "document" | "image" | "video" | "audio";
  attachment_url?: string;
  attachment_name?: string;
  attachment_size?: number;
  attachment_mime_type?: string;
};

const AdminMessages: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isAuthenticated, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allClients, setAllClients] = useState<ClientProfile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitialized = useRef(false);

  const fetchConversations = useCallback(async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const partnerMap = new Map<string, Conversation>();
      
      messagesData?.forEach((msg: Message) => {
        const partnerId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
        
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, {
            partnerId,
            partnerName: "Loading...",
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

      const partnerIds = Array.from(partnerMap.keys());
      
      if (partnerIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("client_profiles")
          .select("user_id, full_name, profile_photo, phone_number, email, profile_id")
          .in("user_id", partnerIds);

        const profiles = (profileRows ?? []) as unknown as ClientProfileLookup[];

        const profileMap = new Map(
          profiles.map((profile) => [profile.user_id, profile])
        );

        partnerMap.forEach((conv, partnerId) => {
          const profile = profileMap.get(partnerId);
          if (profile) {
            conv.profileId = profile.profile_id || undefined;
            conv.partnerName = profile.full_name 
              ? `${profile.full_name} / Profile ID: ${profile.profile_id || 'N/A'}`
              : 'Unknown User';
            conv.partnerPhoto = profile.profile_photo;
            conv.phoneNumber = profile.phone_number || undefined;
            conv.email = profile.email || undefined;
            console.log('[AdminMessages] Loaded profile:', profile.full_name, 'Profile ID:', profile.profile_id);
          } else {
            // Safe fallback - never expose internal IDs
            conv.partnerName = 'Unknown User';
            console.log('[AdminMessages] No profile found for:', partnerId);
          }
        });
      }

      setConversations(Array.from(partnerMap.values()));
    } catch (error) {
      console.error("[AdminMessages] Error fetching conversations:", error);
    }
  }, [user?.id]);

  const fetchAllClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("client_profiles")
        .select("user_id, full_name, profile_photo, phone_number, email")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setAllClients(data || []);
    } catch (error) {
      console.error("[AdminMessages] Error fetching clients:", error);
    }
  }, []);

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
      console.error("[AdminMessages] Error fetching messages:", error);
    } finally {
      setMessagesLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    if (!isAuthenticated || !isAdmin) {
      navigate("/auth");
      return;
    }
    
    Promise.all([fetchConversations(), fetchAllClients()])
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, isAdmin, navigate, fetchConversations, fetchAllClients]);

  useEffect(() => {
    if (selectedPartner && messagesEndRef.current) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedPartner, messages]);

  const sendMessage = useCallback(async () => {
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

        if (uploadError) {
          console.error("[AdminMessages] Upload error:", uploadError);
        }

        const { data: urlData } = supabase.storage
          .from("chat-attachments")
          .getPublicUrl(filePath);

        let messageType = "document";
        if (attachmentPreview.type.startsWith("image/")) messageType = "image";
        else if (attachmentPreview.type.startsWith("video/")) messageType = "video";
        else if (attachmentPreview.type.startsWith("audio/")) messageType = "audio";

        const payload: ExtendedMessageInsert = {
          sender_id: user?.id,
          receiver_id: selectedPartner.partnerId,
          message: newMessage.trim() || "",
          message_type: messageType,
          attachment_url: urlData.publicUrl,
          attachment_name: attachmentPreview.name,
          attachment_size: attachmentPreview.size,
          attachment_mime_type: attachmentPreview.type
        };

        const { error } = await supabase
          .from("messages")
          .insert(payload as never);

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
      console.error("[AdminMessages] Error sending message:", error);
    } finally {
      setSending(false);
    }
  }, [attachmentPreview, fetchConversations, fetchMessages, newMessage, selectedPartner, sending, user?.id]);

  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    setSelectedPartner(conv);
    setSearchQuery("");
    await fetchMessages(conv.partnerId);
  }, [fetchMessages]);

  const handleSelectClient = useCallback(async (client: ClientProfile) => {
    const existingConv = conversations.find(c => c.partnerId === client.user_id);
    
    if (existingConv) {
      setSelectedPartner(existingConv);
      await fetchMessages(client.user_id);
    } else {
      const newConv: Conversation = {
        partnerId: client.user_id,
        partnerName: client.full_name || "Unknown User",
        partnerPhoto: client.profile_photo,
        lastMessage: "",
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        phoneNumber: client.phone_number || undefined,
        email: client.email || undefined
      };
      setSelectedPartner(newConv);
      setMessages([]);
    }
  }, [conversations, fetchMessages]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleNewMessageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Voice recording functions
  const startRecording = useCallback(async () => {
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
      console.error("[AdminMessages] Microphone error:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording]);

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
    
    setSending(true);
    try {
      const fileExt = 'webm';
      const filePath = `${user?.id}/${Date.now()}.${fileExt}`;
      
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
      console.error("[AdminMessages] Error sending voice message:", error);
    } finally {
      setSending(false);
    }
  }, [selectedPartner, audioBlob, sending, user?.id, recordingDuration, fetchMessages, fetchConversations]);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachmentPreview(file);
  }, []);

  const handleRemoveAttachment = useCallback(() => {
    setAttachmentPreview(null);
    setFileInputKey(k => k + 1);
  }, []);

  const groupMessagesByDate = useCallback((msgs: Message[]) => {
    const groups: Record<string, Message[]> = {};
    msgs.forEach(msg => {
      const date = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  }, []);

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    if (isThisWeek(date)) return format(date, "EEEE");
    return format(date, "MMMM d, yyyy");
  };

  const formatMessageTime = (dateStr: string) => format(new Date(dateStr), "h:mm a");

  const formatFileSize = (bytes: number | string) => {
    const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(c => 
      c.partnerName.toLowerCase().includes(query) ||
      c.lastMessage.toLowerCase().includes(query) ||
      (c.phoneNumber && c.phoneNumber.includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query))
    );
  }, [conversations, searchQuery]);

  const clientsNotInConversations = useMemo(() => {
    const conversationPartnerIds = new Set(conversations.map(c => c.partnerId));
    return allClients.filter(c => !conversationPartnerIds.has(c.user_id));
  }, [allClients, conversations]);

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
            <img src={BRAND_LOGO} alt="Sri Lakshmi Mangalya Malai" className="h-12 w-auto" />
            <span className="text-xl font-bold hidden sm:inline">ADMIN MESSAGES</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-4">
        <Card className="h-[calc(100vh-140px)]">
          <div className="flex h-full">
            {/* Left Panel - Conversation List + Client Selector */}
            <div className="w-1/3 border-r flex flex-col">
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  Conversations
                </CardTitle>
                
                {/* Client Dropdown Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between mt-2">
                      <span className="truncate">Select a client...</span>
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[300px] max-h-[300px] overflow-auto">
                    <div className="p-2">
                      <Input
                        placeholder="Search by name, phone, or email..."
                        className="mb-2"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {clientsNotInConversations.length === 0 ? (
                      <DropdownMenuItem disabled>No clients available</DropdownMenuItem>
                    ) : (
                      clientsNotInConversations.map((client) => (
                        <DropdownMenuItem
                          key={client.user_id}
                          onSelect={() => handleSelectClient(client)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={client.profile_photo || undefined} />
                              <AvatarFallback>
                                {client.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{client.full_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">
                                {client.phone_number || client.email || "No contact"}
                              </p>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Search */}
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search conversations..."
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <ScrollArea className="flex-1">
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                    <p className="text-muted-foreground">No conversations yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select a client above to start chatting
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {filteredConversations.map((conv) => (
                      <button
                        key={conv.partnerId}
                        onClick={() => handleSelectConversation(conv)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left",
                          selectedPartner?.partnerId === conv.partnerId && "bg-muted"
                        )}
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.partnerPhoto || undefined} alt={conv.partnerName} />
                          <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                            {conv.partnerName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium truncate">{conv.partnerName}</h4>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conv.lastMessageTime), { addSuffix: true })}
                            </span>
                          </div>
                          <p className={cn("text-sm truncate", conv.unreadCount > 0 && "font-medium")}>
                            {conv.lastMessage || "No messages"}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center bg-pink-500 text-white text-xs">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Panel - Chat Window */}
            <div className="flex-1 flex flex-col">
              {selectedPartner ? (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center gap-3 p-4 border-b">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedPartner.partnerPhoto || undefined} alt={selectedPartner.partnerName} />
                      <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                        {selectedPartner.partnerName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold">{selectedPartner.partnerName}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {selectedPartner.profileId && (
                          <span className="font-mono">Profile ID: {selectedPartner.profileId}</span>
                        )}
                        {selectedPartner.phoneNumber && (
                          <span>{selectedPartner.phoneNumber}</span>
                        )}
                      </div>
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
                          <p className="text-muted-foreground">No messages yet</p>
                          <p className="text-sm text-muted-foreground">
                            Send a message to start the conversation!
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
                                const hasAttachment = msg.attachment_url;
                                const attachmentUrl = msg.attachment_url;
                                const attachmentName = msg.attachment_name;
                                const attachmentMimeType = msg.attachment_mime_type;
                                const isImageAttachment = attachmentMimeType?.startsWith('image/');
                                
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
                                      {/* Voice Message */}
                                      {isVoiceMessage && attachmentUrl ? (
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => togglePlayAudio(msg.id, attachmentUrl)}
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
                                              {attachmentName || 'Audio'}
                                            </p>
                                          </div>
                                        </div>
                                      ) : hasAttachment && isImageAttachment ? (
                                        /* Image Attachment */
                                        <div>
                                          <a href={attachmentUrl} target="_blank" rel="noopener noreferrer">
                                            <img 
                                              src={attachmentUrl} 
                                              alt={attachmentName || 'Image'} 
                                              className="rounded-lg max-w-full cursor-pointer hover:opacity-90"
                                            />
                                          </a>
                                          {msg.message && msg.message !== `[${attachmentName}]` && (
                                            <p className="break-words mt-2">{msg.message}</p>
                                          )}
                                        </div>
                                      ) : hasAttachment ? (
                                        /* Document/File Attachment (PDF, DOC, etc.) */
                                        <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "h-12 w-12 rounded-lg flex items-center justify-center",
                                            isMine ? "bg-white/20" : "bg-primary/10"
                                          )}>
                                            <FileIcon className={cn("h-6 w-6", isMine ? "text-white" : "text-primary")} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={cn("text-sm font-medium truncate", isMine ? "text-white" : "text-foreground")}>
                                              {attachmentName || 'Document'}
                                            </p>
                                            {msg.attachment_size && (
                                              <p className={cn("text-xs", isMine ? "text-white/70" : "text-muted-foreground")}>
                                                {formatFileSize(msg.attachment_size)}
                                              </p>
                                            )}
                                          </div>
                                          <a 
                                            href={attachmentUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            download={attachmentName}
                                          >
                                            <Button size="sm" variant="ghost" className={cn(isMine ? "text-white hover:text-white/80" : "")}>
                                              <Download className="h-4 w-4" />
                                            </Button>
                                          </a>
                                        </div>
                                      ) : (
                                        /* Text Message */
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
                        <p className="text-sm font-medium truncate">
                          {attachmentPreview.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(attachmentPreview.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleRemoveAttachment}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Input */}
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
                          title="Hold to record voice note"
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
                    <p className="text-sm text-muted-foreground mt-1">
                      Or choose a client from the dropdown above
                    </p>
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

export default AdminMessages;
