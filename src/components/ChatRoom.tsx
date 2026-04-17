import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { fileToBase64 } from '../lib/file-utils';
import { Message, UserProfile } from '../types';
import { MessageSquare, Heart, Share2, MapPin, Search, PlusCircle, MoreHorizontal, User as UserIcon, Bell, Shield, HelpCircle, LogOut, ChevronLeft, Send, Image as ImageIcon, Plus, X, Maximize2, MoreVertical, Ban, ShieldAlert, SmilePlus, Camera, Link as LinkIcon, Phone, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCurrentLocation } from '../lib/location';
import { format } from 'date-fns';

interface ChatRoomProps {
  conversationId: string;
  onBack: () => void;
}

export default function ChatRoom({ conversationId, onBack }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [showTimestampFor, setShowTimestampFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBlock = async () => {
    if (!otherUser || !auth.currentUser) return;
    
    try {
      const myUid = auth.currentUser.uid;
      const userRef = doc(db, 'users', myUid);
      
      const { arrayUnion } = await import('firebase/firestore');
      await updateDoc(userRef, {
        blockedUsers: arrayUnion(otherUser.uid)
      });

      setShowBlockConfirm(false);
      onBack();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!auth.currentUser) return;
    const myUid = auth.currentUser.uid;
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || {};
    const users = currentReactions[emoji] || [];
    
    let updatedUsers: string[];
    if (users.includes(myUid)) {
      updatedUsers = users.filter(id => id !== myUid);
    } else {
      updatedUsers = [...users, myUid];
    }

    const newReactions = { ...currentReactions };
    if (updatedUsers.length > 0) {
      newReactions[emoji] = updatedUsers;
    } else {
      delete newReactions[emoji];
    }

    try {
      await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
        reactions: newReactions
      });
      setShowReactionsFor(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}/messages/${messageId}`);
    }
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  useEffect(() => {
    // Scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let unsubscribeUser: () => void;

    // Get other user info with real-time updates
    async function setupChat() {
      try {
        const convSnap = await getDoc(doc(db, 'conversations', conversationId));
        if (convSnap.exists()) {
          const participants = convSnap.data().participants as string[];
          const otherId = participants.find(id => id !== auth.currentUser?.uid);
          
          if (otherId) {
            // Live listener for other user's profile/status
            unsubscribeUser = onSnapshot(doc(db, 'users', otherId), (uSnap) => {
              if (uSnap.exists()) {
                setOtherUser(uSnap.data() as UserProfile);
              }
            }, (err) => {
              handleFirestoreError(err, OperationType.GET, `users/${otherId}`);
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `conversations/${conversationId}`);
      }
    }
    
    setupChat();

    // Listen to messages
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `conversations/${conversationId}/messages`);
    });

    return () => {
      if (unsubscribeUser) unsubscribeUser();
      unsubscribeMessages();
    };
  }, [conversationId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setPendingImage(base64);
      } catch (err) {
        console.error("Error reading file:", err);
      }
    }
  };

  const handleShareLocation = async () => {
    if (!conversationId || !auth.currentUser) return;
    const myUid = auth.currentUser.uid;

    try {
      const loc = await getCurrentLocation();
      await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
        conversationId,
        senderId: myUid,
        text: '📍 Shared a location',
        location: loc,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: {
          text: '📍 Location',
          senderId: myUid,
          createdAt: serverTimestamp(),
          location: true
        },
        updatedAt: serverTimestamp()
      });
      
      setShowExtras(false);
    } catch (err) {
      console.error("Error sharing location:", err);
      // Fallback if permission denied or error
      alert("Please ensure location access is enabled to share your location.");
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputValue.trim() && !pendingImage) || !auth.currentUser || isSending) return;

    const text = inputValue.trim();
    const image = pendingImage;
    setInputValue('');
    setPendingImage(null);
    setIsSending(true);

    try {
      const msgData: any = {
        conversationId,
        senderId: auth.currentUser.uid,
        text,
        createdAt: serverTimestamp()
      };

      if (image) {
        msgData.imageUrl = image;
      }

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), msgData);
      
      // Update last message in conversation
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: {
          text: image ? '📷 Sent a photo' : text,
          senderId: auth.currentUser.uid,
          createdAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}/messages`);
    } finally {
      setIsSending(false);
    }
  };

  const startCall = async (type: 'video' | 'audio') => {
    if (!otherUser || !auth.currentUser) return;
    
    const roomId = `milove-${conversationId}-${Math.random().toString(36).substring(7)}`;
    
    try {
      await addDoc(collection(db, 'calls'), {
        callerId: auth.currentUser.uid,
        callerName: auth.currentUser.displayName || 'Anonymous',
        callerPhoto: auth.currentUser.photoURL || '',
        receiverId: otherUser.uid,
        status: 'calling',
        type: type,
        roomId: roomId,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'calls');
    }
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#f9f9f9] relative z-20">
      {/* Header */}
      <div className="bg-white border-b border-mc-border flex items-center justify-between px-6 py-4 shrink-0 h-[70px]">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-4 hover:bg-gray-50 rounded-full md:hidden">
            <ChevronLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => setFullscreenImage(otherUser?.photoURL || `https://ui-avatars.com/api/?name=${otherUser?.displayName}`)}>
              <img 
                src={otherUser?.photoURL || `https://ui-avatars.com/api/?name=${otherUser?.displayName}`}
                className="w-10 h-10 rounded-full object-cover border border-gray-100"
                alt=""
              />
              <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <Maximize2 className="text-white w-3 h-3" />
              </div>
            </div>
            <div>
              <h2 className="font-bold text-[15px] text-mc-text">{otherUser?.displayName || 'Chat'}</h2>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${otherUser?.isActive ? 'bg-mc-green' : 'bg-gray-300'}`}></div>
                <span className={`text-xs ${otherUser?.isActive ? 'text-mc-green' : 'text-gray-400'}`}>
                  {otherUser?.isActive ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-gray-400 relative">
          <button 
            onClick={() => startCall('audio')}
            className="hover:text-mc-green transition-colors hidden sm:block p-2 hover:bg-gray-50 rounded-full"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button 
            onClick={() => startCall('video')}
            className="hover:text-mc-green transition-colors hidden sm:block p-2 hover:bg-gray-50 rounded-full"
          >
            <Video className="w-5 h-5" />
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-gray-50 rounded-full transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 overflow-hidden"
                  >
                    <button 
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowBlockConfirm(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-red-500 transition-colors text-sm font-bold"
                    >
                      <Ban className="w-4 h-4" />
                      Blokir Pengguna
                    </button>
                    <button 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-gray-600 transition-colors text-sm font-bold"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Laporkan
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => {
          const isMine = msg.senderId === auth.currentUser?.uid;

          return (
            <div 
              key={msg.id} 
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group/msg relative`}
              onMouseEnter={() => setShowTimestampFor(msg.id)}
              onMouseLeave={() => setShowTimestampFor(null)}
              onClick={() => setShowTimestampFor(showTimestampFor === msg.id ? null : msg.id)}
            >
              <div className="flex items-center gap-1 group">
                {isMine && (
                  <button 
                    onClick={() => setShowReactionsFor(showReactionsFor === msg.id ? null : msg.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded-full transition-all text-gray-400"
                  >
                    <SmilePlus className="w-4 h-4" />
                  </button>
                )}
                
                <div 
                  className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm relative ${
                    isMine 
                      ? 'bg-mc-green text-white rounded-br-none' 
                      : 'bg-white text-mc-text rounded-bl-none'
                  }`}
                >
                  {msg.imageUrl && (
                    <div 
                      className="mb-2 relative cursor-pointer group/img"
                      onClick={() => setFullscreenImage(msg.imageUrl!)}
                    >
                      <img 
                        src={msg.imageUrl} 
                        className="rounded-xl w-full max-h-64 object-cover border border-black/5" 
                        alt=""
                      />
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  )}

                  {msg.location && (
                    <div 
                      className="mb-2 relative cursor-pointer group/loc overflow-hidden rounded-xl border border-black/5"
                      onClick={() => openGoogleMaps(msg.location!.lat, msg.location!.lng)}
                    >
                      <div className="bg-gray-100 h-32 flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 bg-mc-green rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
                          <MapPin className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-bold text-mc-text-secondary uppercase tracking-widest bg-white/80 px-2 py-1 rounded-full backdrop-blur-sm">
                          Shared Location
                        </span>
                      </div>
                      <div className="bg-white/90 p-2 text-[10px] border-t border-black/5 flex items-center justify-between">
                        <span className="truncate flex-1 font-medium">{msg.location.lat.toFixed(4)}, {msg.location.lng.toFixed(4)}</span>
                        <span className="text-mc-green font-bold shrink-0 ml-2">VIEW MAP</span>
                      </div>
                    </div>
                  )}
                  {msg.text && (
                    <div className="whitespace-pre-wrap">
                      {renderTextWithLinks(msg.text)}
                    </div>
                  )}
                  
                  {/* Reactions Display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`absolute -bottom-2.5 flex flex-wrap gap-1 ${isMine ? 'right-2' : 'left-2'}`}>
                      {Object.entries(msg.reactions).map(([emoji, uids]) => {
                        const userIds = uids as string[];
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] shadow-sm border transition-all ${
                              userIds.includes(auth.currentUser?.uid || '')
                                ? 'bg-mc-light-green border-mc-green text-mc-green'
                                : 'bg-white border-gray-100 text-gray-500'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-bold">{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!isMine && (
                  <button 
                    onClick={() => setShowReactionsFor(showReactionsFor === msg.id ? null : msg.id)}
                    className="opacity-0 group-hover/msg:opacity-100 p-1 hover:bg-gray-100 rounded-full transition-all text-gray-400"
                  >
                    <SmilePlus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Timestamp */}
              <AnimatePresence>
                {(showTimestampFor === msg.id) && (
                  <motion.div
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    className={`text-[10px] text-gray-400 mt-1 px-2 font-medium bg-gray-50/50 rounded-full py-0.5 border border-gray-100/50 ${isMine ? 'mr-1' : 'ml-1'}`}
                  >
                    {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : 'Sending...'}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reaction Picker Popover */}
              <AnimatePresence>
                {showReactionsFor === msg.id && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: isMine ? -5 : 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: isMine ? -5 : 5 }}
                    className={`absolute z-50 bottom-full mb-2 bg-white rounded-full shadow-xl border border-gray-100 p-1.5 flex gap-1 ${
                      isMine ? 'right-0' : 'left-0'
                    }`}
                  >
                    {['❤️', '😂', '😮', '😢', '🔥', '👍'].map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all text-lg active:scale-90 ${
                          msg.reactions?.[emoji]?.includes(auth.currentUser?.uid || '') ? 'bg-mc-light-green' : ''
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="bg-white px-6 py-4 border-t border-mc-border h-auto shrink-0 flex flex-col items-center justify-center">
        {pendingImage && (
          <div className="w-full mb-3 flex items-start">
            <div className="relative">
              <img 
                src={pendingImage} 
                className="w-20 h-20 rounded-xl object-cover border-2 border-mc-green shadow-md"
                alt="Pending"
              />
              <button 
                onClick={() => setPendingImage(null)}
                className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full p-1 shadow-lg hover:bg-red-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showExtras && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="w-full mb-4 grid grid-cols-4 gap-4"
            >
              <button 
                onClick={() => { fileInputRef.current?.click(); setShowExtras(false); }}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center hover:bg-blue-100 transition-colors">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Photo</span>
              </button>
              
              <button 
                onClick={handleShareLocation}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center hover:bg-green-100 transition-colors">
                  <MapPin className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Location</span>
              </button>

              <button 
                className="flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center hover:bg-purple-100 transition-colors">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Link</span>
              </button>
              
              <button 
                className="flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center hover:bg-orange-100 transition-colors">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Camera</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex items-center gap-4 w-full">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileSelect} 
          />
          <button 
            type="button" 
            onClick={() => setShowExtras(!showExtras)}
            className={`text-gray-400 hover:text-mc-green transition-all ${showExtras ? 'rotate-45 text-mc-green' : ''}`}
          >
            <Plus className="w-6 h-6" />
          </button>
          
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-mc-bg rounded-full py-2.5 px-5 text-sm focus:outline-none border-none text-mc-text placeholder:text-gray-400 shadow-inner"
            />
            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-gray-400">☺</button>
          </div>
          <button 
            type="submit"
            disabled={(!inputValue.trim() && !pendingImage) || isSending}
            className="w-10 h-10 bg-mc-green text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-gray-300 shadow-md active:scale-95 transition-all shrink-0"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[9px] border-l-white ml-0.5"></div>
            )}
          </button>
        </form>
      </div>

      {/* Block Confirmation Modal */}
      <AnimatePresence>
        {showBlockConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-xs w-full text-center shadow-2xl"
            >
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Ban className="text-red-500 w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-mc-text uppercase tracking-tight mb-2">Blokir {otherUser?.displayName}?</h3>
              <p className="text-gray-500 text-xs mb-8 leading-relaxed font-medium">
                Anda tidak akan bisa melihat profil satu sama lain atau saling mengirim pesan lagi. Tindakan ini bisa dibatalkan nanti di pengaturan.
              </p>
              <div className="space-y-3">
                <button 
                  onClick={handleBlock}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-red-100 active:scale-95 transition-all"
                >
                  Ya, Blokir Sekarang
                </button>
                <button 
                  onClick={() => setShowBlockConfirm(false)}
                  className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-100 transition-all"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-12"
            onClick={() => setFullscreenImage(null)}
          >
            <motion.button 
              className="absolute top-6 right-6 text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all"
              onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
            >
              <X className="w-8 h-8" />
            </motion.button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={fullscreenImage} 
              className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl"
              alt="Fullscreen profile"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
