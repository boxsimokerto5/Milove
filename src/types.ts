export interface UserProfile {
  uid: string;
  accountId: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  gender?: 'male' | 'female' | 'other';
  geohash?: string;
  lat?: number;
  lng?: number;
  lastSeen: string;
  isActive: boolean;
  likes?: string[];      // UIDs of people this user liked
  likedBy?: string[];    // UIDs of people who liked this user
  matches?: string[];    // UIDs of mutual likes
  blockedUsers?: string[]; // UIDs of people this user blocked
  birthDate?: string;     // ISO format YYYY-MM-DD
}

export interface Announcement {
  id: string;
  text: string;
  active: boolean;
  createdAt: any;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  count: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  imageUrl?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  createdAt: any; // Typically Timestamp
  reactions?: { [emoji: string]: string[] }; // emoji -> list of user UIDs
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: any;
    location?: boolean;
    imageUrl?: boolean;
  };
  updatedAt: any;
  otherUser?: UserProfile; // Joined data for UI
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  createdAt: any;
}

export interface Moment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  imageUrls: string[];
  likes: string[];
  commentCount?: number;
  createdAt: any;
}

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  status: 'calling' | 'accepted' | 'rejected' | 'ended';
  type: 'video' | 'audio';
  roomId: string;
  createdAt: any;
}
