import type { Branded } from './branded';

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export type UUIDKey = Branded<string, 'UUIDKey'>;

/** converts a packed [u8, 16] uuid to a key string */
export function uuid_key(b: Uint8Array): UUIDKey {
	if (!(b instanceof Uint8Array)) {
		console.error(b);
	}
	return String.fromCharCode.apply(null, b as unknown as number[]) as UUIDKey;
}

const DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DASHED_CI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLAIN_CI = /^[0-9a-f]{32}$/i;

/** true only for the canonical form uuid_to_string produces (lowercase, dashed) */
export function is_UUIDString(value: string): value is UUIDString {
	return value.length === 36 && DASHED.test(value);
}

/** returns null when the string can't be parsed (dashes optional, any case) */
export function string_to_uuid(s: string): Uint8Array | null {
	const n = s.length;
	if (!((n === 36 && DASHED_CI.test(s)) || (n === 32 && PLAIN_CI.test(s)))) return null;
	const out = new Uint8Array(16);
	write_uuid(s, out, 0);
	return out;
}

export type UUIDString = Branded<string, 'UUIDString'>;
/** converts a packed [u8, 16] uuid to a display string */
export function uuid_to_string(b: Uint8Array): UUIDString {
	return (HEX[b[0]] +
		HEX[b[1]] +
		HEX[b[2]] +
		HEX[b[3]] +
		'-' +
		HEX[b[4]] +
		HEX[b[5]] +
		'-' +
		HEX[b[6]] +
		HEX[b[7]] +
		'-' +
		HEX[b[8]] +
		HEX[b[9]] +
		'-' +
		HEX[b[10]] +
		HEX[b[11]] +
		HEX[b[12]] +
		HEX[b[13]] +
		HEX[b[14]] +
		HEX[b[15]]) as UUIDString;
}

/** parses a uuid string (dashes optional) straight into out[offset..offset+16] */
export function write_uuid(s: string, out: Uint8Array, offset: number): void {
	let o = offset;
	let hi = -1;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		if (c === 45) continue; // '-'
		const v = c <= 57 ? c - 48 : (c | 32) - 87; // 0-9, a-f, A-F
		if (hi < 0) hi = v;
		else {
			out[o++] = (hi << 4) | v;
			hi = -1;
		}
	}
}
