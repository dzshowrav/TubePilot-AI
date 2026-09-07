import { GatewayError } from './errors.js';

const tags = ['<think>', '</think>', '<analysis>', '</analysis>'];

/**
 * Defense in depth for compatible models that put private reasoning tags in content.
 * Separate reasoning/reasoning_content fields are never consumed. This is not a general moderator.
 */
export class FinalAnswerFilter {
  #pending = '';
  #stack: string[] = [];

  push(chunk: string): string {
    this.#pending += chunk;
    let output = '';
    const regex = /<\/?(think|analysis)>/gi;
    let offset = 0;
    for (const match of this.#pending.matchAll(regex)) {
      if (!this.#stack.length) output += this.#pending.slice(offset, match.index);
      const name = match[1]!.toLowerCase();
      if (match[0].startsWith('</')) {
        if (this.#stack.length && this.#stack.at(-1) !== name) throw new GatewayError('INVALID_RESPONSE');
        this.#stack.pop();
      } else this.#stack.push(name);
      offset = match.index + match[0].length;
    }
    const remaining = this.#pending.slice(offset);
    const lastBracket = remaining.lastIndexOf('<');
    const possibleTag = lastBracket === -1 ? '' : remaining.slice(lastBracket).toLowerCase();
    const hold = possibleTag && tags.some(tag => tag.startsWith(possibleTag)) ? possibleTag.length : 0;
    if (!this.#stack.length) output += remaining.slice(0, remaining.length - hold);
    this.#pending = hold ? remaining.slice(-hold) : '';
    return output;
  }

  finish(): string {
    // Never flush an unterminated hidden section or a partial opening delimiter.
    if (this.#stack.length || this.#pending) throw new GatewayError('INVALID_RESPONSE');
    return '';
  }
}
