import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Cigarette,
  CirclePlus,
  Coffee,
  CreditCard,
  CupSoda,
  Fuel,
  Gift,
  HandCoins,
  House,
  Landmark,
  PiggyBank,
  ScrollText,
  Shield,
  Shirt,
  Smartphone,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "arrow-left-right": ArrowLeftRight,
  banknote: Banknote,
  briefcase: Briefcase,
  cigarette: Cigarette,
  "circle-plus": CirclePlus,
  coffee: Coffee,
  "credit-card": CreditCard,
  "cup-soda": CupSoda,
  fuel: Fuel,
  gift: Gift,
  "hand-coins": HandCoins,
  house: House,
  landmark: Landmark,
  "piggy-bank": PiggyBank,
  "scroll-text": ScrollText,
  shield: Shield,
  shirt: Shirt,
  smartphone: Smartphone,
  utensils: Utensils,
  wallet: Wallet,
  zap: Zap,
};

export const iconOptions = Object.keys(icons);

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const Glyph = icons[name] ?? Wallet;
  return <Glyph size={size} strokeWidth={1.8} />;
}
