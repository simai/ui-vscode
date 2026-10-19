import { Rgba } from './frameworkTypes';

const round = (value: number): number => Math.round(value * 10000) / 10000;

const named: Record<string, Rgba> = {
    transparent: [0, 0, 0, 0],
    white: [1, 1, 1, 1],
    black: [0, 0, 0, 1],
};

/** Parses hex, rgb()/rgba() and a few keywords. Returns channels in 0..1. */
export function parseColor(value: string): Rgba | null {
    const text = value.trim().toLowerCase();
    if (named[text]) return named[text];

    const hex = text.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/)?.[1];
    if (hex) {
        const full = hex.length <= 4
            ? hex.split('').map(char => char + char).join('')
            : hex;
        const channels = full.match(/../g)!.map(pair => parseInt(pair, 16) / 255);
        return [
            round(channels[0]),
            round(channels[1]),
            round(channels[2]),
            round(channels[3] ?? 1),
        ];
    }

    const fn = text.match(/^rgba?\(([^()]*)\)$/)?.[1];
    if (fn) {
        const parts = fn.split(/[\s,/]+/).filter(Boolean);
        if (parts.length !== 3 && parts.length !== 4) return null;
        const channel = (part: string): number => part.endsWith('%')
            ? parseFloat(part) / 100
            : parseFloat(part) / 255;
        const alpha = parts[3] === undefined
            ? 1
            : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
        const result: Rgba = [
            channel(parts[0]),
            channel(parts[1]),
            channel(parts[2]),
            alpha,
        ];
        if (result.some(item => !Number.isFinite(item))) return null;
        return result.map(item => round(Math.min(1, Math.max(0, item)))) as Rgba;
    }
    return null;
}

/** Formats a colour the way the VS Code suggest widget recognises it. */
export function formatColor([red, green, blue, alpha]: Rgba): string {
    const byte = (value: number): number => Math.round(value * 255);
    if (alpha >= 1) {
        return `#${[red, green, blue]
            .map(value => byte(value).toString(16).padStart(2, '0'))
            .join('')}`;
    }
    const opacity = Number(alpha.toFixed(2)).toString().replace(/^0\./, '0.');
    return `rgba(${byte(red)}, ${byte(green)}, ${byte(blue)}, ${opacity})`;
}
