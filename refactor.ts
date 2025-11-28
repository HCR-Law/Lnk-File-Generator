import path from "node:path";


export interface Options {
  linkTarget: string;
  name?: string;
  workingDirectory?: string;
  args?: string;
  icon_location?: string;
}

interface FileAttr {
  dir: Buffer;
  file: Buffer;
}

interface CLSID {
  computer: Buffer;
  network: Buffer;
}

interface Prefix {
  localRoot: Buffer;
  folder: Buffer;
  file: Buffer;
  networkRoot: Buffer;
}

const sep = path.sep;

// Feature flags (kept as numbers to mirror original behaviour)
const HAS_LINKTARGET_IDLIST = 0x01;
const HAS_NAME = 0x04;
const HAS_WORKINGDIR = 0x10;
const HAS_ARGUMENTS = 0x20;
const HAS_ICONLOCATION = 0x40;

// Static buffers
const headerSize = Buffer.from([0x4c, 0x00, 0x00, 0x00]); // 4 bytes
const linkFlags_2_3_4 = Buffer.from([0x01, 0x00, 0x00]); // remaining 3 bytes for linkFlags

// file attributes
const fileAttr: FileAttr = {
  dir: Buffer.from([0x10, 0x00, 0x00, 0x00]),
  file: Buffer.from([0x20, 0x00, 0x00, 0x00]),
};

// timestamps (8 bytes each)
const creationTime = Buffer.alloc(8, 0x00);
const accessTime = Buffer.alloc(8, 0x00);
const writeTime = Buffer.alloc(8, 0x00);

// other fixed fields
const fileSize = Buffer.alloc(4, 0x00);
const iconIndex = Buffer.alloc(4, 0x00);
const showCommand = Buffer.from([0x01, 0x00, 0x00, 0x00]); // SW_SHOWNORMAL
const hotkey = Buffer.from([0x00, 0x00]);
const reserved = Buffer.from([0x00, 0x00]);
const reserved2 = Buffer.alloc(4, 0x00);
const reserved3 = Buffer.alloc(4, 0x00);
const terminalID = Buffer.from([0x00, 0x00]);

