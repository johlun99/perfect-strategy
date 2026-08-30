import { SoundManager } from './game/ui/audio';

const sound = new SoundManager();
sound.preload(['click']);

document.querySelectorAll<HTMLElement>('[data-sound="click"]').forEach((el) => {
    el.addEventListener('click', () => sound.play('click'));
});
