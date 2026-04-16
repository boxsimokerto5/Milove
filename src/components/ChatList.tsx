import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { Conversation, UserProfile } from '../types';
import { MessageCircle, Clock, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { notificationManager } from '../lib/notifications';

interface ChatListProps {
  onSelectChat: (id: string) => void;
}

export default function ChatList({ onSelectChat }: ChatListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const convs: Conversation[] = [];
      
      for (const d of snap.docs) {
        const data = d.data() as Conversation;
        const otherUserId = data.participants.find(id => id !== auth.currentUser?.uid);
        
        let otherUser;
        if (otherUserId) {
          const uSnap = await getDoc(doc(db, 'users', otherUserId));
          otherUser = uSnap.data() as UserProfile;
        }

        const conv = {
          ...data,
          id: d.id,
          otherUser
        };

        convs.push(conv);

        // Notification logic
        if (
          !loading && 
          conv.lastMessage && 
          conv.lastMessage.senderId !== auth.currentUser?.uid &&
          conv.updatedAt
        ) {
          const updateTime = conv.updatedAt.toMillis ? conv.updatedAt.toMillis() : 0;
          if (updateTime > lastUpdateRef.current) {
            notificationManager.notify(`New message from ${conv.otherUser?.displayName || 'User'}`, {
              body: conv.lastMessage.text,
              tag: conv.id // Group by conversation
            });
          }
        }
      }
      
      setConversations(convs);
      setLoading(false);
      
      // Update the "last seen" time to the latest message update time in the snapshot
      const maxUpdate = Math.max(...convs.map(c => c.updatedAt?.toMillis ? c.updatedAt.toMillis() : 0), lastUpdateRef.current);
      lastUpdateRef.current = maxUpdate;
    }, (error) => {
      console.error("Chat list error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 grayscale opacity-50">
        <MessageCircle className="w-12 h-12 mb-4 animate-pulse" />
        <p className="text-sm">Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 pt-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search messages..." 
            className="w-full bg-gray-100 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all border-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="text-center py-20 px-10">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="text-gray-300 w-8 h-8" />
            </div>
            <p className="text-gray-500 font-medium">No chats yet</p>
            <p className="text-gray-400 text-xs mt-2">Find someone nearby to start chatting!</p>
          </div>
        ) : (
          conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelectChat(conv.id)}
              className="w-full flex items-center gap-4 p-4 hover:bg-mc-light-green border-b border-gray-50 transition-all last:border-none group active:scale-[0.98]"
            >
              <div className="relative shrink-0">
                <img 
                  src={conv.otherUser?.photoURL || `https://ui-avatars.com/api/?name=${conv.otherUser?.displayName}`}
                  className="w-12 h-12 rounded-full object-cover shadow-sm"
                  alt=""
                />
                {conv.otherUser?.isActive && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-mc-green border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="font-semibold text-mc-text group-hover:text-mc-green transition-colors truncate">
                    {conv.otherUser?.displayName || 'Unknown'}
                  </h3>
                  {conv.updatedAt && (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {conv.updatedAt.toDate ? formatDistanceToNow(conv.updatedAt.toDate(), { addSuffix: false }).replace('about ', '') : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-mc-text-secondary truncate pr-2">
                    {conv.lastMessage?.senderId === auth.currentUser?.uid ? 'You: ' : ''}
                    {conv.lastMessage?.text || 'Start a conversation'}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
