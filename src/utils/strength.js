const kilogramFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 1,
});

export function formatKilograms(value) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? `${kilogramFormatter.format(numericValue)} kg` : '–';
}
