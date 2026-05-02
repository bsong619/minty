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

export interface CornersDetail {
  topLeft?: string;
  topRight?: string;
  bottomLeft?: string;
  bottomRight?: string;
  notes?: string;
}

export interface EdgesDetail {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  notes?: string;
}

export interface SurfaceDetail {
  scratches?: string;
  holoScratches?: string;
  printLines?: string;
  indentations?: string;
  staining?: string;
  notes?: string;
}

export type Bucket =
  | "Lock 10"
  | "Strong 10 candidate"
  | "Coin-flip 9/10"
  | "Likely 9"
  | "Below 9";

export type GateValue = "PASS" | "FAIL" | "CANNOT_ASSESS" | "NOT_PROVIDED";

export interface HardPassGate {
  frontCentering?: GateValue;
  backCentering?: GateValue;
  frontCorners?: GateValue;
  backCorners?: GateValue;
  frontEdges?: GateValue;
  backEdges?: GateValue;
  frontSurface?: GateValue;
  backSurface?: GateValue;
  printQuality?: GateValue;
}

export interface GradeResult {
  overallGrade: number;
  /** Calibrated probability the card grades PSA 10 if submitted (0-1). */
  psa10Likelihood: number | null;
  /** Bucket derived from psa10Likelihood — primary signal for the user. */
  bucket: Bucket;
  /** Was the photo good enough to grade reliably? */
  photoQuality: "High" | "Medium" | "Low";
  /** Confidence in the overall prediction (factors photo quality + ambiguity). */
  confidence: "High" | "Medium" | "Low";
  subGrades: SubGrades;
  centeringDetail: CenteringDetail;
  cornersDetail?: CornersDetail;
  edgesDetail?: EdgesDetail;
  surfaceDetail?: SurfaceDetail;
  hardPassGate?: HardPassGate;
  disqualifyingFlaws?: string[];
  obscuredRegions?: string[];
  tips: string[];
  cardName: string;
  cardSet: string;
  cardYear: string;
  cardNumber: string;
  /** Optional reference image URL returned by the grading AI */
  tcgImageUrl?: string | null;
}

export interface GradedCard {
  id: string;
  imageUri: string;
  /** Optional reference card art fetched after grading */
  tcgImageUrl?: string;
  result: GradeResult;
  timestamp: number;
  favorite: boolean;
}
