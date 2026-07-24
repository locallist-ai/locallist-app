/**
 * ChoiceChip idle border contract. The chip lives in TWO backdrops:
 *  - the wizard, over a DARK hero image → idle border must stay the light
 *    `rgba(255,255,255,0.3)` default (no regression from the onboarding relight).
 *  - the light onboarding → callers pass `idleBorderColor` to get a dark, subtle
 *    border that reads on the cream backdrop.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ChoiceChip } from '../design-system/ChoiceChip';

// Collect every flattened `borderColor` present in the rendered tree so we can
// assert the card's idle border without coupling to internal testIDs.
function borderColors(node: unknown): string[] {
  const out: string[] = [];
  const visit = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visit);
    const flat = n.props?.style ? StyleSheet.flatten(n.props.style) : null;
    if (flat?.borderColor) out.push(flat.borderColor as string);
    if (Array.isArray(n.children)) n.children.forEach(visit);
  };
  visit(node);
  return out;
}

describe('ChoiceChip — idle border', () => {
  it('keeps the light default border (wizard / dark backdrop) when idleBorderColor is omitted', () => {
    const { toJSON } = render(
      <ChoiceChip label="Food" emoji="🍜" selected={false} onPress={jest.fn()} />,
    );
    const colors = borderColors(toJSON());
    expect(colors).toContain('rgba(255, 255, 255, 0.3)');
    expect(colors).not.toContain('rgba(15, 23, 42, 0.15)');
  });

  it('applies a dark idle border (onboarding / light backdrop) when idleBorderColor is set', () => {
    const { toJSON } = render(
      <ChoiceChip
        label="Food"
        emoji="🍜"
        selected={false}
        onPress={jest.fn()}
        idleBorderColor="rgba(15, 23, 42, 0.15)"
      />,
    );
    const colors = borderColors(toJSON());
    expect(colors).toContain('rgba(15, 23, 42, 0.15)');
    // The dark override must replace the light default, not stack under it.
    expect(colors).not.toContain('rgba(255, 255, 255, 0.3)');
  });

  it('ignores idleBorderColor while selected (selected border wins)', () => {
    const { toJSON } = render(
      <ChoiceChip
        label="Food"
        emoji="🍜"
        selected
        onPress={jest.fn()}
        idleBorderColor="rgba(15, 23, 42, 0.15)"
      />,
    );
    const colors = borderColors(toJSON());
    expect(colors).not.toContain('rgba(15, 23, 42, 0.15)');
  });
});
