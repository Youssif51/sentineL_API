export function randomJitter(maxMs = 30_000): Promise<void> {
    const delay = Math.floor(Math.random() * maxMs);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
  