export function buildPanel(title: string, lines: string[]): string[] {
  const innerWidth = Math.max(
    56,
    title.length + 4,
    ...lines.map((line) => line.length),
  );
  const topRuleWidth = Math.max(0, innerWidth - title.length - 2);

  return [
    `╭─ ${title} ${"─".repeat(topRuleWidth)}╮`,
    ...lines.map((line) => `│ ${line}${" ".repeat(innerWidth - line.length)} │`),
    `╰${"─".repeat(innerWidth + 2)}╯`,
  ];
}

export function buildSectionTitle(title: string): string[] {
  return [title, `${"─".repeat(title.length)}`];
}
