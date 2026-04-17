import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { Call, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Video, VideoOff, X, Maximize2 } from 'lucide-react';

export default function CallManager({ currentUser }: { currentUser: UserProfile | null }) {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [showJitsi, setShowJitsi] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen for incoming calls
    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', auth.currentUser.uid),
      where('status', '==', 'calling')
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const callData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Call;
        setIncomingCall(callData);
        
        // Auto-reject if more than 30 seconds
        const age = Date.now() - (callData.createdAt?.toDate?.()?.getTime() || Date.now());
        if (age > 30000) {
           handleReject(callData.id);
        }
      } else {
        setIncomingCall(null);
      }
    });

    // Listen for active call updates (if I started a call)
    // Actually, it's better to have one unified listener for calls involving me
    const q2 = query(
      collection(db, 'calls'),
      where('callerId', '==', auth.currentUser.uid)
    );
    const unsub2 = onSnapshot(q2, (snap) => {
      snap.docs.forEach(d => {
        const data = { id: d.id, ...d.data() } as Call;
        if (data.status === 'accepted') {
          setActiveCall(data);
          setShowJitsi(true);
        } else if (data.status === 'rejected' || data.status === 'ended') {
          setActiveCall(null);
          setShowJitsi(false);
          // Cleanup
          setTimeout(() => deleteDoc(doc(db, 'calls', d.id)), 2000);
        }
      });
    });

    return () => {
      unsub();
      unsub2();
    };
  }, [auth.currentUser]);

  const handleAccept = async (callId: string) => {
    try {
      await updateDoc(doc(db, 'calls', callId), {
        status: 'accepted'
      });
      const call = incomingCall || activeCall;
      if (call) {
        setActiveCall({ ...call, status: 'accepted' });
        setShowJitsi(true);
      }
      setIncomingCall(null);
    } catch (err) {
      console.error("Accept call error:", err);
    }
  };

  const handleReject = async (callId: string) => {
    try {
      await updateDoc(doc(db, 'calls', callId), {
        status: 'rejected'
      });
      setIncomingCall(null);
      setActiveCall(null);
      setShowJitsi(false);
    } catch (err) {
      console.error("Reject call error:", err);
    }
  };

  const handleEnd = async () => {
    const callId = activeCall?.id || incomingCall?.id;
    if (!callId) {
      setShowJitsi(false);
      setActiveCall(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'calls', callId), {
        status: 'ended'
      });
      setActiveCall(null);
      setShowJitsi(false);
    } catch (err) {
      console.error("End call error:", err);
    }
  };

  return (
    <>
      {/* Incoming Call Overlay */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[200] flex justify-center px-4"
          >
            <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-4 w-full max-w-sm flex items-center gap-4">
              <img 
                src={incomingCall.callerPhoto || `https://ui-avatars.com/api/?name=${incomingCall.callerName}`} 
                className="w-14 h-14 rounded-full object-cover border-2 border-mc-green shadow-sm"
                alt=""
              />
              <div className="flex-1">
                <h3 className="font-black text-mc-text uppercase text-xs tracking-tight">Panggilan Masuk</h3>
                <p className="text-gray-500 font-bold truncate">{incomingCall.callerName}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleReject(incomingCall.id)}
                  className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center hover:bg-red-100 transition-all active:scale-90"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleAccept(incomingCall.id)}
                  className="w-12 h-12 bg-mc-green text-white rounded-full flex items-center justify-center shadow-lg shadow-mc-green/20 hover:bg-mc-green/90 transition-all animate-bounce active:scale-90"
                >
                  <Phone className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outgoing Call / Active Session */}
      <AnimatePresence>
        {showJitsi && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] bg-black flex flex-col"
          >
            <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
               <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                 <span className="text-white text-xs font-black uppercase tracking-widest">Live Call</span>
               </div>
            </div>

            <button 
              onClick={handleEnd}
              className="absolute top-6 right-6 z-10 w-12 h-12 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all"
            >
              <X className="w-6 h-6" />
            </button>

            <iframe 
              src={`https://meet.jit.si/${activeCall?.roomId || incomingCall?.roomId}#config.startWithVideoMuted=false&config.prejoinPageEnabled=false&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","closedcaptions","desktop","fullscreen","fodeviceselection","hangup","profile","chat","recording","livestreaming","etherpad","sharedvideo","settings","raisehand","videoquality","filmstrip","invite","feedback","stats","shortcuts","tileview","videobackgroundblur","download","help","mute-everyone","security"]`}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="flex-1 w-full border-none"
              title="Video Call"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
