import type {
  IRetailerRepository,
  RawLocationInfo,
  RawLocationImage,
  BaseCashbackRate,
} from '../interfaces/retailer-repository.interface';

export class StubRetailerRepository implements IRetailerRepository {
  private locations: RawLocationInfo[] = [];
  private images: RawLocationImage[] = [];
  private cashbackRates: BaseCashbackRate[] = [];

  setLocations(locations: RawLocationInfo[]): void {
    this.locations = locations;
  }

  setImages(images: RawLocationImage[]): void {
    this.images = images;
  }

  setCashbackRates(rates: BaseCashbackRate[]): void {
    this.cashbackRates = rates;
  }

  clear(): void {
    this.locations = [];
    this.images = [];
    this.cashbackRates = [];
  }

  findVisibleLocations(): Promise<RawLocationInfo[]> {
    return Promise.resolve(this.locations.filter((l) => l.is_visible));
  }

  findLocationImages(): Promise<RawLocationImage[]> {
    return Promise.resolve(
      [...this.images].sort((a, b) => a.priority - b.priority),
    );
  }

  findBaseCashbackRates(): Promise<BaseCashbackRate[]> {
    return Promise.resolve(this.cashbackRates);
  }
}
