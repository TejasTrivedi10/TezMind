import { extractJson, validateScreensOutput } from '../validator';

describe('extractJson & validator', () => {
  it('extracts JSON inside markdown fences', () => {
    const raw = '```json\n{"screens":[{"id":"s1","schemaVersion":1,"name":"Main","width":393,"height":852,"root":{"id":"r1","type":"frame","name":"Root","props":{},"style":{"backgroundColor":"$background"},"sizing":{"width":{"mode":"fill"},"height":{"mode":"fill"}},"layout":{"direction":"column","gap":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"mainAxis":"start","crossAxis":"stretch"},"children":[{"id":"t1","type":"text","name":"Title","props":{"content":"Hello"},"style":{"color":"$text"},"sizing":{"width":{"mode":"hug"},"height":{"mode":"hug"}}}]}}]}\n```';
    const json = extractJson(raw);
    const result = validateScreensOutput(json);
    if (!result.ok) {
      console.log('Validation failure details:', result.errors);
    }
    expect(result.ok).toBe(true);
  });

  it('auto-replaces open brackets for truncated JSON output', () => {
    const raw = '{"screens":[{"id":"s1","name":"Main","width":393,"height":852,"root":{"id":"r1","type":"frame","name":"Root","props":{},"style":{},"sizing":{"width":{"mode":"fill"},"height":{"mode":"fill"}},"layout":{"direction":"column","gap":0,"padding":{"top":0,"right":0,"bottom":0,"left":0},"mainAxis":"start","crossAxis":"stretch"},"children":[]';
    const json = extractJson(raw);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
