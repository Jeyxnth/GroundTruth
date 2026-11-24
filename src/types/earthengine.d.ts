// Minimal typing for @google/earthengine (the package ships none).
// Earth Engine objects are deliberately loosely typed; wrap usage in typed helpers under src/lib/ee.
declare module "@google/earthengine" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type EEAny = any;
  interface EEData {
    authenticateViaPrivateKey(
      key: object,
      success: () => void,
      error: (message: string) => void,
    ): void;
    setAuthToken: EEAny;
    [key: string]: EEAny;
  }
  interface EE {
    data: EEData;
    initialize(
      baseUrl: string | null,
      tileUrl: string | null,
      success: () => void,
      error: (e: unknown) => void,
      xsrfToken: string | null,
      project?: string,
    ): void;
    [key: string]: EEAny;
  }
  const ee: EE;
  export default ee;
}
