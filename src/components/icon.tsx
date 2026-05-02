// Thin Lucide wrapper. Stroke 1.75 is the spec from the design handoff.
// Centralized so swapping icon sets later is one file.
import {
  Camera, Image as LImage, ScanLine, LayoutGrid, User, TrendingUp, Sparkles,
  Check, CheckCircle2, X, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  ArrowLeft, ArrowRight, Share2, Heart, Search, Sliders, Layers, Zap, Infinity as InfinityIcon,
  Shield, Ruler, Settings, Bell, Lock, LogOut, Info, FileText, Crown, Plus, History,
  Tag, Globe, RotateCw, QrCode, Bookmark, MoreHorizontal, Filter, Star, Flame,
  type LucideIcon,
} from "lucide-react-native";

const REGISTRY = {
  camera: Camera,
  library: LImage,
  scan: ScanLine,
  grid: LayoutGrid,
  user: User,
  trend: TrendingUp,
  sparkles: Sparkles,
  check: Check,
  checkCircle: CheckCircle2,
  close: X,
  chevR: ChevronRight,
  chevL: ChevronLeft,
  chevD: ChevronDown,
  chevU: ChevronUp,
  back: ArrowLeft,
  arrowR: ArrowRight,
  share: Share2,
  heart: Heart,
  search: Search,
  filter: Sliders,
  filter2: Filter,
  stack: Layers,
  lightning: Zap,
  infinity: InfinityIcon,
  shield: Shield,
  ruler: Ruler,
  settings: Settings,
  bell: Bell,
  lock: Lock,
  logout: LogOut,
  info: Info,
  doc: FileText,
  crown: Crown,
  plus: Plus,
  history: History,
  tag: Tag,
  globe: Globe,
  rotate: RotateCw,
  qr: QrCode,
  bookmark: Bookmark,
  more: MoreHorizontal,
  star: Star,
  flame: Flame,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof REGISTRY;

export function Icon({
  name,
  size = 20,
  color = "#F4F5F6",
  strokeWidth = 1.75,
  fill = "none",
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const Component = REGISTRY[name];
  return <Component size={size} color={color} strokeWidth={strokeWidth} fill={fill} />;
}
