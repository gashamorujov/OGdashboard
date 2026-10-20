let element: HTMLAudioElement | null = null;

/** Single shared audio element for the whole app. */
export function getAudio(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = 'metadata';
  }
  return element;
}
