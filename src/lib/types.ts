export interface SubGrades {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
}

export interface CenteringDetail {
  leftRight: string;
  topBottom: string;
  passesThreshold: boolean;
  backLeftRight?: string;
  backTopBottom?: string;
}

export interface GradeResult {
  overallGrade: number;
  confidence: "High" | "Medium" | "Low";
  subGrades: SubGrades;
  centeringDetail: CenteringDetail;
  tips: string[];
  cardName: string;
  cardSet: string;
  cardYear: string;
  cardNumber: string;
  /** Official Pokemon TCG image URL (pokemontcg.io) returned by the grading AI */
  tcgImageUrl?: string | null;
}

export interface GradedCard {
  id: string;
  imageUri: string;
  /** Official Pokemon TCG card art fetched after grading */
  tcgImageUrl?: string;
  result: GradeResult;
  timestamp: number;
  favorite: boolean;
}
