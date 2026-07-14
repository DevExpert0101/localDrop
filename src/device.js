const DEVICE_KEY = "localdrop_device_id";

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `LD-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export async function copyDeviceId() {
  const id = getDeviceId();
  await navigator.clipboard.writeText(id);
  return id;
}
