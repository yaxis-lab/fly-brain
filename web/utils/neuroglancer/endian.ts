export enum Endianness {
  LITTLE = 0,
  BIG = 1,
}

export function determineEndianness() {
  const a = Uint16Array.of(0x1122);
  const b = new Uint8Array(a.buffer);
  return b[0] === 0x11 ? Endianness.BIG : Endianness.LITTLE;
}

export const ENDIANNESS = determineEndianness();

export function convertEndian32(
  array: ArrayBufferView,
  source: Endianness,
  target: Endianness = ENDIANNESS,
) {
  if (source !== target) {
    swapEndian32(array);
  }
}

export function swapEndian32(array: ArrayBufferView) {
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  for (let i = 0, length = view.length; i < length; i += 4) {
    let temp = view[i];
    view[i] = view[i + 3];
    view[i + 3] = temp;
    temp = view[i + 1];
    view[i + 1] = view[i + 2];
    view[i + 2] = temp;
  }
}
