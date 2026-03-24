export function getOutboundBurnerHandoffText(sdrName: string): string {
  return `Great! CC'ing ${sdrName}. He can help you get started, and answer any questions.

You're in good hands!
Max`;
}

export function getOutboundBurnerHandoffHtml(sdrName: string): string {
  return `
    <p>Great! CC'ing ${sdrName}. He can help you get started, and answer any questions.</p>
    <p>You're in good hands!<br>Max</p>
  `;
}
