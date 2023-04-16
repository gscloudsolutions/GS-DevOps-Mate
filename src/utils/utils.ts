export function castArray(value: unknown): unknown[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}
