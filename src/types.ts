export interface Photo {
  id: number;
  url: string;
  votes: number;
  caption: string;
  userRating?: number;
  isOutOfCompetition?: boolean;
  isFlagged?: boolean;
}

export interface PhotoFile {
    introArticleMarkdown: string;
    photos: Photo[];
}

export type LayoutMode = 'grid' | 'original';
export type GridAspectRatio = '1/1' | '4/3' | '3/2';

export interface Settings {
    layout: LayoutMode;
    gridAspectRatio: GridAspectRatio;
}

export interface Config {
  photosPath: string;
  resultsPath: string;
  ratedPhotoLimit: number;
  totalStarsLimit: number;
  defaultLayoutDesktop: LayoutMode;
  defaultLayoutMobile: LayoutMode;
  defaultGridAspectRatio: GridAspectRatio;
}