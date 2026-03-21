"use client";

import { LucideIcon } from "lucide-react";

interface MobileKPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  gradient: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function MobileKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  trend,
}: MobileKPICardProps) {
  return (
    <div className={`glass-card relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg active:scale-95 transition-all`}>
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-white/90 uppercase tracking-wide mb-2">{title}</p>
            <p className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">{value}</p>
          </div>
          <div className="rounded-xl bg-white/20 backdrop-blur-sm p-3 shadow-lg">
            <Icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
        </div>
        
        {subtitle && (
          <p className="text-xs text-white/80 font-medium">{subtitle}</p>
        )}
        
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            <span className={`text-xs font-semibold ${trend.isPositive ? "text-emerald-200" : "text-red-200"}`}>
              {trend.isPositive ? "↑" : "↓"} {trend.value}
            </span>
            <span className="text-xs text-white/70">vs last period</span>
          </div>
        )}
      </div>
      
      {/* Decorative water ripple effect */}
      <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
    </div>
  );
}
