import {
  Calendar,
  Users,
  Car,
  Settings,
  CreditCard,
  Bell,
  Package,
  Building2,
  MessageSquare,
  FileText,
  Wallet,
  Clock,
  UserCog,
  Tag,
  Layers,
  BarChart3,
  Shield,
  GitPullRequest,
  CheckCircle,
  type LucideIcon,
} from 'lucide-react';

export interface ModuleDefinition {
  key: string;
  name: string;
  description: string;
  icon: LucideIcon;
  path: string;
  sortOrder: number;
  defaultEnabled: boolean;
  category: 'core' | 'operations' | 'finance' | 'marketing' | 'system';
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // Core Modules
  {
    key: 'dashboard',
    name: 'Dashboard',
    description: 'Overview and analytics dashboard',
    icon: BarChart3,
    path: '/admin',
    sortOrder: 0,
    defaultEnabled: true,
    category: 'core',
  },
  {
    key: 'bookings',
    name: 'Bookings',
    description: 'Manage customer bookings and appointments',
    icon: Calendar,
    path: '/admin/bookings',
    sortOrder: 10,
    defaultEnabled: true,
    category: 'core',
  },
  {
    key: 'completed-bookings',
    name: 'Completed Bookings',
    description: 'View and manage completed bookings',
    icon: CheckCircle,
    path: '/admin/bookings/completed',
    sortOrder: 15,
    defaultEnabled: true,
    category: 'core',
  },
  {
    key: 'customers',
    name: 'Customers',
    description: 'Manage customer accounts and information',
    icon: Users,
    path: '/admin/customers',
    sortOrder: 20,
    defaultEnabled: true,
    category: 'core',
  },
  {
    key: 'services',
    name: 'Services',
    description: 'Manage available services and pricing',
    icon: Car,
    path: '/admin/services',
    sortOrder: 30,
    defaultEnabled: true,
    category: 'core',
  },
  {
    key: 'service-types',
    name: 'Service Types',
    description: 'Manage service categories and types',
    icon: Layers,
    path: '/admin/service-types',
    sortOrder: 35,
    defaultEnabled: true,
    category: 'core',
  },

  // Operations Modules
  {
    key: 'drivers',
    name: 'Drivers',
    description: 'Manage driver accounts and assignments',
    icon: UserCog,
    path: '/admin/drivers',
    sortOrder: 40,
    defaultEnabled: true,
    category: 'operations',
  },
  {
    key: 'driver-days',
    name: 'Driver Days',
    description: 'Track driver shifts and daily activities',
    icon: Clock,
    path: '/admin/driver-days',
    sortOrder: 45,
    defaultEnabled: true,
    category: 'operations',
  },
  {
    key: 'business-day',
    name: 'Business Day',
    description: 'Manage business hours and operations',
    icon: Clock,
    path: '/admin/business-day',
    sortOrder: 50,
    defaultEnabled: true,
    category: 'operations',
  },
  {
    key: 'partners',
    name: 'Partners',
    description: 'Manage partner organizations',
    icon: Building2,
    path: '/admin/partners',
    sortOrder: 55,
    defaultEnabled: true,
    category: 'operations',
  },
  {
    key: 'request-approvals',
    name: 'Request Approvals',
    description: 'Approve or reject partner driver/service requests',
    icon: GitPullRequest,
    path: '/admin/partners/driver-requests',
    sortOrder: 58,
    defaultEnabled: true,
    category: 'operations',
  },

  // Finance Modules
  {
    key: 'transactions',
    name: 'Transactions',
    description: 'View payment transactions',
    icon: CreditCard,
    path: '/admin/transactions',
    sortOrder: 60,
    defaultEnabled: true,
    category: 'finance',
  },
  {
    key: 'collections',
    name: 'Collections',
    description: 'Manage cash collections',
    icon: Wallet,
    path: '/admin/collections',
    sortOrder: 65,
    defaultEnabled: true,
    category: 'finance',
  },
  {
    key: 'settlements',
    name: 'Settlements',
    description: 'Manage driver and partner settlements',
    icon: FileText,
    path: '/admin/settlements',
    sortOrder: 70,
    defaultEnabled: true,
    category: 'finance',
  },
  {
    key: 'invoices',
    name: 'Invoices',
    description: 'Generate and manage invoices',
    icon: FileText,
    path: '/admin/invoices',
    sortOrder: 75,
    defaultEnabled: true,
    category: 'finance',
  },

