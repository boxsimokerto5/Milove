import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, limit, getDocs, updateDoc, doc, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { getCurrentLocation, getGeohash, calculateDistance } from '../lib/location';
import { UserProfile } from '../types';
import { MapPin, Search, MessageSquare, UserPlus, X, Maximize2, Filter, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NearbyProps {
  onStartChat: (uid: string) => void;
}

export default function Nearby({ onStartChat }: NearbyProps) {
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [fullscreenImage, setFullscreenImage] = useState<string|null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const fetchNearby = async () => {
    try {
      setLoading(true);
      const loc = await getCurrentLocation();
      setMyLocation(loc);
      const hash = getGeohash(loc.lat, loc.lng);

      if (auth.currentUser) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            lat: loc.lat,
            lng: loc.lng,
            geohash: hash,
            lastSeen: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
        }
      }

      let q = query(collection(db, 'users'), limit(50));
      if (genderFilter !== 'all') {
        q = query(collection(db, 'users'), where('gender', '==', genderFilter), limit(50));
      }

      const snap = await getDocs(q);
      const results: UserProfile[] = [];
      snap.forEach(doc => {
        const data = doc.data() as UserProfile;
        if (data.uid !== auth.currentUser?.uid && data.lat && data.lng) {
          results.push(data);
        }
      });

      const sorted = results.sort((a, b) => {
        const distA = calculateDistance(loc.lat, loc.lng, a.lat!, a.lng!);
        const distB = calculateDistance(loc.lat, loc.lng, b.lat!, b.lng!);
        return distA - distB;
      });

      setPeople(sorted);
    } catch (err) {
      console.error(err);
      setError("Please enable location to find people nearby.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNearby();
  }, [genderFilter]);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const q = query(collection(db, 'users'), where('accountId', '==', val.toUpperCase()), limit(10));
      const snap = await getDocs(q);
      const results: UserProfile[] = [];
      snap.forEach(d => results.push(d.data() as UserProfile));
      setSearchResults(results.filter(u => u.uid !== auth.currentUser?.uid));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const displayPeople = searchQuery.length >= 3 ? searchResults : people;

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-48">
        <div className="animate-bounce mb-4">
          <MapPin className="text-mc-green w-8 h-8" />
        </div>
        <p className="text-gray-500 text-sm">Finding people nearby...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="bg-red-50 p-4 rounded-2xl mb-4 inline-block">
          <MapPin className="text-red-400 w-8 h-8" />
        </div>
        <p className="text-gray-600 font-medium mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-mc-green text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md shadow-green-100"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search Account ID (e.g. A1B2C3)" 
            className="w-full bg-mc-bg rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-mc-green transition-all border-none"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
               <div className="w-4 h-4 border-2 border-mc-green border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        <button 
          onClick={() => setIsFilterOpen(true)}
          className={`p-3 rounded-2xl transition-all shadow-sm ${genderFilter !== 'all' ? 'bg-mc-green text-white shadow-green-100' : 'bg-white text-gray-500 border border-gray-100'}`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-[2px]"
              onClick={() => setIsFilterOpen(false)}
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-[2.5rem] p-8 shadow-2xl border-t border-gray-50"
            >
               <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-mc-text uppercase tracking-tighter italic">FILTER PEOPLE</h3>
                  <button onClick={() => setIsFilterOpen(false)} className="p-2 bg-gray-50 rounded-full">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
               </div>

               <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block ml-2">Show Gender</label>
                    <div className="grid grid-cols-3 gap-3">
                       {(['all', 'male', 'female'] as const).map(g => (
                         <button
                           key={g}
                           onClick={() => setGenderFilter(g)}
                           className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-2 ${
                             genderFilter === g 
                               ? 'bg-mc-light-green/20 border-mc-green text-mc-green shadow-xl shadow-green-100/20' 
                               : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                           }`}
                         >
                           {genderFilter === g && <Check className="w-3 h-3" />}
                           {g}
                         </button>
                       ))}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setIsFilterOpen(false)}
                    className="w-full bg-mc-green text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-green-100 mt-4 active:scale-95 transition-all"
                  >
                    Apply Filters
                  </button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-2 px-2">
        <h2 className="font-bold text-gray-400 text-xs uppercase tracking-widest">
          {searchQuery.length >= 3 ? 'Search Results' : 'Nearby People'}
        </h2>
      </div>
      
      {displayPeople.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>{searchQuery.length >= 3 ? 'No users found with this ID.' : 'No one nearby yet.'}</p>
          <p className="text-xs">Invite your friends!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayPeople.map(person => (
            <div 
              key={person.uid}
              className="bg-white p-4 flex items-center gap-4 border-b border-gray-50 transition-all hover:bg-mc-light-green cursor-pointer last:border-none"
            >
              <div className="relative group cursor-pointer" onClick={(e) => { e.stopPropagation(); setFullscreenImage(person.photoURL || `https://ui-avatars.com/api/?name=${person.displayName}`); }}>
                <img 
                  src={person.photoURL || `https://ui-avatars.com/api/?name=${person.displayName}`} 
                  alt={person.displayName}
                  className="w-12 h-12 rounded-full object-cover shrink-0 border border-gray-100"
                />
                <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Maximize2 className="text-white w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-mc-text truncate">{person.displayName}</h3>
                  <span className="text-[10px] text-mc-green font-medium shrink-0">
                    {person.accountId} • {myLocation && person.lat ? calculateDistance(myLocation.lat, myLocation.lng, person.lat, person.lng).toFixed(1) + 'km' : 'Unknown'}
                  </span>
                </div>
                <p className="text-mc-text-secondary text-xs truncate mt-0.5">
                  {person.bio || "Hi, I'm new here!"}
                </p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onStartChat(person.uid);
                }}
                className="p-2 text-mc-green hover:bg-white rounded-full transition-colors"
                title="Message"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

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
