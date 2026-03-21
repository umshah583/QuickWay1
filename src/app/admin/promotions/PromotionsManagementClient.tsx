"use client";

import { useState } from "react";
import { format } from "date-fns";
import { 
  Plus, 
  Ticket, 
  TrendingUp, 
  Users,
  Gift,
  Calendar,
  Percent,
  ToggleLeft,
  ToggleRight,
  Edit,
  Trash2,
  Star,
  Award
} from "lucide-react";

type Coupon = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minPurchaseAmount: number | null;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number | null;
  validFrom: Date | null;
  validUntil: Date | null;
  active: boolean;
  createdAt: Date;
};

interface PromotionsManagementClientProps {
  coupons: Coupon[];
  usageMap: Record<string, number>;
  totalCoupons: number;
  activeCoupons: number;
  totalUsage: number;
}

export function PromotionsManagementClient({
  coupons,
  usageMap,
  totalCoupons,
  activeCoupons,
  totalUsage,
}: PromotionsManagementClientProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loyaltyPointsPerAED, setLoyaltyPointsPerAED] = useState(10);
  const [pointsForFreeWash, setPointsForFreeWash] = useState(100);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);

  const formatCurrency = (cents: number) => {
    return `AED ${(cents / 100).toFixed(2)}`;
  };

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.discountType === "PERCENTAGE") {
      return `${coupon.discountValue}% OFF`;
    }
    return formatCurrency(coupon.discountValue);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
            Promotions Management
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Manage coupons, discounts, and loyalty rewards
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <Plus className="h-4 w-4" />
          Create Coupon
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-[var(--brand-primary)]/20 to-[var(--brand-aqua)]/10">
              <Ticket className="h-5 w-5 text-[var(--brand-primary)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Total Coupons</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{totalCoupons}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-green-500/10">
              <ToggleRight className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Active Coupons</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{activeCoupons}</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/10">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">Total Usage</p>
              <p className="text-2xl font-bold text-[var(--text-strong)]">{totalUsage}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Coupon Form */}
      {showCreateForm && (
        <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
          <h3 className="text-lg font-bold text-[var(--text-strong)] mb-6">Create New Coupon</h3>
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Coupon Code
                </label>
                <input
                  type="text"
                  placeholder="SUMMER2024"
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Coupon Name
                </label>
                <input
                  type="text"
                  placeholder="Summer Sale"
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                Description
              </label>
              <textarea
                placeholder="Get 20% off on all services"
                rows={3}
                className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Discount Type
                </label>
                <select className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all">
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Discount Value
                </label>
                <input
                  type="number"
                  placeholder="20"
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Valid From
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Valid Until
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2.5 rounded-xl border-2 border-[var(--surface-border)] text-[var(--text-medium)] font-semibold hover:bg-[var(--hover-bg)] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                Create Coupon
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Coupons List */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--surface-border)] bg-gradient-to-r from-[var(--brand-primary)]/5 to-[var(--brand-aqua)]/5">
          <h2 className="text-lg font-bold text-gradient bg-gradient-to-r from-[var(--brand-navy)] to-[var(--brand-primary)] bg-clip-text text-transparent">
            Active Promotions
          </h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className={`glass-card rounded-xl border-2 p-5 shadow-md hover:shadow-lg transition-all ${
                  coupon.active
                    ? "border-[var(--brand-primary)] bg-gradient-to-br from-[var(--brand-primary)]/5 to-[var(--brand-aqua)]/5"
                    : "border-[var(--surface-border)] opacity-60"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-r from-[var(--brand-primary)]/20 to-[var(--brand-aqua)]/10">
                      <Gift className="h-4 w-4 text-[var(--brand-primary)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-strong)]">{coupon.name}</h3>
                      <p className="text-xs text-[var(--text-muted)] font-mono">{coupon.code}</p>
                    </div>
                  </div>
                  <button className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors">
                    {coupon.active ? (
                      <ToggleRight className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-[var(--text-muted)]" />
                    )}
                  </button>
                </div>

                {coupon.description && (
                  <p className="text-xs text-[var(--text-medium)] mb-3 line-clamp-2">
                    {coupon.description}
                  </p>
                )}

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    <Percent className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span className="text-lg font-bold text-[var(--brand-primary)]">
                      {getDiscountDisplay(coupon)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-muted)]">
                      {usageMap[coupon.id] || 0} uses
                    </span>
                  </div>
                </div>

                {coupon.validUntil && (
                  <div className="flex items-center gap-1 mb-3">
                    <Calendar className="h-3 w-3 text-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-muted)]">
                      Expires {format(new Date(coupon.validUntil), "MMM dd, yyyy")}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-[var(--surface-border)]">
                  <button className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-medium)] text-xs font-semibold hover:bg-[var(--hover-bg)] transition-all">
                    <Edit className="h-3 w-3" />
                    Edit
                  </button>
                  <button className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all">
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {coupons.length === 0 && (
            <div className="text-center py-12">
              <Ticket className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-2">No coupons yet</h3>
              <p className="text-sm text-[var(--text-muted)]">Create your first coupon to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Loyalty Points Configuration */}
      <div className="glass-card rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] backdrop-blur-sm p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-[var(--brand-primary)]" />
            <h3 className="text-lg font-bold text-[var(--text-strong)]">Loyalty Points Configuration</h3>
          </div>
          <button
            onClick={() => setLoyaltyEnabled(!loyaltyEnabled)}
            className="inline-flex items-center gap-2"
          >
            {loyaltyEnabled ? (
              <ToggleRight className="h-6 w-6 text-emerald-600" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-[var(--text-muted)]" />
            )}
            <span className="text-sm font-semibold text-[var(--text-medium)]">
              {loyaltyEnabled ? "Enabled" : "Disabled"}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl border border-[var(--surface-border)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-[var(--text-strong)]">Points Earning Rate</h4>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Points per AED spent
                </label>
                <input
                  type="number"
                  value={loyaltyPointsPerAED}
                  onChange={(e) => setLoyaltyPointsPerAED(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
                />
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-r from-[var(--brand-primary)]/10 to-[var(--brand-aqua)]/5">
                <p className="text-xs text-[var(--text-muted)]">
                  Customers earn <span className="font-bold text-[var(--brand-primary)]">{loyaltyPointsPerAED} points</span> for every AED 1 spent
                </p>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl border border-[var(--surface-border)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="h-4 w-4 text-purple-500" />
              <h4 className="text-sm font-semibold text-[var(--text-strong)]">Redemption Settings</h4>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-label)] mb-2">
                  Points required for free wash
                </label>
                <input
                  type="number"
                  value={pointsForFreeWash}
                  onChange={(e) => setPointsForFreeWash(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white/60 backdrop-blur-sm border-2 border-[var(--surface-border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 transition-all"
                />
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/5">
                <p className="text-xs text-[var(--text-muted)]">
                  Customers can redeem <span className="font-bold text-purple-600">{pointsForFreeWash} points</span> for a free car wash
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-aqua)] text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
