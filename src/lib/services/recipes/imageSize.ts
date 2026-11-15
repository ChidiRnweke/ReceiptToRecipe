/** Width and height in pixels, read from an image's header. */
export interface ImageSize {
	width: number;
	height: number;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
	return signature.every((byte, index) => bytes[offset + index] === byte);
}

function uint16be(bytes: Uint8Array, at: number): number {
	return (bytes[at] << 8) | bytes[at + 1];
}

function uint32be(bytes: Uint8Array, at: number): number {
	return ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
}

function uint24le(bytes: Uint8Array, at: number): number {
	return bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
}

function pngSize(bytes: Uint8Array): ImageSize | null {
	if (bytes.length < 24) return null;
	return { width: uint32be(bytes, 16), height: uint32be(bytes, 20) };
}

/** JPEG keeps its size in the first start-of-frame segment (SOF0–SOF15, except DHT/JPG/DAC). */
function jpegSize(bytes: Uint8Array): ImageSize | null {
	let at = 2;
	while (at + 9 < bytes.length) {
		if (bytes[at] !== 0xff) return null;
		const marker = bytes[at + 1];
		if (marker === 0xff) {
			at += 1;
			continue;
		}
		const length = uint16be(bytes, at + 2);
		const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
		if (isFrame) return { height: uint16be(bytes, at + 5), width: uint16be(bytes, at + 7) };
		at += 2 + length;
	}
	return null;
}

function webpSize(bytes: Uint8Array): ImageSize | null {
	if (bytes.length < 30) return null;
	const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
	if (chunk === 'VP8X') return { width: uint24le(bytes, 24) + 1, height: uint24le(bytes, 27) + 1 };
	if (chunk === 'VP8 ') {
		return {
			width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
			height: (bytes[28] | (bytes[29] << 8)) & 0x3fff
		};
	}
	if (chunk === 'VP8L') {
		const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
		return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
	}
	return null;
}

/** The size of a PNG, JPEG or WebP image, or null when the bytes are none of those. */
export function imageSize(bytes: Uint8Array): ImageSize | null {
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return pngSize(bytes);
	if (startsWith(bytes, [0xff, 0xd8])) return jpegSize(bytes);
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return webpSize(bytes);
	}
	return null;
}
