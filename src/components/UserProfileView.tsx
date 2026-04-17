import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, limit, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { UserProfile, Moment } from '../types';
import { X, MessageSquare, Heart, MapPin, Sparkles, ChevronLeft, Maximize2, Ban, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface UserProfileViewProps {
  userId: string;
  onClose: () => void;
  onStartChat: (uid: string) => void;
  currentUserProfile: UserProfile | null;
}

export default function UserProfileView({ userId, onClose, onStartChat, currentUserProfile }: UserProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    const q = query(
      collection(db, 'moments'),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs: Moment[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() } as Moment));
      setMoments(docs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'moments');
    });

    return () => unsubscribe();
  }, [userId]);

  const handleLike = async () => {
    if (!profile || !auth.currentUser || !currentUserProfile) return;

    try {
      const myUid = auth.currentUser.uid;
      const targetUid = profile.uid;
      
      const myRef = doc(db, 'users', myUid);
      const targetRef = doc(db, 'users', targetUid);

      const isAlreadyLiked = currentUserProfile.likes?.includes(targetUid);

      if (isAlreadyLiked) {
         // Unlike logic (optional, but keep it consistent with button state)
         await updateDoc(myRef, { likes: arrayRemove(targetUid) });
         await updateDoc(targetRef, { likedBy: arrayRemove(myUid) });
      } else {
         await updateDoc(myRef, { likes: arrayUnion(targetUid) });
         await updateDoc(targetRef, { likedBy: arrayUnion(myUid) });
         
         // Check for mutual match
         if (profile.likes?.includes(myUid)) {
            await updateDoc(myRef, { matches: arrayUnion(targetUid) });
            await updateDoc(targetRef, { matches: arrayUnion(myUid) });
         }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const isLiked = currentUserProfile?.likes?.includes(userId);
  const isMatch = currentUserProfile?.matches?.includes(userId);

  const calculateAge = (bday?: string) => {
    if (!bday) return null;
    const today = new Date();
    const birth = new Date(bday);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[60] bg-white flex items-center justify-center">
         <div className="w-12 h-12 border-4 border-mc-green border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[60] bg-white overflow-y-auto"
    >
      {/* Header / Hero */}
      <div className="relative h-[45vh] bg-mc-green overflow-hidden">
        <img 
          src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}&size=512`} 
          className="w-full h-full object-cover"
          alt={profile.displayName}
          onClick={() => setFullscreenImage(profile.photoURL || null)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        
        <button 
          onClick={onClose}
          className="absolute top-6 left-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="absolute bottom-8 left-8 right-8 text-white">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-black tracking-tight">
              {profile.displayName}
              {profile.birthDate && <span className="ml-2 opacity-80 font-bold">, {calculateAge(profile.birthDate)}</span>}
            </h1>
            {profile.isActive && <div className="w-3 h-3 bg-mc-green rounded-full border-2 border-white animate-pulse" />}
          </div>
          <div className="flex items-center gap-4 text-white/80 text-xs font-bold uppercase tracking-widest">
            <span className="bg-white/20 px-2 py-1 rounded-md">ID: {profile.accountId}</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Nearby</span>
          </div>
        </div>
      </div>

      {/* Stats & Actions */}
      <div className="px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-[2.5rem] p-6 shadow-xl shadow-gray-200/50 border border-gray-100 mb-8">
           <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleLike}
                className={`flex flex-col items-center justify-center gap-2 py-4 rounded-[1.5rem] transition-all active:scale-95 ${
                  isLiked ? 'bg-rose-50 text-rose-500' : 'bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-400'
                }`}
              >
                <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{isLiked ? (isMatch ? 'Matched' : 'Liked') : 'Like'}</span>
              </button>
              <button 
                onClick={() => onStartChat(profile.uid)}
                className="flex flex-col items-center justify-center gap-2 py-4 bg-mc-light-green/40 text-mc-green rounded-[1.5rem] transition-all hover:bg-mc-light-green/60 active:scale-95"
              >
                <MessageSquare className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest">Message</span>
              </button>
           </div>
        </div>

        {/* Info Section */}
        <div className="space-y-8 px-2 pb-24">
           <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                 <Sparkles className="w-3 h-3" /> About Me
              </h3>
              <p className="text-mc-text text-sm leading-relaxed font-medium bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                {profile.bio || "This user hasn't added a bio yet."}
              </p>
           </div>

           <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Moments</h3>
              {moments.length === 0 ? (
                <div className="py-12 text-center bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-100 flex flex-col items-center gap-3">
                   <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <ImageIcon className="text-gray-300 w-6 h-6" />
                   </div>
                   <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">No moments yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {moments.map(moment => (
                    moment.imageUrls.length > 0 && (
                      <div 
                        key={moment.id} 
                        className="relative aspect-square rounded-2xl overflow-hidden group cursor-pointer shadow-sm"
                        onClick={() => setFullscreenImage(moment.imageUrls[0])}
                      >
                         <img src={moment.imageUrls[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                         <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Maximize2 className="text-white w-6 h-6" />
                         </div>
                      </div>
                    )
                  ))}
                </div>
              )}
           </div>
        </div>
      </div>

      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setFullscreenImage(null)}
          >
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={fullscreenImage} 
              className="max-w-full max-h-full object-contain rounded-xl"
              alt="Fullscreen"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
