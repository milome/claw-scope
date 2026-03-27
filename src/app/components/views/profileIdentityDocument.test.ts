import { describe, expect, it } from 'vitest';

import { applyIdentityMetaToDocument } from './profileIdentityDocument';

describe('applyIdentityMetaToDocument', () => {
  it('updates existing Name and Avatar fields in IDENTITY.md', () => {
    const original = ['- Name: Old Agent', '- Avatar: https://old.example/avatar.png', '- Emoji: 🦞', '', 'Body line'].join('\n');

    const next = applyIdentityMetaToDocument(original, {
      name: 'New Agent',
      avatar: 'https://new.example/avatar.png',
    });

    expect(next).toContain('- Name: New Agent');
    expect(next).toContain('- Avatar: https://new.example/avatar.png');
    expect(next).toContain('- Emoji: 🦞');
    expect(next).toContain('Body line');
  });

  it('removes cleared fields while preserving the rest of the document', () => {
    const original = ['- Name: Old Agent', '- Avatar: https://old.example/avatar.png', '- Emoji: 🦞', '', 'Body line'].join('\n');

    const next = applyIdentityMetaToDocument(original, {
      name: '',
      avatar: '',
    });

    expect(next).not.toContain('Name:');
    expect(next).not.toContain('Avatar:');
    expect(next).toContain('- Emoji: 🦞');
    expect(next).toContain('Body line');
  });

  it('creates a minimal field block when the document is empty', () => {
    const next = applyIdentityMetaToDocument('', {
      name: 'Fresh Agent',
      avatar: 'https://new.example/avatar.png',
    });

    expect(next).toBe(['- Name: Fresh Agent', '- Avatar: https://new.example/avatar.png'].join('\n'));
  });
});
