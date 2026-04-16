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
}

export interface Announcement {
  id: string;
  text: string;
  active: boolean;
  createdAt: any;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: any; // Typically Timestamp
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: any;
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
