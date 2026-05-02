export interface CenteringDetails {
  leftRight: string;
  topBottom: string;
  passesThreshold: boolean;
}

export interface CornersDetails {
  topLeft?: string;
  topRight?: string;
  bottomLeft?: string;
  bottomRight?: string;
  notes?: string;
}

export interface EdgesDetails {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  notes?: string;
}

export interface SurfaceDetails {
  scratches?: string;
  holoScratches?: string;
  printLines?: string;
  indentations?: string;
  staining?: string;
  notes?: string;
}

export interface ScannedCard {
  id: string;
  user_id: string;
  card_name: string;
  card_set: string;
  card_number: string;
  card_year: string;
  front_image_url: string;
  back_image_url: string | null;
  predicted_grade: number;
  confidence: string;
  centering_score: number;
  corners_score: number;
  edges_score: number;
  surface_score: number;
  centering_details: CenteringDetails | null;
  corners_details: CornersDetails | null;
  edges_details: EdgesDetails | null;
  surface_details: SurfaceDetails | null;
  grade_up_tips: string[];
  is_favorite: boolean;
  scanned_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}
