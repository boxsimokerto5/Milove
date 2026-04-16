import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { updateDoc, doc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { fileToBase64 } from '../lib/file-utils';
import { UserProfile, Moment } from '../types';
import { User, AlignLeft, Info, ChevronRight, Shield, Heart, Image, Star, Lock, X, Maximize2, ArrowLeft, Settings, LifeBuoy, MessageSquare, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileProps {
  profile: UserProfile | null;
  onLogout?: () => void;
}

export default function Profile({ profile, onLogout }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [gender, setGender] = useState(profile?.gender || 'other');
  const [fullscreenProfileImage, setFullscreenProfileImage] = useState<string | null>(null);
  const [activeSubView, setActiveSubView] = useState<'main' | 'photos' | 'likes' | 'privacy' | 'security' | 'help'>('main');
  const [userMoments, setUserMoments] = useState<Moment[]>([]);
  const [likedMoments, setLikedMoments] = useState<Moment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile || activeSubView === 'main') return;

    if (activeSubView === 'photos') {
      const q = query(collection(db, 'moments'), where('authorId', '==', profile.uid), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snap) => {
        const docs: Moment[] = [];
        snap.forEach(d => docs.push({ id: d.id, ...d.data() } as Moment));
        setUserMoments(docs);
      });
    }

    if (activeSubView === 'likes') {
       const q = query(collection(db, 'moments'), where('likes', 'array-contains', profile.uid));
       return onSnapshot(q, (snap) => {
         const docs: Moment[] = [];
         snap.forEach(d => docs.push({ id: d.id, ...d.data() } as Moment));
         setLikedMoments(docs);
       });
    }
  }, [activeSubView, profile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setPhotoURL(base64);
      } catch (err) {
        console.error("Failed to convert file:", err);
      }
    }
  };

  const handleUpdate = async () => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName,
        photoURL,
        bio,
        gender
      });
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  if (!profile) return null;

  const renderSubView = () => {
    switch (activeSubView) {
      case 'photos':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-1">
              {userMoments.length > 0 ? userMoments.flatMap(m => m.imageUrls).map((url, i) => (
                <img 
                  key={i} 
                  src={url} 
                  className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                  onClick={() => setFullscreenProfileImage(url)} 
                />
              )) : (
                <div className="col-span-3 py-20 text-center text-gray-400">
                  <Image className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No photos yet</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'likes':
        return (
          <div className="space-y-4">
             {likedMoments.length > 0 ? (
               <div className="grid grid-cols-2 gap-2">
                 {likedMoments.map(moment => (
                   <div key={moment.id} className="relative group cursor-pointer" onClick={() => setFullscreenProfileImage(moment.imageUrls[0] || '')}>
                     <img src={moment.imageUrls[0] || 'https://picsum.photos/seed/moment/400/400'} className="w-full aspect-square object-cover rounded-xl" alt="" />
                     <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent rounded-b-xl">
                        <p className="text-[10px] text-white truncate font-medium">{moment.text}</p>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="py-20 text-center text-gray-400">
                  <Heart className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No liked posts yet</p>
               </div>
             )}
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-4">
             <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 flex items-center gap-4 mb-2">
                <Lock className="w-8 h-8 text-rose-500" />
                <div>
                   <h4 className="font-bold text-gray-900">Privacy Control</h4>
                   <p className="text-xs text-gray-500 leading-none mt-1 uppercase tracking-widest font-black">Profile Visibility</p>
                </div>
             </div>
             {[
               { title: 'Public Profile', desc: 'Allow others in Discovery to see your bio and photos', default: true },
               { title: 'Last Seen Status', desc: 'Show when you were last active', default: true },
               { title: 'Precise Location', desc: 'Show exact distance in kilometers', default: true },
               { title: 'Message Requests', desc: 'Accept messages from strangers nearby', default: true }
             ].map((opt, i) => (
               <div key={i} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-100 shadow-sm hover:border-mc-green transition-all">
                 <div className="max-w-[70%]">
                   <h4 className="text-sm font-bold text-gray-900">{opt.title}</h4>
                   <p className="text-[11px] text-gray-400 font-medium leading-relaxed">{opt.desc}</p>
                 </div>
                 <div className="w-12 h-6 bg-mc-green rounded-full relative cursor-pointer shadow-inner">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-md"></div>
                 </div>
               </div>
             ))}
             <p className="text-[10px] text-center text-gray-400 font-medium px-8 mt-4 leading-relaxed">Changes to privacy settings are applied instantly to your local profile. Some changes may take up to 24 hours to sync with global discovery.</p>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-4">
             <div className="bg-blue-50 p-4 rounded-2xl flex items-start gap-4">
                <Shield className="w-6 h-6 text-blue-500 shrink-0" />
                <div>
                   <h4 className="text-sm font-bold text-gray-900">Account Safety</h4>
                   <p className="text-xs text-gray-600 mt-1">Your account is currently protected by Google Authentication. No password is required.</p>
                </div>
             </div>
             <button className="w-full p-4 bg-white border border-gray-50 rounded-2xl shadow-sm text-left flex items-center justify-between group active:scale-95 transition-all">
                <div>
                   <h4 className="text-sm font-bold text-gray-900">Manage Sessions</h4>
                   <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">1 Active Device</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-mc-green transition-colors" />
             </button>
             <button className="w-full p-4 bg-red-50/50 border border-red-50 rounded-2xl text-left active:scale-95 transition-all">
                <h4 className="text-sm font-bold text-red-500">Delete Account</h4>
                <p className="text-[10px] text-red-300 uppercase font-black tracking-widest mt-0.5">Irreversible action</p>
             </button>
          </div>
        );
      case 'help':
        return (
          <div className="space-y-6">
             <div className="p-5 bg-mc-light-green/30 rounded-3xl border border-mc-green/10">
                <LifeBuoy className="w-10 h-10 text-mc-green mb-3" />
                <h4 className="font-bold text-gray-900 text-lg">MiLove Support</h4>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">Everything you need to know about using MiLove. Need more help? Our team is active 24/7.</p>
             </div>
             
             <div className="space-y-3">
                <h5 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-2">Top Questions</h5>
                {[
                  { q: 'How do I find people nearby?', a: 'Just head to the "Nearby" tab! Make sure you\'ve granted location permissions to see people around you.' },
                  { q: 'Is my data secure?', a: 'Yes! We use secure Google Authentication and private encryption for all your conversations.' },
                  { q: 'How to change my Unique ID?', a: 'Your ID is unique and permanent to ensure security and prevent impersonation.' },
                  { q: 'What are Moments?', a: 'Moments are like stories. You can share photos and thoughts with everyone in your area!' }
                ].map((faq, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <h6 className="font-bold text-gray-900 text-sm mb-1">{faq.q}</h6>
                    <p className="text-xs text-gray-500 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
             </div>

             <div className="space-y-3 pt-4">
                <h5 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-2">Support Channels</h5>
                <button className="w-full flex items-center justify-between p-5 bg-gray-900 text-white rounded-3xl shadow-xl shadow-gray-200 active:scale-95 transition-all">
                   <div className="flex items-center gap-4">
                      <div className="bg-white/10 p-2 rounded-xl">
                         <MessageSquare className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-bold">Live Chat Support</span>
                   </div>
                   <ChevronRight className="w-4 h-4 text-white/50" />
                </button>
             </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white min-h-full pb-24 overflow-y-auto custom-scrollbar relative">
      <AnimatePresence mode="wait">
        {activeSubView === 'main' ? (
          <motion.div 
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Header Profile */}
            <div className="bg-mc-green pt-16 pb-24 px-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full blur-2xl -ml-24 -mb-24"></div>
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div 
                  className="relative mb-4 group cursor-pointer" 
                  onClick={() => isEditing ? fileInputRef.current?.click() : setFullscreenProfileImage(photoURL || profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`)}
                >
                   <img 
                     src={isEditing ? photoURL : (profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`)} 
                     className="w-28 h-28 rounded-[2.5rem] border-4 border-white object-cover shadow-2xl transition-transform group-hover:scale-105"
                     alt=""
                   />
                   <div className="absolute inset-0 bg-black/20 rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <Maximize2 className="text-white w-6 h-6" />
                   </div>
                   <input 
                     type="file" 
                     ref={fileInputRef} 
                     className="hidden" 
                     accept="image/*" 
                     onChange={handleFileChange} 
                   />
                   {isEditing && (
                     <div className="absolute inset-0 bg-black/40 rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <Image className="text-white w-8 h-8" />
                     </div>
                   )}
                   <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                      <div className="w-5 h-5 bg-mc-green rounded-xl"></div>
                   </div>
                </div>
                
                <div className="text-white">
                  <h2 className="text-2xl font-bold mb-1 tracking-tight">{profile.displayName}</h2>
                  <div className="flex items-center gap-2 bg-black/10 px-3 py-1 rounded-full backdrop-blur-sm self-center">
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/90">ID: {profile.accountId}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 -mt-12 relative z-10 space-y-6">
              
              {/* Horizontal Menu Grid */}
              <div className="grid grid-cols-4 gap-3">
                 {[
                   { icon: Image, label: 'Photos', color: 'bg-orange-50 text-orange-500', action: () => setActiveSubView('photos') },
                   { icon: Star, label: 'Favorites', color: 'bg-yellow-50 text-yellow-500', action: () => setActiveSubView('likes') },
                   { icon: Heart, label: 'Likes', color: 'bg-rose-50 text-rose-500', action: () => setActiveSubView('likes') },
                   { icon: Lock, label: 'Privacy', color: 'bg-emerald-50 text-emerald-500', action: () => setActiveSubView('privacy') }
                 ].map((item, i) => (
                   <button key={i} onClick={item.action} className="flex flex-col items-center gap-2 bg-white p-3 rounded-2xl shadow-sm border border-gray-50 active:scale-90 transition-transform">
                      <div className={`p-2 rounded-xl ${item.color}`}>
                         <item.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 capitalize">{item.label}</span>
                   </button>
                 ))}
              </div>

              {/* Profile Card */}
              <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-mc-green" />
                    Profile Details
                  </h3>
                  {!isEditing ? (
                    <button 
                      onClick={() => {
                        setDisplayName(profile.displayName);
                        setPhotoURL(profile.photoURL);
                        setBio(profile.bio);
                        setGender(profile.gender || 'other');
                        setIsEditing(true);
                      }}
                      className="text-xs font-bold text-green-600 px-3 py-1 bg-green-50 rounded-full"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="text-xs font-bold text-gray-400 px-3 py-1 bg-gray-100 rounded-full"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleUpdate}
                        className="text-xs font-bold text-white px-3 py-1 bg-mc-green rounded-full shadow-lg shadow-green-100"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Account ID</label>
                      <input 
                        type="text"
                        value={profile.accountId}
                        disabled
                        className="w-full bg-gray-100 rounded-xl px-4 py-2.5 text-sm font-mono text-gray-500 cursor-not-allowed border-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Display Name</label>
                      <input 
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-mc-green border-none"
                        placeholder="Enter display name"
                      />
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Photo URL</label>
                      <input 
                        type="text"
                        value={photoURL}
                        onChange={(e) => setPhotoURL(e.target.value)}
                        className="w-full bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-mc-green border-none"
                        placeholder="Paste image URL"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Bio</label>
                      <textarea 
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full bg-gray-50 rounded-2xl p-4 text-sm focus:ring-1 focus:ring-mc-green border-none min-h-[80px] resize-none"
                        placeholder="Write something interesting..."
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Gender</label>
                      <div className="flex gap-2">
                        {['male', 'female', 'other'].map(g => (
                          <button
                            key={g}
                            onClick={() => setGender(g as any)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize tracking-wider transition-all ${
                              gender === g ? 'bg-mc-green text-white shadow-lg shadow-green-100' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Name:</span>
                        <span className="text-sm font-medium text-gray-700">{profile.displayName}</span>
                      </div>
                      <div className="bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block leading-none mb-1">Account ID</span>
                        <span className="text-xs font-mono font-bold text-mc-green">{profile.accountId}</span>
                      </div>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed italic">
                      {profile.bio || "No bio yet. Tell people about yourself!"}
                    </p>
                  </div>
                )}
              </div>

              {/* Stats & Tools */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveSubView('security')}
                  className="bg-blue-50/50 p-6 rounded-3xl border border-blue-50 text-center group active:scale-95 transition-all"
                >
                  <Shield className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <h4 className="font-bold text-gray-900 text-sm">Security</h4>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">Verified</p>
                </button>
                <button 
                  onClick={() => setActiveSubView('likes')}
                  className="bg-rose-50/50 p-6 rounded-3xl border border-rose-50 text-center group active:scale-95 transition-all"
                >
                  <Heart className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                  <h4 className="font-bold text-gray-900 text-sm">Favorite</h4>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mt-1">{likedMoments.length} Items</p>
                </button>
              </div>

              {/* Settings Links */}
              <div className="bg-white rounded-3xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {[
                  { label: 'Privacy Settings', icon: Lock, action: () => setActiveSubView('privacy') },
                  { label: 'Help & Support', icon: LifeBuoy, action: () => setActiveSubView('help') },
                  { label: 'Community Guidelines', icon: AlignLeft, action: () => setActiveSubView('help') }
                ].map((item, i) => (
                  <button key={i} onClick={item.action} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-50 rounded-xl">
                        <item.icon className="w-5 h-5 text-gray-400" />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>

              {/* Logout Button */}
              <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-3 p-5 bg-rose-50 text-rose-600 rounded-3xl border border-rose-100 font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-sm"
              >
                <LogOut className="w-5 h-5" />
                Sign Out from MiLove
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="subview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full bg-white"
          >
            {/* SubView Header */}
            <div className="flex items-center gap-4 p-6 border-b border-gray-50 bg-white sticky top-0 z-20">
               <button onClick={() => setActiveSubView('main')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ArrowLeft className="w-6 h-6 text-gray-900" />
               </button>
               <h2 className="text-xl font-bold text-gray-900 capitalize">{activeSubView}</h2>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto">
               {renderSubView()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Viewer */}
      <AnimatePresence>
        {fullscreenProfileImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 md:p-12"
            onClick={() => setFullscreenProfileImage(null)}
          >
            <motion.button 
              className="absolute top-6 right-6 text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all"
              onClick={(e) => { e.stopPropagation(); setFullscreenProfileImage(null); }}
            >
              <X className="w-8 h-8" />
            </motion.button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={fullscreenProfileImage} 
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
