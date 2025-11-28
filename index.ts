export interface Options {
    /**
     * The full path string of the file or folder.
     * The file extension must be included if the target is a file.
     * 
     * Use backslashes as path seperators.
     * For folder targets, the linkTarget must end in a backslash.
     * Non-ASCII characters are not supported.
     * 
     * Note: Not case-sensitive.
     * @type {string}
     * @example
     * "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" // file
     * "C:\\Program Files\\Google\\Chrome\\Application\\" // folder
     */
    linkTarget: string;
    comment?: string;
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

const sep = "\\";
const dSep = sep + sep as "\\\\"

// Feature flags
const HAS_LINKTARGET_IDLIST = 0x01;
const HAS_NAME = 0x04;
const HAS_WORKINGDIR = 0x10;
const HAS_ARGUMENTS = 0x20;
const HAS_ICONLOCATION = 0x40;

// Static buffers
const headerSize = Buffer.from([0x4c, 0x00, 0x00, 0x00]);
const linkFlags_2_3_4 = Buffer.from([0x01, 0x00, 0x00]);

// file attributes
const fileAttr: FileAttr = {
    dir: Buffer.from([0x10, 0x00, 0x00, 0x00]),
    file: Buffer.from([0x20, 0x00, 0x00, 0x00]),
};

// timestamps
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

const linkCLSID = convertCLSIDtoBuffer("00021401-0000-0000-c000-000000000046");
const clsid: CLSID = {
    computer: convertCLSIDtoBuffer("20d04fe0-3aea-1069-a2d8-08002b30309d"),
    network: convertCLSIDtoBuffer("208d2c60-3aea-1069-a2d7-08002b30309d"),
};

const endOfString = Buffer.from([0x00]);

//#region Helpers

/**
 *  Convert hex string to Buffer 
 */
function hexToBuffer(hex: string): Buffer {
    if (hex.length % 2 !== 0) hex = "0" + hex;
    return Buffer.from(hex, "hex");
}

/**
 * Convert an ASCII-only string to a Buffer.
 */
function strToAsciiBuffer(s: string): Buffer {
    return Buffer.from(s, "ascii");
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
 * 
 * Layout used: 2-byte little-endian size, bytes..., 0x00
 */
function generateDataBuffer(s: string): Buffer {
    const body = strToAsciiBuffer(s);
    const size = body.length + 2;
    const header = Buffer.alloc(2);
    header.writeUInt16LE(size, 0);
    return Buffer.concat([header, body, Buffer.from([0x00])]);
}

/**
 * Generate an IDLIST entry: 2-byte little-endian size followed by item bytes.
 */
function generateIdList(item: Buffer): Buffer {
    const size = item.length + 2; // size field includes 2 bytes of the size itself
    const header = Buffer.alloc(2);
    header.writeUInt16LE(size, 0);
    return Buffer.concat([header, item]);
}

//#region Main

function createLinkBuffer(options: Options): Buffer {
    if (!options || !options.linkTarget) throw new Error("linkTarget is required");

    const { comment, workingDirectory, args, icon_location } = options;
    let linkTarget = options.linkTarget;

    // Build string-data section
    const stringParts: Buffer[] = [];
    if (comment) stringParts.push(generateDataBuffer(comment));
    if (workingDirectory) stringParts.push(generateDataBuffer(workingDirectory));
    if (args) stringParts.push(generateDataBuffer(args));
    if (icon_location) stringParts.push(generateDataBuffer(icon_location));
    const stringData = Buffer.concat(stringParts.length ? stringParts : [Buffer.alloc(0)]);

    const linkFlags = generateLinkFlags();

    // target handling
    let targetIsFolder = false;
    if (linkTarget.endsWith(sep) && linkTarget !== dSep) {
        linkTarget = linkTarget.slice(0, -1);
        targetIsFolder = true;
    }

    const parts = linkTarget.split(sep);

    let prefixRoot: Buffer;
    let itemData: Buffer;
    let targetRootStr: string;
    let targetLeafStr = "";

    if (linkTarget.startsWith(dSep)) {
        // network share: \\server\share\rest\...
        prefixRoot = prefix.networkRoot;
        itemData = Buffer.concat([Buffer.from([0x1f, 0x58]), clsid.network]);

        // rebuild share root including trailing backslash
        const nonEmpty = parts.filter((p) => p.length > 0);
        if (nonEmpty.length < 2) throw new Error("Invalid network path");
        targetRootStr = `${dSep}${nonEmpty[0]}${sep}${nonEmpty[1]}${sep}`;
        // leaf is the remainder after server\share
        const leafParts = nonEmpty.slice(2);
        targetLeafStr = leafParts.join(sep);
    } else {
        // local drive e.g., C:\path\to\file
        prefixRoot = prefix.localRoot;
        itemData = Buffer.concat([Buffer.from([0x1f, 0x50]), clsid.computer]);

        if (!parts[0]) throw new Error("Invalid path - expected drive letter or UNC path");
        targetRootStr = parts[0] + sep; // drive letter + backslash
        const leafParts = parts.slice(1);
        targetLeafStr = leafParts.join(sep);
    }

    if (!targetLeafStr) targetLeafStr = "";

    // Choose prefix and file attributes based on whether target is folder
    const prefixOfTarget = targetIsFolder ? prefix.folder : prefix.file;
    const fileAttributes = targetIsFolder ? fileAttr.dir : fileAttr.file;

    // Convert targetRoot to ANSI bytes and pad with 21 zero bytes
    const targetRootBuf = Buffer.concat([strToAsciiBuffer(targetRootStr), Buffer.alloc(21)]);

    const idListItems: Buffer[] = [];

    idListItems.push(generateIdList(itemData));

    // prefixRoot + targetRoot + endOfString entry
    idListItems.push(
        generateIdList(Buffer.concat([prefixRoot, targetRootBuf, endOfString]))
    );

    // optional target leaf
    if (targetLeafStr && targetLeafStr.length) {
        const leafBuf = strToAsciiBuffer(targetLeafStr);
        idListItems.push(
            generateIdList(Buffer.concat([prefixOfTarget, leafBuf, endOfString]))
        );
    }

    // Combine idListItems into a single buffer, then wrap with outer idlist size header
    const combinedIdListItems = Buffer.concat(idListItems);
    const idList = generateIdList(combinedIdListItems);

    // Compose final data blob
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
 * Create a shortcut file as a Blob.
 *
 * @export
 * @param {Options} options 
 * @returns {Blob} 
 * @throws Will throw an Error on:
 * - Missing linkTarget option.
 * - Invalid network path in linkTarget.
 * - Invalid UNC or missing drive letter in linkTarget
 */
export function createLinkBlob(options: Options): Blob {
    const buf = createLinkBuffer(options);
    return new Blob([new Uint8Array(buf)], { type: "application/x-ms-shortcut" });
}

/*const test = createLinkBlob({
    linkTarget: "C:\\Program Files\\Google\\chrome\\Application\\chrome.exe",
    comment: "Chrome Test",
});

await Bun.write("./outdir/test.lnk", test);*/