  // Marketing Modules
  {
    key: 'packages',
    name: 'Packages',
    description: 'Manage subscription packages',
    icon: Package,
    path: '/admin/packages',
    sortOrder: 80,
    defaultEnabled: true,
    category: 'marketing',
  },
  {
    key: 'subscriptions',
    name: 'Subscriptions',
    description: 'Manage customer subscriptions',
    icon: Package,
    path: '/admin/subscriptions',
    sortOrder: 85,
    defaultEnabled: true,
    category: 'marketing',
  },
  {
    key: 'coupons',
    name: 'Coupons',
    description: 'Create and manage discount coupons',
    icon: Tag,
    path: '/admin/coupons',
    sortOrder: 90,
    defaultEnabled: true,
    category: 'marketing',
  },
  {
    key: 'promotional-notifications',
    name: 'Promotional Notifications',
    description: 'Send broadcast push notifications to customers',
    icon: Bell,
    path: '/admin/promotional-notifications',
    sortOrder: 95,
    defaultEnabled: true,
    category: 'marketing',
  },

  // System Modules
  {
    key: 'notifications',
    name: 'Notifications',
    description: 'Manage system notifications',
    icon: Bell,
    path: '/admin/notifications',
    sortOrder: 100,
    defaultEnabled: true,
    category: 'system',
  },
  {
    key: 'feedback',
    name: 'Feedback',
    description: 'View and manage customer feedback',
    icon: MessageSquare,
    path: '/admin/feedback',
    sortOrder: 105,
    defaultEnabled: true,
    category: 'system',
  },
  {
    key: 'module-management',
    name: 'Module Management',
    description: 'Control which modules are available per role',
    icon: Shield,
    path: '/admin/modules',
    sortOrder: 115,
    defaultEnabled: true,
    category: 'system',
  },
  {
    key: 'user-management',
    name: 'User Management',
    description: 'Manage users and roles',
    icon: Shield,
    path: '/admin/user-management',
    sortOrder: 110,
    defaultEnabled: true,
    category: 'system',
  },
  {
    key: 'settings',
    name: 'Settings',
    description: 'System configuration and settings',
    icon: Settings,
    path: '/admin/settings',
    sortOrder: 120,
    defaultEnabled: true,
    category: 'system',
  },
];

export const MODULE_CATEGORIES = {
  core: { name: 'Core', description: 'Essential business modules' },
  operations: { name: 'Operations', description: 'Day-to-day operational modules' },
  finance: { name: 'Finance', description: 'Financial and payment modules' },
  marketing: { name: 'Marketing', description: 'Marketing and promotions modules' },
  system: { name: 'System', description: 'System administration modules' },
};

export function getModuleByKey(key: string): ModuleDefinition | undefined {
  return MODULE_DEFINITIONS.find((m) => m.key === key);
}

export function getModulesByCategory(category: string): ModuleDefinition[] {
  return MODULE_DEFINITIONS.filter((m) => m.category === category);
}

export function getIconComponent(iconName: string): LucideIcon | null {
  const iconMap: Record<string, LucideIcon> = {
    Calendar,
    Users,
    Car,
    Settings,
    CreditCard,
    Bell,
    Package,
    Building2,
    MessageSquare,
    FileText,
    Wallet,
    Clock,
    UserCog,
    Tag,
    Layers,
    BarChart3,
    Shield,
    GitPullRequest,
    CheckCircle,
  };
  return iconMap[iconName] || null;
}
