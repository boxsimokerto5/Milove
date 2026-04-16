import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, increment, getDocs, limit } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { fileToBase64 } from '../lib/file-utils';
import { Moment, Comment } from '../types';
import { Heart, MessageSquare, Send, Camera, MoreHorizontal, X, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function Moments() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'moments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs: Moment[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() } as Moment));
      setMoments(docs);
    });
    return () => unsubscribe();
  }, []);

  const handlePost = async () => {
    if ((!newPost.trim() && !pendingImage) || !auth.currentUser) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, 'moments'), {
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        authorPhoto: auth.currentUser.photoURL || '',
        text: newPost,
        imageUrls: pendingImage ? [pendingImage] : [],
        likes: [],
        createdAt: serverTimestamp()
      });
      setNewPost('');
      setPendingImage(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'moments');
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (moment: Moment) => {
    if (!auth.currentUser) return;
    const isLiked = moment.likes.includes(auth.currentUser.uid);
    const ref = doc(db, 'moments', moment.id);
    try {
      await updateDoc(ref, {
        likes: isLiked ? arrayRemove(auth.currentUser.uid) : arrayUnion(auth.currentUser.uid)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `moments/${moment.id}`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setPendingImage(base64);
      } catch (err) {
        console.error("Failed to convert file:", err);
      }
    }
  };

  return (
    <div className="bg-gray-50 flex flex-col h-full overflow-y-auto pb-20 scroll-smooth">
      {/* Post Creator */}
      <div className="bg-white p-6 shadow-sm mb-4">
        <div className="flex gap-4">
          <img 
            src={auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${auth.currentUser?.displayName}`} 
            className="w-12 h-12 rounded-2xl object-cover"
            alt=""
          />
          <div className="flex-1">
            <textarea 
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Tell your friends what's new..."
              className="w-full border-none focus:ring-0 text-sm resize-none min-h-[80px] p-0"
            />
            
            {pendingImage && (
              <div className="mt-2 relative inline-block group">
                <img 
                  src={pendingImage} 
                  className="w-32 h-32 rounded-2xl object-cover border border-gray-100 cursor-pointer" 
                  onClick={() => setFullscreenImage(pendingImage)}
                />
                <button 
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-2 -right-2 bg-white text-gray-500 p-1 rounded-full shadow-md hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                  <Maximize2 className="text-white w-5 h-5" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-2">
              <div className="flex gap-4">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileSelect} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-gray-400 hover:text-green-500 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <button 
                onClick={handlePost}
                disabled={(!newPost.trim() && !pendingImage) || isPosting}
                className="bg-mc-green text-white px-6 py-2 rounded-xl text-xs font-bold disabled:opacity-50 shadow-lg shadow-green-100"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-3 px-3">
        {moments.map(moment => (
          <MomentItem 
            key={moment.id} 
            moment={moment} 
            onLike={() => handleLike(moment)} 
            onViewImage={setFullscreenImage}
          />
        ))}
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
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              alt="Fullscreen view"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MomentItem({ moment, onLike, onViewImage }: { key?: string, moment: Moment, onLike: () => void | Promise<void>, onViewImage: (url: string) => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!showComments) return;
    const q = query(collection(db, 'moments', moment.id, 'comments'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const docs: Comment[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() } as Comment));
      setComments(docs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `moments/${moment.id}/comments`);
    });
    return () => unsubscribe();
  }, [showComments, moment.id]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !auth.currentUser) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'moments', moment.id, 'comments'), {
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Anonymous',
        authorPhoto: auth.currentUser.photoURL || '',
        text: newComment,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'moments', moment.id), {
        commentCount: increment(1)
      });
      setNewComment('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `moments/${moment.id}/comments`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-mc-border overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <img 
            src={moment.authorPhoto || `https://ui-avatars.com/api/?name=${moment.authorName}`} 
            className="w-12 h-12 rounded-[1.25rem] object-cover"
            alt=""
          />
          <div>
            <h3 className="font-bold text-sm text-mc-text tracking-tight">{moment.authorName}</h3>
            <p className="text-[10px] text-mc-text-secondary uppercase tracking-widest font-black">
              {moment.createdAt?.toDate ? formatDistanceToNow(moment.createdAt.toDate(), { addSuffix: true }) : 'just now'}
            </p>
          </div>
        </div>
        <button className="text-gray-300">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
      
      <p className="text-mc-text text-sm leading-relaxed mb-6 whitespace-pre-wrap px-1">
        {moment.text}
      </p>

      {moment.imageUrls.length > 0 && (
        <div className="grid grid-cols-1 gap-3 mb-6">
          {moment.imageUrls.map((url, i) => (
            <div key={i} className="relative group cursor-pointer overflow-hidden rounded-[2rem] border border-mc-border shadow-sm" onClick={() => onViewImage(url)}>
              <img src={url} className="w-full h-auto object-cover max-h-[600px] transition-transform duration-700 group-hover:scale-105" alt="" />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 className="text-white w-10 h-10" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-6 pt-5 border-t border-mc-border">
        <button 
          onClick={onLike}
          className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
            moment.likes.includes(auth.currentUser?.uid || '') ? 'text-rose-500 scale-105' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Heart className={`w-5 h-5 ${moment.likes.includes(auth.currentUser?.uid || '') ? 'fill-current' : ''}`} />
          <span>{moment.likes.length || 0}</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
            showComments ? 'text-mc-green scale-105' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <MessageSquare className={`w-5 h-5 ${showComments ? 'fill-mc-green/10' : ''}`} />
          <span>{moment.commentCount || 0}</span>
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-6 space-y-4 pt-6 border-t border-mc-bg"
          >
            <div className="flex gap-3 mb-4">
               <img 
                 src={auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${auth.currentUser?.displayName}`} 
                 className="w-8 h-8 rounded-xl object-cover"
                 alt=""
               />
               <div className="flex-1 flex gap-2">
                 <input 
                   type="text"
                   value={newComment}
                   onChange={(e) => setNewComment(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                   placeholder="Add a comment..."
                   className="flex-1 bg-mc-bg rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-mc-green border-none shadow-inner"
                 />
                 <button 
                   onClick={handlePostComment}
                   disabled={!newComment.trim() || isSubmitting}
                   className="bg-mc-green text-white p-2.5 rounded-xl transition-all disabled:opacity-50 active:scale-90"
                 >
                   <Send className="w-4 h-4" />
                 </button>
               </div>
            </div>

            <div className="space-y-4 px-1 max-h-60 overflow-y-auto custom-scrollbar">
               {comments.map(comment => (
                 <div key={comment.id} className="flex gap-3 group">
                    <img 
                       src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${comment.authorName}`} 
                       className="w-7 h-7 rounded-lg object-cover"
                       alt=""
                    />
                    <div className="flex-1">
                       <div className="bg-mc-bg rounded-2xl rounded-tl-none px-4 py-3 border border-mc-border/50">
                          <p className="text-[10px] font-black text-mc-text mb-0.5 tracking-tight uppercase">{comment.authorName}</p>
                          <p className="text-xs text-mc-text-secondary leading-relaxed font-medium">{comment.text}</p>
                       </div>
                       <p className="text-[9px] text-gray-400 font-bold mt-1 ml-1">
                          {comment.createdAt?.toDate ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                       </p>
                    </div>
                 </div>
               ))}
               {comments.length === 0 && (
                 <p className="text-[10px] text-center text-gray-400 font-bold py-2 uppercase tracking-widest italic">No comments yet. Be the first to share the love!</p>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
