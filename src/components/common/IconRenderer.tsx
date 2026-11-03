import React from 'react';
import * as Icons from 'lucide-react';

interface IconRendererProps {
  name: string;
  className?: string;
  size?: number;
}

export const IconRenderer: React.FC<IconRendererProps> = ({ name, className = 'w-5 h-5', size }) => {
  // Try to find the icon in lucide-react
  const IconComponent = (Icons as unknown as Record<string, React.ElementType>)[name] || Icons.CircleDot;
  return <IconComponent className={className} size={size} />;
};

export const AVAILABLE_ICONS = [
  // Finance, Income, Savings & Business
  'Landmark',
  'Wallet',
  'CreditCard',
  'Banknote',
  'Building2',
  'Building',
  'Coins',
  'PiggyBank',
  'TrendingUp',
  'TrendingDown',
  'Briefcase',
  'Receipt',
  'QrCode',
  'ShieldCheck',
  'Gem',
  'Award',
  'DollarSign',
  'Percent',
  'Scale',
  'BadgePercent',
  'Vault',
  'FileText',
  'HandCoins',

  // Food, Groceries & Dining
  'ShoppingCart',
  'Utensils',
  'UtensilsCrossed',
  'Coffee',
  'Pizza',
  'Wine',
  'Beer',
  'Cake',
  'Apple',
  'IceCream',
  'CupSoda',
  'Sandwich',
  'Soup',
  'Cookie',

  // Housing, Utilities, Bills & Household
  'Home',
  'Zap',
  'Droplets',
  'Flame',
  'Wifi',
  'Tv',
  'Phone',
  'Smartphone',
  'Key',
  'Hammer',
  'Wrench',
  'Paintbrush',
  'Lamp',
  'Bath',
  'Sofa',
  'Bed',
  'Trash2',

  // Shopping, Clothing & Lifestyle
  'ShoppingBag',
  'Shirt',
  'Watch',
  'Scissors',
  'Package',
  'Footprints',
  'Glasses',
  'Store',
  'Tag',
  'Gift',

  // Commute, Vehicles, Travel & Transport
  'Fuel',
  'Car',
  'Bus',
  'Train',
  'Bike',
  'Plane',
  'Ship',
  'Navigation',
  'Compass',
  'Truck',
  'Luggage',

  // Health, Medical, Fitness & Wellness
  'Activity',
  'HeartPulse',
  'Pill',
  'Stethoscope',
  'Dumbbell',
  'Cross',
  'Hospital',
  'Syringe',
  'Thermometer',
  'Heart',
  'Smile',

  // Entertainment, Leisure & Sports
  'Film',
  'Music',
  'Gamepad2',
  'Ticket',
  'Camera',
  'Palmtree',
  'Tent',
  'BookOpen',
  'PartyPopper',
  'Clapperboard',
  'Trophy',
  'Dice5',
  'Sparkles',
  'Radio',

  // Education, Study & Books
  'GraduationCap',
  'School',
  'Book',
  'Baby',
  'Backpack',
  'Palette',
  'Calculator',
  'Library',

  // Family, Relationships & Pets
  'Users',
  'UserCheck',
  'Dog',
  'Cat',
  'Crown',
  'Flower',

  // Tech, Services, Subscriptions & Reminders
  'Laptop',
  'Monitor',
  'Repeat',
  'CalendarCheck',
  'Clock',
  'Bell',
  'Send',
  'Mail',
  'Cloud',
  'Cpu',
  'Server',
  'Shield',
];
