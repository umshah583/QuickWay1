"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { vehicleCatalog } from "./vehicleCatalog";
import { calculateDiscountedPrice, applyFeesToPrice, type PricingAdjustments } from "@/lib/pricing";

type ServiceOption = {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  discountPercentage?: number | null;
};

type BookingFormProps = {
  services: ServiceOption[];
  pricingAdjustments: PricingAdjustments;
};

export default function BookingForm({ services, pricingAdjustments }: BookingFormProps) {
  const router = useRouter();
  const search = useSearchParams();
  const preselect = search.get("service") ?? undefined;
  const [serviceId, setServiceId] = useState(preselect ?? (services[0]?.id ?? ""));
  const [startAt, setStartAt] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationCoordinates, setLocationCoordinates] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const formatter = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" });

  const selectedService = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId]);
  const selectedDiscountedPrice = selectedService
    ? calculateDiscountedPrice(selectedService.priceCents, selectedService.discountPercentage)
    : null;
  const selectedFinalPrice = selectedDiscountedPrice !== null
    ? applyFeesToPrice(selectedDiscountedPrice, pricingAdjustments)
    : null;
  const selectedBasePriceWithFees = selectedService
    ? applyFeesToPrice(selectedService.priceCents, pricingAdjustments)
    : null;
  const selectedHasDiscount = selectedService && selectedFinalPrice !== null && selectedBasePriceWithFees !== null
    ? selectedFinalPrice < selectedBasePriceWithFees
    : false;

  const modelsForMake = useMemo(() => {
    const makeEntry = vehicleCatalog.find((entry) => entry.make === vehicleMake);
    return makeEntry?.models ?? [];
  }, [vehicleMake]);

  const mapsUrl = locationCoordinates ? locationCoordinates : undefined;

  function captureCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation not supported by this browser.");
      return;
    }
    setLocationStatus("Detecting current position...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        setLocationCoordinates(url);
        setLocationStatus("Pinned current GPS location.");
      },
      () => {
        setLocationStatus("Unable to access location. Please allow permission or paste a map link manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        startAt,
        locationLabel,
        locationCoordinates,
        vehicleMake,
        vehicleModel,
        vehicleType,
        vehicleColor,
        vehiclePlate,
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/account");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Unable to create booking");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm">Service</span>
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full border rounded px-3 py-2">
          {services.map((s) => {
            const discounted = calculateDiscountedPrice(s.priceCents, s.discountPercentage);
            const finalPrice = applyFeesToPrice(discounted, pricingAdjustments);
            const basePriceWithFees = applyFeesToPrice(s.priceCents, pricingAdjustments);
            return (
              <option key={s.id} value={s.id}>
                {s.name} — {formatter.format(finalPrice / 100)}
                {finalPrice < basePriceWithFees
                  ? ` (was ${formatter.format(basePriceWithFees / 100)})`
                  : ""}
                {` (${s.durationMin} min)`}
              </option>
            );
          })}
        </select>
      </label>
      {selectedService ? (
        <div className="rounded border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-4 text-sm">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-strong)]">
              {selectedService.name}
              {selectedHasDiscount ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {selectedService.discountPercentage}% off
                </span>
              ) : null}
            </div>
            <div className="text-sm text-[var(--text-muted)]">Duration: {selectedService.durationMin} minutes</div>
            <div className="flex items-center gap-2 text-lg font-semibold text-[var(--text-strong)]">
              {selectedFinalPrice !== null ? formatter.format(selectedFinalPrice / 100) : null}
              {selectedHasDiscount && selectedBasePriceWithFees !== null ? (
                <span className="text-sm font-normal text-[var(--text-muted)] line-through">
                  {formatter.format(selectedBasePriceWithFees / 100)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <label className="block">
        <span className="text-sm">Start time</span>
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required className="w-full border rounded px-3 py-2" />
      </label>
      <fieldset className="grid grid-cols-1 gap-3 rounded border border-dashed p-3">
        <legend className="text-sm font-semibold">Location</legend>
        <label className="block">
          <span className="text-xs uppercase">Location label</span>
          <input
            type="text"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="e.g. Home, Office"
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase">Google Maps link or plus code</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={locationCoordinates}
              onChange={(e) => setLocationCoordinates(e.target.value)}
              placeholder="Paste map link or use the detect button"
              className="w-full border rounded px-3 py-2"
            />
            <button
              type="button"
              onClick={captureCurrentLocation}
              className="shrink-0 rounded border border-[var(--surface-border)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
            >
              Use current location
            </button>
          </div>
        </label>
        {locationStatus ? <p className="text-xs text-[var(--text-muted)]">{locationStatus}</p> : null}
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--brand-primary)] underline"
          >
            Open in Google Maps
          </a>
        ) : null}
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-3 rounded border border-dashed p-3">
        <legend className="text-sm font-semibold">Vehicle details</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase">Make</span>
            <select
              value={vehicleMake}
              onChange={(e) => {
                const nextMake = e.target.value;
                setVehicleMake(nextMake);
                setVehicleModel("");
                setVehicleType("");
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select make</option>
              {vehicleCatalog.map((entry) => (
                <option key={entry.make} value={entry.make}>
                  {entry.make}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs uppercase">Model</span>
            <select
              value={vehicleModel}
              onChange={(e) => {
                const value = e.target.value;
                setVehicleModel(value);
                const model = modelsForMake.find((item) => item.name === value);
                setVehicleType(model?.type ?? "");
              }}
              disabled={!vehicleMake}
              className="w-full border rounded px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">{vehicleMake ? "Select model" : "Select make first"}</option>
              {modelsForMake.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name} ({model.type})
                </option>
              ))}
            </select>
          </label>
        </div>
        {vehicleType ? <p className="text-xs text-[var(--text-muted)]">Vehicle type: {vehicleType}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase">Color</span>
            <input type="text" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} placeholder="White" className="w-full border rounded px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-xs uppercase">Plate number</span>
            <input type="text" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="D 12345" className="w-full border rounded px-3 py-2" />
          </label>
        </div>
      </fieldset>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="rounded bg-black text-white px-4 py-2">{loading ? "Booking..." : "Book"}</button>
    </form>
  );
}
