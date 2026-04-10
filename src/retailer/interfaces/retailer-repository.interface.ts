export interface RawLocationInfo {
  id: number;
  title: string;
  address: string;
  location: {
    coordinates: [number, number]; // [lng, lat]
  };
  category: string;
  is_partner: boolean;
  custom_cashback_text: string;
  keywords: string[];
  is_visible: boolean;
  created_at: string;
  logo_url: string | null;
}

export interface RawLocationImage {
  location_id: number;
  image_url: string;
  priority: number;
}

export interface BaseCashbackRate {
  location_id: number;
  min_rate: number;
  max_rate: number;
}

export interface IRetailerRepository {
  findVisibleLocations(): Promise<RawLocationInfo[]>;
  findLocationImages(): Promise<RawLocationImage[]>;
  findBaseCashbackRates(): Promise<BaseCashbackRate[]>;
}

export const RETAILER_REPOSITORY = Symbol('RETAILER_REPOSITORY');
