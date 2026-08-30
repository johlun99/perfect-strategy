import type { Card, Rank } from '../engine/card';

const RANK_NAME: Record<Rank, string> = {
    A: 'ace', J: 'jack', Q: 'queen', K: 'king',
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9', '10': '10',
};

const BASE = '/assets/cards';

export function cardImageUrl(card: Card): string {
    return `${BASE}/${RANK_NAME[card.rank]}_of_${card.suit}.svg`;
}

export const CARD_BACK_URL = `${BASE}/back.svg`;

/** A face-up card element, optionally with the dealt-in animation. */
export function createCardEl(card: Card, dealing = true): HTMLElement {
    const el = document.createElement('div');
    el.className = 'card' + (dealing ? ' card--dealing' : '');
    const img = document.createElement('img');
    img.src = cardImageUrl(card);
    img.alt = `${card.rank} of ${card.suit}`;
    el.append(img);
    return el;
}

/** A face-down card that can later be flipped to reveal `card`. */
export function createFaceDownEl(dealing = true): HTMLElement {
    const el = document.createElement('div');
    el.className = 'card flip' + (dealing ? ' card--dealing' : '');

    const back = document.createElement('div');
    back.className = 'back';
    back.style.backgroundImage = `url(${CARD_BACK_URL})`;

    const face = document.createElement('div');
    face.className = 'face';

    el.append(back, face);
    return el;
}

/** Reveal a face-down card by setting its face image and flipping it. */
export function revealFaceDown(el: HTMLElement, card: Card): void {
    const face = el.querySelector<HTMLElement>('.face');
    if (face) face.style.backgroundImage = `url(${cardImageUrl(card)})`;
    // next frame so the background paints before the flip transition runs
    requestAnimationFrame(() => el.classList.add('revealed'));
}
