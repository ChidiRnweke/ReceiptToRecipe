/** Small line drawings from the door prototype, used by empty states and paper tiles. */
export type DoorArtName =
	| 'plate'
	| 'basket'
	| 'jar'
	| 'book'
	| 'receipt'
	| 'cal'
	| 'camReceipt'
	| 'camBook'
	| 'pencilCard';

/** Drawings for empty states (120 × 90). */
export type EmptyArtName = Extract<
	DoorArtName,
	'plate' | 'basket' | 'jar' | 'book' | 'cal' | 'receipt'
>;
