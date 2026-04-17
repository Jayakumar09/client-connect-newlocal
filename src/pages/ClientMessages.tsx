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
import { Loader2, ArrowLeft, Search, Send, Paperclip, Image, File as FileIcon, Mic, Play, Pause, Trash2, X, MessageSquare, Upload, Download } from "lucide-react";
import { format, isToday, isYesterday, isThisWeek, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ClientHeader } from "@/components/ClientHeader";
import EmojiPicker from "@/components/EmojiPicker";
import { toast } from "sonner";
import { formatChatPartnerName } from "@/lib/chat-utils";

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
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth();
  
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/client-auth");
  };

  const fetchConversations = useCallback(async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      console.log('[ClientMessages] Raw messages count:', messagesData?.length);

      const partnerMap = new Map<string, Conversation>();
      
      messagesData?.forEach((msg: Message) => {
        const partnerId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
        
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, {
            partnerId,
            partnerName: "Admin", // Default to Admin for client view
            partnerPhoto: null,
            lastMessage: msg.message || (msg.attachment_url ? '[Attachment]' : ''),
            lastMessageTime: msg.created_at,
            unreadCount: 0
          });
        }
        
        const conv = partnerMap.get(partnerId)!;
        if (msg.sender_id !== user?.id && !msg.is_read) {
          conv.unreadCount++;
        }
        // Update lastMessage to most recent
        if (new Date(msg.created_at) > new Date(conv.lastMessageTime)) {
          conv.lastMessage = msg.message || (msg.attachment_url ? '[Attachment]' : '');
          conv.lastMessageTime = msg.created_at;
        }
      });

      const partnerIds = Array.from(partnerMap.keys());
      console.log('[ClientMessages] Unique partners:', partnerIds);

      if (partnerIds.length === 0) {
        setConversations([]);
        return;
      }

      // Fetch all partner profiles from both tables
      const [clientProfilesResult, adminProfilesResult] = await Promise.all([
        supabase.from('client_profiles').select('user_id, full_name, profile_photo').in('user_id', partnerIds),
        supabase.from('persons').select('user_id, name, profile_image').in('user_id', partnerIds)
      ]);

      const clientProfiles = clientProfilesResult.data || [];
      const adminProfiles = adminProfilesResult.data || [];
      
      console.log('[ClientMessages] clientProfiles:', clientProfiles);
      console.log('[ClientMessages] adminProfiles:', adminProfiles);

      // Build set of admin user_ids (anyone in persons table is admin)
      const adminUserIds = new Set(adminProfiles.map(p => p.user_id));
      console.log('[ClientMessages] Admin user_ids:', Array.from(adminUserIds));

      // Update conversation names
      partnerMap.forEach((conv, partnerId) => {
        console.log('[ClientMessages] Processing partner:', partnerId);
        
        // Check if this partner is an admin (exists in persons table)
        const isAdmin = adminUserIds.has(partnerId);
        console.log('[ClientMessages] Partner', partnerId, 'isAdmin:', isAdmin);

        if (isAdmin) {
          // Admin: show just "Admin" for client view
          const adminProfile = adminProfiles.find(p => p.user_id === partnerId);
          conv.partnerName = 'Admin';
          conv.partnerPhoto = adminProfile?.profile_image || null;
          console.log('[ClientMessages] Set partner name to Admin for:', partnerId);
        } else {
          // Client profile: show name
          const clientProfile = clientProfiles.find(p => p.user_id === partnerId);
          if (clientProfile) {
            conv.partnerName = clientProfile.full_name || 'User';
            conv.partnerPhoto = clientProfile.profile_photo;
            console.log('[ClientMessages] Set partner name to:', conv.partnerName, 'for:', partnerId);
          } else {
            // If not found in either table, default to Admin for client view
            // (Most common case: client chatting with admin)
            console.log('[ClientMessages] Partner not in profiles, defaulting to Admin for:', partnerId);
            conv.partnerName = 'Admin';
          }
        }
      });

      const sortedConversations = Array.from(partnerMap.values())
        .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

      console.log('[ClientMessages] Final conversations:', sortedConversations.length, sortedConversations);
      setConversations(sortedConversations);
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
    
    Promise.all([fetchConversations()])
      .finally(() => setLoading(false));
  }, [authLoading, isAuthenticated, navigate, fetchConversations]);

  // Auto-select first conversation when conversations are loaded
  useEffect(() => {
    if (conversations.length > 0 && !selectedPartner) {
      console.log('[ClientMessages] Auto-selecting first conversation:', conversations[0]);
      setSelectedPartner(conversations[0]);
      fetchMessages(conversations[0].partnerId);
    }
  }, [conversations, selectedPartner, fetchMessages]);

  useEffect(() => {
    if (selectedPartner && messagesEndRef.current) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedPartner, messages]);

  const sanitizeFileName = (name: string): string => {
    return name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);
  };

  const sendMessage = async () => {
    if (!selectedPartner || sending) return;
    if (!newMessage.trim() && !attachmentPreview) return;

    setSending(true);
    try {
      if (attachmentPreview) {
        // Debug: Check auth state before upload
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('[ClientMessages] Auth state before upload:', {
          userId: user?.id,
          sessionUser: sessionData?.user?.id,
          bucket: 'chat-attachments'
        });

        console.log('[ClientMessages] Uploading file:', {
          name: attachmentPreview.name,
          type: attachmentPreview.type,
          size: attachmentPreview.size,
          sizeMB: (attachmentPreview.size / 1024 / 1024).toFixed(2)
        });

        const sanitizedName = sanitizeFileName(attachmentPreview.name);
        const fileExt = sanitizedName.split(".").pop() || "bin";
        const filePath = `${user?.id}/${Date.now()}-${sanitizedName}`;

        console.log('[ClientMessages] Upload path:', filePath);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, attachmentPreview, {
            contentType: attachmentPreview.type,
            upsert: false
          });

        if (uploadError) {
          console.error('[ClientMessages] Upload error details:', {
            message: uploadError.message,
            status: uploadError.status,
            error: uploadError
          });
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        console.log('[ClientMessages] Upload success:', uploadData);

        const { data: urlData } = supabase.storage
          .from("chat-attachments")
          .getPublicUrl(filePath);

        // Build insert payload - ONLY send columns that definitely exist in messages table
        const insertPayload = {
          sender_id: user?.id,
          receiver_id: selectedPartner.partnerId,
          message: newMessage.trim() || `[${attachmentPreview.name}]`,
          attachment_url: urlData.publicUrl,
          attachment_name: attachmentPreview.name,
          attachment_size: String(attachmentPreview.size),
          attachment_mime_type: attachmentPreview.type
        };

        console.log('[ClientMessages] Insert payload:', insertPayload);

        const { error } = await supabase
          .from("messages")
          .insert(insertPayload);

        if (error) {
          console.error('[ClientMessages] Insert error:', error);
          throw error;
        }

        toast.success("File sent successfully");
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
    } catch (error: any) {
      console.error("[ClientMessages] Error sending message:", error);
      const errorMessage = error?.message || 'Unknown error';
      console.error('[ClientMessages] Error message for toast:', errorMessage);
      
      if (errorMessage.includes('Bucket not found')) {
        toast.error("Storage not configured. Please contact admin to set up file storage.");
      } else if (errorMessage.includes('permission') || errorMessage.includes('violates row-level security') || errorMessage.includes('new row violates')) {
        toast.error("Upload failed: Storage permission issue. Please contact admin to check storage policies.");
        console.error('[ClientMessages] RLS Policy error - check Supabase storage policies');
      } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        toast.error("Upload failed: Storage limit exceeded.");
      } else if (errorMessage.includes('already exists')) {
        toast.error("Upload failed: File already exists.");
      } else {
        toast.error(`Failed to send message: ${errorMessage}`);
      }
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
      const filePath = `${currentUserId}/${Date.now()}-voice.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });
      
      if (uploadError) {
        console.error('[ClientMessages] Voice upload error:', uploadError);
        throw new Error(`Voice upload failed: ${uploadError.message}`);
      }
      
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
      
      toast.success("Voice message sent");
      setAudioBlob(null);
      setRecordingDuration(0);
      await fetchMessages(selectedPartner.partnerId);
      await fetchConversations();
    } catch (error: any) {
      console.error("[ClientMessages] Error sending voice message:", error);
      const errorMessage = error?.message || 'Unknown error';
      if (errorMessage.includes('Bucket not found')) {
        toast.error("Storage not configured. Please contact admin.");
      } else {
        toast.error(`Failed to send voice message: ${errorMessage}`);
      }
    } finally {
      setSending(false);
    }
  }, [selectedPartner, audioBlob, sending, recordingDuration, user?.id, fetchMessages, fetchConversations]);

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

  const formatFileSize = (bytes: number | string) => {
    const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  };

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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-pink-100 flex flex-col">
      <ClientHeader
        showBackToDashboard
        showInterestsButton
        showChatButton
        showMyProfileButton
        showLogoutButton
        onSignOut={handleSignOut}
      />

      <main className="flex-1 container mx-auto px-4 py-4">
        <Card className="h-[calc(100vh-140px)]">
          <div className="flex h-full">
            {/* Left Panel - Conversation List */}
            <div className="w-1/3 border-r flex flex-col">
              <CardHeader className="border-b pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5" />
                  Messages
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
                  {conversations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No conversations yet</p>
                      <p className="text-sm">Admin will message you soon</p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.partnerId}
                        onClick={() => {
                          console.log('[ClientMessages] Selecting conversation:', conv);
                          setSelectedPartner(conv);
                          fetchMessages(conv.partnerId);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left",
                          selectedPartner?.partnerId === conv.partnerId && "bg-muted"
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={conv.partnerPhoto || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                              {conv.partnerName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {conv.unreadCount > 0 && (
                            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-pink-500 text-white text-xs">
                              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium truncate">{conv.partnerName}</h4>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatDistanceToNow(new Date(conv.lastMessageTime), { addSuffix: false })}
                            </span>
                          </div>
                          <p className={cn(
                            "text-sm truncate",
                            conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                          )}>
                            {conv.lastMessage || "No messages yet"}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
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