export interface FirebasePhoto {
  id: number;
  url: string;
  caption: string;
  isOutOfCompetition?: boolean;
  order?: number;
  groupId?: string;
}

export interface Photo extends FirebasePhoto {
  votes: number; // Sum of stars (Legacy or 's')
  voteCount?: number; // Count of votes ('c')
  normalizedScore?: number; // Sum of normalized scores ('n')
  userRating?: number;
  validRating?: number; // The portion of rating that is stored in Firebase (valid)
  isVisible?: boolean;
  maxRating?: number;
  isCredit?: boolean; // New flag for credit votes
}

export interface GroupData {
    name: string;
    caption?: string;
}

export interface FirebaseDataGroups {
    [groupId: string]: GroupData;
}

export interface PhotoStack {
    type: 'stack';
    groupId: string;
    photos: Photo[];
    isExpanded: boolean;
    selectedPhotoId: number | null;
}

export type GalleryItem = (Photo & { type: 'photo' }) | PhotoStack;

export interface FirebasePhotoData {
    introArticleMarkdown: string;
    photos: FirebasePhoto[];
    groups?: FirebaseDataGroups;
}

export type LayoutMode = 'grid' | 'original';
export type GridAspectRatio = '1/1' | '4/3' | '3/2';

export interface Settings {
    layout: LayoutMode;
    gridAspectRatio: GridAspectRatio;
}

export interface Config {
  name?: string; // Human-readable name
  ratedPhotoLimit: number;
  totalStarsLimit: number;
  defaultLayoutDesktop: LayoutMode;
  defaultLayoutMobile: LayoutMode;
  defaultGridAspectRatio: GridAspectRatio;
  unlockFourStarsThresholdPercent?: number;
  unlockFiveStarsThresholdPercent?: number;
}

export type SortMode = 'id' | 'stars' | 'score' | 'count';