export const unique = <T>(values: T[]) => Array.from(new Set(values));

export const countBy = <T extends string>(values: T[]) =>
  values.reduce<Record<T, number>>(
    (acc, value) => ({ ...acc, [value]: (acc[value] ?? 0) + 1 }),
    {} as Record<T, number>,
  );
