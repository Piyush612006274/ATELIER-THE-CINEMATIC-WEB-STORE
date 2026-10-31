import { z } from 'zod';

export const siteCopyOverridesSchema = z.record(z.string().min(1).max(400), z.object({
  original: z.string().max(1800), text: z.string().max(4000), route: z.string().max(300), scope: z.string().max(1600).optional(),
})).refine(value => Object.keys(value).length <= 5000, 'TOO_MANY_TEXT_EDITS');
export const siteMediaOverridesSchema = z.record(z.string().min(1).max(400), z.object({
  original: z.string().max(4096), src: z.string().max(4096), route: z.string().max(300),
})).refine(value => Object.keys(value).length <= 2000, 'TOO_MANY_IMAGE_EDITS');
// Existing flat theme/payment settings remain valid. Website editor maps have
// explicit bounded shapes so nested edits survive validation and persistence.
export const siteSettingValueSchema = z.union([
  z.string().max(2000000), z.number().finite(), z.boolean(),
  z.record(z.string().max(60), z.union([z.string().max(200), z.number().finite(), z.boolean()])),
  siteCopyOverridesSchema, siteMediaOverridesSchema,
]);
