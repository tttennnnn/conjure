/**
 * Builds a minimal ZIP archive in-browser and triggers a download.
 * Uses stored (uncompressed) entries — no external dependencies.
 * Falls back to individual file downloads if CompressionStream is unavailable.
 */
export async function downloadAsZip(
  files: { name: string; content: string }[],
  zipFilename: string,
): Promise<void> {
  if (typeof CompressionStream === "undefined") {
    for (const file of files) {
      downloadTextFile(file.name, file.content);
    }
    return;
  }

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const data = encoder.encode(file.content);
    const name = encoder.encode(file.name);
    const crc = crc32(data);

    const localHeader = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0),
      name,
    );

    parts.push(localHeader, data);

    const cdEntry = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset),
      name,
    );
    centralDir.push(cdEntry);
    offset += localHeader.length + data.length;
  }

  const cdSize = centralDir.reduce((s, e) => s + e.length, 0);
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(cdSize), u32(offset),
    u16(0),
  );

  const zipBytes = concat(...parts, ...centralDir, eocd);
  const zipBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength,
  ) as ArrayBuffer;

  const blob = new Blob([zipBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipFilename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ──

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of arrays) { out.set(a, pos); pos += a.length; }
  return out;
}

function crc32(data: Uint8Array): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    const idx = (crc ^ byte) & 0xff;
    crc = (crc >>> 8) ^ (table[idx] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crcTable: number[] | null = null;
function makeCrcTable(): number[] {
  if (_crcTable) return _crcTable;
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t.push(c);
  }
  _crcTable = t;
  return _crcTable;
}
