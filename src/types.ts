export interface FirebasePhoto {
  id: number;
  url: string;
  caption: string;
  isOutOfCompetition?: boolean;
  order?: number;
  groupId?: string;
}

export interface Photo extends FirebasePhoto {
  votes: number; // Sum of stars (Legacy + New)
  voteCount?: number; // Number of people who voted
  normalizedScore?: number; // Sum of normalized scores (1 + (N-1)*0.25)
  userRating?: number;
  isVisible?: boolean;
  maxRating?: number;
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
