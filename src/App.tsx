/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  limit, 
  getDocs,
  addDoc 
} from 'firebase/firestore';
import { 
  MessageCircle, 
  MapPin, 
  LayoutGrid, 
  User as UserIcon,
  LogIn,
  LogOut,
  Megaphone,
  X,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Nearby from './components/Nearby';
import ChatList from './components/ChatList';
import ChatRoom from './components/ChatRoom';
import Moments from './components/Moments';
import Profile from './components/Profile';
import UserProfileView from './components/UserProfileView';
import CallManager from './components/CallManager';
import { UserProfile, Announcement } from './types';
import { notificationManager } from './lib/notifications';
import { handleFirestoreError, OperationType } from './lib/firestore-errors';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'nearby' | 'moments' | 'profile' | 'admin'>('chats');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email === "kedaikita1101@gmail.com";

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let annUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        notificationManager.requestPermission();

        const userRef = doc(db, 'users', u.uid);
        profileUnsubscribe = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            const accId = Math.random().toString(36).substring(2, 8).toUpperCase();
            setDoc(userRef, {
              uid: u.uid,
              accountId: accId,
              displayName: u.displayName || 'Anonymous',
              photoURL: u.photoURL || '',
              lastSeen: new Date().toISOString(),
              isActive: true,
              gender: 'other',
              bio: 'Hi, I am using MiLove!'
            }).catch(err => {
              handleFirestoreError(err, OperationType.CREATE, `users/${u.uid}`);
            });
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        });

        const annQuery = query(collection(db, 'announcements'), where('active', '==', true), limit(1));
        annUnsubscribe = onSnapshot(annQuery, (snap) => {
          if (!snap.empty) {
            setAnnouncement({ id: snap.docs[0].id, ...snap.docs[0].data() } as Announcement);
          } else {
            setAnnouncement(null);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'announcements');
        });
      } else {
        setProfile(null);
        setAnnouncement(null);
        if (profileUnsubscribe) profileUnsubscribe();
        if (annUnsubscribe) annUnsubscribe();
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
      if (annUnsubscribe) annUnsubscribe();
    };
  }, []);

  const handleStartChat = async (otherUid: string) => {
    if (!user) return;
    
    try {
      // Check if conversation exists
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid)
      );
      const snap = await getDocs(q);
      
      let existingConvId = null;
      snap.forEach(d => {
        const data = d.data();
        if (data.participants.includes(otherUid)) {
          existingConvId = d.id;
        }
      });

      if (existingConvId) {
        setSelectedChatId(existingConvId);
      } else {
        // Create new one
        const newConv = await addDoc(collection(db, 'conversations'), {
          participants: [user.uid, otherUid],
          updatedAt: serverTimestamp(),
          lastMessage: {
            text: 'Started a new conversation',
            senderId: 'system',
            createdAt: serverTimestamp()
          }
        });
        setSelectedChatId(newConv.id);
      }
      setActiveTab('chats');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'conversations');
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/unauthorized-domain') {
        alert("Domain authentication error. Please add this domain to authorized domains in Firebase Console.");
      } else if (e.code === 'auth/popup-blocked') {
        alert("Popup blocked by browser. Please allow popups for this site.");
      } else {
        alert("Login failed: " + (e.message || "Unknown error"));
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setSelectedChatId(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mc-green"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="w-20 h-20 bg-mc-green rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-green-100">
          <MessageCircle className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">MiLove</h1>
        <p className="text-gray-500 mb-10 max-w-xs text-sm">Connect with people nearby and chat in real-time.</p>
        <button onClick={handleLogin} className="w-full max-w-xs flex items-center justify-center gap-3 bg-gray-900 text-white rounded-2xl py-4 font-bold hover:bg-gray-800 transition-all shadow-lg">
          <LogIn className="w-5 h-5" /> Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-mc-bg overflow-hidden font-sans">
      <AnimatePresence>
        {announcement && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-mc-green text-white px-4 py-3 flex items-center justify-between text-xs font-bold shrink-0 z-50 overflow-hidden shadow-md">
            <div className="flex items-center gap-3">
              <Megaphone className="w-4 h-4" />
              <span>{announcement.text}</span>
            </div>
            <button onClick={() => setAnnouncement(null)} className="hover:opacity-50 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col p-0 md:p-6 overflow-hidden">
        <div className="app-container w-full h-full bg-white md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-w-7xl mx-auto border border-mc-border">
          <nav className="h-20 bg-gray-900 flex items-center px-4 md:px-10 shrink-0 z-30 justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-mc-green rounded-xl flex items-center justify-center shadow-lg">
                <MessageCircle className="text-white w-6 h-6" />
              </div>
              <h1 className="text-white font-black text-xl hidden sm:block tracking-tighter italic">MILOVE</h1>
            </div>

            <div className="flex items-center bg-gray-800/80 rounded-2xl p-1 gap-1">
              {[
                { id: 'chats', icon: MessageCircle, label: 'Chats' },
                { id: 'nearby', icon: MapPin, label: 'Nearby' },
                { id: 'moments', icon: LayoutGrid, label: 'Moments' },
                { id: 'profile', icon: UserIcon, label: 'Profile' },
                ...(isAdmin ? [{ id: 'admin', icon: Settings, label: 'Admin' }] : [])
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => { setActiveTab(id as any); setSelectedChatId(null); }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all ${activeTab === id && !selectedChatId ? 'bg-mc-green text-white shadow-xl scale-105' : 'text-gray-500 hover:text-white'}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end mr-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <span className="text-white text-[10px] font-bold truncate max-w-[120px]">{profile?.displayName}</span>
                <span className="text-mc-green text-[9px] font-black leading-none mt-0.5 tracking-tighter">ID: {profile?.accountId}</span>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 p-2.5 transition-colors border border-gray-800 rounded-xl">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </nav>

          <div className="flex flex-1 overflow-hidden">
            <div className={`middle-pane border-r border-mc-border flex flex-col bg-white shrink-0 ${selectedChatId ? 'hidden lg:flex w-96' : 'w-full md:w-96'}`}>
              <header className="px-8 py-6 border-b border-mc-border flex items-center justify-between bg-white sticky top-0 z-20">
                <h2 className="text-2xl font-black text-mc-text tracking-tight uppercase">
                  {activeTab === 'chats' && 'Messages'}
                  {activeTab === 'nearby' && 'Discovery'}
                  {activeTab === 'moments' && 'Explore'}
                  {activeTab === 'profile' && 'Me'}
                  {activeTab === 'admin' && 'Admin'}
                </h2>
                {activeTab === 'nearby' && <span className="bg-rose-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse">LIVE</span>}
              </header>

              <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="h-full">
                    {activeTab === 'chats' && <ChatList onSelectChat={setSelectedChatId} profile={profile} />}
                    {activeTab === 'nearby' && <Nearby onStartChat={handleStartChat} profile={profile} onViewProfile={setViewingUserId} />}
                    {activeTab === 'moments' && <Moments onViewProfile={setViewingUserId} profile={profile} />}
                    {activeTab === 'profile' && <Profile profile={profile} onLogout={handleLogout} onStartChat={handleStartChat} />}
                    {activeTab === 'admin' && (
                      <div className="p-8 space-y-8">
                        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                          <h3 className="font-black text-mc-text mb-6 flex items-center gap-2 tracking-tight"><Settings className="w-5 h-5" /> SITE GLOBAL BANNER</h3>
                          <div className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-1">Message Content</label>
                              <textarea 
                                className="w-full bg-white rounded-2xl p-5 text-sm border-2 border-gray-100 focus:border-mc-green transition-all outline-none shadow-sm" 
                                defaultValue={announcement?.text || ''} 
                                placeholder="Broadcast message to all users..." 
                                onBlur={async (e) => { 
                                  if (e.target.value) { 
                                    try {
                                      await setDoc(doc(db, 'announcements', 'global'), { 
                                        text: e.target.value, 
                                        active: true, 
                                        createdAt: serverTimestamp() 
                                      }); 
                                    } catch (err) {
                                      handleFirestoreError(err, OperationType.WRITE, 'announcements/global');
                                    }
                                  } 
                                }} 
                              />
                            </div>
                            <button 
                              onClick={async () => { 
                                try {
                                  await setDoc(doc(db, 'announcements', 'global'), { active: false }, { merge: true }); 
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.WRITE, 'announcements/global');
                                }
                              }} 
                              className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-colors shadow-sm"
                            >
                              Deactivate Site Banner
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className={`chat-pane flex-1 flex flex-col bg-[#FAFAFA] ${!selectedChatId ? 'hidden md:flex items-center justify-center p-12 text-center' : 'w-full'}`}>
              {selectedChatId ? (
                <ChatRoom conversationId={selectedChatId} onBack={() => setSelectedChatId(null)} />
              ) : (
                <div className="max-w-xs space-y-8">
                  <div className="w-24 h-24 bg-mc-light-green rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner shadow-mc-green/10">
                    <MessageCircle className="text-mc-green w-12 h-12" />
                  </div>
                  <div>
                    <h3 className="text-mc-text font-black text-2xl mb-3 tracking-tight">MiLove Messenger</h3>
                    <p className="text-mc-text-secondary text-sm leading-relaxed px-4">Start connecting with people nearby or browse your moments feed.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {viewingUserId && (
          <UserProfileView 
            userId={viewingUserId} 
            onClose={() => setViewingUserId(null)} 
            onStartChat={(uid) => {
              setViewingUserId(null);
              handleStartChat(uid);
            }} 
            currentUserProfile={profile}
          />
        )}
      </AnimatePresence>
      <CallManager currentUser={profile} />
    </div>
  );
}
