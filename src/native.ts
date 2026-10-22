import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Place, PlaceSource } from './api';
import type { OpenMeteoResponse } from './forecast';
import type { SpeedUnit } from './wind';

/** Running inside the iOS app rather than a browser. */
export const isNative = Capacitor.isNativePlatform();

export interface AlertsStatus {
  permission: 'granted' | 'denied' | 'prompt';
  enabled: boolean;
}

interface Point {
  time: string;
  speed: number;
  gust: number;
  dir: number;
}

export interface SyncPayload {
  place: { lat: number; lon: number; name: string };
  source: PlaceSource;
  unit: SpeedUnit;
  timezone: string;
  current: Point;
  hours: Point[];
  fetchedAt: number;
}

/** Native side: ios/App/App/VentoPlugin.swift. */
interface VentoPlugin {
  /** Hands the forecast to the widget and to gust notifications. */
  sync(payload: SyncPayload): Promise<void>;
  alertsStatus(): Promise<AlertsStatus>;
  enableAlerts(): Promise<AlertsStatus>;
  disableAlerts(): Promise<AlertsStatus>;
}

export const vento = registerPlugin<VentoPlugin>('Vento');

export function syncPayload(
  shown: { place: Place; source: PlaceSource; data: OpenMeteoResponse; fetchedAt: number },
  unit: SpeedUnit,
): SyncPayload {
  const { current: c, hourly: h } = shown.data;
  return {
    place: { lat: shown.place.lat, lon: shown.place.lon, name: shown.place.name },
    source: shown.source,
    unit,
    timezone: shown.data.timezone,
    current: { time: c.time, speed: c.wind_speed_10m, gust: c.wind_gusts_10m, dir: c.wind_direction_10m },
    hours: h.time
      .map((time, i) => ({ time, speed: h.wind_speed_10m[i], gust: h.wind_gusts_10m[i], dir: h.wind_direction_10m[i] }))
      .filter((p) => p.speed != null && p.gust != null && p.dir != null),
    fetchedAt: shown.fetchedAt,
  };
}

const DENIED = new Set([
  'OS-PLUG-GLOC-0003', // permission denied
  'OS-PLUG-GLOC-0007', // location services off
  'OS-PLUG-GLOC-0008', // restricted
]);

/** Plugin errors reshaped like GeolocationPositionError: code 1 means the user has to allow location. */
export function positionError(err: unknown): { code: number } {
  const code = String((err as { code?: unknown } | null)?.code ?? '');
  return { code: DENIED.has(code) ? 1 : 2 };
}

export async function nativePosition(): Promise<{ coords: { latitude: number; longitude: number } }> {
  const { Geolocation } = await import('@capacitor/geolocation');
  try {
    return await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 });
  } catch (err) {
    throw positionError(err);
  }
}
