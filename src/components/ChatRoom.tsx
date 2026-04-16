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
import { Message, UserProfile } from '../types';
import { ChevronLeft, Send, Image as ImageIcon, Plus, X, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatRoomProps {
  conversationId: string;
  onBack: () => void;
}

export default function ChatRoom({ conversationId, onBack }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Get other user info
    async function fetchOtherUser() {
      const convSnap = await getDoc(doc(db, 'conversations', conversationId));
      if (convSnap.exists()) {
        const participants = convSnap.data().participants as string[];
        const otherId = participants.find(id => id !== auth.currentUser?.uid);
        if (otherId) {
          const uSnap = await getDoc(doc(db, 'users', otherId));
          setOtherUser(uSnap.data() as UserProfile);
        }
      }
    }
    fetchOtherUser();

    // Listen to messages
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs: Message[] = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [conversationId]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !auth.currentUser) return;

    const text = inputValue.trim();
    setInputValue('');

    try {
      const msgData = {
        conversationId,
        senderId: auth.currentUser.uid,
        text,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), msgData);
      
      // Update last message in conversation
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: {
          text,
          senderId: auth.currentUser.uid,
          createdAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `conversations/${conversationId}/messages`);
    }
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
        <div className="flex items-center gap-4 text-gray-400">
          <button className="hover:text-mc-green transition-colors">📞</button>
          <button className="hover:text-mc-green transition-colors">📹</button>
          <button className="hover:text-mc-green transition-colors">⋮</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, idx) => {
          const isMine = msg.senderId === auth.currentUser?.uid;

          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <div 
                className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  isMine 
                    ? 'bg-mc-green text-white rounded-br-none' 
                    : 'bg-white text-mc-text rounded-bl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="bg-white px-6 py-4 border-t border-mc-border h-[80px] shrink-0 flex items-center justify-center">
        <form onSubmit={handleSend} className="flex items-center gap-4 w-full">
          <button type="button" className="text-gray-400 hover:text-mc-green transition-colors text-2xl">⊕</button>
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
            disabled={!inputValue.trim()}
            className="w-10 h-10 bg-mc-green text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-gray-300 shadow-md active:scale-95 transition-all shrink-0"
          >
            <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[9px] border-l-white ml-0.5"></div>
          </button>
        </form>
      </div>

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