const prefix: Prefix = {
  localRoot: Buffer.from([0x2f]),
  folder: Buffer.from([0x31, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
  file: Buffer.from([0x32, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
  networkRoot: Buffer.from([0xc3, 0x01, 0x81]),
};

// convert CLSIDs to buffers at module init
const linkCLSID = convertCLSIDtoBuffer("00021401-0000-0000-c000-000000000046");
const clsid: CLSID = {
  computer: convertCLSIDtoBuffer("20d04fe0-3aea-1069-a2d8-08002b30309d"),
  network: convertCLSIDtoBuffer("208d2c60-3aea-1069-a2d7-08002b30309d"),
};

const endOfString = Buffer.from([0x00]);

// -------------------- helpers --------------------

/** Convert even-length hex string to Buffer (no 0x prefix expected) */
function hexToBuffer(hex: string): Buffer {
  if (hex.length % 2 !== 0) hex = "0" + hex;
    return Buffer.from(hex, "hex");
}

/**
 * Convert a simple ASCII-only JS string to a single-byte-per-char Buffer.
 * Throws on non-ASCII to preserve original behavior.
 */
function strToAnsiBuffer(s: string): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; ++i) {
    const code = s.charCodeAt(i);
    if (code > 0x7f) {
      throw new Error(`Non-ASCII character detected at index ${i}: ${s[i]}`);
    }
    bytes.push(code & 0xff);
  }
  return Buffer.from(bytes);
}

/**
 * Convert a textual CLSID form "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" into
 * the mixed-endian binary layout used by Windows structures.
 */
function convertCLSIDtoBuffer(clsid: string): Buffer {
  const parts = clsid.split("-");
  if (parts.length !== 5) throw new Error(`Invalid CLSID format: ${clsid}`);

  // parts[0..2] are little-endian groups; parts[3..4] are big-endian
  const b0 = Buffer.from(hexToBuffer(parts[0])).reverse();
  const b1 = Buffer.from(hexToBuffer(parts[1])).reverse();
  const b2 = Buffer.from(hexToBuffer(parts[2])).reverse();
  const b3 = Buffer.from(hexToBuffer(parts[3])); // no reverse
  const b4 = Buffer.from(hexToBuffer(parts[4])); // no reverse

  return Buffer.concat([b0, b1, b2, b3, b4]);
}

/** Create the 4-byte LinkFlags: one byte containing our flags followed by 3 static bytes */
function generateLinkFlags(): Buffer {
  const first = Buffer.from([
    HAS_LINKTARGET_IDLIST + HAS_NAME + HAS_WORKINGDIR + HAS_ARGUMENTS + HAS_ICONLOCATION,
  ]);
  return Buffer.concat([first, linkFlags_2_3_4]);
}

/**
 * Generate the StringData buffer used in the LNK format.
 * The original code used (length + 2) and appended a single 0x00 byte.
 * To remain compatible with original output we preserve that behavior.
 *
 * Layout used: 2-byte little-endian size, bytes..., 0x00
 */
function generateDataBuffer(s: string): Buffer {
  const body = strToAnsiBuffer(s);
  const size = body.length + 2; // preserve original logic
  const header = Buffer.alloc(2);
  header.writeUInt16LE(size, 0);
  return Buffer.concat([header, body, Buffer.from([0x00])]);
}

/**
 * Generate an IDLIST entry: 2-byte little-endian size followed by item bytes.
 * The caller should provide `item` as the bytes that represent the item entry.
 */
function generateIdList(item: Buffer): Buffer {
  const size = item.length + 2; // size field includes 2 bytes of the size itself
  const header = Buffer.alloc(2);
  header.writeUInt16LE(size, 0);
  return Buffer.concat([header, item]);
}

// -------------------- main builder --------------------

/**
 * Create a Buffer representing a .lnk file from the provided options.
 * This mirrors the logic from your original source but uses Buffer for binary handling.
 */
export function createLinkBuffer(options: Options): Buffer {
  if (!options || !options.linkTarget) throw new Error("linkTarget is required");

  const { name, workingDirectory, args, icon_location } = options;
  let linkTarget = options.linkTarget;

  // Build string-data section
  const stringParts: Buffer[] = [];
  if (name) stringParts.push(generateDataBuffer(name));
  if (workingDirectory) stringParts.push(generateDataBuffer(workingDirectory));
  if (args) stringParts.push(generateDataBuffer(args));
  if (icon_location) stringParts.push(generateDataBuffer(icon_location));
  const stringData = Buffer.concat(stringParts.length ? stringParts : [Buffer.alloc(0)]);

  const linkFlags = generateLinkFlags();

  // target handling
  let targetIsFolder = false;
  if (linkTarget.endsWith("\\") && linkTarget !== "\\\\") {
    linkTarget = linkTarget.slice(0, -1);
    targetIsFolder = true;
  }

  const parts = linkTarget.split("\\");

  let prefixRoot: Buffer;
  let itemData: Buffer;
  let targetRootStr: string;
  let targetLeafStr = "";

  if (linkTarget.startsWith("\\\\")) {
    // network share: \\server\share\rest\...
    prefixRoot = prefix.networkRoot;
    itemData = Buffer.concat([Buffer.from([0x1f, 0x58]), clsid.network]);

    // rebuild share root including trailing backslash
    //const shareParts = parts.slice(0, 3); // ["", "", "server", "share"] -> careful
    // when split("\\\\server\\share\\...") we get ["", "", "server", "share", ...]
    // slice(0,3) here results in ["", "", "server"]; original code used slice(0,3),
    // but to ensure server\share we find the first two non-empty segments:
    const nonEmpty = parts.filter((p) => p.length > 0);
    if (nonEmpty.length < 2) throw new Error("Invalid network path");
    targetRootStr = `\\\\${nonEmpty[0]}\\${nonEmpty[1]}\\`;
    // leaf is the remainder after server\share
    const leafParts = nonEmpty.slice(2);
    targetLeafStr = leafParts.join("\\");
  } else {
    // local drive e.g., C:\path\to\file
    prefixRoot = prefix.localRoot;
    itemData = Buffer.concat([Buffer.from([0x1f, 0x50]), clsid.computer]);

    if (!parts[0]) throw new Error("Invalid path - expected drive letter or UNC path");
    targetRootStr = parts[0] + "\\"; // drive letter + backslash
    const leafParts = parts.slice(1);
    targetLeafStr = leafParts.join("\\");
  }

  if (!targetLeafStr) targetLeafStr = "";

  // Choose prefix and file attributes based on whether target is folder
  const prefixOfTarget = targetIsFolder ? prefix.folder : prefix.file;
  const fileAttributes = targetIsFolder ? fileAttr.dir : fileAttr.file;

  // Convert targetRoot to ANSI bytes and pad with 21 zero bytes as original code does
  const targetRootBuf = Buffer.concat([strToAnsiBuffer(targetRootStr), Buffer.alloc(21)]);
  // idList building
  const idListItems: Buffer[] = [];

  // itemData entry
  idListItems.push(generateIdList(itemData));

  // prefixRoot + targetRoot + endOfString entry
  idListItems.push(
    generateIdList(Buffer.concat([prefixRoot, targetRootBuf, endOfString]))
  );

  // optional target leaf
  if (targetLeafStr && targetLeafStr.length) {
    const leafBuf = strToAnsiBuffer(targetLeafStr);
    idListItems.push(
      generateIdList(Buffer.concat([prefixOfTarget, leafBuf, endOfString]))
    );
  }

  // Combine idListItems into a single buffer, then wrap with outer idlist size header
  const combinedIdListItems = Buffer.concat(idListItems);
  const idList = generateIdList(combinedIdListItems);

  // Compose final data blob according to original order:
  const components = [
    headerSize,
    linkCLSID,
    linkFlags,
    fileAttributes,
    creationTime,
    accessTime,
    writeTime,
    fileSize,
    iconIndex,
    showCommand,
    hotkey,
    reserved,
    reserved2,
    reserved3,
    idList,
    terminalID,
    stringData,
  ];

  const full = Buffer.concat(components);
  return full;
}

/**
 * Convenience: create a Blob when running in environments with global `Blob`.
 * Returns undefined when Blob is not available.
 */
export function createLinkBlob(options: Options): Blob | undefined {
  const buf = createLinkBuffer(options);
  if (typeof Blob === "undefined") return undefined;
  // convert Buffer -> Uint8Array for Blob constructor
  return new Blob([new Uint8Array(buf)], { type: "application/x-ms-shortcut" });
}

export default createLinkBuffer;

const test = createLinkBlob({
    linkTarget: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    name: "Chrome Test",
});

await Bun.write("./outdir/test.lnk", test!);
