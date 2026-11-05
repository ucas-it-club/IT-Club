/** Devices that should get the plain page instead of scroll scenes. */
export function weakDevice() {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };

  return (
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) ||
    nav.connection?.saveData === true
  );
}
