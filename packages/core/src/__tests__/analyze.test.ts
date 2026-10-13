import { analyze } from '../html/archetypes';

describe('analyze()', () => {
  test('chat prompt detects roles', () => {
    const a = analyze('Generate Chat Screen UI: bottom show input box with send button');
    expect(a.archetype?.id).toBe('chat');
    expect(a.requiredRoles).toEqual(
      expect.arrayContaining(['app-bar', 'message-list', 'composer', 'composer-input', 'send-button'])
    );
  });

  test('login "input box" does not create a composer', () => {
    expect(analyze('login screen with input box for email').requiredRoles).not.toContain('composer-input');
  });

  test('bottom nav detected from prompt', () => {
    const a = analyze('Dashboard with bottom navigation');
    expect(a.requiredRoles).toContain('bottom-nav');
  });

  test('search field detected from prompt', () => {
    const a = analyze('Product list with search bar');
    expect(a.requiredRoles).toContain('search-field');
  });
});
