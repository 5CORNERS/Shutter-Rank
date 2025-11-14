export interface FirebasePhoto {
    id: number;
    url: string;
    caption: string;
    isOutOfCompetition?: boolean;
    order?: number;
    groupId?: string;
}

export interface Photo extends FirebasePhoto {
    votes: number;
    userRating?: number;
    isFlagged?: boolean;
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
    ratedPhotoLimit: number;
    totalStarsLimit: number;
    defaultLayoutDesktop: LayoutMode;
    defaultLayoutMobile: LayoutMode;
    defaultGridAspectRatio: GridAspectRatio;
    unlockFourStarsThresholdPercent?: number;
    unlockFiveStarsThresholdPercent?: number;
}