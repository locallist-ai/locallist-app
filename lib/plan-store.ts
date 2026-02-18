import type { BuilderResponse } from './types';

let _preview: BuilderResponse | null = null;

export const setPreviewPlan = (r: BuilderResponse | null) => {
  _preview = r;
};

export const getPreviewPlan = () => _preview;
