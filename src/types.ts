import * as z from 'zod/v4';

export const FormName = z.string().min(1).max(64).regex(/^(?:[ZY][A-Z0-9_]*|\/[A-Z][A-Z0-9_]*\/[A-Z][A-Z0-9_]*)$/i, 'Expected Z_FORM, Y_FORM or /CUSTOM/FORM');
export const FormPattern = z.string().min(1).max(64).regex(/^[A-Z0-9_/*?]+$/i);
export const destinationIdSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,31}$/);
export const Parameter = z.object({
  name: z.string(), direction: z.enum(['IMPORTING', 'EXPORTING', 'CHANGING', 'TABLES']),
  type: z.string(), description: z.string().optional()
});
export const FormSummary = z.object({
  name: z.string(), description: z.string(), package: z.string(),
  interfaceName: z.string().nullable(), active: z.boolean()
});
export const FormMetadata = FormSummary.extend({
  originalLanguage: z.string(), lastChangedAt: z.string().nullable(),
  technology: z.enum(['SFP_CLASSIC', 'XDP_TEMPLATE'])
});
export const FormInterface = z.object({
  formName: z.string(), interfaceName: z.string(),
  interfaceType: z.enum(['ABAP_DDIC', 'XML_SCHEMA', 'SMARTFORMS_COMPATIBLE', 'UNKNOWN']),
  parameters: z.array(Parameter), comments: z.string().optional()
});
export type ContextNode = {
  name: string;
  kind: 'FIELD' | 'STRUCTURE' | 'TABLE' | 'TEXT' | 'CONDITION' | 'OTHER';
  binding?: string | undefined;
  children?: ContextNode[] | undefined;
};
export const ContextNodeSchema: z.ZodType<ContextNode> = z.lazy(() => z.object({
  name: z.string(), kind: z.enum(['FIELD', 'STRUCTURE', 'TABLE', 'TEXT', 'CONDITION', 'OTHER']),
  binding: z.string().optional(), children: z.array(ContextNodeSchema).optional()
}));
export const FormContext = z.object({ formName: z.string(), nodes: z.array(ContextNodeSchema) });
export const FormLayout = z.object({ formName: z.string(), xdpBase64: z.string() });
export type Summary = z.infer<typeof FormSummary>;
export type Metadata = z.infer<typeof FormMetadata>;
export type Interface = z.infer<typeof FormInterface>;
export type Context = z.infer<typeof FormContext>;
export type Layout = z.infer<typeof FormLayout>;

export interface FormProvider {
  listCustomForms(destination: string, pattern: string, limit: number): Promise<Summary[]>;
  getFormMetadata(destination: string, name: string): Promise<Metadata>;
  getFormInterface(destination: string, name: string): Promise<Interface>;
  getFormContext(destination: string, name: string): Promise<Context>;
  getFormLayout(destination: string, name: string): Promise<Layout>;
}
