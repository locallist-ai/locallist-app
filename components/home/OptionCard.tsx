import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceChip } from '../ui/design-system';
import type { StepOption } from './constants';

// Wrapper wizard-específico sobre ChoiceChip (design-system). Mantenemos esta
// pieza porque el wizard opera con StepOption + labelKey (i18n) en vez del
// `label` ya traducido que acepta ChoiceChip.

interface OptionCardProps {
  option: StepOption;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

export const OptionCard: React.FC<OptionCardProps> = React.memo(({ option, index, selected, onSelect }) => {
  const { t } = useTranslation();
  return (
    <ChoiceChip
      emoji={option.emoji}
      iconName={option.iconName}
      label={t(option.labelKey)}
      selected={selected}
      onPress={onSelect}
      index={index}
    />
  );
});
